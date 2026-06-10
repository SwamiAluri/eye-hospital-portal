namespace IpManagementService.Models.Domain;

/// <summary>Form 1 OT — Surgical Safety Checklist (3 phases).</summary>
public class SurgicalSafetyChecklist
{
    public Guid      Id                              { get; set; }
    public Guid      TenantId                        { get; set; }
    public Guid      PatientJourneyId                { get; set; }

    public bool      IdentityConfirmed               { get; set; }
    public bool      EyeRe                           { get; set; }
    public bool      EyeLe                           { get; set; }
    public bool      TopicalAntibioticsUsed          { get; set; }
    public string?   SurgeryType                     { get; set; }
    public bool      BillingVerifiedOverride         { get; set; }
    public bool      AscanVerified                   { get; set; }
    public bool      AllergyKnown                    { get; set; }
    public string?   AllergyDetails                  { get; set; }
    public bool      ConsentFormChecked              { get; set; }
    public bool      FitnessConfirmed                { get; set; }
    public DateTime? BeforeAnaesthesiaCompletedAt    { get; set; }
    public Guid?     BeforeAnaesthesiaCompletedBy    { get; set; }

    public bool      WhoPatientIdentity              { get; set; }
    public bool      WhoCorrectEye                   { get; set; }
    public bool      WhoCorrectProcedure             { get; set; }
    public bool      WhoConsentConfirmed             { get; set; }
    public Guid?     WhoSurgeonUserId                { get; set; }
    public Guid?     WhoNurseUserId                  { get; set; }
    public DateTime? WhoCompletedAt                  { get; set; }

    public bool      ProcedureNameRecorded           { get; set; }
    public bool      PostopMedicationInstructed      { get; set; }
    public bool      PostopPositionInstructed        { get; set; }
    public DateTime? AfterSurgeryCompletedAt         { get; set; }
    public Guid?     AfterSurgeryCompletedBy         { get; set; }

    public DateTime  CreatedAt                       { get; set; }
    public DateTime  UpdatedAt                       { get; set; }
    public DateTime? DeletedAt                       { get; set; }
    public string    Status                          { get; set; } = "active";
}
