namespace AuthService.SeedData;

/// <summary>
/// LMS Testing / Verification / Clinical Authorization / Critical Results permission definitions only.
/// No role grants (PD-TST-15 / PD-VER-14 / PD-AUTH-18 / PD-CRT-10).
/// </summary>
public static class EnterpriseLmsTestingPermissionCatalog
{
    public const string TestingView = "lms.testing.view";
    public const string TestingManage = "lms.testing.manage";
    public const string TestingResult = "lms.testing.result";
    public const string TestingVerify = "lms.testing.verify";
    public const string ResultsAuthorize = "lms.results.authorize";
    public const string ResultsCriticalView = "lms.results.critical.view";
    public const string ResultsCriticalManage = "lms.results.critical.manage";
    public const string ResultsCriticalAcknowledge = "lms.results.critical.acknowledge";

    public static readonly string[] RequiredPermissionCodes =
    {
        TestingView,
        TestingManage,
        TestingResult,
        TestingVerify,
        ResultsAuthorize,
        ResultsCriticalView,
        ResultsCriticalManage,
        ResultsCriticalAcknowledge,
    };

    public static readonly (string Code, string Name, string Module, string Action, string ResourceType, string Description)[] PermissionDefinitions =
    {
        (
            TestingView,
            "View LMS Testing",
            "lms",
            "view",
            "lms_testing",
            "Read Enterprise LMS Testing work queue and Result Draft detail (L-TST-01A)."
        ),
        (
            TestingManage,
            "Manage LMS Testing",
            "lms",
            "manage",
            "lms_testing",
            "Manage Testing work queue context (L-TST-01A)."
        ),
        (
            TestingResult,
            "Enter LMS Result Drafts",
            "lms",
            "result",
            "lms_result",
            "Create and update Manual Result Drafts (L-TST-01A)."
        ),
        (
            TestingVerify,
            "Technically Verify LMS Results",
            "lms",
            "verify",
            "lms_result",
            "Perform Technical Verification of Result Drafts (L-VER-01). Not Clinical Authorization."
        ),
        (
            ResultsAuthorize,
            "Clinically Authorize LMS Results",
            "lms",
            "authorize",
            "lms_result",
            "Perform Clinical Authorization of TechnicalVerified Results (L-AUTH-01). Not Final/Released/Reporting."
        ),
        (
            ResultsCriticalView,
            "View LMS Critical Results",
            "lms",
            "view",
            "lms_critical_result",
            "View Critical Results work queue and event detail (L-CRT-01). Not Final/Released/patient-visible."
        ),
        (
            ResultsCriticalManage,
            "Classify LMS Critical Results",
            "lms",
            "manage",
            "lms_critical_result",
            "Manually classify eligible Result Versions as Critical (L-CRT-01). Not automated thresholds."
        ),
        (
            ResultsCriticalAcknowledge,
            "Acknowledge LMS Critical Results",
            "lms",
            "acknowledge",
            "lms_critical_result",
            "Acknowledge Critical Result events with evidence via LaboratoryApi (L-CRT-01)."
        ),
    };
}
