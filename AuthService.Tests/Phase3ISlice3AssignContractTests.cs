using System.Reflection;
using AuthService.Authorization;
using AuthService.Controllers;
using AuthService.Models.Counselor;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Phase 3I Slice 3 — Assign endpoint contract (route, permission, request shape).
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

        var parameters = method.GetParameters();
        Assert.Equal(2, parameters.Length);
        Assert.Equal(typeof(Guid), parameters[0].ParameterType);
        Assert.Equal(typeof(AssignCounselingSessionRequest), parameters[1].ParameterType);
    }

    [Fact]
    public void AssignCounselingSessionRequest_has_CounselorId_only()
    {
        var props = typeof(AssignCounselingSessionRequest).GetProperties().Select(p => p.Name).ToHashSet();
        Assert.Contains(nameof(AssignCounselingSessionRequest.CounselorId), props);
        Assert.DoesNotContain("BranchId", props);
        Assert.DoesNotContain("TenantId", props);
    }

    [Fact]
    public void ClaimSessionForLifecycle_is_post_claim_for_lifecycle_with_update_permission()
    {
        var method = typeof(CounselingController).GetMethod(
            "ClaimSessionForLifecycle",
            BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);
        Assert.NotNull(method);

        var httpPost = method!.GetCustomAttribute<HttpPostAttribute>();
        Assert.NotNull(httpPost);
        Assert.Equal("sessions/{id}/claim-for-lifecycle", httpPost!.Template);

        var perm = method.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(perm);
        Assert.Equal("counseling_sessions.update", perm!.PermissionCode);

        var parameters = method.GetParameters();
        Assert.Equal(2, parameters.Length);
        Assert.Equal(typeof(ClaimCounselingSessionForLifecycleRequest), parameters[1].ParameterType);
    }

    [Fact]
    public void ClaimCounselingSessionForLifecycleRequest_has_expected_owner_and_intent_only()
    {
        var props = typeof(ClaimCounselingSessionForLifecycleRequest).GetProperties().Select(p => p.Name).ToHashSet();
        Assert.Contains(nameof(ClaimCounselingSessionForLifecycleRequest.ExpectedCounselorId), props);
        Assert.Contains(nameof(ClaimCounselingSessionForLifecycleRequest.Intent), props);
        Assert.Equal(typeof(Guid?), typeof(ClaimCounselingSessionForLifecycleRequest).GetProperty(
            nameof(ClaimCounselingSessionForLifecycleRequest.ExpectedCounselorId))!.PropertyType);
        Assert.DoesNotContain("CounselorId", props);
        Assert.DoesNotContain("BranchId", props);
        Assert.DoesNotContain("TenantId", props);
    }
}
