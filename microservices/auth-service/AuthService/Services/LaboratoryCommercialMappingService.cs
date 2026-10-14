using System.Text.Json;
using AuthService.Context;
using AuthService.Models.Domain;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

/// <summary>
/// L3-COM-01 commercial classification for LaboratoryTestDefinition.
/// Read-only Billing resolver interaction — never posts charges.
/// </summary>
public static class LaboratoryCommercialStates
{
    public const string Mapped = "MAPPED";
    public const string Unmapped = "UNMAPPED";
    public const string NonBillable = "NON_BILLABLE";
    public const string Unpriced = "UNPRICED";
}

public sealed record LaboratoryCommercialStateDto(
    Guid TestDefinitionId,
    string LocalCode,
    string Name,
    string? Category,
    bool IsActive,
    bool IsNonBillable,
    Guid? ServiceVariantId,
    string? ServiceVariantCode,
    string? ServiceVariantName,
    string CommercialState,
    string? ResolverKind,
    string? ResolverReason,
    bool FinanciallyActionable);

/// <summary>L3-UX-01 composition-time summary line (prices omitted unless FIN-VIS authorized).</summary>
public sealed record LaboratoryOrderSummaryLineDto(
    Guid TestDefinitionId,
    string LocalCode,
    string Name,
    string? Category,
    Guid? PanelId,
    string? PanelName,
    string? PanelCode,
    int Quantity,
    string CommercialState,
    Guid? ServiceVariantId,
    string? ServiceVariantCode,
    string? ServiceVariantName,
    bool FinanciallyActionable,
    decimal? UnitPrice,
    decimal? LineEstimate);

/// <summary>L3-UX-01 read-only Order Summary / estimate (no financial mutations).</summary>
public sealed record LaboratoryOrderSummaryDto(
    int SelectedItemCount,
    int LineCount,
    bool FinancialAmountsVisible,
    decimal? EstimateTotal,
    IReadOnlyList<LaboratoryOrderSummaryLineDto> Lines);

public sealed record LaboratoryOrderSummarySelection(
    Guid? TestDefinitionId,
    Guid? PanelId);

public interface ILaboratoryCommercialMappingService
{
    Task<LaboratoryCommercialStateDto> GetCommercialStateAsync(
        Guid tenantId,
        LaboratoryTestDefinition test,
        CancellationToken cancellationToken = default);

    Task<LaboratoryOrderSummaryDto> BuildOrderSummaryAsync(
        Guid tenantId,
        IReadOnlyList<LaboratoryOrderSummarySelection> selections,
        bool includeFinancialAmounts,
        CancellationToken cancellationToken = default);

    Task<LaboratoryCommercialStateDto> MapServiceVariantAsync(
        Guid tenantId,
        Guid userId,
        Guid testDefinitionId,
        Guid serviceVariantId,
        CancellationToken cancellationToken = default);

    Task<LaboratoryCommercialStateDto> UnmapServiceVariantAsync(
        Guid tenantId,
        Guid userId,
        Guid testDefinitionId,
        CancellationToken cancellationToken = default);

    Task<LaboratoryCommercialStateDto> SetNonBillableAsync(
        Guid tenantId,
        Guid userId,
        Guid testDefinitionId,
        bool isNonBillable,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<object>> SearchServiceVariantsAsync(
        string? search,
        int take = 20,
        CancellationToken cancellationToken = default);
}

public class LaboratoryCommercialMappingService : ILaboratoryCommercialMappingService
{
    private readonly AppDbContext _db;
    private readonly IChargeCatalogResolver _resolver;
    private readonly IAuditService _audit;

    public LaboratoryCommercialMappingService(
        AppDbContext db,
        IChargeCatalogResolver resolver,
        IAuditService audit)
    {
        _db = db;
        _resolver = resolver;
        _audit = audit;
    }

