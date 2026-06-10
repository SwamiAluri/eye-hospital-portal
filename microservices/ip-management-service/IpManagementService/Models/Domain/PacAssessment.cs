namespace IpManagementService.Models.Domain;

/// <summary>Form 3 — Pre-Anaesthesia Check-up (PAC) assessment.</summary>
public class PacAssessment
{
    public Guid      Id                       { get; set; }
    public Guid      TenantId                 { get; set; }
    public Guid      PatientJourneyId         { get; set; }

    public DateTime? AssessedAt               { get; set; }
    public string?   PreOpDiagnosis           { get; set; }

    public string?   Bp                       { get; set; }
    public int?      Hr                       { get; set; }
    public int?      PhysicalStatusAsa        { get; set; }

    public string    Investigations           { get; set; } = "{}";
    public string?   Allergies                { get; set; }
    public string    SystemicReview           { get; set; } = "{}";
    public string?   PastAnaestheticHistory   { get; set; }
    public string    AirwayExam               { get; set; } = "{}";

    public string?   AnaesthesiaPlan          { get; set; }
    public bool      PeriOpExplained          { get; set; }
    public string?   ConsentType              { get; set; }
    public string    CurrentMedications       { get; set; } = "[]";
    public string?   PreOpConsultations       { get; set; }
    public string?   MedicationsAdvised       { get; set; }
    public string?   InvestigationsAdvised    { get; set; }
    public string?   CompletedByDesignation   { get; set; }

    public string    AssessmentStatus         { get; set; } = "Draft";
    public Guid?     CompletedByUserId        { get; set; }
    public DateTime? CompletedAt              { get; set; }

    public DateTime  CreatedAt                { get; set; }
    public DateTime  UpdatedAt                { get; set; }
    public DateTime? DeletedAt                { get; set; }
    public string    Status                   { get; set; } = "active";
}
