namespace AuthService.SeedData;

/// <summary>
/// L0 Laboratory UAT prerequisite: restore existing page/API permission codes and
/// grant them to Lab Technician / Lab Manager roles. Does not invent new lab.* codes.
/// Admin unrestricted access is role-based wildcard elsewhere — not listed here.
/// </summary>
public static class LaboratoryL0UatPermissionCatalog
{
    public const string LaboratoryView = "laboratory.view";
    public const string PatientView = "patient.view";
    public const string PatientUpdate = "patient.update";

    public static readonly string[] RequiredPermissionCodes =
    {
        LaboratoryView,
        PatientView,
        PatientUpdate,
    };

    /// <summary>Live named roles approved for L0 Lab page + LabReport contracts. Matching uses NormalizedName.</summary>
    public static readonly string[] ApprovedRoleNormalizedNames =
    {
        "LAB TECHNICIAN",
        "LAB MANAGER",
    };

    public static readonly (string Code, string Name, string Module, string Action, string ResourceType, string Description)[] PermissionDefinitions =
    {
        (
            LaboratoryView,
            "View Laboratory",
            "laboratory",
            "view",
            "laboratory",
            "Access the Laboratory staff area (nav / ProtectedRoute). Does not invent lab workflow permissions."
        ),
        (
            PatientView,
            "View Patients",
            "patient",
            "view",
            "patient",
            "View patient records including LabReport read/content (existing LabReportsController contract)."
        ),
        (
            PatientUpdate,
            "Update Patients",
            "patient",
            "update",
            "patient",
            "Update patient-linked clinical/lab records including LabReport write/complete/attach (existing LabReportsController contract)."
        ),
    };
}
