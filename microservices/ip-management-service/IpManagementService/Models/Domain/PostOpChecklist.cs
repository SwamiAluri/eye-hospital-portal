namespace IpManagementService.Models.Domain;

public class NurseChecklistItem
{
    public Guid     Id          { get; set; }
    public Guid     TenantId    { get; set; }
    public string   ItemLabel   { get; set; } = string.Empty;
    public int      ItemOrder   { get; set; }
    public bool     IsActive    { get; set; } = true;
    public DateTime CreatedAt   { get; set; }
    public DateTime UpdatedAt   { get; set; }
    public DateTime? DeletedAt  { get; set; }
}

public class NurseChecklistResponse
{
    public Guid     Id                  { get; set; }
    public Guid     TenantId            { get; set; }
    public Guid     PatientJourneyId    { get; set; }
    public Guid     ChecklistItemId     { get; set; }
    public bool     IsCompleted         { get; set; }
    public string?  Notes               { get; set; }
    public Guid?    CompletedByUserId   { get; set; }
    public DateTime? CompletedAt       { get; set; }
    public DateTime CreatedAt           { get; set; }
    public DateTime UpdatedAt           { get; set; }
    public DateTime? DeletedAt          { get; set; }
}

public class SurgeonChecklistItem
{
    public Guid     Id          { get; set; }
    public Guid     TenantId    { get; set; }
    public string   ItemLabel   { get; set; } = string.Empty;
    public int      ItemOrder   { get; set; }
    public bool     IsActive    { get; set; } = true;
    public DateTime CreatedAt   { get; set; }
    public DateTime UpdatedAt   { get; set; }
    public DateTime? DeletedAt  { get; set; }
}

public class SurgeonChecklistResponse
{
    public Guid     Id                  { get; set; }
    public Guid     TenantId            { get; set; }
    public Guid     PatientJourneyId    { get; set; }
    public Guid     ChecklistItemId     { get; set; }
    public bool     IsCompleted         { get; set; }
    public string?  Notes               { get; set; }
    public Guid?    CompletedByUserId   { get; set; }
    public DateTime? CompletedAt       { get; set; }
    public DateTime CreatedAt           { get; set; }
    public DateTime UpdatedAt           { get; set; }
    public DateTime? DeletedAt          { get; set; }
}

public class PostOpInstruction
{
    public Guid     Id                    { get; set; }
    public Guid     TenantId              { get; set; }
    public Guid     PatientJourneyId      { get; set; }
    public string?  Medications           { get; set; } // JSONB stored as string
    public string?  ActivityRestrictions  { get; set; }
    public string?  DietaryInstructions   { get; set; }
    public DateTime? FollowupDate         { get; set; }
    public Guid?    FollowupDoctorId      { get; set; }
    public Guid?    FollowupAppointmentId { get; set; }
    public string?  EyeCareInstructions   { get; set; }
    public string?  WarningSigns          { get; set; } // JSONB stored as string
    public string   Status                { get; set; } = "active";
    public bool     IsSaved               { get; set; }
    public DateTime? SavedAt              { get; set; }
    public Guid?    SavedByUserId         { get; set; }
    public DateTime CreatedAt             { get; set; }
    public DateTime UpdatedAt             { get; set; }
    public DateTime? DeletedAt            { get; set; }
}
