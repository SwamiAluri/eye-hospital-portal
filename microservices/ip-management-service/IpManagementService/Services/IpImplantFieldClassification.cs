namespace IpManagementService.Services;

/// <summary>
/// E4 / F6 — implant usage vs compatibility flags.
/// Usage, charge, and stock follow <c>journey_implant_usage</c> only.
/// </summary>
public static class IpImplantFieldClassification
{
    public const string UsageRecord         = "usage_record";
    public const string PlannedClinical     = "planned_clinical";
    public const string ProcessTick         = "process_tick";
    public const string LegacyCompatibility = "legacy_compatibility";

    public sealed record FieldMeta(
        string Field,
        string Classification,
        string CanonicalOwner,
        string Notes);

    public static readonly IReadOnlyList<FieldMeta> All =
    [
        new("JourneyImplantUsage", UsageRecord, "IP registry",
            "Per-patient implant/IOL usage. Record implant writes this row and emits ImplantUsed. Charge and stock follow the outbox, not this classification."),
        new("PatientJourney.IolPower", PlannedClinical, "IP journey",
            "Planned lens power from OPD/counselling. Compared at record time; not a usage or charge record."),
        new("PatientJourney.IolIssuedFromIp", ProcessTick, "IP journey",
            "OT tick for where the lens was drawn. Not usage, inventory, or billing truth."),
        new("PatientJourney.IolBarcode", LegacyCompatibility, "IP registry",
            "Compatibility / planned-model hint. Verify and OT Details must not write scanned barcodes here. Read allowed for planned-model lookup."),
        new("PatientJourney.IolBarcodeVerified", LegacyCompatibility, "IP registry",
            "Compatibility flag. Verify IOL barcode must not persist this. Record implant is the usage event."),
        new("IntraOpNote.ImplantUsed", LegacyCompatibility, "IP registry",
            "Free-text leftover. Save ignores client writes; GET overlays the latest Implanted registry row when present."),
        new("IntraOpNote.ImplantPower", LegacyCompatibility, "IP registry",
            "Free-text leftover. Save ignores client writes; GET overlays registry power when present."),
    ];

    public static FieldMeta? Find(string field) =>
        All.FirstOrDefault(f =>
            string.Equals(f.Field, field?.Trim(), StringComparison.OrdinalIgnoreCase));

    public static bool WritesAreFrozen(string field) =>
        Find(field)?.Classification == LegacyCompatibility;
}
