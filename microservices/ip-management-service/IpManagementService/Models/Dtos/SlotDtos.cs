namespace IpManagementService.Models.Dtos;

public record AssignSlotRequest(
    Guid      JourneyId,
    Guid      BranchId,
    Guid      TheatreId,
    DateOnly  SlotDate,
    string    Session,
    int?      SequenceNo = null,
    DateTime? PlannedArrivalAt = null,
    string?   TheatreName = null
);

public record ReorderSlotsRequest(
    Guid               BranchId,
    Guid               TheatreId,
    DateOnly           SlotDate,
    string             Session,
    IReadOnlyList<Guid> JourneyIds,
    string?            TheatreName = null
);

public record ReleaseSlotRequest(string? Reason = null);

public record JourneySlotRowDto(
    Guid      Id,
    Guid      JourneyId,
    Guid      TheatreId,
    string?   TheatreName,
    DateOnly  SlotDate,
    string    Session,
    int       SequenceNo,
    DateTime  PlannedArrivalAt,
    string    SlotLabel,
    DateTime? ReleasedAt,
    string?   ReleasedReason,
    string?   PatientName,
    string?   Uhid,
    string?   ProcedureName,
    string?   EyeOperated,
    string?   ClinicalState,
    bool      PacCompleted,
    string?   OtState = null,
    bool      IsEmergencyFc = false
);

public record UnassignedSlotCandidateDto(
    Guid    JourneyId,
    string? PatientName,
    string? Uhid,
    string? ProcedureName,
    string? EyeOperated,
    string  ClinicalState
);

public record SlotBoardDto(
    DateOnly Date,
    Guid?    TheatreId,
    IReadOnlyList<JourneySlotRowDto> Morning,
    IReadOnlyList<JourneySlotRowDto> Afternoon,
    IReadOnlyList<JourneySlotRowDto> Evening,
    IReadOnlyList<UnassignedSlotCandidateDto> Unassigned
);

public record SlotMetricsDto(
    int     AssignedCount,
    int     ReadyCount,
    double? AvgArrivalToDischargeMinutes,
    double? AvgTurnoverMinutes
);

public record SlotThroughputBreakdownDto(
    string  Key,
    string  Label,
    int     AssignedCount,
    int     CompletedCount,
    int     DischargedCount,
    double? AvgArrivalToDischargeMinutes
);

/// <summary>
/// RPT-080. Period report (not the one-day board widget). One row per journey-day,
/// preferring the active slot over released history.
/// <c>VitalsOverrideCount</c> is Mark Ready despite <c>vitals_out_of_range</c> (not missing vitals).
/// <c>IolMismatchOverrideCount</c> is record-implant mismatch overrides. Both are audit counts
/// on journeys slotted in the window — not a second clinical or billing path.
/// </summary>
public record SlotThroughputDto(
    DateOnly From,
    DateOnly To,
    int     AssignedCount,
    int     ActiveCount,
    int     CancelledCount,
    int     ReadyCount,
    int     CompletedCount,
    int     DischargedCount,
    double? AvgArrivalToDischargeMinutes,
    double? MedianArrivalToDischargeMinutes,
    double? AvgTurnoverMinutes,
    IReadOnlyList<SlotThroughputBreakdownDto> BySession,
    IReadOnlyList<SlotThroughputBreakdownDto> ByTheatre,
    IReadOnlyList<SlotThroughputBreakdownDto> ByDay,
    int VitalsOverrideCount = 0,
    int IolMismatchOverrideCount = 0
);