    public async Task<LaboratoryCommercialStateDto> GetCommercialStateAsync(
        Guid tenantId,
        LaboratoryTestDefinition test,
        CancellationToken cancellationToken = default)
    {
        var resolved = await ResolveCommercialAsync(tenantId, test, cancellationToken);
        return resolved.State;
    }

    public async Task<LaboratoryOrderSummaryDto> BuildOrderSummaryAsync(
        Guid tenantId,
        IReadOnlyList<LaboratoryOrderSummarySelection> selections,
        bool includeFinancialAmounts,
        CancellationToken cancellationToken = default)
    {
        if (selections == null || selections.Count == 0)
            throw new InvalidOperationException("At least one catalog test or panel is required.");

        var keys = selections.Select(s =>
            s.TestDefinitionId.HasValue ? $"test:{s.TestDefinitionId}" : $"panel:{s.PanelId}").ToList();
        if (keys.Count != keys.Distinct(StringComparer.Ordinal).Count())
            throw new InvalidOperationException("Duplicate test or panel selection is not allowed.");

        var lines = new List<LaboratoryOrderSummaryLineDto>();

        foreach (var selection in selections)
        {
            if (selection.TestDefinitionId.HasValue == selection.PanelId.HasValue)
                throw new InvalidOperationException("Each selection must specify exactly one of TestDefinitionId or PanelId.");

            if (selection.TestDefinitionId is Guid testId)
            {
                var test = await _db.LaboratoryTestDefinitions.AsNoTracking()
                    .FirstOrDefaultAsync(
                        t => t.Id == testId && t.TenantId == tenantId && t.IsActive,
                        cancellationToken);
                if (test == null)
                    throw new KeyNotFoundException("Laboratory test definition not found for this tenant.");

                lines.Add(await ToSummaryLineAsync(
                    tenantId, test, panelId: null, panelName: null, panelCode: null,
                    includeFinancialAmounts, cancellationToken));
            }
            else
            {
                var panel = await _db.LaboratoryPanels.AsNoTracking()
                    .Include(p => p.Items)
                    .ThenInclude(i => i.TestDefinition)
                    .FirstOrDefaultAsync(
                        p => p.Id == selection.PanelId!.Value && p.TenantId == tenantId && p.IsActive,
                        cancellationToken);
                if (panel == null)
                    throw new KeyNotFoundException("Laboratory panel not found for this tenant.");

                var members = panel.Items
                    .Where(i => i.TestDefinition != null
                                && i.TestDefinition.IsActive
                                && i.TestDefinition.DeletedAt == null)
                    .OrderBy(i => i.DisplayOrder)
                    .Select(i => i.TestDefinition!)
                    .ToList();
                if (members.Count == 0)
                    throw new InvalidOperationException("Panel has no active member tests.");

                foreach (var member in members)
                {
                    lines.Add(await ToSummaryLineAsync(
                        tenantId, member, panel.Id, panel.Name, panel.LocalCode,
                        includeFinancialAmounts, cancellationToken));
                }
            }
        }

        var distinctIds = lines.Select(l => l.TestDefinitionId).ToList();
        if (distinctIds.Count != distinctIds.Distinct().Count())
            throw new InvalidOperationException("Duplicate catalog test is not allowed in one order.");

        // Sum of resolved line estimates only — never fabricate missing prices.
        decimal? estimateTotal = null;
        if (includeFinancialAmounts && lines.Any(l => l.LineEstimate.HasValue))
            estimateTotal = lines.Where(l => l.LineEstimate.HasValue).Sum(l => l.LineEstimate!.Value);

        return new LaboratoryOrderSummaryDto(
            SelectedItemCount: selections.Count,
            LineCount: lines.Count,
            FinancialAmountsVisible: includeFinancialAmounts,
            EstimateTotal: estimateTotal,
            Lines: lines);
    }

