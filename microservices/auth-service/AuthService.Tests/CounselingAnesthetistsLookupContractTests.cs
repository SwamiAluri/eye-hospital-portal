using System.Reflection;
using AuthService.Controllers;
using AuthService.Authorization;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Finalize OT anaesthetist dropdown must not require broad user.view.
/// Mirrors GET /api/Counseling/surgeons pattern (counseling_sessions.read).
/// </summary>
public class CounselingAnesthetistsLookupContractTests
{
    [Fact]
    public void GetAnesthetists_is_on_CounselingController_with_counseling_sessions_read()
    {
        var method = typeof(CounselingController).GetMethod(
            "GetAnesthetists",
            BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);
        Assert.NotNull(method);

        var httpGet = method!.GetCustomAttribute<HttpGetAttribute>();
        Assert.NotNull(httpGet);
        Assert.Equal("anesthetists", httpGet!.Template);

        var perm = method.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(perm);
        Assert.Equal("counseling_sessions.read", perm!.PermissionCode);
    }

    [Fact]
    public void UsersController_GetAnesthetists_still_requires_user_view_unchanged()
    {
        var method = typeof(UsersController).GetMethod(
            "GetAnesthetists",
            BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);
        Assert.NotNull(method);

        var perm = method!.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(perm);
        Assert.Equal("user.view", perm!.PermissionCode);
    }

    [Fact]
    public void GetAnesthetists_authorization_matches_GetSurgeons_pattern_not_user_view()
    {
        var counseling = typeof(CounselingController).GetMethod(
            "GetAnesthetists", BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)!;
        var surgeons = typeof(CounselingController).GetMethod(
            "GetSurgeons", BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)!;

        var counselingPerm = counseling.GetCustomAttribute<RequirePermissionAttribute>()!.PermissionCode;
        var surgeonsPerm = surgeons.GetCustomAttribute<RequirePermissionAttribute>()!.PermissionCode;
        Assert.Equal(surgeonsPerm, counselingPerm);
        Assert.Equal("counseling_sessions.read", counselingPerm);
    }
}
