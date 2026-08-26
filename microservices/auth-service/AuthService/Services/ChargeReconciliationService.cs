using AuthService.Context;
using AuthService.DTOs.Billing;
using AuthService.Models.Domain;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public interface IChargeReconciliationService
{
    Task<ChargeReconciliationReportDto> GetReportAsync(Guid tenantId, DateTime? fromUtc, DateTime? toUtc);
    Task<WastageReportDto> GetWastageAsync(Guid tenantId, DateTime? fromUtc, DateTime? toUtc);
    Task<ChargeCompletenessDto> GetCompletenessAsync(Guid tenantId, Guid? billId, Guid? patientJourneyId);
    Task<UnbilledActivityDto> GetUnbilledActivityAsync(Guid tenantId, Guid? branchId, DateTime fromUtc, DateTime toUtcExclusive);
    Task<IReadOnlyDictionary<Guid, JourneyChargeStatusDto>> GetChargeStatusByJourneyAsync(
        Guid tenantId, IReadOnlyList<Guid> journeyIds);
}

/// <summary>
/// INV-051. Live three-way match of implant usage, stock ledger, and bill lines.
/// Computed on demand (GET is the daily job and the on-demand refresh).
/// Wastage cost is purchase rate from inventory, never a patient charge.
/// </summary>
public sealed class ChargeReconciliationService : IChargeReconciliationService
{
    public const string Implanted = "Implanted";
    public const string OpenedUnused = "Opened_Unused";
    public const string Wasted = "Wasted";
    public const string Posted = "Posted";
    public const string Covered = "Covered";
    public const string Credited = "Credited";
    public const string Exception = "Exception";
    public const string Pending = "Pending";
    public const string Suppressed = "Suppressed";
    public const string CreditPending = "CreditPending";
    public const string UnmappedJourney = "UnmappedJourney";

    private static readonly string[] WriteOffStatuses = [OpenedUnused, Wasted];
    private static readonly string[] IssueTypes = ["OT_ISSUE", "PATIENT_IOL_ISSUE"];
    private static readonly string[] WastageLedgerTypes = ["EXPIRY_WRITE_OFF", "IMPLANT_WASTE"];

    private readonly AppDbContext _db;
    private readonly IChargeCatalogResolver _catalog;

    public ChargeReconciliationService(AppDbContext db, IChargeCatalogResolver catalog)
    {
        _db = db;
        _catalog = catalog;
    }

    public async Task<ChargeReconciliationReportDto> GetReportAsync(Guid tenantId, DateTime? fromUtc, DateTime? toUtc)
    {
        var (from, to) = Range(fromUtc, toUtc);
        var usages = await _db.JourneyImplantUsageReads.AsNoTracking()
            .Where(u => u.TenantId == tenantId && u.DeletedAt == null && u.ScannedAt >= from && u.ScannedAt < to)
            .ToListAsync();
        var bills = await _db.OpdBills.AsNoTracking()
            .Where(b => b.TenantId == tenantId && b.DeletedAt == null)
            .Select(b => new { b.Id, b.BillNumber, b.PatientJourneyId, b.PatientId, b.IsFinalized, b.IsLocked })
            .ToListAsync();
        var billByJourney = bills
            .Where(b => b.PatientJourneyId != null)
            .GroupBy(b => b.PatientJourneyId!.Value)
            .ToDictionary(g => g.Key, g => g.First());
        var billIds = bills.Select(b => b.Id).ToList();
        var items = await _db.OpdBillItems.AsNoTracking()
            .Where(i => billIds.Contains(i.OpdBillId) && i.DeletedAt == null)
            .ToListAsync();
        var implantLines = items.Where(i => i.SourceType == BillChargeSource.Implant && i.UnitPrice > 0).ToList();
        var consumableLines = items.Where(i => i.SourceType == BillChargeSource.Consumable).ToList();
        var packageVariants = items
            .Where(i => i.SourceType == BillChargeSource.Package && i.ServiceVariantId != null)
            .Select(i => (i.OpdBillId, VariantId: i.ServiceVariantId!.Value))
            .ToHashSet();

        var ledgers = await _db.InvStockLedgerReads.AsNoTracking()
            .Where(l => l.TenantId == tenantId && l.DeletedAt == null && l.QuantityOut > 0
                        && l.CreatedAt >= from && l.CreatedAt < to)
            .ToListAsync();
        var consumables = await _db.InvSurgeryConsumableReads.AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null && c.IssuedAt >= from && c.IssuedAt < to)
            .ToListAsync();
        var exceptions = await _db.ChargeExceptions.AsNoTracking()
            .Where(e => e.TenantId == tenantId && e.Status == ChargeExceptionStatus.Open
                        && e.CreatedAt >= from && e.CreatedAt < to)
            .ToListAsync();