    private async Task<LaboratoryOrderSummaryLineDto> ToSummaryLineAsync(
        Guid tenantId,
        LaboratoryTestDefinition test,
        Guid? panelId,
        string? panelName,
        string? panelCode,
        bool includeFinancialAmounts,
        CancellationToken cancellationToken)
    {
        var resolved = await ResolveCommercialAsync(tenantId, test, cancellationToken);
        var state = resolved.State;
        const int quantity = 1;
        decimal? unitPrice = null;
        decimal? lineEstimate = null;

        if (includeFinancialAmounts
            && state.CommercialState == LaboratoryCommercialStates.Mapped
            && resolved.UnitPrice is decimal price
            && price > 0)
        {
            unitPrice = price;
            lineEstimate = price * quantity;
        }

        return new LaboratoryOrderSummaryLineDto(
            test.Id,
            test.LocalCode,
            test.Name,
            test.Category,
            panelId,
            panelName,
            panelCode,
            quantity,
            state.CommercialState,
            state.ServiceVariantId,
            state.ServiceVariantCode,
            state.ServiceVariantName,
            state.FinanciallyActionable,
            unitPrice,
            lineEstimate);
    }

    private async Task<(LaboratoryCommercialStateDto State, decimal? UnitPrice)> ResolveCommercialAsync(
        Guid tenantId,
        LaboratoryTestDefinition test,
        CancellationToken cancellationToken)
    {
        string? variantCode = null;
        string? variantName = null;
        string? resolverKind = null;
        string? resolverReason = null;
        decimal? unitPrice = null;
        var commercialState = LaboratoryCommercialStates.Unmapped;

        if (test.IsNonBillable)
        {
            commercialState = LaboratoryCommercialStates.NonBillable;
        }
        else if (test.ServiceVariantId is Guid variantId)
        {
            var variant = await _db.ServiceVariants.AsNoTracking()
                .FirstOrDefaultAsync(
                    v => v.Id == variantId && v.DeletedAt == null,
                    cancellationToken);

            if (variant != null)
            {
                variantCode = variant.VariantCode;
                variantName = variant.VariantName;
            }

            var resolved = await _resolver.ResolveVariantAsync(tenantId, variantId);
            resolverKind = resolved.Kind.ToString();
            resolverReason = resolved.Reason;
            unitPrice = resolved.UnitPrice;

            commercialState = resolved.Kind switch
            {
                ChargeResolveKind.Mapped => LaboratoryCommercialStates.Mapped,
                ChargeResolveKind.Unpriced => LaboratoryCommercialStates.Unpriced,
                _ => LaboratoryCommercialStates.Unmapped,
            };
        }

        var state = new LaboratoryCommercialStateDto(
            test.Id,
            test.LocalCode,
            test.Name,
            test.Category,
            test.IsActive,
            test.IsNonBillable,
            test.ServiceVariantId,
            variantCode,
            variantName,
            commercialState,
            resolverKind,
            resolverReason,
            FinanciallyActionable: commercialState == LaboratoryCommercialStates.Mapped);

        return (state, unitPrice);
    }

    public async Task<LaboratoryCommercialStateDto> MapServiceVariantAsync(
        Guid tenantId,
        Guid userId,
        Guid testDefinitionId,
        Guid serviceVariantId,
        CancellationToken cancellationToken = default)
    {
        var test = await LoadMutableTestAsync(tenantId, testDefinitionId, cancellationToken);
        if (test.IsNonBillable)
            throw new InvalidOperationException(
                "Cannot map a ServiceVariant while the test is marked non-billable. Clear non-billable first.");

        var variant = await _db.ServiceVariants.AsNoTracking()
            .FirstOrDefaultAsync(
                v => v.Id == serviceVariantId && v.IsActive && v.DeletedAt == null,
                cancellationToken);
        if (variant == null)
            throw new InvalidOperationException("ServiceVariant not found or inactive.");

        var previous = Snapshot(test);
        test.ServiceVariantId = serviceVariantId;
        test.IsNonBillable = false;
        test.UpdatedAt = DateTime.UtcNow;
        test.UpdatedByUserId = userId;

        await StageAuditAsync(
            userId,
            "LaboratoryCommercialMap",
            test.Id,
            previous,
            Snapshot(test),
            cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);
        return await GetCommercialStateAsync(tenantId, test, cancellationToken);
    }

