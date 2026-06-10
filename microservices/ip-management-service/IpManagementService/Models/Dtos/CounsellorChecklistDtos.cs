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
