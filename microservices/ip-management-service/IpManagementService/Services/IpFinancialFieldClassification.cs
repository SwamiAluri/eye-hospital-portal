namespace IpManagementService.Services;

/// <summary>
/// Phase 3 classification of IP financial / coverage fields.
/// IP must not independently own hospital-wide settlement.
/// </summary>
public static class IpFinancialFieldClassification
{
    public const string ClinicalWorkflow     = "clinical_workflow";
    public const string BillingProjection    = "billing_projection";
    public const string CoverageProjection   = "coverage_projection";
    public const string LegacyCompatibility  = "legacy_compatibility";
    public const string Deprecated           = "deprecated";

    public sealed record FieldMeta(
        string Field,
        string Classification,
        string CanonicalOwner,
        string Notes);

    public static readonly IReadOnlyList<FieldMeta> All =
    [
        new("FinancialState", ClinicalWorkflow, "IP",
            "Ward/OT workflow compatibility. Settled may emit BillFinalized bridge; Billing remains charge SoT."),
        new("PaymentMode", ClinicalWorkflow, "IP",
            "Drives coverage-based admit policy; not payer approval."),
        new("PackageAmount", BillingProjection, "Billing",
            "Display / counselling estimate snapshot on the journey."),
        new("TotalPaid", BillingProjection, "Billing",
            "Projection of advances/receipts; not claim settlement."),
        new("TotalAdvances", BillingProjection, "Billing",
            "Ward advance projection."),
        new("BalanceDue", BillingProjection, "Billing",
            "Generated / projected outstanding patient responsibility."),
        new("IpBillingTransaction", BillingProjection, "Billing",
            "Ward receipts/advances; not the hospital charge engine."),
        new("IsBillingLocked", ClinicalWorkflow, "IP",
            "Mutation / OT guard — clinically relevant."),
        new("EmergencyFcApplied", ClinicalWorkflow, "IP",
            "Privileged admit override; mirrored to CCMS; not coverage approval."),
        new("InsurancePreauthSubmitted", Deprecated, "CCMS",
            "Legacy flag. Live authorization is CCMS PreauthStatus / coverage case."),
        new("GovernmentApprovalSubmitted", LegacyCompatibility, "CCMS",
            "Scheme doc workflow hint; authorization truth remains CCMS."),
        new("PreauthStatusDto", CoverageProjection, "CCMS",
            "Backend-owned read model from CCMS admit validation."),
    ];

    public static FieldMeta? Find(string field) =>
        All.FirstOrDefault(f =>
            string.Equals(f.Field, field?.Trim(), StringComparison.OrdinalIgnoreCase));

    public static bool IsDeprecated(string field) =>
        Find(field)?.Classification == Deprecated;
}
