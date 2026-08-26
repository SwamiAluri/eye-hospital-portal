namespace IpManagementService.Models.Domain;

/// <summary>
/// Historical ward/bed assignment for a journey. Occupancy SoT remains Auth bed inventory.
/// </summary>
public class JourneyBedAssignment
{
    public Guid     Id                  { get; set; }
    public Guid     TenantId            { get; set; }
    public Guid     PatientJourneyId    { get; set; }
    public Guid     PatientId           { get; set; }
    public Guid?    WardId              { get; set; }
    public string?  WardName            { get; set; }
    public string?  RoomNumber          { get; set; }
    public string?  BedNumber           { get; set; }
    public Guid?    AssignedBedId       { get; set; }
    public string   AssignmentType      { get; set; } = BedAssignmentType.Initial;
    public Guid?    AssignedFromBedId   { get; set; }
    public Guid?    AssignedToBedId     { get; set; }
    public DateTime StartedAt           { get; set; }
    public DateTime? EndedAt            { get; set; }
    public Guid?    PerformedByUserId   { get; set; }
    public string?  Reason              { get; set; }
    public DateTime CreatedAt           { get; set; }
    public DateTime UpdatedAt           { get; set; }
    public Guid?    CreatedByUserId     { get; set; }
    public Guid?    UpdatedByUserId     { get; set; }
    public DateTime? DeletedAt          { get; set; }
    public string   Status              { get; set; } = "active";
}
