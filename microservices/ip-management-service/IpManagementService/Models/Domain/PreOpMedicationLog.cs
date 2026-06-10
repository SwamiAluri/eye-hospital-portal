namespace IpManagementService.Models.Domain;

/// <summary>Per-dose pre-operative medication administration log (Form 4).</summary>
public class PreOpMedicationLog
{
    public Guid      Id                    { get; set; }
    public Guid      TenantId              { get; set; }
    public Guid      PatientJourneyId      { get; set; }
    public Guid?     MedicationId          { get; set; }
    public string    MedicineName          { get; set; } = string.Empty;
    public int       DoseNumber            { get; set; } = 1;
    public DateTime? AdministeredAt        { get; set; }
    public Guid?     AdministeredByUserId  { get; set; }
    public string?   Notes                 { get; set; }
    public int       DisplayOrder          { get; set; }
    public DateTime  CreatedAt             { get; set; }
    public DateTime  UpdatedAt             { get; set; }
    public DateTime? DeletedAt             { get; set; }
    public string    Status                { get; set; } = "active";
}
