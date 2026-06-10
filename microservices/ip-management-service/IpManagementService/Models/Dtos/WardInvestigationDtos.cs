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
    bool     AppliesToJourney
);

public record WardInvestigationChecklistDto(
    Guid     JourneyId,
    int      TotalItems,
    int      CompletedItems,
    string?  AnaesthesiaType,
    List<WardInvestigationItemDto> Items
);

public record SaveWardInvestigationCompletionRequest(
    bool     IsCompleted,
    bool?    IsBypassed,
    string?  BypassReason,
    string?  Notes
);
