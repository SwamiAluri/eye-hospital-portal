namespace AuthService.Services;

/// <summary>
/// Inpatient billing dashboard totals from OpdBill + append-only payment lines.
/// Journey financial snapshots are not inputs.
/// </summary>
public static class IpBillingDashboardCalculator
{
    public sealed record PaymentFact(
        string Kind,
        decimal Amount,
        string Status,
        DateTime PaymentDate,
        string PaymentMode);

    public sealed record BillFact(
        Guid BillId,
        Guid PatientId,
        Guid? JourneyId,
        string BillNumber,
        DateTime BillDate,
        decimal GrossAmount,
        decimal TaxAmount,
        decimal InsuranceClaimAmount,
        bool IsFinalized,
        bool IsInsurance,
        string BillStatus,
        string PatientName,
        string? Mrn,
        string? InsuranceProvider,
        IReadOnlyList<PaymentFact> Payments,
        DateTime? AdmissionDate = null,
        string? CcmsPayerType = null,
        bool CcmsClaimOpen = false);

    public sealed record PipelineBucket(string Key, string Label, int Count, decimal BilledAmount);
    public sealed record NamedAmount(string Key, string Label, decimal Amount);
    public sealed record AgingBucket(string Key, string Label, int Count, decimal PatientOutstanding, decimal PayerOutstanding);

    public sealed record PatientRow(
        Guid BillId,
        Guid PatientId,
        Guid? JourneyId,
        string PatientName,
        string? Mrn,
        DateTime BillDate,
        string BillNumber,
        decimal BilledAmount,
        decimal PatientResponsibility,
        decimal PayerResponsibility,
        decimal Collected,
        decimal PatientOutstanding,
        decimal PayerOutstanding,
        string Lifecycle,
        DateTime? LastTransactionAt,
        DateTime? AdmissionDate);

    public sealed record DashboardResult(
        DateTime FromUtc,
        DateTime ToUtcExclusive,
        string RangeLabel,
        string BilledDateBasis,
        string CollectionDateBasis,
        int PatientCount,
        decimal PackageEstimate,
        decimal TotalBilled,
        decimal TotalCollected,
        decimal PatientOutstanding,
        decimal PayerOutstanding,
        decimal Refunds,
        decimal Adjustments,
        IReadOnlyList<PipelineBucket> Pipeline,
        IReadOnlyList<NamedAmount> PaymentInstruments,
        IReadOnlyList<NamedAmount> PayerMix,
        IReadOnlyList<AgingBucket> Aging,
        IReadOnlyList<PatientRow> Patients,
        string AdmissionDateBasis);

    public static (DateTime FromUtc, DateTime ToUtcExclusive, string Label) ResolveRange(
        string? preset, DateTime? fromUtc, DateTime? toUtc, DateTime utcNow)
    {
        var today = DateTime.SpecifyKind(utcNow.Date, DateTimeKind.Utc);
        var p = (preset ?? "this_month").Trim().ToLowerInvariant();
        return p switch
        {
            "today" => (today, today.AddDays(1), "Today"),
            "yesterday" => (today.AddDays(-1), today, "Yesterday"),
            "this_week" => (StartOfIsoWeek(today), StartOfIsoWeek(today).AddDays(7), "This week (Mon–Sun UTC)"),
            "this_month" => MonthRange(today, "This month"),
            "custom" or "custom_range" when fromUtc is { } f && toUtc is { } t => (
                DateTime.SpecifyKind(f.Date, DateTimeKind.Utc),
                DateTime.SpecifyKind(t.Date, DateTimeKind.Utc).AddDays(1),
                "Custom range"),
            _ => MonthRange(today, "This month"),
        };
    }

