using System.IO;
using System.Linq;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Phase 3I Slice 8 — contract guards for ReQueue endpoint/DTO/service surface.
/// </summary>
public class Phase3ISlice8RequeueContractTests
{
    private static string Read(params string[] relativeParts)
    {
        var root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".."));
        return File.ReadAllText(Path.Combine(new[] { root }.Concat(relativeParts).ToArray()));
    }

    [Fact]
    public void ReQueue_Endpoint_UsesUpdatePermission_NotNewPermission()
    {
        var src = Read("AuthService", "Controllers", "CounselingController.cs");
        Assert.Contains("[HttpPost(\"sessions/{id}/re-queue\")]", src);
        Assert.Contains("[RequirePermission(\"counseling_sessions.update\")]", src);
        Assert.DoesNotContain("counseling_sessions.requeue", src);
    }

    [Fact]
    public void ReQueue_DelegatesToWorkflowService()
    {
        var controller = Read("AuthService", "Controllers", "CounselingController.cs");
        Assert.Contains("ReQueueSessionAsync(", controller);

        var iface = Read("AuthService", "Services", "ICounselingWorkflowService.cs");
        Assert.Contains("ReQueueSessionAsync", iface);
    }

    [Fact]
    public void ReQueue_RequestDto_HasVersionExpectedOwnerAndReason()
    {
        var src = Read("AuthService", "Models", "Counselor", "CounselorCommunicationModels.cs");
        Assert.Contains("class ReQueueSessionRequest", src);
        Assert.Contains("public int? Version", src);
        Assert.Contains("public Guid? ExpectedCounselorId", src);
        Assert.Contains("public string Reason", src);
    }

    [Fact]
    public void OwnershipAuditEvents_IncludesRequeued()
    {
        var src = Read("AuthService", "Services", "CounselingWorkflowService.cs");
        Assert.Contains("public const string Requeued = \"OwnershipRequeued\";", src);
    }
}
