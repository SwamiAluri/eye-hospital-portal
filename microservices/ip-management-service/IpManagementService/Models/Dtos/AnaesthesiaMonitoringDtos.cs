namespace IpManagementService.Models.Dtos;

public record MonitoringReadingDto(
    Guid     Id,
    int      ElapsedMin,
    int?     Pulse,
    int?     Spo2,
    DateTime? RecordedAt
);

public record AnaesthesiaMonitoringDto(
    Guid     JourneyId,
    int?     PreOpPulse,
    string?  PreOpBp,
    int?     PreOpSpo2,
    bool     PreOpConsentConfirmed,
    DateTime? PreOpReviewAt,
    List<MonitoringReadingDto> Readings,
    int?     DischargePr,
    string?  DischargeBp,
    bool?    GeneralConditionNormal,
    string?  DischargeRemarks,
    DateTime? DischargeClearedAt,
    bool     DischargeClearanceComplete
);

public record SavePreOpReviewRequest(
    int?     Pulse,
    string?  Bp,
    int?     Spo2,
    bool     ConsentConfirmed
);

public record SaveMonitoringReadingRequest(
    int  ElapsedMin,
    int? Pulse,
    int? Spo2
);

public record UpdateMonitoringReadingRequest(
    int? ElapsedMin,
    int? Pulse,
    int? Spo2
);

public record SaveDischargeClearanceRequest(
    int?     Pulse,
    string?  Bp,
    bool?    GeneralConditionNormal,
    string?  Remarks
);
