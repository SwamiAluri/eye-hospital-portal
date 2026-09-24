using System.Net.Http;
using System.Security.Claims;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Hubs;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using AuthService.Tests;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests.Services;

/// <summary>
/// Package C / PD-OTPREP-10 — OTPrepared IsLocked must block Upsert schedule mutation;
/// Reopen-first path remains the certified recovery edit workflow.
/// </summary>
public class OtFinalizeOtPreparedLockGuardTests
{
    [Fact]
    public async Task Upsert_when_OTPrepared_locked_rejects_before_any_mutation()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        var (userId, branchId) = SeedActor(db, tenantId);
        var originalStart = new DateTime(2026, 10, 15, 9, 0, 0, DateTimeKind.Unspecified);
        var preparedAt = new DateTime(2026, 10, 14, 12, 0, 0, DateTimeKind.Utc);
        var schedule = SeedLockedOtPrepared(
            db, tenantId, patientId, branchId, originalStart,
            sequenceNo: 7, preparedAt, preparedBy: "prep-user");
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.UpsertFromCounsellorAsync(new UpsertOtScheduleRequest
            {
                PatientId = patientId,
                PatientName = schedule.PatientName,
                Uhid = schedule.Uhid,
                SurgeryName = "Changed Surgery",
                Eye = "LE",
                StartTime = originalStart.AddDays(1).AddHours(2),
                CounsellingSessionId = null,
            }, tenantId, userId));

        Assert.Contains("Record is locked", ex.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Reopen OT Case", ex.Message, StringComparison.OrdinalIgnoreCase);

        var row = await db.OtFinalizeSchedules.FindAsync(schedule.Id);
        Assert.NotNull(row);
        Assert.Equal(originalStart, row!.StartTime);
        Assert.Equal(OtFinalizeStatus.OTPrepared, row.Status);
        Assert.True(row.IsLocked);
        Assert.Equal(7, row.SequenceNo);
        Assert.Equal(preparedAt, row.PreparedAt);
        Assert.Equal("prep-user", row.PreparedBy);
        Assert.Equal("Phaco", row.SurgeryName);
        Assert.Equal("RE", row.Eye);
    }

    [Fact]
    public async Task UpdateDetails_when_OTPrepared_locked_rejects_StartTime_mutation()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var (userId, branchId) = SeedActor(db, tenantId);
        var originalStart = new DateTime(2026, 10, 15, 9, 0, 0, DateTimeKind.Unspecified);
        var schedule = SeedLockedOtPrepared(
            db, tenantId, Guid.NewGuid(), branchId, originalStart,
            sequenceNo: 3, DateTime.UtcNow, "prep");
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.UpdateDetailsAsync(schedule.Id, new UpdateOtDetailsRequest
            {
                StartTime = originalStart.AddHours(3),
            }, tenantId, userId));

        Assert.Contains("Record is locked", ex.Message, StringComparison.OrdinalIgnoreCase);
        var row = await db.OtFinalizeSchedules.FindAsync(schedule.Id);
        Assert.Equal(originalStart, row!.StartTime);
        Assert.Equal(OtFinalizeStatus.OTPrepared, row.Status);
        Assert.True(row.IsLocked);
    }

    [Fact]
    public async Task UpdateSlot_when_OTPrepared_locked_rejects_StartTime_mutation()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var (userId, branchId) = SeedActor(db, tenantId);
        var originalStart = new DateTime(2026, 10, 15, 9, 0, 0, DateTimeKind.Unspecified);
        var schedule = SeedLockedOtPrepared(
            db, tenantId, Guid.NewGuid(), branchId, originalStart,
            sequenceNo: 4, DateTime.UtcNow, "prep");
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.UpdateSlotAsync(schedule.Id, new UpdateSlotRequest
            {
                StartTime = originalStart.AddHours(4),
            }, tenantId, userId));

        Assert.Contains("Record is locked", ex.Message, StringComparison.OrdinalIgnoreCase);
        var row = await db.OtFinalizeSchedules.FindAsync(schedule.Id);
        Assert.Equal(originalStart, row!.StartTime);
        Assert.Equal(OtFinalizeStatus.OTPrepared, row.Status);
        Assert.True(row.IsLocked);
    }

    [Fact]
    public async Task Reopen_OTPrepared_unlocks_to_Confirmed_preserving_prepare_metadata()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var (userId, branchId) = SeedActor(db, tenantId);
        var originalStart = new DateTime(2026, 10, 15, 9, 0, 0, DateTimeKind.Unspecified);
        var preparedAt = new DateTime(2026, 10, 14, 8, 30, 0, DateTimeKind.Utc);
        var schedule = SeedLockedOtPrepared(
            db, tenantId, Guid.NewGuid(), branchId, originalStart,
            sequenceNo: 11, preparedAt, preparedBy: "prep-user");
        await db.SaveChangesAsync();

        var result = await CreateService(db).ReopenAsync(schedule.Id, tenantId, userId);

        Assert.Equal(OtFinalizeStatus.Confirmed, result.Status);
        Assert.False(result.IsLocked);

        var row = await db.OtFinalizeSchedules.FindAsync(schedule.Id);
        Assert.Equal(OtFinalizeStatus.Confirmed, row!.Status);
        Assert.False(row.IsLocked);
        Assert.Equal(11, row.SequenceNo);
        Assert.Equal(preparedAt, row.PreparedAt);
        Assert.Equal("prep-user", row.PreparedBy);
        Assert.Equal(originalStart, row.StartTime);
    }

    [Fact]
    public async Task After_Reopen_UpdateDetails_StartTime_edit_succeeds_and_reverts_to_NotConfirmed()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var (userId, branchId) = SeedActor(db, tenantId);
        var originalStart = new DateTime(2026, 10, 15, 9, 0, 0, DateTimeKind.Unspecified);
        var newStart = originalStart.AddDays(1).AddHours(1);
        var schedule = SeedLockedOtPrepared(
            db, tenantId, Guid.NewGuid(), branchId, originalStart,
            sequenceNo: 5, DateTime.UtcNow, "prep");
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        await svc.ReopenAsync(schedule.Id, tenantId, userId);

        var updated = await svc.UpdateDetailsAsync(schedule.Id, new UpdateOtDetailsRequest
        {
            StartTime = newStart,
        }, tenantId, userId);

        Assert.Equal(OtFinalizeStatus.NotConfirmed, updated.Status);
        Assert.False(updated.IsLocked);
        Assert.Equal(newStart, updated.StartTime);

        var row = await db.OtFinalizeSchedules.FindAsync(schedule.Id);
        Assert.Equal(OtFinalizeStatus.NotConfirmed, row!.Status);
        Assert.Equal(newStart, row.StartTime);
        Assert.Equal(5, row.SequenceNo);
    }

    [Fact]
    public async Task Upsert_unlocked_NotConfirmed_remains_functional()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var (userId, branchId) = SeedActor(db, tenantId);
        SeedSession(db, tenantId, patientId, sessionId, branchId);
        var originalStart = new DateTime(2026, 10, 15, 9, 0, 0, DateTimeKind.Unspecified);
        db.OtFinalizeSchedules.Add(new OtFinalizeSchedule
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            PatientId = patientId,
            Uhid = "UAT-UNLOCK",
            PatientName = "Unlocked Patient",
            SurgeryName = "Phaco",
            Eye = "RE",
            Status = OtFinalizeStatus.NotConfirmed,
            IsLocked = false,
            StartTime = originalStart,
            CounsellingSessionId = sessionId,
            Version = 1,
        });
        await db.SaveChangesAsync();

        var newStart = originalStart.AddDays(2);
        var result = await CreateService(db).UpsertFromCounsellorAsync(new UpsertOtScheduleRequest
        {
            PatientId = patientId,
            PatientName = "Unlocked Patient",
            Uhid = "UAT-UNLOCK",
            SurgeryName = "Phaco + IOL",
            Eye = "RE",
            StartTime = newStart,
            CounsellingSessionId = sessionId,
        }, tenantId, userId);

        Assert.Equal(OtFinalizeStatus.NotConfirmed, result.Status);
        Assert.False(result.IsLocked);
        Assert.Equal(newStart, result.StartTime);
        Assert.Equal("Phaco + IOL", result.SurgeryName);
    }

    [Fact]
    public async Task Prepare_Finalised_to_OTPrepared_persists_SequenceNo()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var (userId, branchId) = SeedActor(db, tenantId);
        var day = new DateTime(2026, 10, 15, 0, 0, 0, DateTimeKind.Unspecified);
        var schedule = new OtFinalizeSchedule
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            PatientId = Guid.NewGuid(),
            PatientName = "Prepare Patient",
            SurgeryName = "Phaco",
            Eye = "RE",
            Status = OtFinalizeStatus.Finalised,
            IsLocked = false,
            StartTime = day.AddHours(9),
            Version = 1,
        };
        db.OtFinalizeSchedules.Add(schedule);
        await db.SaveChangesAsync();

        await CreateService(db).PrepareOtListAsync(
            new PrepareOtListRequest
            {
                Date = day,
                Items = [new PrepareOtListItem { ScheduleId = schedule.Id, Sequence = 9 }],
            },
            tenantId,
            userId);

        var row = await db.OtFinalizeSchedules.FindAsync(schedule.Id);
        Assert.Equal(OtFinalizeStatus.OTPrepared, row!.Status);
        Assert.True(row.IsLocked);
        Assert.Equal(9, row.SequenceNo);
        Assert.NotNull(row.PreparedAt);
        Assert.False(string.IsNullOrWhiteSpace(row.PreparedBy));
    }

    [Fact]
    public async Task UpsertOtSchedule_locked_GuardLocked_returns_409_Conflict_not_500()
    {
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var ot = new Mock<IOtFinalizeService>();
        ot.Setup(s => s.UpsertFromCounsellorAsync(
                It.IsAny<UpsertOtScheduleRequest>(), tenantId, userId))
            .ThrowsAsync(new InvalidOperationException(
                "Record is locked (status: OTPrepared). Use 'Reopen OT Case' to make changes."));

        var controller = CreateController(ot.Object, tenantId, userId);
        var result = await controller.UpsertOtSchedule(new UpsertOtScheduleRequest
        {
            PatientId = Guid.NewGuid(),
            PatientName = "Locked",
            StartTime = DateTime.UtcNow.Date.AddDays(1),
        });

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal(StatusCodes.Status409Conflict, conflict.StatusCode);
        var json = System.Text.Json.JsonSerializer.Serialize(conflict.Value);
        Assert.Contains("Record is locked", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Error saving OT schedule", json, StringComparison.Ordinal);
    }

    [Fact]
    public async Task UpsertOtSchedule_stale_concurrency_still_returns_409()
    {
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var ot = new Mock<IOtFinalizeService>();
        ot.Setup(s => s.UpsertFromCounsellorAsync(
                It.IsAny<UpsertOtScheduleRequest>(), tenantId, userId))
            .ThrowsAsync(new InvalidOperationException(SessionConcurrency.StaleMessage));

        var controller = CreateController(ot.Object, tenantId, userId);
        var result = await controller.UpsertOtSchedule(new UpsertOtScheduleRequest
        {
            PatientId = Guid.NewGuid(),
            PatientName = "Stale",
        });

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal(StatusCodes.Status409Conflict, conflict.StatusCode);
    }

    [Fact]
    public async Task UpsertOtSchedule_UnauthorizedAccess_remains_403_not_GuardLocked_409()
    {
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var ot = new Mock<IOtFinalizeService>();
        ot.Setup(s => s.UpsertFromCounsellorAsync(
                It.IsAny<UpsertOtScheduleRequest>(), tenantId, userId))
            .ThrowsAsync(new UnauthorizedAccessException("Branch access denied"));

        var controller = CreateController(ot.Object, tenantId, userId);
        var result = await controller.UpsertOtSchedule(new UpsertOtScheduleRequest
        {
            PatientId = Guid.NewGuid(),
            PatientName = "Denied",
        });

        var forbid = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, forbid.StatusCode);
    }

    [Fact]
    public async Task Upsert_locked_schedule_branch_denial_is_Unauthorized_not_GuardLocked()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        var scheduleBranch = Guid.NewGuid();
        var (outsiderId, _) = SeedActor(db, tenantId, Guid.NewGuid());
        var originalStart = new DateTime(2026, 10, 15, 9, 0, 0, DateTimeKind.Unspecified);
        SeedLockedOtPrepared(
            db, tenantId, patientId, scheduleBranch, originalStart,
            sequenceNo: 2, DateTime.UtcNow, "prep");
        await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            CreateService(db).UpsertFromCounsellorAsync(new UpsertOtScheduleRequest
            {
                PatientId = patientId,
                PatientName = "Outsider",
                StartTime = originalStart.AddDays(1),
            }, tenantId, outsiderId));

        Assert.DoesNotContain("Record is locked", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    private static CounselingController CreateController(
        IOtFinalizeService ot, Guid tenantId, Guid userId)
    {
        var controller = new CounselingController(
            Mock.Of<ICounselingWorkflowService>(),
            Mock.Of<ICounselorCommunicationService>(),
            Mock.Of<IFollowupListService>(),
            Mock.Of<IFollowupBranchAccessService>(),
            Mock.Of<ICounselingAnalyticsService>(),
            NullLogger<CounselingController>.Instance,
            Mock.Of<IEmailService>(),
            Mock.Of<ISmsService>(),
            Mock.Of<IHubContext<QueueHub>>(),
            TestDbContextFactory.CreateInMemory(),
            ot);

        var identity = new ClaimsIdentity(
        [
            new Claim("TenantId", tenantId.ToString()),
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
        ], "test");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(identity),
            },
        };
        return controller;
    }

    private static OtFinalizeSchedule SeedLockedOtPrepared(
        AppDbContext db,
        Guid tenantId,
        Guid patientId,
        Guid branchId,
        DateTime startTime,
        int sequenceNo,
        DateTime preparedAt,
        string preparedBy)
    {
        var entity = new OtFinalizeSchedule
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            PatientId = patientId,
            Uhid = "UAT-LOCK",
            PatientName = "Locked Patient",
            SurgeryName = "Phaco",
            Eye = "RE",
            Status = OtFinalizeStatus.OTPrepared,
            IsLocked = true,
            StartTime = startTime,
            SequenceNo = sequenceNo,
            PreparedAt = preparedAt,
            PreparedBy = preparedBy,
            Version = 1,
        };
        db.OtFinalizeSchedules.Add(entity);
        return entity;
    }

    private static void SeedSession(
        AppDbContext db, Guid tenantId, Guid patientId, Guid sessionId, Guid branchId)
    {
        db.CounselingSession.Add(new CounselingSession
        {
            Id = sessionId,
            TenantId = tenantId,
            BranchId = branchId,
            PatientId = patientId,
            ReferredByDoctorId = Guid.NewGuid(),
            SessionDate = DateTime.UtcNow.Date,
            PatientType = "Cash",
        });
    }

    private static (Guid UserId, Guid BranchId) SeedActor(AppDbContext db, Guid tenantId, Guid? branchId = null)
    {
        var branch = branchId ?? Guid.NewGuid();
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
            BranchId = branch,
            UserType = "Counsellor",
        });
        db.UserBranches.Add(new UserBranch
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = userId,
            BranchId = branch,
            Status = "active",
            EffectiveFrom = DateTime.UtcNow.AddDays(-30),
        });
        return (userId, branch);
    }

    private static OtFinalizeService CreateService(AppDbContext db)
    {
        var httpFactory = new Mock<IHttpClientFactory>();
        httpFactory.Setup(f => f.CreateClient(It.IsAny<string>())).Returns(new HttpClient());
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();
        return new OtFinalizeService(
            db, httpFactory.Object, config, NullLogger<OtFinalizeService>.Instance,
            new FollowupBranchAccessService(db));
    }
}
