using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using AuthService.Tests;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests.Services;

/// <summary>
/// Regression: anaesthesia type, anaesthetist name, and remarks must persist
/// through UpdateDetailsAsync and round-trip on list/detail responses.
/// </summary>
public class OtFinalizeUpdateDetailsPersistenceTests
{
    [Fact]
    public async Task UpdateDetails_PersistsAnesthesiaAnesthetistRemarks_AndReturnsThem()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var (userId, branchId) = SeedActor(db, tenantId);
        var scheduleId = Guid.NewGuid();

        db.OtFinalizeSchedules.Add(new OtFinalizeSchedule
        {
            Id = scheduleId,
            TenantId = tenantId,
            BranchId = branchId,
            PatientId = Guid.NewGuid(),
            Uhid = "UAT-ANES-01",
            PatientName = "Persistence Patient",
            SurgeryName = "Phaco",
            Eye = "RE",
            Status = OtFinalizeStatus.NotConfirmed,
            AnesthesiaType = null,
            AnesthetistName = null,
            Remarks = null,
            Version = 1,
        });
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        var updated = await svc.UpdateDetailsAsync(scheduleId, new UpdateOtDetailsRequest
        {
            AnesthesiaType = "Topical",
            AnesthetistName = "John Smith",
            Remarks = "UAT anaesthesia persistence test",
        }, tenantId, userId);

        Assert.Equal("Topical", updated.AnesthesiaType);
        Assert.Equal("John Smith", updated.AnesthetistName);
        Assert.Equal("UAT anaesthesia persistence test", updated.Remarks);

        var row = await db.OtFinalizeSchedules.FindAsync(scheduleId);
        Assert.Equal("Topical", row!.AnesthesiaType);
        Assert.Equal("John Smith", row.AnesthetistName);
        Assert.Equal("UAT anaesthesia persistence test", row.Remarks);

        var detail = await svc.GetByIdAsync(scheduleId, tenantId, userId);
        Assert.Equal("Topical", detail.AnesthesiaType);
        Assert.Equal("John Smith", detail.AnesthetistName);
        Assert.Equal("UAT anaesthesia persistence test", detail.Remarks);
    }

    [Fact]
    public async Task UpdateDetails_PartialRemarksChange_DoesNotEraseAnesthesiaFields()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var (userId, branchId) = SeedActor(db, tenantId);
        var scheduleId = Guid.NewGuid();

        db.OtFinalizeSchedules.Add(new OtFinalizeSchedule
        {
            Id = scheduleId,
            TenantId = tenantId,
            BranchId = branchId,
            PatientId = Guid.NewGuid(),
            Uhid = "UAT-ANES-02",
            PatientName = "Partial Patient",
            SurgeryName = "Phaco",
            Eye = "LE",
            Status = OtFinalizeStatus.NotConfirmed,
            AnesthesiaType = "Topical",
            AnesthetistName = "John Smith",
            Remarks = "Existing remark",
            Version = 1,
        });
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        await svc.UpdateDetailsAsync(scheduleId, new UpdateOtDetailsRequest
        {
            Remarks = "New remark only",
        }, tenantId, userId);

        var row = await db.OtFinalizeSchedules.FindAsync(scheduleId);
        Assert.Equal("Topical", row!.AnesthesiaType);
        Assert.Equal("John Smith", row.AnesthetistName);
        Assert.Equal("New remark only", row.Remarks);
    }

    [Fact]
    public async Task UpdateDetails_OmittingAnesthesiaFields_DoesNotWipeWithNull()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var (userId, branchId) = SeedActor(db, tenantId);
        var scheduleId = Guid.NewGuid();

        db.OtFinalizeSchedules.Add(new OtFinalizeSchedule
        {
            Id = scheduleId,
            TenantId = tenantId,
            BranchId = branchId,
            PatientId = Guid.NewGuid(),
            Uhid = "UAT-ANES-03",
            PatientName = "Keep Patient",
            SurgeryName = "LASIK",
            Status = OtFinalizeStatus.NotConfirmed,
            AnesthesiaType = "Topical",
            AnesthetistName = "Emily Chen",
            Remarks = "Keep me",
            Version = 1,
        });
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        await svc.UpdateDetailsAsync(scheduleId, new UpdateOtDetailsRequest
        {
            DoctorName = "Dr. Nair",
        }, tenantId, userId);

        var row = await db.OtFinalizeSchedules.FindAsync(scheduleId);
        Assert.Equal("Topical", row!.AnesthesiaType);
        Assert.Equal("Emily Chen", row.AnesthetistName);
        Assert.Equal("Keep me", row.Remarks);
        Assert.Equal("Dr. Nair", row.DoctorName);
    }

    private static (Guid UserId, Guid BranchId) SeedActor(AppDbContext db, Guid tenantId)
    {
        var branchId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        db.Users.Add(new AppUser
        {
            Id = userId,
            TenantId = tenantId,
            UserName = $"{userId:N}@test",
            NormalizedUserName = $"{userId:N}@TEST",
            Email = $"{userId:N}@test",
            NormalizedEmail = $"{userId:N}@TEST",
            FirstName = "OT",
            LastName = "Actor",
            BranchId = branchId,
            UserType = "Counsellor",
        });
        db.UserBranches.Add(new UserBranch
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = userId,
            BranchId = branchId,
            Status = "active",
            EffectiveFrom = DateTime.UtcNow.AddDays(-30),
        });
        return (userId, branchId);
    }

    private static OtFinalizeService CreateService(AppDbContext db)
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();
        var httpFactory = new Mock<System.Net.Http.IHttpClientFactory>();
        return new OtFinalizeService(
            db, httpFactory.Object, config, NullLogger<OtFinalizeService>.Instance,
            new FollowupBranchAccessService(db));
    }
}
