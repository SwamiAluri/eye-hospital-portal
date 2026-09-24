using System;
using System.Linq;
using AuthService.Models.Identity;
using AuthService.Services;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Authentication boundary — Network Hospital (tenant) login email lookup.
/// Branch membership is intentionally out of scope for eligibility.
/// </summary>
public class LoginTenantEmailLookupTests
{
    private static readonly Guid IndiaEyeTenant = Guid.Parse("155fe198-6ae5-4a01-9254-ead5b427247e");
    private static readonly Guid OtherTenant = Guid.Parse("11111111-1111-1111-1111-111111111111");

    [Fact]
    public void FindByNormalizedEmailAndTenant_MatchesMixedCaseEmail_SameTenant()
    {
        var users = new[]
        {
            new AppUser
            {
                Id = Guid.Parse("5599402a-e240-4845-9f1e-da2969068376"),
                Email = "swamidassaluri@gmail.com",
                NormalizedEmail = "SWAMIDASSALURI@GMAIL.COM",
                TenantId = IndiaEyeTenant,
                UserStatus = "active",
            },
        }.AsQueryable();

        var found = LoginIdentityLookup.FindByEmailAndTenant(
            users,
            "SwamidassAluri@gmail.com",
            IndiaEyeTenant,
            LoginIdentityLookup.NormalizeEmail);

        Assert.NotNull(found);
        Assert.Equal(IndiaEyeTenant, found!.TenantId);
    }

    [Fact]
    public void FindByNormalizedEmailAndTenant_RejectsWrongNetworkHospitalTenant()
    {
        var users = new[]
        {
            new AppUser
            {
                Id = Guid.Parse("5599402a-e240-4845-9f1e-da2969068376"),
                Email = "swamidassaluri@gmail.com",
                NormalizedEmail = "SWAMIDASSALURI@GMAIL.COM",
                TenantId = IndiaEyeTenant,
                UserStatus = "active",
            },
        }.AsQueryable();

        var found = LoginIdentityLookup.FindByEmailAndTenant(
            users,
            "swamidassaluri@gmail.com",
            OtherTenant,
            LoginIdentityLookup.NormalizeEmail);

        Assert.Null(found);
    }

    [Fact]
    public void FindByNormalizedEmailAndTenant_DoesNotRequireBranchId()
    {
        var users = new[]
        {
            new AppUser
            {
                Id = Guid.NewGuid(),
                Email = "counsellor2@hospital.com",
                NormalizedEmail = "COUNSELLOR2@HOSPITAL.COM",
                TenantId = IndiaEyeTenant,
                BranchId = null,
                UserStatus = "active",
            },
        }.AsQueryable();

        var found = LoginIdentityLookup.FindByEmailAndTenant(
            users,
            "counsellor2@hospital.com",
            IndiaEyeTenant,
            LoginIdentityLookup.NormalizeEmail);

        Assert.NotNull(found);
        Assert.Null(found!.BranchId);
    }
}
