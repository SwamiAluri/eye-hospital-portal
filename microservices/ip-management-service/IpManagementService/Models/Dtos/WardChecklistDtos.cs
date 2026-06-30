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
    string?  CompletedByRole,
    // Surgery/patient-type scoping: false when the catalog filters this item out for
    // the journey's procedure (e.g. toric IOL marking on a LASIK case). Defaulted so
    // existing positional constructors stay valid.
    bool     AppliesToJourney = true
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
