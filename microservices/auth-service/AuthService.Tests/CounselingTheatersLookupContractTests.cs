using System.Reflection;
using AuthService.Controllers;
using AuthService.Authorization;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Counsellor Schedule Surgery theater dropdown must not require ot.theaters.view.
/// Mirrors GET /api/Counseling/surgeons pattern (counseling_sessions.read).
/// </summary>
public class CounselingTheatersLookupContractTests
{
    [Fact]
    public void GetTheaters_is_on_CounselingController_with_counseling_sessions_read()
    {
        var method = typeof(CounselingController).GetMethod(
            "GetTheaters",
            BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);
        Assert.NotNull(method);

        var httpGet = method!.GetCustomAttribute<HttpGetAttribute>();
        Assert.NotNull(httpGet);
        Assert.Equal("theaters", httpGet!.Template);

        var perm = method.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(perm);
        Assert.Equal("counseling_sessions.read", perm!.PermissionCode);
    }

    [Fact]
    public void GetTheaters_authorization_matches_GetSurgeons_pattern_not_ot_theaters_view()
    {
        var theaters = typeof(CounselingController).GetMethod(
            "GetTheaters", BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)!;
        var surgeons = typeof(CounselingController).GetMethod(
            "GetSurgeons", BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)!;

        Assert.Equal(
            surgeons.GetCustomAttribute<RequirePermissionAttribute>()!.PermissionCode,
            theaters.GetCustomAttribute<RequirePermissionAttribute>()!.PermissionCode);

        // Explicit: counselling theaters must NOT be gated by OT booking permission.
        Assert.NotEqual(
            "ot.theaters.view",
            theaters.GetCustomAttribute<RequirePermissionAttribute>()!.PermissionCode);
    }

    [Fact]
    public void GetTheaters_accepts_optional_branchId_for_authorized_scope_narrowing()
    {
        // Branch-aware lookup (FollowupBranchAccess) — optional Guid? branchId query param.
        var theaters = typeof(CounselingController).GetMethod(
            "GetTheaters", BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)!;
        var branchParam = theaters.GetParameters().SingleOrDefault(p => p.Name == "branchId");
        Assert.NotNull(branchParam);
        Assert.Equal(typeof(System.Guid?), branchParam!.ParameterType);
        Assert.True(branchParam.IsOptional || branchParam.HasDefaultValue);
    }

    [Fact]
    public void OTBookingController_GetAllTheaters_still_requires_ot_theaters_view_unchanged()
    {
        var method = typeof(OTBookingController).GetMethod(
            "GetAllTheaters",
            BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);
        Assert.NotNull(method);

        var perm = method!.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(perm);
        Assert.Equal("ot.theaters.view", perm!.PermissionCode);
    }
}
