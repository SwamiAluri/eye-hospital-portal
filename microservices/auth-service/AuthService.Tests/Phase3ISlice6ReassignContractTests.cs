using System.Reflection;
using AuthService.Authorization;
using AuthService.Controllers;
using AuthService.Models.Counselor;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Phase 3I Slice 6 — Reassign endpoint contract (source + reflection).
/// </summary>
public class Phase3ISlice6ReassignContractTests
{
    [Fact]
    public void CounselingController_source_contains_reassign_route_and_permission()
    {
        var path = LocateCounselingControllerSource();
        Assert.True(File.Exists(path), $"Expected source at {path}");
        var src = File.ReadAllText(path);

        Assert.Contains("sessions/{id}/reassign", src, StringComparison.Ordinal);
        Assert.Contains("RequirePermission(\"counseling_sessions.reassign\")", src, StringComparison.Ordinal);
        Assert.Contains("ReassignSessionAsync", src, StringComparison.Ordinal);
    }

    [Fact]
    public void ReassignSession_is_post_sessions_id_reassign_with_reassign_permission()
    {
        var method = typeof(CounselingController).GetMethod(
            "ReassignSession",
            BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);
        Assert.NotNull(method);

        var httpPost = method!.GetCustomAttribute<HttpPostAttribute>();
        Assert.NotNull(httpPost);
        Assert.Equal("sessions/{id}/reassign", httpPost!.Template);

        var perm = method.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(perm);
        Assert.Equal("counseling_sessions.reassign", perm!.PermissionCode);

        var parameters = method.GetParameters();
        Assert.Equal(2, parameters.Length);
        Assert.Equal(typeof(Guid), parameters[0].ParameterType);
        Assert.Equal(typeof(ReassignCounselingSessionRequest), parameters[1].ParameterType);
    }

    [Fact]
    public void ReassignCounselingSessionRequest_has_target_expected_and_reason_only()
    {
        var props = typeof(ReassignCounselingSessionRequest).GetProperties().Select(p => p.Name).ToHashSet();
        Assert.Contains(nameof(ReassignCounselingSessionRequest.CounselorId), props);
        Assert.Contains(nameof(ReassignCounselingSessionRequest.ExpectedCounselorId), props);
        Assert.Contains(nameof(ReassignCounselingSessionRequest.Reason), props);
        Assert.DoesNotContain("BranchId", props);
        Assert.DoesNotContain("TenantId", props);
        Assert.DoesNotContain("Intent", props);
    }

    private static string LocateCounselingControllerSource()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            var candidate = Path.Combine(
                dir.FullName,
                "microservices", "auth-service", "AuthService", "Controllers", "CounselingController.cs");
            if (File.Exists(candidate)) return candidate;

            // When running from microservices/auth-service/AuthService.Tests bin
            candidate = Path.Combine(
                dir.FullName,
                "AuthService", "Controllers", "CounselingController.cs");
            if (File.Exists(candidate)) return candidate;

            dir = dir.Parent;
        }

        return Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "..", "..", "..", "..",
            "AuthService", "Controllers", "CounselingController.cs"));
    }
}
