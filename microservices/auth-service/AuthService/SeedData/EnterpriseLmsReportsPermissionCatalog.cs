namespace AuthService.SeedData;

/// <summary>
/// LMS Report permission definitions (L-REP-01 / L-REP-02 / L-REP-03 CUT A / CUT B / CUT C).
/// No role grants (PD-REP-21 / PD-ART-13 / PD-PDF-11 / PD-DL-19). Catalogue codes do not imply role grants.
/// Do not seed lms.reports.publish (patient publication out of scope).
/// </summary>
public static class EnterpriseLmsReportsPermissionCatalog
{
    public const string ReportsView = "lms.reports.view";
    public const string ReportsManage = "lms.reports.manage";
    public const string ReportsFinalize = "lms.reports.finalize";
    public const string ReportsRelease = "lms.reports.release";
    public const string ReportsDownload = "lms.reports.download";
    public const string ReportsAssignNumber = "lms.reports.assign_number";
    public const string ReportsGenerate = "lms.reports.generate";

    public static readonly string[] RequiredPermissionCodes =
    {
        ReportsView,
        ReportsManage,
        ReportsFinalize,
        ReportsRelease,
        ReportsDownload,
        ReportsAssignNumber,
        ReportsGenerate,
    };

    public static readonly (string Code, string Name, string Module, string Action, string ResourceType, string Description)[] PermissionDefinitions =
    {
        (
            ReportsView,
            "View LMS Reports",
            "lms",
            "view",
            "lms_report",
            "View Enterprise LMS Draft Report worklist and ReportVersion snapshots (L-REP-01). Not patient publication."
        ),
        (
            ReportsManage,
            "Manage LMS Reports",
            "lms",
            "manage",
            "lms_report",
            "Create Draft LMS Reports and append ReportVersions from ClinicallyAuthorized ResultVersions (L-REP-01)."
        ),
        (
            ReportsFinalize,
            "Finalize LMS Reports",
            "lms",
            "finalize",
            "lms_report",
            "Finalize Draft Enterprise LMS Reports to Final (L-REP-02A metadata). Does not Release, publish, or generate PDF."
        ),
        (
            ReportsRelease,
            "Release LMS Reports",
            "lms",
            "release",
            "lms_report",
            "Release Final Enterprise LMS Reports to Released (L-REP-02B metadata). Does not publish, notify, generate PDF, or assign a business Report number."
        ),
        (
            ReportsDownload,
            "Download LMS Reports",
            "lms",
            "download",
            "lms_report",
            "Download the current Official PDF for a Released, numbered Enterprise LMS Report (L-REP-03 CUT C). Catalogue only — no role grants. Does not publish to patients."
        ),
        (
            ReportsAssignNumber,
            "Assign LMS Report Number",
            "lms",
            "assign_number",
            "lms_report",
            "Assign an immutable business Report Number to a Released Enterprise LMS Report (L-REP-03 CUT A). Does not generate PDF or download."
        ),
        (
            ReportsGenerate,
            "Generate LMS Official PDF",
            "lms",
            "generate",
            "lms_report",
            "Request asynchronous Official PDF generation for a Released, numbered Enterprise LMS Report (L-REP-03 CUT B). Catalogue only — no role grants. Does not download or publish to patients."
        ),
    };
}
