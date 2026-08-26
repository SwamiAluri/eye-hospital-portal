namespace AuthService.Services;

public enum ChargeResolveKind
{
    Mapped,
    Unmapped,
    NonChargeable,
    Unpriced,
}

public sealed record ChargeResolveResult(
    ChargeResolveKind Kind,
    Guid? ServiceVariantId,
    decimal? UnitPrice,
    string? Reason)
{
    public bool CanPost => Kind == ChargeResolveKind.Mapped && UnitPrice.HasValue;

    public static ChargeResolveResult Mapped(Guid variantId, decimal unitPrice)
        => new(ChargeResolveKind.Mapped, variantId, unitPrice, null);

    public static ChargeResolveResult Unmapped(string reason)
        => new(ChargeResolveKind.Unmapped, null, null, reason);

    public static ChargeResolveResult NonChargeable(string? reason)
        => new(ChargeResolveKind.NonChargeable, null, null, reason);

    public static ChargeResolveResult Unpriced(Guid variantId)
        => new(ChargeResolveKind.Unpriced, variantId, null, "Mapped variant has no catalog price.");
}

public class ChargeExceptionEnqueueRequest
{
    public Guid? ItemId { get; set; }
    public Guid? PackageTemplateId { get; set; }
    public Guid? PackageComponentId { get; set; }
    public string SourceType { get; set; } = "Consumable";
    public Guid? SourceRefId { get; set; }
    public Guid? OpdBillId { get; set; }
    public Guid? PatientJourneyId { get; set; }
    public decimal Quantity { get; set; } = 1;
    public decimal EstimatedValue { get; set; }
    public string? Reason { get; set; }
    public string? IdempotencyKey { get; set; }
    /// <summary>Open (default) or NeedsAdjustment for closed-bill parks.</summary>
    public string? Status { get; set; }
}

public interface IChargeCatalogResolver
{
    Task<ChargeResolveResult> ResolveItemAsync(Guid tenantId, Guid itemId, DateTime? asOf = null, Guid? payerId = null);
    Task<ChargeResolveResult> ResolveVariantAsync(Guid tenantId, Guid serviceVariantId, DateTime? asOf = null, Guid? payerId = null);
    Task<ChargeResolveResult> ResolveByCodeAsync(Guid tenantId, string serviceCode, DateTime? asOf = null, Guid? payerId = null);
    Task<Models.Domain.ChargeException> EnqueueUnmappedAsync(Guid tenantId, ChargeExceptionEnqueueRequest request);
}
