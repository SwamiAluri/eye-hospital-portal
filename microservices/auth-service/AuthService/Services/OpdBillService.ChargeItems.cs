using AuthService.DTOs.Billing;
using AuthService.Models.Domain;
using AuthService.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public partial class OpdBillService
{
    /// <summary>
    /// BILL-032. Atomic batch of catalog-priced lines for OT/inventory posters.
    /// Caller-supplied unitPriceOverride is ignored (FHIR ChargeItem: the posting system does not apply pricing).
    /// IsCredit posts the catalog price as a negative line; it never deletes an existing row.
    /// </summary>
    public async Task<ChargeItemsResultDto> ChargeItemsAsync(ChargeItemsRequest request)
    {
        if (_billItems is null || _catalog is null)
            throw new InvalidOperationException("Charge posting is not configured.");

        if (request.TenantId == Guid.Empty)
            throw new ArgumentException("TenantId is required.");
        if (request.PatientJourneyId == Guid.Empty)
            throw new ArgumentException("PatientJourneyId is required.");
        if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
            throw new ArgumentException("IdempotencyKey is required.");
        if (request.Lines is null || request.Lines.Count == 0)
            throw new ArgumentException("At least one charge line is required.");

        var batchKey = request.IdempotencyKey.Trim();
        var bill = await _context.OpdBills
            .FirstOrDefaultAsync(b =>
                b.PatientJourneyId == request.PatientJourneyId
                && b.TenantId == request.TenantId
                && b.DeletedAt == null);

        if (bill is null)
        {
            var cancelled = await _context.OpdBills
                .FirstOrDefaultAsync(b =>
                    b.PatientJourneyId == request.PatientJourneyId
                    && b.TenantId == request.TenantId
                    && (b.DeletedAt != null
                        || b.Status != null && b.Status.ToLower() == "cancelled"));
            if (cancelled is not null)
                throw new ChargePostingException(
                    ChargePostingCodes.BillCancelled,
                    "Bill is cancelled; queue an adjustment on a replacement bill.",
                    cancelled.Id);
            throw new ChargePostingException(ChargePostingCodes.BillNotFound, "Inpatient bill not found.", null);
        }

        if (string.Equals(bill.Status, "cancelled", StringComparison.OrdinalIgnoreCase))
            throw new ChargePostingException(
                ChargePostingCodes.BillCancelled,
                "Bill is cancelled; queue an adjustment on a replacement bill.",
                bill.Id);

        if (bill.IsFinalized)
            throw new ChargePostingException(
                ChargePostingCodes.BillFinalized,
                "Bill is finalized; queue a post-finalize correction.",
                bill.Id);

        if (bill.IsLocked)
            throw new ChargePostingException(
                ChargePostingCodes.BillLocked,
                "Bill is locked; queue a post-finalize correction.",
                bill.Id);

        var userId = request.ActorUserId != Guid.Empty ? request.ActorUserId : bill.CreatedByUserId;
        var isConsumableOnly = request.Lines.All(l =>
            BillChargeSource.Normalize(l.SourceType) == BillChargeSource.Consumable);

        var packageVariants = new HashSet<Guid>();
        if (isConsumableOnly)
        {
            var ids = await _context.OpdBillItems
                .AsNoTracking()
                .Where(i => i.OpdBillId == bill.Id
                            && i.DeletedAt == null
                            && i.SourceType == BillChargeSource.Package
                            && i.ServiceVariantId != null)
                .Select(i => i.ServiceVariantId!.Value)
                .ToListAsync();
            packageVariants = ids.ToHashSet();
        }

        var payerId = await _context.CcmsCoverageCases.AsNoTracking()
            .Where(c => c.JourneyId == request.PatientJourneyId && c.DeletedAt == null)
            .Select(c => c.InsuranceProviderId)
            .FirstOrDefaultAsync();

        var iolCoverage = await LoadIolCoverageAsync(bill, request.TenantId, request.PatientJourneyId);
        var iolCoveredThisBatch = 0;
        var consumableById = await LoadConsumableSnapshotsAsync(request);

        var resolved = new List<ResolvedChargeLine>();
        var failed = new List<string>();
        var failCode = ChargePostingCodes.UnknownCatalogItem;

        for (var i = 0; i < request.Lines.Count; i++)
        {
            var line = request.Lines[i];
            var qty = line.Quantity <= 0 ? 1 : (int)Math.Max(1, Math.Round(line.Quantity));
            var key = LineIdempotencyKey(batchKey, line, i);
            var catalog = await ResolveLineAsync(request.TenantId, line, payerId);
            var action = ClassifyLine(isConsumableOnly, catalog, packageVariants);
            if (line.IsCredit)
            {
                // Credits of a Posted extra must still post when a package line later
                // overlaps the same variant. Package overlap only suppresses debits.
                action = catalog.CanPost
                    ? ChargeLineAction.Post
                    : (isConsumableOnly ? ChargeLineAction.Exception : ChargeLineAction.Fail);
            }
            else if (BillChargeSource.Normalize(line.SourceType) == BillChargeSource.Consumable
                     && line.SourceRefId is Guid consumableId
                     && consumableId != Guid.Empty
                     && consumableById.TryGetValue(consumableId, out var consumableSnap)
                     && IsConsumableWithdrawn(consumableSnap)
                     && !IsBilledConsumable(consumableSnap.ChargeStatus))
            {
                action = ChargeLineAction.Suppress;
            }

            var unprovenIol = false;
            if (!line.IsCredit
                && BillChargeSource.Normalize(line.SourceType) == BillChargeSource.Implant)
            {
                if (line.SourceRefId is Guid usageId
                    && usageId != Guid.Empty
                    && iolCoverage.CoveredUsageIds.Contains(usageId))
                {
                    action = ChargeLineAction.Suppress;
                }
                else
                {
                    var snap = iolCoverage with
                    {
                        CoveredUsagesAlready = iolCoverage.CoveredUsagesAlready + iolCoveredThisBatch,
                    };
                    var klass = IolFinancialClassifier.Classify(
                        catalog.CanPost, catalog.ServiceVariantId, line.ItemId, line.ServiceCode, snap);
                    if (klass == IolFinancialClassifier.Class.Covered)
                    {
                        action = ChargeLineAction.Suppress;
                        iolCoveredThisBatch++;
                    }
                    else if (klass == IolFinancialClassifier.Class.Unproven)
                    {
                        action = ChargeLineAction.Exception;
                        unprovenIol = true;
                    }
                }
            }

            resolved.Add(new ResolvedChargeLine(line, key, qty, catalog, action, unprovenIol));

            if (action == ChargeLineAction.Post) continue;
            if (action == ChargeLineAction.Fail)
            {
                failed.Add($"{key}: {catalog.Reason ?? catalog.Kind.ToString()}");
                if (catalog.Kind == ChargeResolveKind.Unpriced)
                    failCode = ChargePostingCodes.UnpricedCatalogItem;
            }
        }

        foreach (var row in resolved.Where(r => r.Action is ChargeLineAction.Fail or ChargeLineAction.Exception))
        {
            await _catalog.EnqueueUnmappedAsync(request.TenantId, new ChargeExceptionEnqueueRequest
            {
                ItemId = row.Line.ItemId,
                SourceType = BillChargeSource.Normalize(row.Line.SourceType),
                SourceRefId = row.Line.SourceRefId,
                OpdBillId = bill.Id,
                PatientJourneyId = request.PatientJourneyId,
                Quantity = row.Quantity,
                EstimatedValue = 0,
                Reason = row.UnprovenIol
                    ? "IOL identity unproven against package inclusion; not posted. Confirm extra vs covered."
                    : row.Result.Reason ?? "Unknown catalog item",
                IdempotencyKey = row.Key,
                Status = row.UnprovenIol ? ChargeExceptionStatus.NeedsAdjustment : null,
            });
        }

        if (failed.Count > 0)
        {
            throw new ChargePostingException(
                failCode,
                "One or more charge lines could not be priced from the catalog. Nothing was posted.",
                bill.Id,
                failed);
        }

        var toPost = resolved.Where(r => r.Action == ChargeLineAction.Post).ToList();
        var staged = new List<StagedBillItem>();
        foreach (var row in toPost)
        {
            decimal? creditPrice = null;
            if (row.Line.IsCredit)
                creditPrice = -row.Result.UnitPrice!.Value;

            staged.Add(await _billItems.StageBillItemAsync(new AddBillItemRequest
            {
                OpdBillId = bill.Id,
                ServiceVariantId = row.Result.ServiceVariantId,
                Quantity = row.Quantity,
                SourceType = row.Line.SourceType,
                SourceRefId = row.Line.SourceRefId,
                IdempotencyKey = row.Key,
                Notes = row.Line.Notes,
                UnitPriceOverride = creditPrice ?? row.Result.UnitPrice,
            }, request.TenantId, userId));
        }

        var anyCreated = staged.Any(s => s.Created);
        if (anyCreated)
        {
            for (var i = 0; i < staged.Count; i++)
            {
                if (!staged[i].Created) continue;
                var credit = toPost[i].Line.IsCredit;
                if (!credit && staged[i].Item.UnitPrice <= 0)
                    throw new ChargePostingException(
                        ChargePostingCodes.UnpricedCatalogItem,
                        "Catalog price was missing at post time. Nothing was posted.",
                        bill.Id);
                if (credit && staged[i].Item.UnitPrice >= 0)
                    throw new ChargePostingException(
                        ChargePostingCodes.UnpricedCatalogItem,
                        "Credit line must post a negative catalog price. Nothing was posted.",
                        bill.Id);
            }

            await ApplyItemisedGrossAsync(bill, userId);

            if (bill.PatientJourneyId is { } journeyId)
            {
                _ccmsOutbox.Enqueue(
                    bill.TenantId,
                    BillingCcmsEventTypes.PatientObligationChanged,
                    bill.Id,
                    new
                    {
                        tenantId = bill.TenantId,
                        journeyId,
                        billId = bill.Id,
                        actorUserId = userId,
                        eventType = BillingRealtimeEvents.PatientObligationChanged,
                        occurredAt = DateTime.UtcNow,
                    },
                    $"{BillingCcmsEventTypes.PatientObligationChanged}:billing:{bill.Id:N}:charges:{batchKey}");
            }

            await StageFinancialAuditAsync(
                userId,
                "ChargeItemsPosted",
                bill.Id,
                null,
                bill.GrossAmount.ToString("F2"),
                batchKey,
                bill.PatientJourneyId);
        }

        await ApplyIolCoveredSlotAsync(bill, userId, request.TenantId, resolved, iolCoverage, iolCoveredThisBatch);
        await ApplyConsumableProjectionsAsync(request.TenantId, resolved, staged, toPost);
        await _context.SaveChangesAsync();

        if (anyCreated)
        {
            NotifyBillingRealtime(
                bill.TenantId,
                BillingRealtimeEvents.PatientObligationChanged,
                bill.Id,
                bill.PatientJourneyId);
        }

        return new ChargeItemsResultDto
        {
            BillId = bill.Id,
            BillNumber = bill.BillNumber,
            Replayed = !anyCreated,
            Items = staged.Select(s => s.Item).ToList(),
            GrossAmount = bill.GrossAmount,
            BalanceDue = bill.BalanceDue,
            SuppressedCount = resolved.Count(r => r.Action == ChargeLineAction.Suppress),
            ExceptionCount = resolved.Count(r => r.Action == ChargeLineAction.Exception),
        };
    }

    private static ChargeLineAction ClassifyLine(
        bool isConsumableOnly, ChargeResolveResult catalog, HashSet<Guid> packageVariants)
    {
        if (!isConsumableOnly)
            return catalog.CanPost ? ChargeLineAction.Post : ChargeLineAction.Fail;

        if (catalog.CanPost
            && catalog.ServiceVariantId is Guid variantId
            && packageVariants.Contains(variantId))
            return ChargeLineAction.Suppress;

        if (catalog.Kind == ChargeResolveKind.NonChargeable)
            return ChargeLineAction.Suppress;

        if (!catalog.CanPost)
            return ChargeLineAction.Exception;

        return ChargeLineAction.Post;
    }

    private async Task ApplyConsumableProjectionsAsync(
        Guid tenantId,
        List<ResolvedChargeLine> resolved,
        List<StagedBillItem> staged,
        List<ResolvedChargeLine> posted)
    {
        var consumable = resolved.Where(r =>
            BillChargeSource.Normalize(r.Line.SourceType) == BillChargeSource.Consumable
            && r.Line.SourceRefId is Guid id && id != Guid.Empty).ToList();
        if (consumable.Count == 0) return;

        var ids = consumable.Select(r => r.Line.SourceRefId!.Value).Distinct().ToList();
        var rows = await _context.InvSurgeryConsumableReads
            .Where(c => c.TenantId == tenantId && ids.Contains(c.Id))
            .ToListAsync();
        if (rows.Count == 0) return;

        var postedByRef = new Dictionary<Guid, StagedBillItem>();
        for (var i = 0; i < posted.Count; i++)
        {
            if (posted[i].Line.SourceRefId is Guid refId && refId != Guid.Empty)
                postedByRef[refId] = staged[i];
        }

        foreach (var row in rows)
        {
            var match = consumable.First(r => r.Line.SourceRefId == row.Id);
            if (match.Action == ChargeLineAction.Post && postedByRef.TryGetValue(row.Id, out var stagedItem))
            {
                if (match.Line.IsCredit)
                {
                    row.ChargeStatus = "Credited";
                }
                else
                {
                    row.ChargeStatus = "Posted";
                    row.ChargeItemId = stagedItem.Item.Id;
                }
            }
            else if (match.Action == ChargeLineAction.Suppress)
            {
                if (!IsBilledConsumable(row.ChargeStatus))
                {
                    row.ChargeStatus = "Suppressed";
                    row.ChargeItemId = null;
                }
            }
            else if (match.Action == ChargeLineAction.Exception)
            {
                row.ChargeStatus = "Exception";
                row.ChargeItemId = null;
            }
        }
    }

    private async Task<Dictionary<Guid, InvSurgeryConsumableRead>> LoadConsumableSnapshotsAsync(
        ChargeItemsRequest request)
    {
        var ids = request.Lines
            .Where(l => BillChargeSource.Normalize(l.SourceType) == BillChargeSource.Consumable
                        && l.SourceRefId is Guid id && id != Guid.Empty)
            .Select(l => l.SourceRefId!.Value)
            .Distinct()
            .ToList();
        if (ids.Count == 0)
            return new Dictionary<Guid, InvSurgeryConsumableRead>();

        var rows = await _context.InvSurgeryConsumableReads
            .Where(c => c.TenantId == request.TenantId && ids.Contains(c.Id))
            .ToListAsync();
        return rows.ToDictionary(c => c.Id);
    }

    private static bool IsConsumableWithdrawn(InvSurgeryConsumableRead row)
    {
        if (row.DeletedAt != null) return true;
        return row.ConsumableStatus is "Cancelled" or "ReturnPosted";
    }

    private static bool IsBilledConsumable(string? chargeStatus)
        => chargeStatus is "Posted" or "Credited";

    /// <summary>
    /// B5.7B. Persist a newly consumed included slot in the same ChargeItems transaction as the
    /// bill RowVersion bump so a concurrent ImplantUsed cannot also classify Covered.
    /// Replay of an already-Covered usage does not bump.
    /// </summary>
    private async Task ApplyIolCoveredSlotAsync(
        OpdBill bill,
        Guid userId,
        Guid tenantId,
        List<ResolvedChargeLine> resolved,
        IolFinancialClassifier.CoverageSnapshot coverage,
        int iolCoveredThisBatch)
    {
        if (iolCoveredThisBatch <= 0) return;

        var newlyCovered = resolved
            .Where(r => r.Action == ChargeLineAction.Suppress
                        && !r.Line.IsCredit
                        && BillChargeSource.Normalize(r.Line.SourceType) == BillChargeSource.Implant
                        && r.Line.SourceRefId is Guid id
                        && id != Guid.Empty
                        && !coverage.CoveredUsageIds.Contains(id))
            .Select(r => r.Line.SourceRefId!.Value)
            .Distinct()
            .ToList();
        if (newlyCovered.Count == 0) return;

        var rows = await _context.JourneyImplantUsageReads
            .Where(u => u.TenantId == tenantId && newlyCovered.Contains(u.Id) && u.DeletedAt == null)
            .ToListAsync();
        foreach (var row in rows)
            row.ChargeStatus = IolFinancialClassifier.CoveredChargeStatus;

        bill.UpdatedAt = DateTime.UtcNow;
        bill.UpdatedByUserId = userId;
    }

    private enum ChargeLineAction { Post, Fail, Suppress, Exception }

    private sealed record ResolvedChargeLine(
        ChargeItemLineRequest Line,
        string Key,
        int Quantity,
        ChargeResolveResult Result,
        ChargeLineAction Action,
        bool UnprovenIol = false);

    private async Task<IolFinancialClassifier.CoverageSnapshot> LoadIolCoverageAsync(
        OpdBill bill, Guid tenantId, Guid journeyId)
    {
        var packageItems = await _context.Set<OpdBillItem>().AsNoTracking()
            .Where(i => i.OpdBillId == bill.Id && i.DeletedAt == null && i.SourceType == BillChargeSource.Package)
            .ToListAsync();
        var upgradeCount = packageItems.Count(i =>
            IolFinancialClassifier.IsPremiumUpgradeLine(i.ServiceName, i.IdempotencyKey));
        var componentIds = packageItems
            .Where(i => i.SourceRefId is Guid id && id != Guid.Empty)
            .Select(i => i.SourceRefId!.Value)
            .Distinct()
            .ToList();
        var iolComponentIds = new HashSet<Guid>();
        if (componentIds.Count > 0)
        {
            var components = await _context.PackageComponentMaps.AsNoTracking()
                .Where(c => c.TenantId == tenantId && componentIds.Contains(c.Id))
                .Select(c => new { c.Id, c.ComponentKey, c.ComponentName })
                .ToListAsync();
            foreach (var c in components)
            {
                if (IolFinancialClassifier.IsIolInclusionComponent(c.ComponentKey, c.ComponentName))
                    iolComponentIds.Add(c.Id);
            }
        }

        var inclusionItems = packageItems
            .Where(i => i.SourceRefId is Guid id && iolComponentIds.Contains(id))
            .ToList();
        var inclusionVariants = inclusionItems
            .Where(i => i.ServiceVariantId is Guid v && v != Guid.Empty)
            .Select(i => i.ServiceVariantId!.Value)
            .ToHashSet();
        var upgradeIolIds = packageItems
            .Where(i => IolFinancialClassifier.IsPremiumUpgradeLine(i.ServiceName, i.IdempotencyKey)
                        && i.SourceRefId is Guid id && id != Guid.Empty)
            .Select(i => i.SourceRefId!.Value)
            .ToHashSet();

        var counsellingIds = new HashSet<Guid>(upgradeIolIds);
        var session = await ResolveCounselingSessionAsync(tenantId, bill.PatientId, journeyId);
        if (session != null)
        {
            var selected = TryReadSelectedIolId(session.RecommendedProcedures);
            if (selected is Guid sid && sid != Guid.Empty)
                counsellingIds.Add(sid);
            if (session.SelectedPackageId is Guid templateId && templateId != Guid.Empty)
            {
                var templateIol = await _context.CounsellingPackageTemplates.AsNoTracking()
                    .Where(t => t.Id == templateId && t.TenantId == tenantId && t.DeletedAt == null)
                    .Select(t => t.IolId)
                    .FirstOrDefaultAsync();
                if (templateIol is Guid tid && tid != Guid.Empty)
                    counsellingIds.Add(tid);
            }
        }

        var productCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (counsellingIds.Count > 0)
        {
            var codes = await _context.IolMasters.AsNoTracking()
                .Where(m => counsellingIds.Contains(m.Id) && m.ProductCode != null && m.ProductCode != "")
                .Select(m => m.ProductCode!)
                .ToListAsync();
            foreach (var code in codes)
                productCodes.Add(code);
        }

        var coveredUsageIds = (await _context.JourneyImplantUsageReads.AsNoTracking()
            .Where(u => u.TenantId == tenantId
                        && u.JourneyId == journeyId
                        && u.DeletedAt == null
                        && u.UsageStatus == "Implanted"
                        && u.ChargeStatus == IolFinancialClassifier.CoveredChargeStatus)
            .Select(u => u.Id)
            .ToListAsync()).ToHashSet();

        return new IolFinancialClassifier.CoverageSnapshot(
            IolFinancialClassifier.IncludedSlotCount(inclusionItems.Count, upgradeCount),
            coveredUsageIds.Count,
            inclusionVariants,
            counsellingIds,
            productCodes,
            coveredUsageIds);
    }

    private async Task<ChargeResolveResult> ResolveLineAsync(
        Guid tenantId, ChargeItemLineRequest line, Guid? payerId)
    {
        if (line.ServiceVariantId is Guid variantId && variantId != Guid.Empty)
            return await _catalog!.ResolveVariantAsync(tenantId, variantId, payerId: payerId);

        ChargeResolveResult? fromItem = null;
        if (line.ItemId is Guid itemId && itemId != Guid.Empty)
        {
            fromItem = await _catalog!.ResolveItemAsync(tenantId, itemId, payerId: payerId);
            if (fromItem.CanPost || fromItem.Kind == ChargeResolveKind.NonChargeable)
                return fromItem;
        }

        if (!string.IsNullOrWhiteSpace(line.ServiceCode))
        {
            var fromCode = await _catalog!.ResolveByCodeAsync(tenantId, line.ServiceCode.Trim(), payerId: payerId);
            if (fromCode.CanPost || fromItem is null)
                return fromCode;
        }

        return fromItem ?? ChargeResolveResult.Unmapped("serviceVariantId, itemId, or serviceCode is required.");
    }

    private static string LineIdempotencyKey(string batchKey, ChargeItemLineRequest line, int index)
    {
        var source = BillChargeSource.Normalize(line.SourceType);
        if (line.SourceRefId is Guid id && id != Guid.Empty)
            return $"{batchKey}:{source}:{id:N}";
        return $"{batchKey}:{index:D4}";
    }
}
