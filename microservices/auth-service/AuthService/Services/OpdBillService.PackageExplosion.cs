using System.Text.Json;
using AuthService.DTOs.Billing;
using AuthService.Models.Domain;
using AuthService.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public partial class OpdBillService
{
    /// <summary>
    /// BILL-031 / D1. Fully exploded catalog lines plus one package-discount line so
    /// sum(items) == agreed package amount. Unmapped chargeable components fail the whole explosion.
    /// </summary>
    private async Task<bool> ApplyPackagePlanAsync(OpdBill bill, PackageExplosionPlan plan, Guid userId)
    {
        if (_billItems is null) return false;

        foreach (var line in plan.Lines)
        {
            var staged = await _billItems.StageBillItemAsync(new AddBillItemRequest
            {
                OpdBillId = bill.Id,
                ServiceVariantId = line.ServiceVariantId,
                ServiceName = line.ServiceName,
                UnitPriceOverride = line.UnitPriceOverride,
                Quantity = 1,
                SourceType = line.SourceType,
                SourceRefId = line.SourceRefId,
                IdempotencyKey = line.IdempotencyKey,
                Notes = line.Notes,
            }, bill.TenantId, userId);

            if (staged.Created && line.ServiceVariantId.HasValue && staged.Item.UnitPrice <= 0)
            {
                throw new ChargePostingException(
                    ChargePostingCodes.UnpricedCatalogItem,
                    "Package component catalog price was missing at post time. Nothing was posted.",
                    bill.Id);
            }
        }

        bill.AdditionalCharges = 0;
        await ApplyItemisedGrossAsync(bill, userId);
        return true;
    }

    internal async Task ApplyItemisedGrossAsync(OpdBill bill, Guid userId)
    {
        await _context.Set<OpdBillItem>()
            .Where(i => i.OpdBillId == bill.Id && i.DeletedAt == null)
            .LoadAsync();
        var local = _context.Set<OpdBillItem>().Local
            .Where(i => i.OpdBillId == bill.Id && i.DeletedAt == null)
            .ToList();
        var itemTotal = local.Sum(i => i.TotalAmount);
        var exploded = local.Any(i =>
            i.SourceType == BillChargeSource.Package || i.SourceType == BillChargeSource.PackageDiscount);
        bill.GrossAmount = exploded ? itemTotal : Math.Max(0, bill.AdditionalCharges) + itemTotal;
        await RecalculateBillFromLedgerAsync(bill, userId);
    }

    private async Task<PackageExplosionPlan?> PlanPackageExplosionAsync(OpdBill bill, EnsureInpatientBillRequest request)
    {
        var alreadyExploded = await _context.Set<OpdBillItem>().AnyAsync(i =>
            i.OpdBillId == bill.Id
            && i.DeletedAt == null
            && (i.SourceType == BillChargeSource.Package || i.SourceType == BillChargeSource.PackageDiscount));
        if (alreadyExploded) return null;
        var session = await ResolveCounselingSessionAsync(bill.TenantId, request.PatientId, request.PatientJourneyId);
        var templateId = session?.SelectedPackageId;
        if (templateId is null || templateId == Guid.Empty)
            return null;

        var template = await _context.CounsellingPackageTemplates
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == templateId && t.TenantId == bill.TenantId && t.DeletedAt == null);
        if (template is null)
        {
            return new PackageExplosionPlan(
                templateId.Value,
                0,
                [],
                [new PackageExplosionFailure(null, $"Package:{request.PatientJourneyId:N}:{templateId:N}:missing",
                    "Selected counselling package template was not found.")]);
        }

        var agreed = session?.PackageAmount
            ?? (request.PackageAmount > 0 ? request.PackageAmount : template.PackageAmount);
        agreed = Math.Max(0, agreed);

        var components = await _context.PackageComponentMaps
            .AsNoTracking()
            .Where(c => c.TenantId == bill.TenantId && c.PackageTemplateId == template.Id)
            .OrderBy(c => c.SortOrder)
            .ToListAsync();

        var failed = new List<PackageExplosionFailure>();
        var lines = new List<PlannedPackageLine>();
        decimal catalogSum = 0;

        foreach (var component in components)
        {
            var key = $"Package:{request.PatientJourneyId:N}:{template.Id:N}:{component.Id:N}";
            if (component.CoversConsumable && component.ServiceVariantId is null)
                continue;

            if (component.ServiceVariantId is not Guid variantId || variantId == Guid.Empty)
            {
                failed.Add(new PackageExplosionFailure(
                    component.Id, key, $"Unmapped package component '{component.ComponentName}' ({component.ComponentKey})."));
                continue;
            }

            var resolved = await _catalog!.ResolveVariantAsync(bill.TenantId, variantId);
            if (!resolved.CanPost)
            {
                failed.Add(new PackageExplosionFailure(
                    component.Id, key, $"{component.ComponentName}: {resolved.Reason ?? resolved.Kind.ToString()}"));
                continue;
            }

            catalogSum += resolved.UnitPrice!.Value;
            lines.Add(new PlannedPackageLine(
                component.Id,
                BillChargeSource.Package,
                key,
                variantId,
                null,
                null,
                component.ComponentName));
        }

        if (components.Count == 0)
        {
            failed.Add(new PackageExplosionFailure(
                null,
                $"Package:{request.PatientJourneyId:N}:{template.Id:N}:empty",
                "Package template has no component map. Map components in charge-mapping before exploding."));
        }

        var selectedIol = TryReadSelectedIolId(session?.RecommendedProcedures);
        if (selectedIol is Guid premiumId
            && template.IolId is Guid allowanceId
            && premiumId != allowanceId)
        {
            var premiumPrice = await GetIolCatalogPriceAsync(premiumId);
            var allowancePrice = await GetIolCatalogPriceAsync(allowanceId);
            var upgrade = premiumPrice - allowancePrice;
            if (upgrade > 0)
            {
                catalogSum += upgrade;
                lines.Add(new PlannedPackageLine(
                    premiumId,
                    BillChargeSource.Package,
                    $"Package:{request.PatientJourneyId:N}:{template.Id:N}:PremiumIolUpgrade",
                    null,
                    "Premium IOL upgrade",
                    upgrade,
                    "premium price − package IOL allowance"));
            }
        }

        if (failed.Count == 0 && lines.Count > 0)
        {
            var discount = agreed - catalogSum;
            lines.Add(new PlannedPackageLine(
                template.Id,
                BillChargeSource.PackageDiscount,
                $"Package:{request.PatientJourneyId:N}:{template.Id:N}:Discount",
                null,
                "Package Discount",
                discount,
                "D1 balancing line so sum(items) == agreed package amount"));
        }

        return new PackageExplosionPlan(template.Id, agreed, lines, failed);
    }

    private async Task<CounselingSession?> ResolveCounselingSessionAsync(Guid tenantId, Guid patientId, Guid journeyId)
    {
        var journey = await _context.PatientJourneys.AsNoTracking()
            .FirstOrDefaultAsync(j => j.Id == journeyId && j.DeletedAt == null);
        if (journey?.CounselingSessionId is Guid sessionId && sessionId != Guid.Empty)
        {
            var linked = await _context.CounselingSession.AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null);
            if (linked != null) return linked;
        }

        return await _context.CounselingSession.AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.PatientId == patientId && s.DeletedAt == null && s.SelectedPackageId != null)
            .OrderByDescending(s => s.UpdatedAt ?? s.CreatedAt)
            .FirstOrDefaultAsync();
    }

    private async Task<decimal> GetIolCatalogPriceAsync(Guid iolId)
        => await _context.IolPrices.AsNoTracking()
            .Where(p => p.IolMasterId == iolId
                        && p.BranchId == null
                        && p.EffectiveTo == null
                        && p.IsActive
                        && p.DeletedAt == null)
            .OrderByDescending(p => p.EffectiveFrom)
            .Select(p => p.Amount)
            .FirstOrDefaultAsync();

    private static Guid? TryReadSelectedIolId(string? recommendedProceduresJson)
    {
        if (string.IsNullOrWhiteSpace(recommendedProceduresJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(recommendedProceduresJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return null;
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                if (el.TryGetProperty("iolCatalogId", out var idEl)
                    && Guid.TryParse(idEl.GetString() ?? idEl.ToString(), out var id)
                    && id != Guid.Empty)
                    return id;
            }
        }
        catch (JsonException)
        {
            return null;
        }

        return null;
    }

    private sealed record PlannedPackageLine(
        Guid? SourceRefId,
        string SourceType,
        string IdempotencyKey,
        Guid? ServiceVariantId,
        string? ServiceName,
        decimal? UnitPriceOverride,
        string? Notes);

    private sealed record PackageExplosionFailure(Guid? ComponentId, string IdempotencyKey, string Reason);

    private sealed record PackageExplosionPlan(
        Guid TemplateId,
        decimal AgreedAmount,
        List<PlannedPackageLine> Lines,
        List<PackageExplosionFailure> Failed);
}