    /// <summary>
    /// Period billed/collected use bill_date / payment_date inside the range.
    /// Aging and outstanding are an as-of AR snapshot: all unpaid IP bills with
    /// bill_date before the range end (not only bills created in the selected month).
    /// </summary>
    public static DashboardResult Compute(
        IReadOnlyList<BillFact> bills, DateTime fromUtc, DateTime toUtcExclusive, string rangeLabel)
    {
        var patientIds = new HashSet<Guid>();
        decimal package = 0, billedInPeriod = 0, collectedInPeriod = 0, refundsInPeriod = 0, discountsInPeriod = 0;
        decimal patientOs = 0, payerOs = 0;
        var pipeline = new Dictionary<string, PipelineBucket>(StringComparer.OrdinalIgnoreCase);
        foreach (var key in PipelineKeys)
            pipeline[key] = new PipelineBucket(key, LifecycleLabel(key), 0, 0);
        var instruments = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        var payers = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        var aging = new[]
        {
            new AgingAcc("0_30", "0–30 days"),
            new AgingAcc("31_60", "31–60 days"),
            new AgingAcc("61_90", "61–90 days"),
            new AgingAcc("90_plus", "90+ days"),
        };
        var rows = new List<PatientRow>();
        var asOf = toUtcExclusive.AddTicks(-1);

        foreach (var bill in bills)
        {
            var lines = bill.Payments
                .Select(p => new OpdBillLedgerCalculator.Line(
                    OpdBillLedgerCalculator.NormalizeKind(p.Kind),
                    p.Amount,
                    p.Status))
                .ToList();
            var snap = OpdBillLedgerCalculator.Compute(
                bill.GrossAmount, bill.TaxAmount, bill.InsuranceClaimAmount, bill.IsFinalized, lines);

            var inBillPeriod = bill.BillDate >= fromUtc && bill.BillDate < toUtcExclusive;
            var life = MapLifecycle(bill.BillStatus, bill.IsFinalized, bill.IsInsurance, snap, bill.CcmsClaimOpen);

            if (inBillPeriod)
            {
                patientIds.Add(bill.PatientId);
                package += bill.GrossAmount;
                billedInPeriod += snap.BilledAmount;
                AddAmt(payers, ClassifyPayer(bill.IsInsurance, bill.InsuranceProvider, bill.CcmsPayerType), snap.BilledAmount);
                AddPipeline(pipeline, life, snap.BilledAmount);
            }

            foreach (var pay in bill.Payments.Where(IsPosted))
            {
                if (pay.PaymentDate < fromUtc || pay.PaymentDate >= toUtcExclusive)
                    continue;
                var kind = OpdBillLedgerCalculator.NormalizeKind(pay.Kind);
                if (kind is OpdBillLedgerCalculator.Refund or OpdBillLedgerCalculator.Reversal)
                    refundsInPeriod += pay.Amount;
                else if (kind == OpdBillLedgerCalculator.Discount)
                    discountsInPeriod += pay.Amount;
                else
                {
                    collectedInPeriod += pay.Amount;
                    var inst = NormalizeInstrument(pay.PaymentMode);
                    AddAmt(instruments, inst, pay.Amount);
                }
            }

            var pOut = PatientOutstanding(snap);
            var yOut = PayerOutstanding(snap);
            if (bill.BillDate < toUtcExclusive && (pOut > 0 || yOut > 0))
            {
                patientOs += pOut;
                payerOs += yOut;
                var days = Math.Max(0, (asOf.Date - bill.BillDate.Date).Days);
                var bucket = days switch { <= 30 => aging[0], <= 60 => aging[1], <= 90 => aging[2], _ => aging[3] };
                bucket.Count++;
                bucket.Patient += pOut;
                bucket.Payer += yOut;
            }

            DateTime? lastTx = bill.Payments.Where(IsPosted).Select(p => p.PaymentDate).DefaultIfEmpty().Max();
            if (!bill.Payments.Any(IsPosted)) lastTx = null;

            if (inBillPeriod || pOut > 0 || yOut > 0)
            {
                rows.Add(new PatientRow(
                    bill.BillId, bill.PatientId, bill.JourneyId, bill.PatientName, bill.Mrn,
                    bill.BillDate, bill.BillNumber, snap.BilledAmount, snap.PatientResponsibility,
                    snap.InsuranceResponsibility, snap.Collected, pOut, yOut, life, lastTx,
                    bill.AdmissionDate));
            }
        }

        return new DashboardResult(
            fromUtc, toUtcExclusive, rangeLabel,
            "opd_bills.bill_date",
            "opd_bill_payments.payment_date",
            patientIds.Count, package, billedInPeriod, collectedInPeriod,
            patientOs, payerOs, refundsInPeriod, discountsInPeriod,
            pipeline.Values.OrderBy(v => PipelineOrder(v.Key)).ToList(),
            instruments.Select(kv => new NamedAmount(kv.Key, InstrumentLabel(kv.Key), kv.Value)).OrderByDescending(x => x.Amount).ToList(),
            CompletePayerMix(payers),
            aging.Select(a => new AgingBucket(a.Key, a.Label, a.Count, a.Patient, a.Payer)).ToList(),
            rows.OrderByDescending(r => r.PatientOutstanding + r.PayerOutstanding).ToList(),
            "patient_journey.admitted_at");
    }

