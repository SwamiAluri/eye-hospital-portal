using IpManagementService.Models.Dtos;
using IpManagementService.Services;
using Xunit;

namespace IpManagementService.Tests;

public class SectionDisplayStatusHelperTests
{
  [Fact]
  public void Derive_locks_evaluation_at_expected()
  {
    var status = SectionDisplayStatusHelper.Derive(
      "Expected",
      "Evaluation",
      "NotRequested",
      []);

    Assert.Equal(SectionDisplayStatusHelper.Locked, status);
  }

  [Fact]
  public void Derive_maps_coordination_statuses()
  {
    Assert.Equal(
      SectionDisplayStatusHelper.AwaitingDepartment,
      SectionDisplayStatusHelper.Derive("Admitted", "Consent", "Requested", []));

    Assert.Equal(
      SectionDisplayStatusHelper.ReadyToConfirm,
      SectionDisplayStatusHelper.Derive("Admitted", "Consent", "RespondedClear", []));

    Assert.Equal(
      SectionDisplayStatusHelper.Complete,
      SectionDisplayStatusHelper.Derive("Admitted", "Consent", "WardConfirmed", []));
  }

  [Fact]
  public void Derive_item_progress_when_not_requested()
  {
    var items = new List<PreOpCompletionDto>
    {
      MakeItem(completed: true),
      MakeItem(completed: false),
    };

    Assert.Equal(
      SectionDisplayStatusHelper.PartiallyComplete,
      SectionDisplayStatusHelper.Derive("Expected", "Consent", "NotRequested", items));
  }

  [Fact]
  public void ComputeDeptRollup_uses_active_sections()
  {
    var sections = new List<PreOpSectionClearanceDto>
    {
      MakeSection("Consent", "WardConfirmed", SectionDisplayStatusHelper.Complete),
      MakeSection("Financial", "Requested", SectionDisplayStatusHelper.AwaitingDepartment),
    };

    var rollup = SectionDisplayStatusHelper.ComputeDeptRollup(sections, []);

    Assert.Equal(1, rollup.Completed);
    Assert.Equal(2, rollup.Total);
    Assert.True(rollup.NeedsAttention);
  }

  private static PreOpCompletionDto MakeItem(bool completed) => new(
    Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
    "key", "label", "Consent",
    true, false, completed, false,
    null, null, null, null, null, DateTime.UtcNow,
    null, null);

  private static PreOpSectionClearanceDto MakeSection(
    string category,
    string status,
    string displayStatus) => new(
    Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
    category, "STD_NURSE", status,
    null, null, null, null, null,
    false, null, null,
    null, null, null,
    DateTime.UtcNow, DateTime.UtcNow,
    "Normal", null,
    displayStatus);
}
