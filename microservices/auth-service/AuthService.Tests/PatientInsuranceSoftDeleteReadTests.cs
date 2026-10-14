using System.Security.Claims;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models.Domain;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Patient insurance list relies on the PatientInsurance query filter for soft delete.
/// </summary>
public class PatientInsuranceSoftDeleteReadTests
{
    private static readonly Guid TenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid PatientId = Guid.Parse("44444444-4444-4444-4444-444444444444");

    [Fact]
    public async Task ActiveInsurance_IsReturned()
    {
        await using var db = CreateDb();
        var active = Row(TenantId, deleted: null);
        db.PatientInsurances.Add(active);
        await db.SaveChangesAsync();

        var rows = await Read(db, TenantId, PatientId);

        Assert.Contains(rows, row => row.Id == active.Id);
    }

    [Fact]
    public async Task SoftDeletedInsurance_IsExcluded()
    {
        await using var db = CreateDb();
        var deleted = Row(TenantId, deleted: DateTime.UtcNow);
        db.PatientInsurances.Add(deleted);
        await db.SaveChangesAsync();

        var rows = await Read(db, TenantId, PatientId);

        Assert.Empty(rows);
        Assert.Equal(1, await db.PatientInsurances.IgnoreQueryFilters().CountAsync());
    }

    [Fact]
    public async Task MixedInsurance_ReturnsOnlyTheActiveRow()
    {
        await using var db = CreateDb();
        var active = Row(TenantId, deleted: null);
        db.PatientInsurances.Add(active);
        db.PatientInsurances.Add(Row(TenantId, deleted: DateTime.UtcNow));
        await db.SaveChangesAsync();

        var rows = await Read(db, TenantId, PatientId);

        Assert.Equal(active.Id, Assert.Single(rows).Id);
    }

    [Fact]
    public async Task OtherTenantInsurance_StaysHidden()
    {
        await using var db = CreateDb();
        db.PatientInsurances.Add(Row(OtherTenantId, deleted: null));
        await db.SaveChangesAsync();

        var rows = await Read(db, TenantId, PatientId);

        Assert.Empty(rows);
    }

    [Fact]
    public void PatientRead_KeepsPatientViewPermission()
    {
        var method = typeof(PatientInsuranceController).GetMethod(nameof(PatientInsuranceController.GetByPatient));
        Assert.NotNull(method);
        var permission = Assert.Single(method!.GetCustomAttributes(typeof(RequirePermissionAttribute), false))
            as RequirePermissionAttribute;
        Assert.Equal("patient.view", permission!.PermissionCode);
    }

    private static async Task<List<PatientInsurance>> Read(AppDbContext db, Guid tenantId, Guid patientId)
    {
        var controller = new PatientInsuranceController(db, NullLogger<PatientInsuranceController>.Instance)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                    {
                        new Claim("TenantId", tenantId.ToString()),
                    }, "test")),
                },
            },
        };

        var result = await controller.GetByPatient(patientId);
        var ok = Assert.IsType<OkObjectResult>(result);
        return Assert.IsType<List<PatientInsurance>>(ok.Value);
    }

    private static PatientInsurance Row(Guid tenantId, DateTime? deleted) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PatientId = PatientId,
            ProviderName = "Apex Health",
            PolicyNumber = Guid.NewGuid().ToString("N"),
            Status = "active",
            DeletedAt = deleted,
        };

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AppDbContext(options, new HttpContextAccessor());
    }
}