        var names = await LoadNamesAsync(tenantId, usages.Select(u => u.PatientId)
            .Concat(bills.Select(b => b.PatientId)).Distinct().ToList());
        var itemNames = await LoadItemNamesAsync(tenantId);

        var implanted = usages.Where(u => u.UsageStatus == Implanted).ToList();

        var bucket1 = new List<ReconciliationRowDto>();
        foreach (var u in implanted.Where(u => u.ChargeStatus is not Posted and not Credited and not Covered))
        {
            billByJourney.TryGetValue(u.JourneyId, out var bill);
            var amount = await CatalogAmountAsync(tenantId, u.ItemId);
            bucket1.Add(new ReconciliationRowDto
            {
                JourneyId = u.JourneyId,
                BillId = bill?.Id,
                BillNumber = bill?.BillNumber,
                PatientId = u.PatientId,
                PatientName = names.GetValueOrDefault(u.PatientId),
                ItemId = u.ItemId,
                ItemName = ItemLabel(u, itemNames),
                SerialNumber = u.SerialNumber,
                SourceType = BillChargeSource.Implant,
                SourceRefId = u.Id,
                Amount = amount,
                Reason = MissingChargeReason(u.ChargeStatus, bill?.IsFinalized == true || bill?.IsLocked == true),
                OccurredAt = u.ScannedAt,
            });
        }

        var implantedIds = implanted.Select(u => u.Id).ToHashSet();
        var bucket2 = new List<ReconciliationRowDto>();
        foreach (var line in implantLines)
        {
            var matched = line.SourceRefId is Guid id && implantedIds.Contains(id);
            if (matched) continue;
            var bill = bills.FirstOrDefault(b => b.Id == line.OpdBillId);
            bucket2.Add(new ReconciliationRowDto
            {
                JourneyId = bill?.PatientJourneyId,
                BillId = line.OpdBillId,
                BillNumber = bill?.BillNumber,
                PatientId = bill?.PatientId,
                PatientName = bill != null ? names.GetValueOrDefault(bill.PatientId) : null,
                ItemId = null,
                ItemName = line.ServiceName,
                SourceType = BillChargeSource.Implant,
                SourceRefId = line.SourceRefId,
                Amount = line.TotalAmount,
                Reason = line.SourceRefId is Guid sid && usages.Any(u => u.Id == sid)
                    ? $"Usage status is {usages.First(u => u.Id == sid).UsageStatus}"
                    : "None found",
                OccurredAt = line.CreatedAt,
            });
        }

        var knownRefs = consumables.Select(c => c.Id.ToString("D"))
            .Concat(consumables.Select(c => c.Id.ToString("N")))
            .Concat(usages.Where(u => u.InventoryTxnId != null).Select(u => u.InventoryTxnId!.Value.ToString("D")))
            .Concat(usages.Select(u => u.Id.ToString("D")))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var knownLedgerIds = usages.Where(u => u.InventoryTxnId != null).Select(u => u.InventoryTxnId!.Value).ToHashSet();

        var bucket3 = new List<ReconciliationRowDto>();
        foreach (var row in ledgers.Where(l => IssueTypes.Contains(l.TransactionType, StringComparer.OrdinalIgnoreCase)))
        {
            var matched = knownLedgerIds.Contains(row.Id)
                || (!string.IsNullOrWhiteSpace(row.ReferenceId) && knownRefs.Contains(row.ReferenceId));
            if (matched) continue;
            bucket3.Add(new ReconciliationRowDto
            {
                ItemId = row.ItemId,
                ItemName = itemNames.GetValueOrDefault(row.ItemId, row.ItemId.ToString()),
                SerialNumber = row.ReferenceNumber,
                SourceType = row.TransactionType,
                SourceRefId = Guid.TryParse(row.ReferenceId, out var rid) ? rid : null,
                Amount = 0,
                Reason = "Stock out with no clinical usage record",
                OccurredAt = row.CreatedAt,
            });
        }

