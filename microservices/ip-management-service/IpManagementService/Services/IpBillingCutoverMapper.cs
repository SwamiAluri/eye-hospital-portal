namespace IpManagementService.Services;

/// <summary>
/// Cutover classifier for historical ip_billing_transactions. Rows are never deleted.
/// </summary>
public static class IpBillingCutoverMapper
{
    public static string Classify(Guid? journeyOpdBillId, Guid? mappedPaymentId, string? mappingStatus)
    {
        if (mappedPaymentId.HasValue || string.Equals(mappingStatus, "mapped", StringComparison.OrdinalIgnoreCase))
            return "mapped";
        if (journeyOpdBillId is null || journeyOpdBillId == Guid.Empty)
            return "unmatched";
        return "pending_map";
    }

    public static string MapPaymentKind(string? transactionType)
    {
        if (string.Equals(transactionType, "Advance", StringComparison.OrdinalIgnoreCase)) return "Advance";
        if (string.Equals(transactionType, "Discount", StringComparison.OrdinalIgnoreCase)) return "Discount";
        if (string.Equals(transactionType, "Refund", StringComparison.OrdinalIgnoreCase)) return "Refund";
        if (string.Equals(transactionType, "Reversal", StringComparison.OrdinalIgnoreCase)) return "Reversal";
        return "Payment";
    }
}
