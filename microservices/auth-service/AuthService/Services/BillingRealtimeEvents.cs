namespace AuthService.Services;

/// <summary>SignalR type names for billing invalidation. Never put ledger amounts on the wire.</summary>
public static class BillingRealtimeEvents
{
    public const string PaymentReceived = "PaymentReceived";
    public const string PaymentReversed = "PaymentReversed";
    public const string BillCreated = "BillCreated";
    public const string BillFinalized = "BillFinalized";
    public const string RefundCreated = "RefundCreated";
    public const string PatientObligationChanged = "PatientObligationChanged";
    public const string ClaimStatusChanged = "ClaimStatusChanged";

    public static string FromPaymentKind(string? paymentKind)
    {
        if (string.Equals(paymentKind, "Refund", StringComparison.OrdinalIgnoreCase))
            return RefundCreated;
        if (string.Equals(paymentKind, "Reversal", StringComparison.OrdinalIgnoreCase))
            return PaymentReversed;
        return PaymentReceived;
    }

    public static string IdentityDetails(Guid billId, Guid? journeyId)
    {
        return journeyId is Guid j
            ? $"{{\"billId\":\"{billId:D}\",\"journeyId\":\"{j:D}\"}}"
            : $"{{\"billId\":\"{billId:D}\"}}";
    }
}