        var bucket4 = new List<ReconciliationRowDto>();
        foreach (var line in consumableLines.Where(l => l.ServiceVariantId != null && l.UnitPrice > 0))
        {
            if (!packageVariants.Contains((line.OpdBillId, line.ServiceVariantId!.Value))) continue;
            var bill = bills.FirstOrDefault(b => b.Id == line.OpdBillId);
            bucket4.Add(new ReconciliationRowDto
            {
                JourneyId = bill?.PatientJourneyId,
                BillId = line.OpdBillId,
                BillNumber = bill?.BillNumber,
                PatientId = bill?.PatientId,
                PatientName = bill != null ? names.GetValueOrDefault(bill.PatientId) : null,
                ItemName = line.ServiceName,
                SourceType = BillChargeSource.Consumable,
                SourceRefId = line.SourceRefId,
                Amount = line.TotalAmount,
                Reason = "Package already covers this variant",
                OccurredAt = line.CreatedAt,
            });
        }

        var bucket5 = exceptions
            .GroupBy(e => e.ItemId)
            .Select(g => new ReconciliationRowDto
            {
                ItemId = g.Key,
                ItemName = g.Key is Guid id ? itemNames.GetValueOrDefault(id, "Unmapped item") : "Unmapped item",
                SourceType = g.First().SourceType,
                Amount = g.Sum(x => x.EstimatedValue),
                Reason = $"{g.Count()} open exception(s)",
                OccurredAt = g.Max(x => x.CreatedAt),
            })
            .ToList();

