using System.Reflection;
using AuthService.Controllers;
using AuthService.Authorization;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Counsellor Add Patient surgeon dropdown must not require broad user.view.
/// Mirrors GET /api/Counseling/counselors pattern (counseling_sessions.read).
/// </summary>
public class CounselingSurgeonsLookupContractTests
{
    [Fact]
    public void GetSurgeons_is_on_CounselingController_with_counseling_sessions_read()
    {
        var method = typeof(CounselingController).GetMethod(
            "GetSurgeons",
            BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);
        Assert.NotNull(method);

        var httpGet = method!.GetCustomAttribute<HttpGetAttribute>();
        Assert.NotNull(httpGet);
        Assert.Equal("surgeons", httpGet!.Template);

        var perm = method.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(perm);
        Assert.Equal("counseling_sessions.read", perm!.PermissionCode);
    }

    [Fact]
    public void UsersController_GetSurgeons_still_requires_user_view_unchanged()
    {
        var method = typeof(UsersController).GetMethod(
            "GetSurgeons",
            BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);
        Assert.NotNull(method);

        var perm = method!.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(perm);
        Assert.Equal("user.view", perm!.PermissionCode);
    }
}
