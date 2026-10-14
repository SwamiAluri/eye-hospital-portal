namespace AuthService.SeedData;

/// <summary>
/// Phase 3O stored grants for the existing patient.create permission.
/// Does not define or rewrite the permission catalog row.
/// </summary>
public static class PatientCreateRoleGrantCatalog
{
    public const string Code = "patient.create";

    /// <summary>Live named roles approved to hold patient.create. Matching uses NormalizedName, not RoleCode.</summary>
    public static readonly string[] ApprovedRoleNormalizedNames =
    {
        "ADMIN",
        "COUNSELLOR",
        "RECEPTIONIST",
        "MEDICAL RECORDS OFFICER",
        "NURSE",
        "IP COORDINATOR",
    };
}
