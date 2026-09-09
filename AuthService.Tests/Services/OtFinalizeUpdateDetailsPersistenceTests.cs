using AuthService.Context;
using AuthService.Models.Domain;
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
        var userId = Guid.NewGuid();
        var scheduleId = Guid.NewGuid();

        db.OtFinalizeSchedules.Add(new OtFinalizeSchedule
        {
            Id = scheduleId,
            TenantId = tenantId,
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

        var detail = await svc.GetByIdAsync(scheduleId, tenantId);
        Assert.Equal("Topical", detail.AnesthesiaType);
        Assert.Equal("John Smith", detail.AnesthetistName);
        Assert.Equal("UAT anaesthesia persistence test", detail.Remarks);
    }

    [Fact]
    public async Task UpdateDetails_PartialRemarksChange_DoesNotEraseAnesthesiaFields()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var scheduleId = Guid.NewGuid();

        db.OtFinalizeSchedules.Add(new OtFinalizeSchedule
        {
            Id = scheduleId,
            TenantId = tenantId,
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
        var scheduleId = Guid.NewGuid();

        db.OtFinalizeSchedules.Add(new OtFinalizeSchedule
        {
            Id = scheduleId,
            TenantId = tenantId,
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
        }, tenantId, Guid.NewGuid());

        var row = await db.OtFinalizeSchedules.FindAsync(scheduleId);
        Assert.Equal("Topical", row!.AnesthesiaType);
        Assert.Equal("Emily Chen", row.AnesthetistName);
        Assert.Equal("Keep me", row.Remarks);
        Assert.Equal("Dr. Nair", row.DoctorName);
    }

    private static OtFinalizeService CreateService(AppDbContext db)
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();
        var httpFactory = new Mock<System.Net.Http.IHttpClientFactory>();
        return new OtFinalizeService(db, httpFactory.Object, config, NullLogger<OtFinalizeService>.Instance);
    }
}
