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

/// <summary>Workspace + ward-list rollup — mirrors FE <c>PreOpReadiness</c>.</summary>
public record PreOpReadinessDto(
    IReadOnlyList<StepReadinessDto> Steps,
    int ReadySteps,
    int CountableSteps,
    int Blockers
);
