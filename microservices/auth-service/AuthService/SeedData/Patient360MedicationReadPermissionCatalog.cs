namespace AuthService.SeedData;

/// <summary>
/// Patient 360 clinical prescription history read. SQL 199 is the same catalog and role set.
/// Grants only active, non-deleted roles that already exist. Does not create roles.
/// </summary>
public static class Patient360MedicationReadPermissionCatalog
{
    public const string Code = "patient360.medication.read";
    public const string Name = "Read Patient 360 Medication History";
    public const string Module = "patient360";
    public const string Action = "read";
    public const string ResourceType = "medication_history";
    public const string Scope = "tenant";
    public const string Description =
        "Read-only Patient 360 clinical prescription history from prescription and prescription_medication, excluding financial, dispensing, inventory, notes, diagnosis, and staff identity fields.";

    public static readonly string[] ApprovedRoleNormalizedNames =
    {
        "ADMIN",
        "CONSULTANT",
        "DOCTOR",
        "SENIOR DOCTOR",
        "NURSE",
        "SENIOR NURSE",
        "NURSE MANAGER",
        "SURGEON",
    };
}
