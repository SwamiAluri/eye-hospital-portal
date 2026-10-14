namespace AuthService.SeedData;

/// <summary>
/// Patient 360 OCT metadata read. SQL 198 is the same catalog and role set.
/// Grants only active, non-deleted roles that already exist. Does not create roles.
/// </summary>
public static class DiagnosticOctReadPermissionCatalog
{
    public const string Code = "diagnostic.oct.read";
    public const string Name = "Read OCT metadata";
    public const string Module = "diagnostic";
    public const string Action = "read";
    public const string ResourceType = "oct_imaging";
    public const string Scope = "branch";
    public const string Description =
        "Read-only Patient 360 OCT metadata from oct_imaging_scans for the approved fields only: scan date, eye, scan type, scan pattern, scan size, device, device model, and status. Limited to the caller's server-authorized branches. Does not authorize measurements, signal or quality scores, pathology or fluid findings, technician identity, notes, diagnosis, image paths, thumbnail paths, data-file paths, storage keys, URLs, file bytes, viewer, download, preview, upload, edit, delete, capture, search, statistics, or any other OCT route.";

    public static readonly string[] ApprovedRoleNormalizedNames =
    {
        "ADMIN",
        "DOCTOR",
        "SURGEON",
        "OPTOMETRIST",
    };
}