        return new ChargeReconciliationReportDto
        {
            FromUtc = from,
            ToUtc = to,
            GeneratedAt = DateTime.UtcNow,
            Buckets =
            [
                Bucket(1, "implanted_not_charged", "Implanted, not charged", bucket1),
                Bucket(2, "charged_not_implanted", "Charged, not implanted", bucket2),
                Bucket(3, "stock_out_no_usage", "Stock out, no usage recorded", bucket3),
                Bucket(4, "package_consumable_overlap", "Package / consumable overlap", bucket4),
                Bucket(5, "unmapped_items", "Unmapped items", bucket5),
            ],
            ImplantedNotCharged = bucket1,
            ChargedNotImplanted = bucket2,
            StockOutNoUsage = bucket3,
            PackageConsumableOverlap = bucket4,
            UnmappedItems = bucket5,
        };
    }

    public async Task<WastageReportDto> GetWastageAsync(Guid tenantId, DateTime? fromUtc, DateTime? toUtc)
    {
        var (from, to) = Range(fromUtc, toUtc);
        var usages = await _db.JourneyImplantUsageReads.AsNoTracking()
            .Where(u => u.TenantId == tenantId && u.DeletedAt == null
                        && WriteOffStatuses.Contains(u.UsageStatus)
                        && u.ScannedAt >= from && u.ScannedAt < to)
            .ToListAsync();
        var ledger = (await _db.InvStockLedgerReads.AsNoTracking()
            .Where(l => l.TenantId == tenantId && l.DeletedAt == null && l.QuantityOut > 0
                        && l.CreatedAt >= from && l.CreatedAt < to)
            .ToListAsync())
            .Where(l => WastageLedgerTypes.Contains(l.TransactionType, StringComparer.OrdinalIgnoreCase))
            .ToList();
        var rates = await LoadPurchaseRatesAsync(tenantId);
        var itemNames = await LoadItemNamesAsync(tenantId);
        var surgeonIds = usages.Where(u => u.SurgeonUserId != null).Select(u => u.SurgeonUserId!.Value).Distinct().ToList();
        var surgeons = await _db.Users.AsNoTracking()
            .Where(u => surgeonIds.Contains(u.Id))
            .Select(u => new { u.Id, u.FirstName, u.LastName })
            .ToListAsync();
        var surgeonNames = surgeons.ToDictionary(
            u => u.Id,
            u => $"{u.FirstName} {u.LastName}".Trim());

        var matchedLedger = new HashSet<Guid>();
        var lines = new List<WastageLineDto>();
        foreach (var u in usages)
        {
            var ledgerRow = u.InventoryTxnId is Guid txn
                ? ledger.FirstOrDefault(l => l.Id == txn)
                : ledger.FirstOrDefault(l => l.ItemId == u.ItemId && !matchedLedger.Contains(l.Id));
            if (ledgerRow != null) matchedLedger.Add(ledgerRow.Id);
            var cost = ledgerRow != null
                ? (ledgerRow.TotalValue > 0 ? ledgerRow.TotalValue : ledgerRow.UnitRate * ledgerRow.QuantityOut)
                : (u.ItemId is Guid itemId ? rates.GetValueOrDefault(itemId) : 0);
            lines.Add(new WastageLineDto
            {
                OccurredAt = u.ScannedAt,
                JourneyId = u.JourneyId,
                PatientId = u.PatientId,
                SurgeonUserId = u.SurgeonUserId,
                SurgeonName = u.SurgeonUserId is Guid sid ? surgeonNames.GetValueOrDefault(sid) : null,
                ItemId = u.ItemId,
                ItemName = ItemLabel(u, itemNames),
                SerialNumber = u.SerialNumber,
                UsageStatus = u.UsageStatus,
                Reason = string.IsNullOrWhiteSpace(u.WastageReason) ? "(no reason)" : u.WastageReason.Trim(),
                Cost = cost,
                HasLedgerMatch = ledgerRow != null,
            });
        }

        var usageTotal = lines.Sum(l => l.Cost);
        var ledgerTotal = ledger.Sum(l => l.TotalValue > 0 ? l.TotalValue : l.UnitRate * l.QuantityOut);

        return new WastageReportDto
        {
            FromUtc = from,
            ToUtc = to,
            UsageTotalCost = usageTotal,
            LedgerTotalCost = ledgerTotal,
            Delta = usageTotal - ledgerTotal,
            Lines = lines,
            ByReason = Group(lines, l => l.Reason),
            BySurgeon = Group(lines, l => string.IsNullOrWhiteSpace(l.SurgeonName) ? "(unassigned)" : l.SurgeonName!),
            ByItem = Group(lines, l => l.ItemName),
            ByMonth = Group(lines, l => l.OccurredAt.ToString("yyyy-MM")),
        };
    }

    public async Task<ChargeCompletenessDto> GetCompletenessAsync(Guid tenantId, Guid? billId, Guid? patientJourneyId)
    {
        Guid? journeyId = patientJourneyId is { } j && j != Guid.Empty ? j : null;
        Guid? resolvedBillId = billId is { } b && b != Guid.Empty ? b : null;
        if (journeyId is null)
        {
            if (resolvedBillId is Guid bid)
            {
                var bill = await _db.OpdBills.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == bid && x.TenantId == tenantId && x.DeletedAt == null);
                journeyId = bill?.PatientJourneyId;
                resolvedBillId = bill?.Id;
            }
        }
        else if (resolvedBillId is null)
        {
            resolvedBillId = await _db.OpdBills.AsNoTracking()
                .Where(x => x.PatientJourneyId == journeyId && x.TenantId == tenantId && x.DeletedAt == null)
                .Select(x => (Guid?)x.Id)
                .FirstOrDefaultAsync();
        }

        if (journeyId is null)
            return new ChargeCompletenessDto { BillId = resolvedBillId };

        var implantUsages = await _db.JourneyImplantUsageReads.AsNoTracking()
            .Where(u => u.TenantId == tenantId && u.JourneyId == journeyId
                        && u.DeletedAt == null && u.UsageStatus == Implanted)
            .Select(u => new { u.Id, u.ItemId, u.ChargeStatus })
            .ToListAsync();
        var recorded = implantUsages.Count;
        var charged = implantUsages.Count(u => IsImplantChargeComplete(u.ChargeStatus));
        var missing = implantUsages.Count(u => IsImplantChargeMissing(u.ChargeStatus));

        var pendingConsumables = await _db.InvSurgeryConsumableReads.AsNoTracking()
            .CountAsync(c => c.TenantId == tenantId && c.JourneyId == journeyId
                             && c.DeletedAt == null
                             && (c.ChargeStatus == Pending
                                 || c.ChargeStatus == Exception
                                 || c.ChargeStatus == UnmappedJourney)
                             && c.ConsumableStatus != "Cancelled"
                             && c.ConsumableStatus != "ReturnPosted");

        var tableExceptions = await _db.ChargeExceptions.AsNoTracking()
            .Where(e => e.TenantId == tenantId
                        && e.PatientJourneyId == journeyId
                        && (e.Status == ChargeExceptionStatus.Open
                            || e.Status == ChargeExceptionStatus.NeedsAdjustment))
            .Select(e => new { e.SourceRefId, e.ItemId, e.SourceType })
            .ToListAsync();
        var uncoveredImplantExceptions = implantUsages.Count(u =>
            u.ChargeStatus == Exception
            && !tableExceptions.Any(e => CoversImplantUsage(e.SourceRefId, e.ItemId, e.SourceType, u.Id, u.ItemId)));
        var exceptionsOpen = tableExceptions.Count + uncoveredImplantExceptions;

        var warnings = new List<string>();
        if (missing > 0)
            warnings.Add($"{recorded} implants recorded, {missing} charge missing");
        if (pendingConsumables > 0)
            warnings.Add($"{pendingConsumables} OT consumable issue(s) not posted to the bill");
        if (exceptionsOpen > 0)
            warnings.Add($"{exceptionsOpen} open charge exception(s) must be mapped or resolved");

        return new ChargeCompletenessDto
        {
            PatientJourneyId = journeyId,
            BillId = resolvedBillId,
            ImplantsRecorded = recorded,
            ImplantsCharged = charged,
            ImplantsMissingCharge = missing,
            ConsumablesPending = pendingConsumables,
            ExceptionsOpen = exceptionsOpen,
            Warnings = warnings,
        };
    }

    public async Task<UnbilledActivityDto> GetUnbilledActivityAsync(
        Guid tenantId, Guid? branchId, DateTime fromUtc, DateTime toUtcExclusive)
    {
        if (fromUtc >= toUtcExclusive)
            return new UnbilledActivityDto();

        var allowed = await BranchJourneyIdsAsync(tenantId, branchId);
        var usages = await _db.JourneyImplantUsageReads.AsNoTracking()
            .Where(u => u.TenantId == tenantId && u.DeletedAt == null
                        && u.UsageStatus == Implanted
                        && u.ScannedAt >= fromUtc && u.ScannedAt < toUtcExclusive
                        && u.ChargeStatus != Posted && u.ChargeStatus != Credited
                        && u.ChargeStatus != Covered)
            .ToListAsync();
        if (allowed is not null)
            usages = usages.Where(u => allowed.Contains(u.JourneyId)).ToList();

        var consumables = await _db.InvSurgeryConsumableReads.AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null
                        && c.IssuedAt >= fromUtc && c.IssuedAt < toUtcExclusive
                        && (c.ChargeStatus == Pending || c.ChargeStatus == Exception)
                        && c.ConsumableStatus != "Cancelled"
                        && c.ConsumableStatus != "ReturnPosted")
            .ToListAsync();
        if (allowed is not null)
            consumables = consumables.Where(c => c.JourneyId is Guid j && allowed.Contains(j)).ToList();

        var exceptions = await _db.ChargeExceptions.AsNoTracking()
            .Where(e => e.TenantId == tenantId
                        && (e.Status == ChargeExceptionStatus.Open
                            || e.Status == ChargeExceptionStatus.NeedsAdjustment)
                        && e.CreatedAt >= fromUtc && e.CreatedAt < toUtcExclusive)
            .ToListAsync();
        if (allowed is not null)
            exceptions = exceptions.Where(e => e.PatientJourneyId is Guid j && allowed.Contains(j)).ToList();

        var prices = await CatalogAmountsAsync(
            tenantId,
            usages.Select(u => u.ItemId).Concat(consumables.Select(c => (Guid?)c.ItemId)));

        decimal implantAmount = 0;
        foreach (var u in usages)
        {
            if (u.ItemId is Guid id && prices.TryGetValue(id, out var price))
                implantAmount += price;
        }

        decimal consumableAmount = 0;
        foreach (var c in consumables)
        {
            var qty = c.Quantity <= 0 ? 1 : c.Quantity;
            if (prices.TryGetValue(c.ItemId, out var price))
                consumableAmount += price * qty;
        }

        return new UnbilledActivityDto
        {
            ImplantCount = usages.Count,
            ImplantAmount = implantAmount,
            ConsumableCount = consumables.Count,
            ConsumableAmount = consumableAmount,
            UnmappedExceptionCount = exceptions.Count,
        };
    }

    public async Task<IReadOnlyDictionary<Guid, JourneyChargeStatusDto>> GetChargeStatusByJourneyAsync(
        Guid tenantId, IReadOnlyList<Guid> journeyIds)
    {
        var result = new Dictionary<Guid, JourneyChargeStatusDto>();
        if (journeyIds.Count == 0) return result;
        var ids = journeyIds.Distinct().ToList();

        var usages = await _db.JourneyImplantUsageReads.AsNoTracking()
            .Where(u => u.TenantId == tenantId && u.DeletedAt == null
                        && ids.Contains(u.JourneyId) && u.UsageStatus == Implanted)
            .Select(u => new { u.JourneyId, u.Id, u.ItemId, u.ChargeStatus })
            .ToListAsync();
        var consumables = await _db.InvSurgeryConsumableReads.AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null
                        && c.JourneyId != null && ids.Contains(c.JourneyId.Value)
                        && (c.ChargeStatus == Pending
                            || c.ChargeStatus == Exception
                            || c.ChargeStatus == UnmappedJourney)
                        && c.ConsumableStatus != "Cancelled"
                        && c.ConsumableStatus != "ReturnPosted")
            .Select(c => new { JourneyId = c.JourneyId!.Value, c.ChargeStatus })
            .ToListAsync();
        var exceptions = await _db.ChargeExceptions.AsNoTracking()
            .Where(e => e.TenantId == tenantId
                        && (e.Status == ChargeExceptionStatus.Open
                            || e.Status == ChargeExceptionStatus.NeedsAdjustment)
                        && e.PatientJourneyId != null && ids.Contains(e.PatientJourneyId.Value))
            .Select(e => new { JourneyId = e.PatientJourneyId!.Value, e.SourceRefId, e.ItemId, e.SourceType })
            .ToListAsync();

        foreach (var journeyId in ids)
        {
            var ju = usages.Where(u => u.JourneyId == journeyId).ToList();
            var jc = consumables.Where(c => c.JourneyId == journeyId).ToList();
            var table = exceptions.Where(e => e.JourneyId == journeyId).ToList();
            var uncoveredImplants = ju.Count(u =>
                u.ChargeStatus == Exception
                && !table.Any(e => CoversImplantUsage(e.SourceRefId, e.ItemId, e.SourceType, u.Id, u.ItemId)));
            var unmapped = table.Count
                           + uncoveredImplants
                           + jc.Count(c => c.ChargeStatus == Exception || c.ChargeStatus == UnmappedJourney);
            var missing = ju.Count(u => IsImplantChargeMissing(u.ChargeStatus))
                          + jc.Count(c => c.ChargeStatus == Pending);
            var (status, label) = ChargeStatusClassifier.Classify(missing, unmapped);
            result[journeyId] = new JourneyChargeStatusDto
            {
                JourneyId = journeyId,
                Status = status,
                Label = label,
                MissingChargeCount = missing,
                UnmappedCount = unmapped,
            };
        }

        return result;
    }

    private async Task<HashSet<Guid>?> BranchJourneyIdsAsync(Guid tenantId, Guid? branchId)
    {
        if (branchId is not Guid bid || bid == Guid.Empty) return null;
        try
        {
            var ids = await _db.PatientJourneys.AsNoTracking()
                .Where(j => j.TenantId == tenantId && j.BranchId == bid && j.DeletedAt == null)
                .Select(j => j.Id)
                .ToListAsync();
            return ids.ToHashSet();
        }
        catch
        {
            return null;
        }
    }

    private async Task<Dictionary<Guid, decimal>> CatalogAmountsAsync(Guid tenantId, IEnumerable<Guid?> itemIds)
    {
        var ids = itemIds
            .Where(x => x is Guid g && g != Guid.Empty)
            .Select(x => x!.Value)
            .Distinct()
            .ToList();
        var map = new Dictionary<Guid, decimal>();
        foreach (var id in ids)
            map[id] = await CatalogAmountAsync(tenantId, id);
        return map;
    }

    private static bool IsImplantChargeComplete(string? chargeStatus)
        => chargeStatus is Posted or Covered or Credited or Suppressed;

    private static bool IsImplantChargeMissing(string? chargeStatus)
        => chargeStatus is Pending or CreditPending;

    private static bool CoversImplantUsage(
        Guid? sourceRefId, Guid? exceptionItemId, string? sourceType, Guid usageId, Guid? usageItemId)
    {
        if (sourceRefId == usageId) return true;
        return usageItemId is Guid item && item != Guid.Empty
               && exceptionItemId == item
               && string.Equals(sourceType, "Implant", StringComparison.OrdinalIgnoreCase);
    }

    private static (DateTime From, DateTime To) Range(DateTime? fromUtc, DateTime? toUtc)
    {
        var to = toUtc ?? DateTime.UtcNow;
        var from = fromUtc ?? to.AddDays(-7);
        if (from > to) from = to.AddDays(-7);
        return (from, to);
    }

    private static ReconciliationBucketDto Bucket(int n, string code, string title, List<ReconciliationRowDto> rows)
        => new()
        {
            Number = n,
            Code = code,
            Title = title,
            Count = rows.Count,
            Value = rows.Sum(r => r.Amount),
        };

    private static string MissingChargeReason(string chargeStatus, bool billFinalized)
    {
        if (billFinalized && chargeStatus is Pending or Exception)
            return "Bill finalized before charge arrived";
        return chargeStatus switch
        {
            Exception => "No variant mapping",
            Pending => "Outbox not yet posted",
            "CreditPending" => "Reversal credit pending",
            _ => chargeStatus,
        };
    }

    private static string ItemLabel(JourneyImplantUsageRead u, Dictionary<Guid, string> itemNames)
    {
        if (u.ItemId is Guid id && itemNames.TryGetValue(id, out var name) && !string.IsNullOrWhiteSpace(name))
            return name;
        var parts = new[] { u.Brand, u.Model, u.Power is decimal p ? $"+{p:0.#} D" : null }
            .Where(s => !string.IsNullOrWhiteSpace(s));
        var joined = string.Join(" ", parts);
        return string.IsNullOrWhiteSpace(joined) ? u.CatalogRef ?? "Implant" : joined;
    }

    private async Task<decimal> CatalogAmountAsync(Guid tenantId, Guid? itemId)
    {
        if (itemId is not Guid id || id == Guid.Empty) return 0;
        var resolved = await _catalog.ResolveItemAsync(tenantId, id);
        return resolved.CanPost ? resolved.UnitPrice!.Value : 0;
    }

    private async Task<Dictionary<Guid, string>> LoadNamesAsync(Guid tenantId, List<Guid> patientIds)
    {
        if (patientIds.Count == 0) return new Dictionary<Guid, string>();
        var rows = await _db.Patients.AsNoTracking()
            .Where(p => p.TenantId == tenantId && patientIds.Contains(p.Id))
            .Select(p => new { p.Id, p.FirstName, p.LastName, p.MedicalRecordNumber })
            .ToListAsync();
        return rows.ToDictionary(
            p => p.Id,
            p => string.IsNullOrWhiteSpace($"{p.FirstName} {p.LastName}".Trim())
                ? p.MedicalRecordNumber
                : $"{p.FirstName} {p.LastName}".Trim());
    }

    private async Task<Dictionary<Guid, string>> LoadItemNamesAsync(Guid tenantId)
    {
        var rows = await _db.InvItemMasterReads.AsNoTracking()
            .Where(i => i.TenantId == tenantId && i.DeletedAt == null)
            .Select(i => new { i.Id, i.ItemName })
            .ToListAsync();
        return rows.ToDictionary(i => i.Id, i => i.ItemName);
    }

    private async Task<Dictionary<Guid, decimal>> LoadPurchaseRatesAsync(Guid tenantId)
    {
        var rows = await _db.InvStockBatchReads.AsNoTracking()
            .Where(b => b.TenantId == tenantId && b.DeletedAt == null && b.IsActive && b.PurchaseRate > 0)
            .OrderByDescending(b => b.CreatedAt)
            .Select(b => new { b.ItemId, b.PurchaseRate })
            .ToListAsync();
        return rows
            .GroupBy(b => b.ItemId)
            .ToDictionary(g => g.Key, g => g.First().PurchaseRate);
    }

    private static List<WastageGroupDto> Group(List<WastageLineDto> lines, Func<WastageLineDto, string> key)
        => lines
            .GroupBy(key)
            .Select(g => new WastageGroupDto { Key = g.Key, Count = g.Count(), Cost = g.Sum(x => x.Cost) })
            .OrderByDescending(g => g.Cost)
            .ToList();
}
