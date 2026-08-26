namespace IpManagementService.Services.Uat;

public enum UatTargetState
{
    Expected,
    Admitted,
    ReadyForSurgery,
    SentToOT,
    InOT,
    SurgeryCompleted,
    PostOp,
    ReadyForDischarge,
    Discharged,
    CancelledSurgery,
}

public enum UatBillingKind
{
    None,
    Estimated,
    PackageConfirmed,
    AdvanceHeld,
    PartialPayment,
    FullyPaid,
    Refund,
    Reversal,
    Discount,
}

public enum UatCoverageKind
{
    SelfPay,
    Pending,
    Approved,
    Rejected,
    PatientSharePartial,
    TpaOutstandingPatientCleared,
}

public sealed record UatScenarioDef(
    string Key,
    string Label,
    UatTargetState Target,
    UatBillingKind Billing,
    UatCoverageKind Coverage,
    bool CompletePac,
    bool ApplyEmergencyFc,
    bool BedTransfer,
    bool Lama,
    bool Readmission,
    bool DischargeOverride,
    bool CancelFromReady,
    bool OccupiedBedConflict);

public static class UatScenarioCatalog
{
    public const int ReplicasPerScenario = 5;

    private static readonly string[] Procedures =
    [
        "LASIK",
        "Phacoemulsification + IOL",
        "Cataract Surgery",
        "Trabeculectomy",
        "Vitrectomy",
        "Pterygium Surgery",
        "Corneal Procedure",
        "Retinal Procedure",
    ];

    private static readonly string[] FirstNames =
    [
        "Ananya", "Rohan", "Meera", "Arjun", "Kavya",
        "Ishaan", "Diya", "Vikram", "Nisha", "Aditya",
        "Pooja", "Karan", "Sneha", "Rahul", "Priya",
        "Amit", "Neha", "Sanjay", "Lakshmi", "Dev",
        "Tara", "Nikhil", "Isha", "Gaurav", "Ritu",
        "Harsh", "Asha", "Varun", "Simran", "Manish",
    ];

