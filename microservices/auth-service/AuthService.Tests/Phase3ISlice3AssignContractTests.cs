using System.Linq;
using System.Reflection;
using AuthService.Authorization;
using AuthService.Controllers;
using AuthService.Models.Counselor;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Phase 3I Slice 3 — Assign endpoint contract (secondary test project).
/// </summary>
public class Phase3ISlice3AssignContractTests
{
    [Fact]
    public void AssignSession_is_post_sessions_id_assign_with_update_permission()
    {
        var method = typeof(CounselingController).GetMethod(
            "AssignSession",
            BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);
        Assert.NotNull(method);

        var httpPost = method!.GetCustomAttribute<HttpPostAttribute>();
        Assert.NotNull(httpPost);
        Assert.Equal("sessions/{id}/assign", httpPost!.Template);

        var perm = method.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(perm);
        Assert.Equal("counseling_sessions.update", perm!.PermissionCode);
    }

    [Fact]
    public void AssignCounselingSessionRequest_has_CounselorId_only()
    {
        var props = typeof(AssignCounselingSessionRequest).GetProperties().Select(p => p.Name).ToHashSet();
        Assert.Contains(nameof(AssignCounselingSessionRequest.CounselorId), props);
        Assert.DoesNotContain("BranchId", props);
        Assert.DoesNotContain("TenantId", props);
    }
}
