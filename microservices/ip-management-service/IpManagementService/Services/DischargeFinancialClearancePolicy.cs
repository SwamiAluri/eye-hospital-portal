namespace IpManagementService.Services;

/// <summary>
/// Clinical discharge money gate: block the bed until the <em>patient</em> obligation is cleared.
/// TPA/CCMS settlement is shown separately and must not hold the bed.
/// <c>balanceDue</c> on the cash path must be Auth <see cref="AuthIpFinancialSummary.PatientBalance"/>
/// when a bill exists — never the journey generated <c>package_amount − total_paid</c> column
/// and never ledger <c>BalanceDue</c> (that includes TPA).
/// </summary>
public static class DischargeFinancialClearancePolicy
{
    /// <summary>
    /// Cash remaining that may hold the bed. Use Auth patient remaining when a bill exists.
    /// Journey <c>BalanceDue</c> is only the no-bill path after a <em>successful</em> Auth summary
    /// with no OpdBill. Never call this after an Auth summary failure.
    /// </summary>
    public static decimal CashLedgerDue(
        bool billingLedgerAvailable,
        decimal patientBalance,
        decimal? journeyBalanceDue)
    {
        if (billingLedgerAvailable)
            return patientBalance < 0 ? 0 : patientBalance;

        var due = journeyBalanceDue ?? 0m;
        return due < 0 ? 0 : due;
    }

    /// <summary>
    /// Outstanding amount that must be collected before any → Discharged,
    /// unless an audited discharge override is applied.
    /// </summary>
    public static decimal PatientObligationDue(
        bool coverageBased,
        decimal? balanceDue,
        decimal? patientShareAmount,
        bool ccmsUnavailable,
        decimal patientCollected = 0)
    {
        if (coverageBased && ccmsUnavailable)
            return decimal.MaxValue;

        if (coverageBased && patientShareAmount.HasValue)
        {
            var remaining = patientShareAmount.Value - Math.Max(0, patientCollected);
            return remaining < 0 ? 0 : remaining;
        }

        var due = balanceDue ?? 0m;
        return due < 0 ? 0 : due;
    }

    public static bool IsOutstanding(
        bool coverageBased,
        decimal? balanceDue,
        decimal? patientShareAmount,
        bool ccmsUnavailable,
        decimal patientCollected = 0)
        => PatientObligationDue(coverageBased, balanceDue, patientShareAmount, ccmsUnavailable, patientCollected) > 0.009m;
}