    public static readonly UatScenarioDef[] Scenarios =
    [
        new("expected", "Cash / Expected", UatTargetState.Expected, UatBillingKind.None, UatCoverageKind.SelfPay, false, false, false, false, false, false, false, false),
        new("admitted", "Cash / Admitted", UatTargetState.Admitted, UatBillingKind.Estimated, UatCoverageKind.SelfPay, false, false, false, false, false, false, false, false),
        new("ready_ot", "Ready for OT", UatTargetState.ReadyForSurgery, UatBillingKind.PackageConfirmed, UatCoverageKind.SelfPay, true, false, false, false, false, false, false, false),
        new("blocked_pac", "Ready for OT blocked (PAC)", UatTargetState.Admitted, UatBillingKind.Estimated, UatCoverageKind.SelfPay, false, false, false, false, false, false, false, false),
        new("blocked_checklist", "Ready for OT blocked (checklist)", UatTargetState.Admitted, UatBillingKind.Estimated, UatCoverageKind.SelfPay, true, false, false, false, false, false, false, false),
        new("sent_to_ot", "Sent to OT", UatTargetState.SentToOT, UatBillingKind.PartialPayment, UatCoverageKind.SelfPay, true, false, false, false, false, false, false, false),
        new("in_ot", "In OT", UatTargetState.InOT, UatBillingKind.PartialPayment, UatCoverageKind.SelfPay, true, false, false, false, false, false, false, false),
        new("surgery_done", "Surgery completed", UatTargetState.SurgeryCompleted, UatBillingKind.PartialPayment, UatCoverageKind.SelfPay, true, false, false, false, false, false, false, false),
        new("postop", "Post-Op", UatTargetState.PostOp, UatBillingKind.PartialPayment, UatCoverageKind.SelfPay, true, false, false, false, false, false, false, false),
        new("ready_dc_paid", "Ready D/C / Paid", UatTargetState.ReadyForDischarge, UatBillingKind.FullyPaid, UatCoverageKind.SelfPay, true, false, false, false, false, false, false, false),
        new("ready_dc_block", "Ready D/C / Financial block", UatTargetState.ReadyForDischarge, UatBillingKind.PartialPayment, UatCoverageKind.SelfPay, true, false, false, false, false, false, false, false),
        new("discharged", "Discharged", UatTargetState.Discharged, UatBillingKind.FullyPaid, UatCoverageKind.SelfPay, true, false, false, false, false, false, false, false),
        new("cancelled", "Cancellation (Expected)", UatTargetState.CancelledSurgery, UatBillingKind.None, UatCoverageKind.SelfPay, false, false, false, false, false, false, false, false),
        new("cancel_ready", "Cancellation (Ready for OT)", UatTargetState.CancelledSurgery, UatBillingKind.Estimated, UatCoverageKind.SelfPay, true, false, false, false, false, false, true, false),
        new("lama", "LAMA candidate", UatTargetState.Admitted, UatBillingKind.PartialPayment, UatCoverageKind.SelfPay, false, false, false, true, false, false, false, false),
        new("readmission", "Readmission (active #2)", UatTargetState.Admitted, UatBillingKind.Estimated, UatCoverageKind.SelfPay, false, false, false, false, true, false, false, false),
        new("bed_transfer", "Bed transfer", UatTargetState.Admitted, UatBillingKind.Estimated, UatCoverageKind.SelfPay, false, false, true, false, false, false, false, false),
        new("bed_conflict", "Bed unavailable", UatTargetState.Admitted, UatBillingKind.None, UatCoverageKind.SelfPay, false, false, false, false, false, false, false, true),
        new("ins_pending", "Insurance / Pending", UatTargetState.Expected, UatBillingKind.PackageConfirmed, UatCoverageKind.Pending, false, false, false, false, false, false, false, false),
        new("ins_approved", "Coverage approved", UatTargetState.Admitted, UatBillingKind.PackageConfirmed, UatCoverageKind.Approved, true, false, false, false, false, false, false, false),
        new("ins_rejected", "Coverage rejected", UatTargetState.Expected, UatBillingKind.PackageConfirmed, UatCoverageKind.Rejected, false, false, false, false, false, false, false, false),
        new("share_partial", "Patient share partial", UatTargetState.Admitted, UatBillingKind.PartialPayment, UatCoverageKind.PatientSharePartial, true, false, false, false, false, false, false, false),
        new("tpa_cleared", "TPA outstanding / patient cleared", UatTargetState.ReadyForDischarge, UatBillingKind.FullyPaid, UatCoverageKind.TpaOutstandingPatientCleared, true, false, false, false, false, false, false, false),
        new("emergency_fc", "Emergency FC", UatTargetState.Admitted, UatBillingKind.Estimated, UatCoverageKind.Pending, false, true, false, false, false, false, false, false),
        new("dc_override", "Discharge override", UatTargetState.ReadyForDischarge, UatBillingKind.PartialPayment, UatCoverageKind.SelfPay, true, false, false, false, false, true, false, false),
        new("bill_none", "No bill", UatTargetState.Admitted, UatBillingKind.None, UatCoverageKind.SelfPay, false, false, false, false, false, false, false, false),
        new("bill_advance", "Advance held", UatTargetState.Admitted, UatBillingKind.AdvanceHeld, UatCoverageKind.SelfPay, false, false, false, false, false, false, false, false),
        new("bill_refund", "Refund", UatTargetState.Admitted, UatBillingKind.Refund, UatCoverageKind.SelfPay, false, false, false, false, false, false, false, false),
        new("bill_reversal", "Reversal", UatTargetState.Admitted, UatBillingKind.Reversal, UatCoverageKind.SelfPay, false, false, false, false, false, false, false, false),
        new("bill_discount", "Discount", UatTargetState.Admitted, UatBillingKind.Discount, UatCoverageKind.SelfPay, false, false, false, false, false, false, false, false),
    ];

    public static IReadOnlyList<(string Code, UatScenarioDef Scenario, int Replica)> Expand()
    {
        var list = new List<(string, UatScenarioDef, int)>(Scenarios.Length * ReplicasPerScenario);
        var n = 1;
        foreach (var s in Scenarios)
        {
            for (var r = 1; r <= ReplicasPerScenario; r++)
            {
                list.Add(($"UAT-IP-{n:000}", s, r));
                n++;
            }
        }
        return list;
    }

    public static string ProcedureFor(int index) => Procedures[index % Procedures.Length];
    public static string FirstNameFor(int index) => FirstNames[index % FirstNames.Length];
    public static string GenderFor(int index) => index % 2 == 0 ? "Female" : "Male";
    public static DateTime DobFor(int index) => new DateTime(1960 + (index % 40), 1 + (index % 12), 1 + (index % 27), 0, 0, 0, DateTimeKind.Utc);
    public static decimal PackageFor(UatScenarioDef s, int replica) => s.Billing switch
    {
        UatBillingKind.None => 80_000m + replica * 1_000m,
        UatBillingKind.AdvanceHeld => 120_000m,
        UatBillingKind.FullyPaid => 50_000m,
        UatBillingKind.Refund => 80_000m,
        UatBillingKind.Discount => 90_000m,
        _ => 100_000m + replica * 5_000m,
    };
}