    public async Task<LaboratoryCommercialStateDto> UnmapServiceVariantAsync(
        Guid tenantId,
        Guid userId,
        Guid testDefinitionId,
        CancellationToken cancellationToken = default)
    {
        var test = await LoadMutableTestAsync(tenantId, testDefinitionId, cancellationToken);
        var previous = Snapshot(test);
        test.ServiceVariantId = null;
        test.UpdatedAt = DateTime.UtcNow;
        test.UpdatedByUserId = userId;

        await StageAuditAsync(
            userId,
            "LaboratoryCommercialUnmap",
            test.Id,
            previous,
            Snapshot(test),
            cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);
        return await GetCommercialStateAsync(tenantId, test, cancellationToken);
    }

    public async Task<LaboratoryCommercialStateDto> SetNonBillableAsync(
        Guid tenantId,
        Guid userId,
        Guid testDefinitionId,
        bool isNonBillable,
        CancellationToken cancellationToken = default)
    {
        var test = await LoadMutableTestAsync(tenantId, testDefinitionId, cancellationToken);

        if (isNonBillable && test.ServiceVariantId.HasValue)
            throw new InvalidOperationException(
                "Cannot mark non-billable while a ServiceVariant mapping exists. Unmap first.");

        var previous = Snapshot(test);
        test.IsNonBillable = isNonBillable;
        if (isNonBillable)
            test.ServiceVariantId = null;
        test.UpdatedAt = DateTime.UtcNow;
        test.UpdatedByUserId = userId;

        await StageAuditAsync(
            userId,
            isNonBillable ? "LaboratoryCommercialNonBillableSet" : "LaboratoryCommercialNonBillableClear",
            test.Id,
            previous,
            Snapshot(test),
            cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);
        return await GetCommercialStateAsync(tenantId, test, cancellationToken);
    }

    public async Task<IReadOnlyList<object>> SearchServiceVariantsAsync(
        string? search,
        int take = 20,
        CancellationToken cancellationToken = default)
    {
        var limit = Math.Clamp(take, 1, 50);
        var query = _db.ServiceVariants.AsNoTracking()
            .Where(v => v.IsActive && v.DeletedAt == null);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(v =>
                v.VariantName.Contains(term) ||
                (v.VariantCode != null && v.VariantCode.Contains(term)));
        }

        var rows = await query
            .OrderBy(v => v.DisplayOrder)
            .ThenBy(v => v.VariantName)
            .Take(limit)
            .Select(v => new
            {
                v.Id,
                code = v.VariantCode,
                name = v.VariantName,
                v.IsActive,
            })
            .ToListAsync(cancellationToken);

        return rows.Cast<object>().ToList();
    }

    private async Task<LaboratoryTestDefinition> LoadMutableTestAsync(
        Guid tenantId,
        Guid testDefinitionId,
        CancellationToken cancellationToken)
    {
        var test = await _db.LaboratoryTestDefinitions
            .FirstOrDefaultAsync(
                t => t.Id == testDefinitionId && t.TenantId == tenantId,
                cancellationToken);
        if (test == null)
            throw new KeyNotFoundException("Laboratory test definition not found for this tenant.");
        return test;
    }

    private static object Snapshot(LaboratoryTestDefinition test) => new
    {
        test.Id,
        test.TenantId,
        test.LocalCode,
        test.ServiceVariantId,
        test.IsNonBillable,
        test.IsActive,
    };

    private async Task StageAuditAsync(
        Guid userId,
        string action,
        Guid resourceId,
        object previous,
        object next,
        CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        await _audit.StageAsync(
            userId,
            action,
            "LaboratoryTestDefinition",
            resourceId,
            details: "L3-COM-01 commercial mapping mutation",
            oldValue: JsonSerializer.Serialize(previous),
            newValue: JsonSerializer.Serialize(next));
    }
}
