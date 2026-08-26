using AuthService.Context;
using AuthService.Models.Domain;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public class ChargeCatalogResolver : IChargeCatalogResolver
{
    private readonly AppDbContext _db;

    public ChargeCatalogResolver(AppDbContext db)
    {
        _db = db;
    }

    public async Task<ChargeResolveResult> ResolveItemAsync(Guid tenantId, Guid itemId, DateTime? asOf = null, Guid? payerId = null)
    {
        var at = asOf ?? DateTime.UtcNow;
        var map = await _db.ServiceVariantItemMaps
            .AsNoTracking()
            .Where(m => m.TenantId == tenantId && m.ItemId == itemId
                        && m.EffectiveFrom <= at
                        && (m.EffectiveTo == null || m.EffectiveTo > at))
            .OrderByDescending(m => m.EffectiveFrom)
            .FirstOrDefaultAsync();

        if (map is null)
            return ChargeResolveResult.Unmapped("No catalog mapping for this item.");

        if (!map.IsChargeable)
            return ChargeResolveResult.NonChargeable(map.NonChargeableReason);

        return await ResolveVariantAsync(tenantId, map.ServiceVariantId, at, payerId);
    }

    public async Task<ChargeResolveResult> ResolveVariantAsync(Guid tenantId, Guid serviceVariantId, DateTime? asOf = null, Guid? payerId = null)
    {
        _ = tenantId;
        _ = asOf;

        var variant = await _db.ServiceVariants
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.Id == serviceVariantId && v.IsActive && v.DeletedAt == null);
        if (variant is null)
            return ChargeResolveResult.Unmapped("Service variant is missing or inactive.");

        var prices = await _db.VariantPrices
            .AsNoTracking()
            .Where(p => p.VariantId == serviceVariantId
                        && p.EffectiveTo == null
                        && p.IsActive
                        && p.DeletedAt == null)
            .ToListAsync();

        decimal? Pick(Guid? payer, Guid? branch) =>
            prices
                .Where(p => p.PayerId == payer && p.BranchId == branch)
                .OrderByDescending(p => p.EffectiveFrom)
                .Select(p => (decimal?)p.Amount)
                .FirstOrDefault();

        var amount = (payerId is Guid pid ? Pick(pid, null) : null)
                     ?? Pick(null, null);

        if (amount is null or <= 0)
            return ChargeResolveResult.Unpriced(serviceVariantId);

        return ChargeResolveResult.Mapped(serviceVariantId, amount.Value);
    }

    public async Task<ChargeResolveResult> ResolveByCodeAsync(Guid tenantId, string serviceCode, DateTime? asOf = null, Guid? payerId = null)
    {
        if (string.IsNullOrWhiteSpace(serviceCode))
            return ChargeResolveResult.Unmapped("Service code is required.");

        var variant = await _db.ServiceVariants
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.VariantCode == serviceCode && v.IsActive && v.DeletedAt == null);
        if (variant is null)
            return ChargeResolveResult.Unmapped("Service code is missing or inactive.");

        return await ResolveVariantAsync(tenantId, variant.Id, asOf, payerId);
    }

    public async Task<ChargeException> EnqueueUnmappedAsync(Guid tenantId, ChargeExceptionEnqueueRequest request)
    {
        var key = string.IsNullOrWhiteSpace(request.IdempotencyKey) ? null : request.IdempotencyKey.Trim();
        if (key is not null)
        {
            var existing = await _db.ChargeExceptions
                .FirstOrDefaultAsync(e => e.TenantId == tenantId && e.IdempotencyKey == key);
            if (existing != null) return existing;
        }

        var row = new ChargeException
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ItemId = request.ItemId,
            PackageTemplateId = request.PackageTemplateId,
            PackageComponentId = request.PackageComponentId,
            SourceType = string.IsNullOrWhiteSpace(request.SourceType) ? "Consumable" : request.SourceType,
            SourceRefId = request.SourceRefId,
            OpdBillId = request.OpdBillId,
            PatientJourneyId = request.PatientJourneyId,
            Quantity = request.Quantity <= 0 ? 1 : request.Quantity,
            EstimatedValue = request.EstimatedValue,
            Status = NormalizeExceptionStatus(request.Status),
            Reason = request.Reason ?? "Unmapped",
            IdempotencyKey = key,
            CreatedAt = DateTime.UtcNow,
        };
        _db.ChargeExceptions.Add(row);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException) when (key is not null)
        {
            var replay = await _db.ChargeExceptions
                .FirstOrDefaultAsync(e => e.TenantId == tenantId && e.IdempotencyKey == key);
            if (replay != null) return replay;
            throw;
        }

        return row;
    }

    private static string NormalizeExceptionStatus(string? status)
    {
        if (string.Equals(status, ChargeExceptionStatus.NeedsAdjustment, StringComparison.OrdinalIgnoreCase))
            return ChargeExceptionStatus.NeedsAdjustment;
        if (string.Equals(status, ChargeExceptionStatus.NonChargeable, StringComparison.OrdinalIgnoreCase))
            return ChargeExceptionStatus.NonChargeable;
        return ChargeExceptionStatus.Open;
    }
}
