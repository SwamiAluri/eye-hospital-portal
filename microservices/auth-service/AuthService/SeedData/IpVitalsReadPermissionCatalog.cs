namespace AuthService.SeedData;

/// <summary>
/// Patient 360 IP vitals read. SQL 197 is the same catalog and role set.
/// </summary>
public static class IpVitalsReadPermissionCatalog
{
    public const string Code = "ip.vitals.read";
    public const string Name = "Read IP Vitals";
    public const string Module = "ip_management";
    public const string Action = "read";
    public const string ResourceType = "vital_sign";
    public const string Scope = "branch";
    public const string Description =
        "Read-only Patient 360 IP vitals: vital_sign through patient_journey for the approved fields, Ward and PreOp contexts, and approved journey states, limited to the caller's authorized branches. Does not authorize notes, recorder identity, nurse records, pre-op clearance, OPD vitals, billing, journey actions, or any mutation.";

    public static readonly string[] ApprovedRoleNormalizedNames =
    {
        "NURSE",
        "OT NURSE",
        "OTNURSE",
        "ADMIN",
    };
}
