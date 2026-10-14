using System.Security.Claims;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models.Domain;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Patient 360 OPD bill list. Gate remains patient.view and bill.update.
/// Tenant is enforced. Branch is not a filter.
/// </summary>
public class Patient360OpdBillReadSafetyTests
{
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid PatientId = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly Guid OtherPatientId = Guid.Parse("55555555-5555-5555-5555-555555555555");

    [Fact]
    public async Task SameTenantSamePatient_ReturnsStoredAmountsAndStatus()
    {
        await using var db = CreateDb();
        var bill = BillRow(TenantId, PatientId, created: new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc));
        db.OpdBills.Add(bill);
        EnsurePatient(db, TenantId, PatientId);
        await db.SaveChangesAsync();

        var rows = await Read(db, TenantId, PatientId);

        var row = Assert.Single(rows);
        Assert.Equal(bill.Id, row.Id);
        Assert.Equal("OPD-1", row.BillNumber);
        Assert.Equal(1000m, row.NetAmount);
        Assert.Equal(400m, row.AmountPaid);
        Assert.Equal(600m, row.BalanceDue);
        Assert.Equal("Pending", row.Status);
        Assert.False(row.IsFreeVisit);
    }

    [Fact]
    public async Task SameTenantDifferentPatient_IsExcluded()
    {
        await using var db = CreateDb();
        db.OpdBills.Add(BillRow(TenantId, OtherPatientId, created: DateTime.UtcNow, number: "OPD-OTHER"));
        EnsurePatient(db, TenantId, OtherPatientId);
        await db.SaveChangesAsync();

        Assert.Empty(await Read(db, TenantId, PatientId));
    }

    [Fact]
    public async Task OtherTenantSamePatient_IsExcluded()
    {
        await using var db = CreateDb();
        db.OpdBills.Add(BillRow(OtherTenantId, PatientId, created: DateTime.UtcNow, number: "OPD-XTENANT"));
        EnsurePatient(db, OtherTenantId, PatientId);
        await db.SaveChangesAsync();

        Assert.Empty(await Read(db, TenantId, PatientId));
    }

    [Fact]
    public async Task DeletedBill_IsExcluded()
    {
        await using var db = CreateDb();
        db.OpdBills.Add(BillRow(TenantId, PatientId, created: DateTime.UtcNow, deleted: DateTime.UtcNow));
        EnsurePatient(db, TenantId, PatientId);
        await db.SaveChangesAsync();

        Assert.Empty(await Read(db, TenantId, PatientId));
    }

    [Fact]
    public async Task SameTenantBills_AreNewestFirst_AndPaged()
    {
        await using var db = CreateDb();
        var older = BillRow(TenantId, PatientId, created: new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc), number: "OPD-OLD");
        var newer = BillRow(TenantId, PatientId, created: new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc), number: "OPD-NEW");
        db.OpdBills.AddRange(older, newer);
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
        var home = BillRow(TenantId, PatientId, created: new DateTime(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc), number: "OPD-A", branchId: Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"));
        var other = BillRow(TenantId, PatientId, created: new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc), number: "OPD-B", branchId: Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"));
        db.OpdBills.AddRange(home, other);
        EnsurePatient(db, TenantId, PatientId);
        await db.SaveChangesAsync();

        var rows = await Read(db, TenantId, PatientId);

        Assert.Equal(2, rows.Count);
    }

    [Fact]
    public async Task MissingPatientView_IsUnauthorized()
    {
        var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(() => Authorize("bill.update"));
        Assert.Equal("Missing permission: patient.view", ex.Message);
    }

    [Fact]
    public async Task MissingBillUpdate_IsUnauthorized()
    {
        var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(() => Authorize("patient.view"));
        Assert.Equal("Missing permission: bill.update", ex.Message);
    }

    [Fact]
    public async Task OnlyOnePermission_IsUnauthorized()
    {
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => Authorize("patient.view"));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => Authorize("bill.update"));
    }

    [Fact]
    public async Task BothPermissions_AreAuthorized()
    {
        await Authorize("patient.view", "bill.update");
    }

    [Fact]
    public async Task PatientQuery_KeepsTheListContract_AndPassesTheCallerTenant()
    {
        var patientId = PatientId;
        var tenantId = TenantId;
        var bill = new AuthService.DTOs.Billing.OpdBillListDto
        {
            Id = Guid.NewGuid(),
            BillNumber = "OPD-1",
            NetAmount = 10,
            AmountPaid = 4,
            BalanceDue = 6,
            Status = "Pending",
            IsFreeVisit = true,
        };
        var bills = new Mock<IOpdBillService>();
        bills.Setup(s => s.AuthorizePatientBillReadAsync()).Returns(Task.CompletedTask);
        bills.Setup(s => s.GetByPatientIdAsync(tenantId, patientId, 1, 50))
            .ReturnsAsync(new List<AuthService.DTOs.Billing.OpdBillListDto> { bill });
        var controller = Controller(bills.Object, tenantId);

        var result = await controller.GetAll(patientId: patientId, page: 1, pageSize: 50);

        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = ok.Value!;
        var list = Assert.IsAssignableFrom<IEnumerable<AuthService.DTOs.Billing.OpdBillListDto>>(
            payload.GetType().GetProperty("bills")!.GetValue(payload));
        Assert.Single(list);
        Assert.Equal(1, payload.GetType().GetProperty("total")!.GetValue(payload));
        bills.Verify(s => s.GetByPatientIdAsync(tenantId, patientId, 1, 50), Times.Once);
    }

    [Fact]
    public async Task MissingTenantClaim_IsUnauthorized_AndDoesNotQuery()
    {
        var bills = new Mock<IOpdBillService>();
        bills.Setup(s => s.AuthorizePatientBillReadAsync()).Returns(Task.CompletedTask);
        var controller = Controller(bills.Object, tenantId: null);

        var result = await controller.GetAll(patientId: PatientId);

        Assert.IsType<UnauthorizedObjectResult>(result);
        bills.Verify(
            s => s.GetByPatientIdAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<int>(), It.IsAny<int>()),
            Times.Never);
    }

    private static async Task<List<AuthService.DTOs.Billing.OpdBillListDto>> Read(
        AppDbContext db, Guid tenantId, Guid patientId, int page = 1, int pageSize = 20)
    {
        var service = new OpdBillService(db, NullLogger<OpdBillService>.Instance, null!);
        return await service.GetByPatientIdAsync(tenantId, patientId, page, pageSize);
    }

    private static Task Authorize(params string[] permissions)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, UserId.ToString()),
            new("tenant_id", TenantId.ToString()),
        };
        claims.AddRange(permissions.Select(permission => new Claim("permission", permission)));
        var http = new HttpContextAccessor
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test")),
            },
        };
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        var db = new AppDbContext(options, http);
        var service = new OpdBillService(db, NullLogger<OpdBillService>.Instance, null!, http: http);
        return service.AuthorizePatientBillReadAsync();
    }

    private static OpdBillsController Controller(IOpdBillService bills, Guid? tenantId)
    {
        var http = new DefaultHttpContext();
        if (tenantId.HasValue)
        {
            http.User = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, UserId.ToString()),
                new Claim("tenant_id", tenantId.Value.ToString()),
            }, "test"));
        }

        return new OpdBillsController(bills, NullLogger<OpdBillsController>.Instance)
        {
            ControllerContext = new ControllerContext { HttpContext = http },
        };
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

    private static OpdBill BillRow(
        Guid tenantId,
        Guid patientId,
        DateTime created,
        string number = "OPD-1",
        DateTime? deleted = null,
        Guid? branchId = null) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PatientId = patientId,
            BranchId = branchId ?? Guid.NewGuid(),
            BillNumber = number,
            BillDate = created,
            NetAmount = 1000m,
            AmountPaid = 400m,
            BalanceDue = 600m,
            Status = "Pending",
            IsFreeVisit = false,
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
