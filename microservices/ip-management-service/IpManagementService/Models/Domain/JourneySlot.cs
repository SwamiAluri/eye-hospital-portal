namespace IpManagementService.Models.Domain;

/// <summary>
/// IP-013. Session batch / staggered arrival. Rows are history; <see cref="ReleasedAt"/>
/// frees a sequence. <c>patient_journey.slot_id</c> is the current pointer.
/// </summary>
public class JourneySlot
{
    public Guid      Id                 { get; set; }
    public Guid      TenantId           { get; set; }
    public Guid      BranchId           { get; set; }
    public DateOnly  SlotDate           { get; set; }
    public string    Session            { get; set; } = SlotSession.Morning;
    public Guid      TheatreId          { get; set; }
    public string?   TheatreName        { get; set; }
    public int       SequenceNo         { get; set; }
    public DateTime  PlannedArrivalAt   { get; set; }
    public Guid      JourneyId          { get; set; }
    public DateTime? ReleasedAt         { get; set; }
    public string?   ReleasedReason     { get; set; }
    public Guid?     ReleasedByUserId   { get; set; }
    public DateTime  CreatedAt          { get; set; }
    public DateTime  UpdatedAt          { get; set; }
    public Guid?     CreatedByUserId    { get; set; }
    public Guid?     UpdatedByUserId    { get; set; }
}

public static class SlotSession
{
    public const string Morning   = "Morning";
    public const string Afternoon = "Afternoon";
    public const string Evening   = "Evening";

    public static readonly HashSet<string> All = new(StringComparer.Ordinal)
    {
        Morning, Afternoon, Evening,
    };
}
