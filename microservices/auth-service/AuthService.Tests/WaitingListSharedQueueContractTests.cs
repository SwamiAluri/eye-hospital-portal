using AuthService.Models.Counselor;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// PD-WL-01 — Waiting List stays a shared counselling queue (no CounselorId filter).
/// Phase 3I Slice 1 — visibility is server-authorized branch scope (PD16), not ownership.
/// </summary>
public class WaitingListSharedQueueContractTests
{
    [Fact]
    public void WaitingListFiltersRequest_has_no_CounselorId_property()
    {
        var props = typeof(WaitingListFiltersRequest).GetProperties().Select(p => p.Name).ToHashSet();
        Assert.Contains(nameof(WaitingListFiltersRequest.BranchId), props);
        Assert.Contains(nameof(WaitingListFiltersRequest.FromDate), props);
        Assert.Contains(nameof(WaitingListFiltersRequest.ToDate), props);
        Assert.DoesNotContain("CounselorId", props);
        Assert.DoesNotContain("CreatedByUserId", props);
    }
}
