namespace IpManagementService.Models.Dtos;

public record PacInvestigationsDto(
    string? Hgb,
    string? Fbs,
    string? SerumCreatinine,
    string? Hiv,
    string? HBsAg,
    string? Hcv,
    string? Xray,
    string? Ecg,
    string? Echo2d,
    string? BloodGroup,
    string? Others
);

public record PacSystemicReviewDto(
    string? Cvs,
    string? Respiratory,
    string? Renal,
    string? HepaticGi,
    string? Diabetes,
    string? Cns,
    string? Others
);

public record PacAirwayExamDto(
    int?    Mallampati,
    string? MouthOpening,
    string? Mentohyoid,
    string? Neck,
    string? Teeth,
    string? Lungs,
    string? Heart,
    string? VenousAccess
);

public record PacMedicationLineDto(
    string Name,
    string? Dose,
    string? Frequency
);

public record PacAssessmentDto(
    Guid     JourneyId,
    string?  PatientName,
    string?  Uhid,
    string?  ProcedureName,
    string?  EyeOperated,
    DateTime? AssessedAt,
    string?  PreOpDiagnosis,
    string?  Bp,
    int?     Hr,
    int?     PhysicalStatusAsa,
    PacInvestigationsDto Investigations,
    string?  Allergies,
    PacSystemicReviewDto SystemicReview,
    string?  PastAnaestheticHistory,
    PacAirwayExamDto AirwayExam,
    string?  AnaesthesiaPlan,
    bool     PeriOpExplained,
    string?  ConsentType,
    List<PacMedicationLineDto> CurrentMedications,
    string?  PreOpConsultations,
    string?  MedicationsAdvised,
    string?  InvestigationsAdvised,
    string?  CompletedByDesignation,
    string   AssessmentStatus,
    DateTime? CompletedAt,
    bool     IsComplete
);

public record SavePacAssessmentRequest(
    DateTime? AssessedAt,
    string?   PreOpDiagnosis,
    string?   Bp,
    int?      Hr,
    int?      PhysicalStatusAsa,
    PacInvestigationsDto? Investigations,
    string?   Allergies,
    PacSystemicReviewDto? SystemicReview,
    string?   PastAnaestheticHistory,
    PacAirwayExamDto? AirwayExam,
    string?   AnaesthesiaPlan,
    bool?     PeriOpExplained,
    string?   ConsentType,
    List<PacMedicationLineDto>? CurrentMedications,
    string?   PreOpConsultations,
    string?   MedicationsAdvised,
    string?   InvestigationsAdvised,
    string?   CompletedByDesignation
);
