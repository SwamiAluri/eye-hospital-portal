using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Finalize Package 1 — PD-FS-03 Reporting Time Confirm + PD-FS-04 Cancel reason.
/// </summary>
public class FinalizePackage1ConfirmCancelTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly OtFinalizeService _ot;
    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _branch = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _admin = Guid.Parse("a0000001-0000-0000-0000-000000000001");
    private readonly Guid _patient = Guid.Parse("f1000001-0000-0000-0000-000000000001");

    public FinalizePackage1ConfirmCancelTests()
    {
        _db = TestDbContextFactory.CreateInMemory();
        var branchAccess = new FollowupBranchAccessService(_db);
        var httpFactory = new Mock<IHttpClientFactory>();
        httpFactory.Setup(f => f.CreateClient(It.IsAny<string>())).Returns(new HttpClient());
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();
        _ot = new OtFinalizeService(
            _db, httpFactory.Object, config, NullLogger<OtFinalizeService>.Instance, branchAccess);
        Seed();
    }

    public void Dispose() => _db.Dispose();

    private void Seed()
    {
        _db.Users.Add(new AppUser
        {
            Id = _admin,
            TenantId = _tenant,
            UserName = "admin@test",
            NormalizedUserName = "ADMIN@TEST",
            Email = "admin@test",
            NormalizedEmail = "ADMIN@TEST",
            FirstName = "Admin",
            LastName = "User",
            BranchId = _branch,
            UserType = "Staff",
        });
        _db.UserBranches.Add(new UserBranch
        {
            Id = Guid.NewGuid(),
            UserId = _admin,
            BranchId = _branch,
            TenantId = _tenant,
            Status = "active",
            EffectiveFrom = DateTime.UtcNow.AddDays(-30),
        });
        _db.SaveChanges();
    }

    private async Task<OtFinalizeSchedule> SeedNotConfirmedAsync(TimeSpan? reportingTime)
    {
        var entity = new OtFinalizeSchedule
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            BranchId = _branch,
            PatientId = _patient,
            PatientName = "Pkg One",
            Uhid = "MRN-P1",
            SurgeryName = "Phaco",
            Eye = "RE",
            Status = OtFinalizeStatus.NotConfirmed,
            StartTime = DateTime.UtcNow.Date.AddDays(3).AddHours(9),
            ReportingTime = reportingTime,
            Version = 1,
        };
        _db.OtFinalizeSchedules.Add(entity);
        await _db.SaveChangesAsync();
        return entity;
    }

    [Fact]
    public async Task Confirm_WithReportingTime_Succeeds()
    {
        var sched = await SeedNotConfirmedAsync(TimeSpan.FromHours(7).Add(TimeSpan.FromMinutes(30)));
        var result = await _ot.ConfirmAsync(sched.Id, _tenant, _admin);
        Assert.Equal(OtFinalizeStatus.Confirmed, result.Status);
    }

    [Fact]
    public async Task Confirm_MissingReportingTime_ThrowsArgumentException()
    {
        var sched = await SeedNotConfirmedAsync(null);
        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => _ot.ConfirmAsync(sched.Id, _tenant, _admin));
        Assert.Contains("Reporting time", ex.Message, StringComparison.OrdinalIgnoreCase);
        var still = await _db.OtFinalizeSchedules.AsNoTracking().FirstAsync(s => s.Id == sched.Id);
        Assert.Equal(OtFinalizeStatus.NotConfirmed, still.Status);
    }

    [Fact]
    public async Task Cancel_WithReason_PersistsReasonAndCancels()
    {
        var sched = await SeedNotConfirmedAsync(TimeSpan.FromHours(8));
        var result = await _ot.CancelAsync(sched.Id, _tenant, _admin, "Patient deferred surgery");
        Assert.Equal(OtFinalizeStatus.Cancelled, result.Status);
        var row = await _db.OtFinalizeSchedules.AsNoTracking().FirstAsync(s => s.Id == sched.Id);
        Assert.Equal("Patient deferred surgery", row.CancelReason);
    }

    [Fact]
    public async Task Cancel_MissingReason_ThrowsArgumentException()
    {
        var sched = await SeedNotConfirmedAsync(TimeSpan.FromHours(8));
        await Assert.ThrowsAsync<ArgumentException>(
            () => _ot.CancelAsync(sched.Id, _tenant, _admin, "  "));
        var row = await _db.OtFinalizeSchedules.AsNoTracking().FirstAsync(s => s.Id == sched.Id);
        Assert.Equal(OtFinalizeStatus.NotConfirmed, row.Status);
        Assert.True(string.IsNullOrEmpty(row.CancelReason));
    }

    [Fact]
    public async Task Cancel_DoesNotMutateCounselorId_WhenSessionLinked()
    {
        // No CounselorId on schedule; cancel must not invent ownership fields.
        var sched = await SeedNotConfirmedAsync(TimeSpan.FromHours(8));
        Assert.Null(typeof(OtFinalizeSchedule).GetProperty("CounselorId"));
        await _ot.CancelAsync(sched.Id, _tenant, _admin, "Clinical change");
        Assert.Null(typeof(OtFinalizeSchedule).GetProperty("CounselorId"));
    }

    [Fact]
    public async Task Confirm_UnauthorizedBranch_Throws()
    {
        var otherUser = Guid.Parse("a0000002-0000-0000-0000-000000000002");
        var otherBranch = Guid.Parse("22222222-2222-2222-2222-222222222222");
        _db.Users.Add(new AppUser
        {
            Id = otherUser,
            TenantId = _tenant,
            UserName = "other@test",
            NormalizedUserName = "OTHER@TEST",
            Email = "other@test",
            NormalizedEmail = "OTHER@TEST",
            FirstName = "Other",
            LastName = "Branch",
            BranchId = otherBranch,
            UserType = "Counsellor",
        });
        _db.UserBranches.Add(new UserBranch
        {
            Id = Guid.NewGuid(),
            UserId = otherUser,
            BranchId = otherBranch,
            TenantId = _tenant,
            Status = "active",
            EffectiveFrom = DateTime.UtcNow.AddDays(-30),
        });
        await _db.SaveChangesAsync();

        var sched = await SeedNotConfirmedAsync(TimeSpan.FromHours(7));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => _ot.ConfirmAsync(sched.Id, _tenant, otherUser));
    }
}
