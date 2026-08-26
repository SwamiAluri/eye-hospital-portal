namespace IpManagementService.Models.Domain;

public class IntraOpNote
{
    public Guid     Id                   { get; set; }
    public Guid     TenantId             { get; set; }
    public Guid     BranchId             { get; set; }
    public Guid     PatientJourneyId     { get; set; }

    // Surgical team
    public Guid?    PrimarySurgeonId     { get; set; }
    public Guid?    AssistantSurgeonId   { get; set; }
    public Guid?    AnesthesiologistId   { get; set; }
    public Guid?    ScrubNurseId         { get; set; }

    // Procedure
    public DateTime? SurgeryStartTime   { get; set; }
    public DateTime? SurgeryEndTime     { get; set; }
    public string?  AnesthesiaType       { get; set; }
    public string?  AnesthesiaNotes      { get; set; }
    public string?  ProcedurePerformed   { get; set; }
    public string?  EyeOperated          { get; set; }
    public string?  Findings             { get; set; }
    public string?  Complications        { get; set; }

    // IOL implant — E4 compatibility only. Save ignores client writes; GET overlays registry.
    public string?  ImplantUsed          { get; set; }
    public string?  ImplantPower         { get; set; }

    // Measurements
    public int?     BloodLossMl          { get; set; }
    public int?     IvFluidMl            { get; set; }
    public bool     SpecimenSent         { get; set; }
    public string?  SpecimenDetails      { get; set; }

    // Status
    public string   NotesStatus          { get; set; } = "Draft"; // Draft|Signed|Locked
    public DateTime? SignedAt            { get; set; }
    public Guid?    SignedByUserId       { get; set; }

    // Audit
    public DateTime  CreatedAt           { get; set; }
    public DateTime  UpdatedAt           { get; set; }
    public Guid?     CreatedByUserId     { get; set; }
    public Guid?     UpdatedByUserId     { get; set; }
    public DateTime? DeletedAt           { get; set; }
    public string    Status              { get; set; } = "active";
}
