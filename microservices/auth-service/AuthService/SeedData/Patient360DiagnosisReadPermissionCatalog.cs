namespace AuthService.SeedData;

/// <summary>
/// Patient 360 coded diagnosis history read. SQL 200 is the same catalog and role set.
/// Grants only active, non-deleted roles that already exist. Does not create roles.
/// </summary>
public static class Patient360DiagnosisReadPermissionCatalog
{
    public const string Code = "patient360.diagnosis.read";
    public const string Name = "Read Patient 360 Diagnosis History";
    public const string Module = "patient360";
    public const string Action = "read";
    public const string ResourceType = "diagnosis_history";
    public const string Scope = "tenant";
    public const string Description =
        "Read-only Patient 360 coded diagnosis history from patient_diagnosis and diagnosis_code, excluding diagnosis notes, examination narrative, draft diagnosis, payer and financial diagnosis representations, and staff identifiers.";

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
        "JUNIOR DOCTOR",
        "ANAESTHETIST",
        "COUNSELLOR",
        "RADIOLOGIST",
        "MEDICAL RECORDS OFFICER",
    };
}
