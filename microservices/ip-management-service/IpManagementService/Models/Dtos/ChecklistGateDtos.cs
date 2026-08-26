using IpManagementService.Models.Domain;

namespace IpManagementService.Models.Dtos;

public record ChecklistGateWarningDto(
    string   Code,
    string   Message,
    string   Severity,   // warn | block
    bool     CanOverride,
    string   Category = DischargeBlockerCategory.Clinical
);

public record ChecklistGateResultDto(
    string   Transition,
    bool     CanProceed,
    bool     RequiresOverride,
    IReadOnlyList<ChecklistGateWarningDto> Warnings
);

public record TransitionClinicalResponseDto(
    PatientJourneyDetailDto Journey,
    IReadOnlyList<ChecklistGateWarningDto> Warnings
);

public record WhoSupervisorOverrideRequest(string? Reason);

public record ChecklistPhaseStatusDto(
    bool OutpatientSafetyComplete,
    bool WardInvestigationComplete,
    bool WardChecklistComplete,
    bool PacCompleted,
    bool WhoTimeoutComplete,
    bool WardPostopComplete,
    bool AnaesthesiaDischargeCleared
);

public record InvestigationPhaseSummaryDto(
    int VerifiedCount,
    int TotalApplicable,
    IReadOnlyList<string> UnverifiedCritical
);
