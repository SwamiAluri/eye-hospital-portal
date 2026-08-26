namespace AuthService.Services;

/// <summary>BILL-032 actionable codes so OT/inventory can queue post-finalize corrections.</summary>
public static class ChargePostingCodes
{
    public const string BillNotFound = "BILL_NOT_FOUND";
    public const string BillFinalized = "BILL_FINALIZED";
    public const string BillLocked = "BILL_LOCKED";
    public const string BillCancelled = "BILL_CANCELLED";
    public const string UnknownCatalogItem = "UNKNOWN_CATALOG_ITEM";
    public const string UnpricedCatalogItem = "UNPRICED_CATALOG_ITEM";
    public const string PackageComponentUnmapped = "PACKAGE_COMPONENT_UNMAPPED";
}

public sealed class ChargePostingException : InvalidOperationException
{
    public ChargePostingException(
        string code,
        string message,
        Guid? billId = null,
        IReadOnlyList<string>? failedLines = null)
        : base(message)
    {
        Code = code;
        BillId = billId;
        FailedLines = failedLines ?? [];
    }

    public string Code { get; }
    public Guid? BillId { get; }
    public IReadOnlyList<string> FailedLines { get; }
}
