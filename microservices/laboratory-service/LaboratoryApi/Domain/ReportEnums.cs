namespace LaboratoryApi.Domain;

/// <summary>
/// Report lifecycle. Separate from <see cref="ResultStatuses"/>.
/// Draft → Final (L-REP-02A). Final → Released (L-REP-02B metadata).
/// </summary>
public static class ReportStatuses
{
    public const string Draft = "Draft";
    public const string Final = "Final";
    public const string Released = "Released";
}

public static class ReportIdempotencyOperations
{
    public const string CreateReportDraft = "create_report_draft";
    public const string AppendReportVersion = "append_report_version";
    public const string FinalizeReport = "finalize_report";
    public const string ReleaseReport = "release_report";
    public const string AssignReportNumber = "assign_report_number";
    public const string GenerateOfficialPdf = "generate_official_pdf";
}

public static class ReportAuditActions
{
    public const string CreateReportDraft = "CREATE_REPORT_DRAFT";
    public const string AppendReportVersion = "APPEND_REPORT_VERSION";
    public const string FinalizeReport = "FINALIZE_REPORT";
    public const string ReleaseReport = "RELEASE_REPORT";
    public const string AssignReportNumber = "ASSIGN_REPORT_NUMBER";
    public const string RequestOfficialPdf = "REQUEST_OFFICIAL_PDF";
    public const string OfficialPdfGenerated = "OFFICIAL_PDF_GENERATED";
    public const string OfficialPdfFailed = "OFFICIAL_PDF_FAILED";
    /// <summary>L-REP-03 CUT C — staff download of current Official PDF (fail-closed).</summary>
    public const string DownloadOfficialPdf = "DOWNLOAD_OFFICIAL_PDF";
}

public static class ReportAuditResources
{
    public const string LmsReport = "LmsReport";
    public const string LmsReportVersion = "LmsReportVersion";
}
