using System.Security.Claims;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models.Domain;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Patient 360 visit list. Permission is the existing patient.view.
/// Tenant is enforced. Branch is not a filter.
/// </summary>
public class Patient360VisitReadSafetyTests
{
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid PatientId = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly Guid OtherPatientId = Guid.Parse("55555555-5555-5555-5555-555555555555");

    [Fact]
    public async Task SameTenantSamePatient_ReturnsTheVisit()
    {
        await using var db = CreateDb();
        var visit = VisitRow(TenantId, PatientId, created: new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc));
        db.Visits.Add(visit);
        EnsurePatient(db, TenantId, PatientId);
        await db.SaveChangesAsync();

        var rows = await Read(db, TenantId, PatientId);

        Assert.Equal(visit.Id, Assert.Single(rows).Id);
        Assert.Equal("completed", rows[0].Status);
    }

    [Fact]
    public async Task SameTenantDifferentPatient_IsExcluded()
    {
        await using var db = CreateDb();
        db.Visits.Add(VisitRow(TenantId, OtherPatientId, created: DateTime.UtcNow));
        EnsurePatient(db, TenantId, OtherPatientId);
        await db.SaveChangesAsync();

        var rows = await Read(db, TenantId, PatientId);

        Assert.Empty(rows);
    }

    [Fact]
    public async Task OtherTenantSamePatient_IsExcluded()
    {
        await using var db = CreateDb();
        db.Visits.Add(VisitRow(OtherTenantId, PatientId, created: DateTime.UtcNow));
        EnsurePatient(db, OtherTenantId, PatientId);
        await db.SaveChangesAsync();

        var rows = await Read(db, TenantId, PatientId);

        Assert.Empty(rows);
    }

    [Fact]
    public async Task DeletedVisit_IsExcluded()
    {
        await using var db = CreateDb();
        db.Visits.Add(VisitRow(TenantId, PatientId, created: DateTime.UtcNow, deleted: DateTime.UtcNow));
        EnsurePatient(db, TenantId, PatientId);
        await db.SaveChangesAsync();

        var rows = await Read(db, TenantId, PatientId);

        Assert.Empty(rows);
    }

    [Fact]
    public async Task SameTenantVisits_AreNewestFirst_AndPaged()
    {
        await using var db = CreateDb();
        var older = VisitRow(TenantId, PatientId, created: new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        var newer = VisitRow(TenantId, PatientId, created: new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc));
        db.Visits.AddRange(older, newer);
        EnsurePatient(db, TenantId, PatientId);
        await db.SaveChangesAsync();

        var page1 = await Read(db, TenantId, PatientId, page: 1, pageSize: 1);
        var page2 = await Read(db, TenantId, PatientId, page: 2, pageSize: 1);

        Assert.Equal(newer.Id, Assert.Single(page1).Id);
        Assert.Equal(older.Id, Assert.Single(page2).Id);
    }

    [Fact]
    public async Task OtherBranchInTheSameTenant_RemainsVisible()
    {
        await using var db = CreateDb();
        var home = VisitRow(TenantId, PatientId, created: new DateTime(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc), branchId: Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"));
        var otherBranch = VisitRow(TenantId, PatientId, created: new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc), branchId: Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"));
        db.Visits.AddRange(home, otherBranch);
        EnsurePatient(db, TenantId, PatientId);
        await db.SaveChangesAsync();

        var rows = await Read(db, TenantId, PatientId);

        Assert.Equal(2, rows.Count);
        Assert.Contains(rows, row => row.Id == home.Id);
        Assert.Contains(rows, row => row.Id == otherBranch.Id);
    }

    [Fact]
    public async Task PatientView_AllowsThePatientRead()
    {
        Assert.True(await Authorize("patient.view"));
    }

    [Fact]
    public async Task MissingPermission_DoesNotAuthorize()
    {
        Assert.False(await Authorize());
    }

    [Fact]
    public void Endpoint_RequiresPatientView_AndDoesNotApplyItToTheBranchList()
    {
        var method = typeof(VisitsController).GetMethod(nameof(VisitsController.GetByPatientId));
        var permission = method!.GetCustomAttributes(typeof(RequirePermissionAttribute), false)
            .Cast<RequirePermissionAttribute>()
            .Single();
        Assert.Equal("patient.view", permission.PermissionCode);

        var branch = typeof(VisitsController).GetMethod(nameof(VisitsController.GetByBranchId));
        Assert.Empty(branch!.GetCustomAttributes(typeof(RequirePermissionAttribute), false));
    }

    [Fact]
    public async Task MissingTenantClaim_IsUnauthorized_AndDoesNotQuery()
    {
        var visits = new Mock<IVisitService>();
        var controller = new VisitsController(visits.Object, NullLogger<VisitsController>.Instance)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };

        var result = await controller.GetByPatientId(PatientId);

        Assert.IsType<UnauthorizedObjectResult>(result);
        visits.Verify(s => s.GetByPatientIdAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<int>(), It.IsAny<int>()), Times.Never);
    }

    private static async Task<List<AuthService.DTOs.Visit.VisitListDto>> Read(
        AppDbContext db, Guid tenantId, Guid patientId, int page = 1, int pageSize = 20)
    {
        var service = new VisitService(db, null!, null!, null!, NullLogger<VisitService>.Instance);
        return await service.GetByPatientIdAsync(tenantId, patientId, page, pageSize);
    }

    private static async Task<bool> Authorize(params string[] permissions)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, UserId.ToString()),
            new("tenant_id", TenantId.ToString()),
        };
        foreach (var permission in permissions)
            claims.Add(new Claim("permission", permission));
        var user = new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));
        var requirement = new PermissionRequirement("patient.view");
        var context = new AuthorizationHandlerContext(new[] { requirement }, user, null);
        await using var db = CreateDb();
        await new PermissionAuthorizationHandler(db).HandleAsync(context);
        return context.HasSucceeded && !context.HasFailed;
    }

    private static void EnsurePatient(AppDbContext db, Guid tenantId, Guid patientId)
    {
        if (db.Patients.Local.Any(patient => patient.Id == patientId)) return;
        db.Patients.Add(new Patient
        {
            Id = patientId,
            TenantId = tenantId,
            MedicalRecordNumber = "MRN-1",
            FirstName = "Ada",
            LastName = "Lovelace",
            DateOfBirth = new DateTime(1980, 1, 1),
            Gender = "Female",
        });
    }

    private static Visit VisitRow(Guid tenantId, Guid patientId, DateTime created, DateTime? deleted = null, Guid? branchId = null) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PatientId = patientId,
            AppointmentId = Guid.NewGuid(),
            BranchId = branchId ?? Guid.NewGuid(),
            VisitType = "review",
            VisitCategory = "paid",
            Status = "completed",
            TokenNumber = "HYD-001",
            CreatedAt = created,
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
