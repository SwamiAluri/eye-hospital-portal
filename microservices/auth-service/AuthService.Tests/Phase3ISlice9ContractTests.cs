using System;
using System.IO;
using System.Linq;
using System.Reflection;
using AuthService.Models.Counselor;
using AuthService.Models.Domain;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Phase 3I Slice 9 — contract guards for Finalize ownership boundary surface.
/// </summary>
public class Phase3ISlice9ContractTests
{
    private static string Read(params string[] relativeParts)
    {
        var root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".."));
        return File.ReadAllText(Path.Combine(new[] { root }.Concat(relativeParts).ToArray()));
    }

    [Fact]
    public void OtFinalizeSchedule_HasBranchId_NoCounselorId()
    {
        var t = typeof(OtFinalizeSchedule);
        Assert.NotNull(t.GetProperty(nameof(OtFinalizeSchedule.BranchId)));
        Assert.Null(t.GetProperty(
            "CounselorId", BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase));
    }

    [Fact]
    public void PostSurgeryFollowupItemDto_HasNoCounselorId()
    {
        Assert.Null(typeof(PostSurgeryFollowupItemDto).GetProperty(
            "CounselorId", BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase));
        Assert.NotNull(typeof(PostSurgeryFollowupItemDto).GetProperty(nameof(PostSurgeryFollowupItemDto.SessionId)));
    }

    [Fact]
    public void OtFinalizeService_InjectsFollowupBranchAccess()
    {
        var src = Read("AuthService", "Services", "OtFinalizeService.cs");
        Assert.Contains("IFollowupBranchAccessService _branchAccess", src);
        Assert.Contains("EnsureActorCanAccessScheduleAsync", src);
        // Ownership must not be written onto OT entities (comments may mention CounselorId).
        Assert.DoesNotContain(".CounselorId =", src);
        Assert.DoesNotContain("CounselorId = null", src);
    }

    [Fact]
    public void AssignSession_RejectsSurgeryDone()
    {
        var src = Read("AuthService", "Services", "CounselingWorkflowService.cs");
        Assert.Contains("SurgeryDone sessions cannot be assigned.", src);
    }

    [Fact]
    public void MarkSurgeryDone_DoesNotClearCounselorId()
    {
        var src = Read("AuthService", "Services", "OtFinalizeService.cs");
        Assert.Contains("MarkSurgeryDoneAsync", src);
        // Must not mutate counselling ownership from OT surgery-done path.
        Assert.DoesNotContain("CounselorId = null", src);
        Assert.DoesNotContain(".CounselorId =", src);
    }
}
