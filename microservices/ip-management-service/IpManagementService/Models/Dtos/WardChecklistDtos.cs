namespace IpManagementService.Models.Dtos;

public record WardChecklistItemDto(
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
    string?  CompletedByRole
);

public record WardChecklistDto(
    Guid     JourneyId,
    int      TotalItems,
    int      CompletedItems,
    string   FinancialState,
    decimal? BalanceDue,
    bool     EmergencyFcApplied,
    DateTime? WardCheckInAt,
    DateTime? InformedOtTeamAt,
    List<WardChecklistItemDto> Items
);

public record SaveWardChecklistCompletionRequest(
    bool     IsCompleted,
    bool?    IsBypassed,
    string?  BypassReason,
    string?  Notes
);
