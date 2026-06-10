namespace IpManagementService.Models.Dtos;

public record SurgicalSafetyGateDto(
    bool     BillingGateSatisfied,
    bool     BillingVerifiedAuto,
    bool     EmergencyFcApplied,
    decimal? BalanceDue,
    string   FinancialState,
    bool     BeforeAnaesthesiaComplete,
    bool     WhoTimeoutComplete,
    bool     AfterSurgeryComplete,
    List<string> Warnings
);

public record BeforeAnaesthesiaSectionDto(
    bool     IdentityConfirmed,
    bool     EyeRe,
    bool     EyeLe,
    bool     TopicalAntibioticsUsed,
    string?  SurgeryType,
    bool     BillingVerifiedOverride,
    bool     AscanVerified,
    bool     AllergyKnown,
    string?  AllergyDetails,
    bool     ConsentFormChecked,
    bool     FitnessConfirmed,
    DateTime? CompletedAt
);

public record WhoTimeoutSectionDto(
    bool     PatientIdentity,
    bool     CorrectEye,
    bool     CorrectProcedure,
    bool     ConsentConfirmed,
    Guid?    SurgeonUserId,
    Guid?    NurseUserId,
    DateTime? CompletedAt
);

public record AfterSurgerySectionDto(
    bool     ProcedureNameRecorded,
    bool     PostopMedicationInstructed,
    bool     PostopPositionInstructed,
    DateTime? CompletedAt
);

public record SurgicalSafetyChecklistDto(
    Guid     JourneyId,
    string?  EyeOperated,
    string?  ProcedureName,
    BeforeAnaesthesiaSectionDto BeforeAnaesthesia,
    WhoTimeoutSectionDto        WhoTimeout,
    AfterSurgerySectionDto      AfterSurgery,
    SurgicalSafetyGateDto       Gates
);

public record SaveBeforeAnaesthesiaRequest(
    bool     IdentityConfirmed,
    bool     EyeRe,
    bool     EyeLe,
    bool     TopicalAntibioticsUsed,
    string?  SurgeryType,
    bool     BillingVerifiedOverride,
    bool     AscanVerified,
    bool     AllergyKnown,
    string?  AllergyDetails,
    bool     ConsentFormChecked,
    bool     FitnessConfirmed
);

public record SaveWhoTimeoutRequest(
    bool  PatientIdentity,
    bool  CorrectEye,
    bool  CorrectProcedure,
    bool  ConsentConfirmed,
    Guid? SurgeonUserId,
    Guid? NurseUserId
);

public record SaveAfterSurgeryRequest(
    bool ProcedureNameRecorded,
    bool PostopMedicationInstructed,
    bool PostopPositionInstructed
);