    public static string MapLifecycle(
        string billStatus, bool isFinalized, bool isInsurance, OpdBillLedgerCalculator.Snapshot snap,
        bool ccmsClaimOpen = false)
    {
        if (billStatus.Equals("cancelled", StringComparison.OrdinalIgnoreCase))
            return "cancelled";
        if (snap.BilledAmount == 0 && snap.Collected == 0)
            return "no_estimate";
        if (snap.Advances > 0 && snap.BalanceDue > 0 && snap.Collected == snap.Advances && !isFinalized)
            return "advance_held";
        if (IsPendingEstimate(billStatus) && !isFinalized && snap.Collected == 0)
            return "estimated";
        if (snap.Collected == 0 && !isFinalized && snap.BilledAmount > 0)
            return "package_confirmed";
        if (isFinalized && snap.Collected == 0)
            return "bill_posted";
        if (snap.DerivedStatus == "partially_paid")
            return "partially_paid";
        if (snap.BalanceDue <= 0 && !ccmsClaimOpen)
            return "settled";
        if ((isInsurance || ccmsClaimOpen) && snap.InsuranceResponsibility > 0
            && PatientOutstanding(snap) <= 0 && (snap.BalanceDue > 0 || ccmsClaimOpen))
            return "claim_open";
        if (PatientOutstanding(snap) <= 0 && snap.BalanceDue > 0)
            return "patient_cleared";
        if (snap.BalanceDue <= 0)
            return "settled";
        return snap.DerivedStatus;
    }

    public static decimal PatientOutstanding(OpdBillLedgerCalculator.Snapshot snap)
        => Math.Max(0, snap.PatientResponsibility - snap.Collected);

    public static decimal PayerOutstanding(OpdBillLedgerCalculator.Snapshot snap)
        => Math.Max(0, snap.BalanceDue - PatientOutstanding(snap));

    public static string ClassifyPayer(bool isInsurance, string? provider, string? ccmsPayerType = null)
    {
        var ccms = (ccmsPayerType ?? "").Trim().ToLowerInvariant();
        if (ccms is "tpa") return "tpa";
        if (ccms is "govt" or "government" or "government_scheme") return "government";
        if (ccms is "corporate" or "company") return "corporate";
        if (ccms is "self" or "cash") return "self";
        if (ccms is "insurance" or "cashless") return "insurance";
        if (!isInsurance) return "self";
        var p = provider ?? "";
        if (ContainsAny(p, "CGHS", "CGHS", "ECHS", "Ayushman", "PMJAY")) return "government";
        if (ContainsAny(p, "TPA")) return "tpa";
        if (ContainsAny(p, "corporate", "company")) return "corporate";
        return "insurance";
    }

