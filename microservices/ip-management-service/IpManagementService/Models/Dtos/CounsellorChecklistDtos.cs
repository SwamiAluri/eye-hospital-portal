namespace IpManagementService.Models.Dtos;

public record CounsellorOutpatientItemDto(
    Guid     ItemId,
    string   ItemKey,
    string   ItemLabel,
    string?  Description,
    int      DisplayOrder,
    bool     IsCompleted,
    bool     IsBypassed,
    string?  Notes,
    DateTime? CompletedAt,
    string?  CompletedByRole
);

public record CounsellorOutpatientChecklistDto(
    Guid     CounselingSessionId,
    int      TotalItems,
    int      CompletedItems,
    List<CounsellorOutpatientItemDto> Items
);

public record SaveCounsellorCompletionRequest(
    bool     IsCompleted,
    bool?    IsBypassed,
    string?  BypassReason,
    string?  Notes
);

public record CounsellorPreOpInvestigationItemDto(
    Guid     ItemId,
    string   ItemKey,
    string   WardTargetKey,
    string   ItemLabel,
    string?  Description,
    int      DisplayOrder,
    string?  ResultValue,
    string?  ResultUnit,
    string   EntryStatus,
    string?  Notes,
    DateTime? EnteredAt,
    string?  DefaultUnit,
    string?  ValueType
);

public record CounsellorPreOpInvestigationChecklistDto(
    Guid     CounselingSessionId,
    int      TotalItems,
    int      DraftItems,
    List<CounsellorPreOpInvestigationItemDto> Items
);

public record SaveCounsellorInvestigationResultRequest(
    string   ResultValue,
    string?  ResultUnit,
    string?  Notes
);
