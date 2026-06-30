using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

/// <summary>
/// G3 / R5 — computed §2 display status (mirrors FE section-display-status.ts).
/// </summary>
public static class SectionDisplayStatusHelper
{
  public const string Locked = "Locked";
  public const string NotStarted = "NotStarted";
  public const string PartiallyComplete = "PartiallyComplete";
  public const string AwaitingDepartment = "AwaitingDepartment";
  public const string ReadyToConfirm = "ReadyToConfirm";
  public const string ConcernsRaised = "ConcernsRaised";
  public const string OnHold = "OnHold";
  public const string Rejected = "Rejected";
  public const string Escalated = "Escalated";
  public const string Complete = "Complete";

  private static readonly HashSet<string> AdmissionLockedCategories = new(StringComparer.Ordinal)
  {
    "Evaluation",
    "Anaesthesia",
  };

  private static readonly HashSet<string> ExcludedDeptCategories = new(StringComparer.Ordinal)
  {
    "Lab Tests",
    "Diagnostic Imaging",
    "Investigations",
    "Vitals",
  };

  private static readonly HashSet<string> AttentionStatuses = new(StringComparer.Ordinal)
  {
    AwaitingDepartment,
    ReadyToConfirm,
    ConcernsRaised,
    OnHold,
    Rejected,
    Escalated,
  };

  public static bool IsDepartmentClearanceCategory(string category)
    => !ExcludedDeptCategories.Contains(category);

  public static bool IndicatesAttention(string? displayStatus)
    => displayStatus != null && AttentionStatuses.Contains(displayStatus);

  public static string Derive(
    string clinicalState,
    string category,
    string backendStatus,
    IReadOnlyList<PreOpCompletionDto> categoryItems)
  {
    if (clinicalState == "Expected" && AdmissionLockedCategories.Contains(category))
      return Locked;

    switch (backendStatus)
    {
      case "WardConfirmed":
        return Complete;
      case "RespondedClear":
        return ReadyToConfirm;
      case "RespondedConcerns":
        return ConcernsRaised;
      case "Requested":
      case "NeedsInfo":
        return AwaitingDepartment;
      case "OnHold":
        return OnHold;
      case "Rejected":
        return Rejected;
      case "Escalated":
        return Escalated;
    }

    var pool = MandatoryItems(categoryItems);
    var done = pool.Count(i => i.IsCompleted || i.IsBypassed);
    var total = pool.Count;
    if (total == 0 || done == 0) return NotStarted;
    if (done >= total) return Complete;
    return PartiallyComplete;
  }

  public static PreOpSectionClearanceDto MapSectionClearance(
    Models.Domain.PreOpSectionClearance section,
    Guid journeyId,
    string clinicalState,
    IReadOnlyList<PreOpCompletionDto> allCompletions)
  {
    var categoryItems = allCompletions
      .Where(c => c.Category == section.SectionCategory)
      .ToList();
    var displayStatus = Derive(clinicalState, section.SectionCategory, section.Status, categoryItems);

    return new PreOpSectionClearanceDto(
      section.Id,
      section.ClearanceId,
      journeyId,
      section.SectionCategory,
      section.ResponsibleDepartmentCode,
      section.Status,
      section.RequestedByUserId,
      section.RequestedAt,
      section.RespondedByUserId,
      section.RespondedAt,
      section.ResponseNotes,
      section.IsExternalResponder,
      section.ExternalResponderName,
      section.ExternalResponderContact,
      section.ConfirmedByUserId,
      section.ConfirmedAt,
      section.ConfirmationNotes,
      section.CreatedAt,
      section.UpdatedAt,
      section.Urgency,
      section.RejectionReason,
      displayStatus);
  }

  public static (int Completed, int Total, bool NeedsAttention) ComputeDeptRollup(
    IReadOnlyList<PreOpSectionClearanceDto> sectionClearances,
    IReadOnlyList<PreOpCompletionDto> deptCompletions)
  {
    var activeSections = sectionClearances
      .Where(s => s.Status != "NotRequested")
      .ToList();

    if (activeSections.Count > 0)
    {
      var confirmed = activeSections.Count(s => s.Status == "WardConfirmed");
      var needsAttention = activeSections.Any(s => IndicatesAttention(s.SectionDisplayStatus));
      return (confirmed, activeSections.Count, needsAttention);
    }

    var deptItems = deptCompletions
      .Where(c => IsDepartmentClearanceCategory(c.Category))
      .ToList();
    var pool = deptItems.Where(c => c.IsBlocking).ToList();
    if (pool.Count == 0) pool = deptItems;
    var done = pool.Count(c => c.IsCompleted || c.IsBypassed);
    return (done, pool.Count, false);
  }

  private static List<PreOpCompletionDto> MandatoryItems(IReadOnlyList<PreOpCompletionDto> items)
  {
    var blocking = items.Where(i => i.IsBlocking).ToList();
    return blocking.Count > 0 ? blocking : items.ToList();
  }
}
