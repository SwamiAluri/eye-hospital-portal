namespace IpManagementService.Models.Dtos;

/// <summary>Per-step readiness slice — mirrors FE <c>StepReadiness</c> (Phase 8).</summary>
public record StepReadinessDto(
    string Key,
    int    Completed,
    int    Total,
    int    Blocking,
    string Status,
    bool   Locked,
    bool   HasCount
);

/// <summary>Derived dilation timer (W-06 A3). Status: not_recorded | not_ready | ready.</summary>
public record DilationSliceDto(
    DateTime? StartedAt,
    DateTime? ReadyAt,
    int?      RemainingSeconds,
    string    Status,
    string?   MedicineName
);

/// <summary>Workspace + ward-list rollup — mirrors FE <c>PreOpReadiness</c>.</summary>
public record PreOpReadinessDto(
    IReadOnlyList<StepReadinessDto> Steps,
    int ReadySteps,
    int CountableSteps,
    int Blockers,
    DilationSliceDto? Dilation = null
);
