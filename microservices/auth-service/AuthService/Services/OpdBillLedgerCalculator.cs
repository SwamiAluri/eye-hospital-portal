namespace AuthService.Services;

/// <summary>
/// Derived bill totals from append-only payment lines. Header AmountPaid / BalanceDue
/// are projections of this calculation, not independent books.
/// </summary>
public static class OpdBillLedgerCalculator
{
    public const string Payment  = "Payment";
    public const string Advance  = "Advance";
    public const string Discount = "Discount";
    public const string Refund   = "Refund";
    public const string Reversal = "Reversal";

    public sealed record Line(string Kind, decimal Amount, string Status);

    public sealed record Snapshot(
        decimal BilledAmount,
        decimal DiscountTotal,
        decimal Collected,
        decimal Advances,
        decimal RefundsAndReversals,
        decimal InsuranceResponsibility,
        decimal PatientResponsibility,
        decimal BalanceDue,
        string DerivedStatus);

    public static Snapshot Compute(
        decimal grossAmount,
        decimal taxAmount,
        decimal insuranceClaimAmount,
        bool isFinalized,
        IReadOnlyList<Line> lines)
    {
        decimal collected = 0m, advances = 0m, discounts = 0m, refunds = 0m;
        foreach (var line in lines)
        {
            if (!string.Equals(line.Status, "completed", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(line.Status, "Completed", StringComparison.OrdinalIgnoreCase))
                continue;

            var amt = line.Amount;
            if (amt < 0) throw new InvalidOperationException("Ledger line amounts must be positive; use Kind for sign.");

            switch (line.Kind)
            {
                case Advance:
                    collected += amt;
                    advances += amt;
                    break;
                case Discount:
                    discounts += amt;
                    break;
                case Refund:
                case Reversal:
                    collected -= amt;
                    refunds += amt;
                    break;
                default:
                    collected += amt;
                    break;
            }
        }

        if (collected < 0) collected = 0;
        var billed = Math.Max(0, grossAmount - discounts + taxAmount);
        var insurance = Math.Clamp(insuranceClaimAmount, 0, billed);
        var patientResp = Math.Max(0, billed - insurance);
        var balance = billed - collected;

        string status;
        if (billed == 0 && collected == 0)
            status = "generated";
        else if (collected == 0)
            status = "generated";
        else if (balance > 0)
            status = "partially_paid";
        else
            status = isFinalized ? "paid" : "paid";

        return new Snapshot(billed, discounts, collected, advances, refunds, insurance, patientResp, balance, status);
    }

    public static string NormalizeKind(string? kind, string? transactionTypeFallback = null)
    {
        var raw = string.IsNullOrWhiteSpace(kind) ? transactionTypeFallback : kind;
        if (string.IsNullOrWhiteSpace(raw)) return Payment;
        if (raw.Equals("Advance", StringComparison.OrdinalIgnoreCase)) return Advance;
        if (raw.Equals("Discount", StringComparison.OrdinalIgnoreCase)) return Discount;
        if (raw.Equals("Refund", StringComparison.OrdinalIgnoreCase)) return Refund;
        if (raw.Equals("Reversal", StringComparison.OrdinalIgnoreCase)
            || raw.Equals("Reverse", StringComparison.OrdinalIgnoreCase))
            return Reversal;
        return Payment;
    }
}