    public static string NormalizeInstrument(string? mode)
    {
        var m = (mode ?? "").Trim().ToLowerInvariant();
        return m switch
        {
            "cash" => "cash",
            "card" or "credit_card" or "debit_card" => "card",
            "upi" or "gpay" or "phonepe" => "upi",
            "bank" or "neft" or "rtgs" or "imps" or "bank_transfer" or "cheque" => "bank_transfer",
            _ => "other",
        };
    }

    public static string LifecycleLabel(string key) => key switch
    {
        "no_estimate" => "No estimate",
        "estimated" => "Estimated",
        "package_confirmed" => "Package confirmed",
        "advance_held" => "Advance held",
        "bill_posted" => "Bill posted",
        "partially_paid" => "Partially paid",
        "patient_cleared" => "Patient cleared",
        "claim_open" => "Claim open",
        "settled" => "Settled",
        "cancelled" => "Cancelled",
        _ => key,
    };

    private static bool IsPosted(PaymentFact p)
        => p.Status.Equals("completed", StringComparison.OrdinalIgnoreCase);

    private static DateTime StartOfIsoWeek(DateTime utcDate)
    {
        var diff = ((int)utcDate.DayOfWeek + 6) % 7;
        return utcDate.AddDays(-diff);
    }

    private static (DateTime, DateTime, string) MonthRange(DateTime todayUtc, string label)
    {
        var from = new DateTime(todayUtc.Year, todayUtc.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        return (from, from.AddMonths(1), label);
    }

    private static void AddPipeline(Dictionary<string, PipelineBucket> map, string key, decimal billed)
    {
        if (!map.TryGetValue(key, out var cur))
            map[key] = new PipelineBucket(key, LifecycleLabel(key), 1, billed);
        else
            map[key] = cur with { Count = cur.Count + 1, BilledAmount = cur.BilledAmount + billed };
    }

    private static void AddAmt(Dictionary<string, decimal> map, string key, decimal amt)
        => map[key] = map.GetValueOrDefault(key) + amt;

    private static int PipelineOrder(string key) => key switch
    {
        "no_estimate" => 0,
        "estimated" => 1,
        "package_confirmed" => 2,
        "advance_held" => 3,
        "bill_posted" => 4,
        "partially_paid" => 5,
        "patient_cleared" => 6,
        "claim_open" => 7,
        "settled" => 8,
        _ => 9,
    };

    private static string InstrumentLabel(string key) => key switch
    {
        "cash" => "Cash",
        "card" => "Card",
        "upi" => "UPI",
        "bank_transfer" => "Bank transfer",
        _ => "Other",
    };

    private static string PayerLabel(string key) => key switch
    {
        "self" => "Self",
        "insurance" => "Insurance",
        "tpa" => "TPA",
        "government" => "Government scheme",
        "corporate" => "Corporate",
        _ => key,
    };

    private static readonly string[] PipelineKeys =
    [
        "no_estimate", "estimated", "package_confirmed", "advance_held",
        "bill_posted", "partially_paid", "patient_cleared", "claim_open", "settled",
    ];

    private static readonly string[] PayerKeys = ["self", "insurance", "tpa", "government", "corporate"];

    private static bool IsPendingEstimate(string billStatus)
        => billStatus.Equals("pending", StringComparison.OrdinalIgnoreCase)
           || billStatus.Equals("draft", StringComparison.OrdinalIgnoreCase);

    private static IReadOnlyList<NamedAmount> CompletePayerMix(Dictionary<string, decimal> payers)
        => PayerKeys.Select(k => new NamedAmount(k, PayerLabel(k), payers.GetValueOrDefault(k)))
            .ToList();

    private static bool ContainsAny(string value, params string[] tokens)
        => tokens.Any(t => value.Contains(t, StringComparison.OrdinalIgnoreCase));

    private sealed class AgingAcc
    {
        public AgingAcc(string key, string label) { Key = key; Label = label; }
        public string Key { get; }
        public string Label { get; }
        public int Count;
        public decimal Patient;
        public decimal Payer;
    }
}
