namespace IpManagementService.Models.Dtos;

public record WardInvestigationItemDto(
    Guid     ItemId,
    string   ItemKey,
    string   ItemLabel,
    string?  Description,
    int      DisplayOrder,
    bool     IsCompleted,
    bool     IsBypassed,
    string?  Notes,
    DateTime? CompletedAt,
    string?  Source,
    bool     AppliesToJourney,
    // Phase 2 — structured result fields
    string?  ResultValue,
    string?  ResultUnit,
    string?  ReferenceRange,
    string?  ResultFlag,
    string?  ResultSource,
    string   EntryStatus,
    Guid?    EnteredByUserId,
    DateTime? EnteredAt,
    Guid?    VerifiedByUserId,
    DateTime? VerifiedAt,
    Guid?    DocumentId,
    string?  DocumentFileName,
    string?  DocumentPreviewUrl,
    string?  ExternalReportNote,
    bool     IsCritical,
    bool     CounsellorDraft,
    string?  DefaultUnit,
    string?  ValueType,
    string?  EnteredByName,
    string?  VerifiedByName
);

public record WardInvestigationChecklistDto(
    Guid     JourneyId,
    int      TotalItems,
    int      CompletedItems,
    string?  AnaesthesiaType,
    List<WardInvestigationItemDto> Items,
    IReadOnlyList<string> UnverifiedCriticalKeys
);

public record SaveWardInvestigationCompletionRequest(
    bool     IsCompleted,
    bool?    IsBypassed,
    string?  BypassReason,
    string?  Notes
);

public record SaveWardInvestigationResultRequest(
    string   ResultValue,
    string?  ResultUnit,
    string?  ReferenceRange,
    string?  ResultFlag,
    string?  ResultSource,
    string?  ExternalReportNote,
    string?  Notes
);

public record VerifyWardInvestigationRequest(
    string?  Notes
);

public record UploadInvestigationDocumentRequest(
    string   DocumentType,
    string   FileName,
    string   ContentType,
    string   FileData
);

public record InvestigationDocumentDto(
    Guid     DocumentId,
    string   FileName,
    string   FileUrl,
    string?  ContentType,
    long?    FileSizeBytes,
    bool     IsVerified
);

public record WardInvestigationSummaryItemDto(
    string   ItemKey,
    string   ItemLabel,
    string?  ResultValue,
    string?  ResultUnit,
    string   EntryStatus,
    bool     IsCritical,
    bool     AppliesToJourney
);

public record WardInvestigationSummaryDto(
    Guid     JourneyId,
    IReadOnlyList<WardInvestigationSummaryItemDto> Items,
    IReadOnlyList<string> UnverifiedCriticalKeys
);

public record CompletePacAssessmentResultDto(
    PacAssessmentDto Assessment,
    IReadOnlyList<string> UnverifiedCriticalWarnings
);
