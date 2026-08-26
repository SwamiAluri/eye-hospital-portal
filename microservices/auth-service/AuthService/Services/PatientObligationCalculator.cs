namespace AuthService.Services;

/// <summary>
/// Patient vs payer obligation chain. Payer/patient shares come from CCMS
/// (live PatientShareAmount via validate-admission, or Billing
/// InsuranceClaimAmount as a CCMS projection). Collections come from Billing.
/// Finalize and the inpatient summary must pass ccmsPatientShare whenever a
/// coverage case exists — the same share the discharge gate uses.
/// </summary>
public static class PatientObligationCalculator
{
    public sealed record Snapshot(
        decimal TotalBill,
        decimal PayerResponsibility,
        decimal PatientResponsibility,
        decimal PatientPaid,
        decimal PatientBalance);

    public static Snapshot Compute(
        decimal billedAmount,
        decimal payerResponsibility,
        decimal collected,
        decimal? ccmsPatientShare = null)
    {
        var billed = Math.Max(0, billedAmount);
        var payer = Math.Clamp(payerResponsibility, 0, billed);
        var patient = ccmsPatientShare is { } share
            ? Math.Max(0, share)
            : Math.Max(0, billed - payer);
        var paid = Math.Min(Math.Max(0, collected), patient);
        var balance = Math.Max(0, patient - paid);
        return new Snapshot(billed, payer, patient, paid, balance);
    }

    /// <summary>
    /// Cashier/patient tender ceiling. Never larger than remaining patient
    /// obligation, and never larger than ledger remaining.
    /// </summary>
    public static decimal CollectiblePatientCap(Snapshot obligation, decimal ledgerBalanceDue)
    {
        var cap = Math.Max(0, obligation.PatientBalance);
        if (ledgerBalanceDue >= 0)
            cap = Math.Min(cap, ledgerBalanceDue);
        return cap;
    }
}
