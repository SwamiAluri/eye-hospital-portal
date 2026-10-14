namespace LaboratoryApi.Domain;

/// <summary>Stable catalogue object kinds (PRD).</summary>
public static class CatalogueTypes
{
    public const string Test = "TEST";
    public const string Panel = "PANEL";
    public const string ReferralTest = "REFERRAL_TEST";

    public static readonly HashSet<string> All = new(StringComparer.OrdinalIgnoreCase)
    {
        Test, Panel, ReferralTest,
    };

    public static bool IsValid(string? value) =>
        !string.IsNullOrWhiteSpace(value) && All.Contains(value.Trim());
}

/// <summary>Server-owned lifecycle states. Do not accept arbitrary client status writes.</summary>
public static class CatalogueStatuses
{
    public const string Draft = "Draft";
    public const string Review = "Review";
    public const string Approved = "Approved";
    public const string Active = "Active";
    public const string Retired = "Retired";
    public const string Superseded = "Superseded";

    public static readonly HashSet<string> All = new(StringComparer.Ordinal)
    {
        Draft, Review, Approved, Active, Retired, Superseded,
    };

    public static readonly HashSet<string> ImmutableDefinition = new(StringComparer.Ordinal)
    {
        Active, Retired, Superseded,
    };
}

/// <summary>Local vs referral performing classification.</summary>
public static class CatalogueClassifications
{
    public const string Local = "LOCAL";
    public const string Referral = "REFERRAL";

    public static bool IsValid(string? value) =>
        string.Equals(value, Local, StringComparison.OrdinalIgnoreCase)
        || string.Equals(value, Referral, StringComparison.OrdinalIgnoreCase);
}

/// <summary>PRD discipline codes. Availability is deployment configuration — not auto-activated.</summary>
public static class CatalogueDisciplines
{
    public static readonly string[] Codes =
    {
        "CLINICAL_CHEMISTRY",
        "HEMATOLOGY_COAGULATION",
        "IMMUNOLOGY_SEROLOGY",
        "MICROBIOLOGY",
        "MOLECULAR_DIAGNOSTICS",
        "HISTOPATHOLOGY_CYTOPATHOLOGY",
        "TRANSFUSION_IMMUNOHEMATOLOGY",
        "URINALYSIS_CLINICAL_PATHOLOGY",
        "TOXICOLOGY_TDM",
        "POCT",
    };

    public static bool IsValid(string? value) =>
        !string.IsNullOrWhiteSpace(value)
        && Codes.Contains(value.Trim(), StringComparer.OrdinalIgnoreCase);
}

/// <summary>Platform audit action codes for catalogue mutations.</summary>
public static class CatalogueAuditActions
{
    public const string CreateDraft = "CREATE_DRAFT";
    public const string UpdateDraft = "UPDATE_DRAFT";
    public const string SubmitReview = "SUBMIT_REVIEW";
    public const string ReturnToDraft = "RETURN_TO_DRAFT";
    public const string Approve = "APPROVE";
    public const string Activate = "ACTIVATE";
    public const string Retire = "RETIRE";
    public const string Supersede = "SUPERSEDE";
    public const string CreateVersion = "CREATE_VERSION";
}
