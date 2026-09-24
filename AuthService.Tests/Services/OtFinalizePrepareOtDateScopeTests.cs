using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using AuthService.Tests;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using System.Net.Http;
using Xunit;

namespace AuthService.Tests.Services;

/// <summary>FS-02 — Prepare OT must be date-scoped; missing date must not prepare all Finalised.</summary>
public class OtFinalizePrepareOtDateScopeTests
{
    [Fact]
    public async Task PrepareOtListAsync_selected_date_only_leaves_other_date_finalised()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var (userId, branchId) = SeedActor(db, tenantId);
        var dayA = new DateTime(2026, 9, 10, 0, 0, 0, DateTimeKind.Unspecified);
        var dayB = new DateTime(2026, 9, 11, 0, 0, 0, DateTimeKind.Unspecified);

        var onA = Seed(db, tenantId, Guid.NewGuid(), dayA.AddHours(9), OtFinalizeStatus.Finalised, "Patient A", branchId);
        var onB = Seed(db, tenantId, Guid.NewGuid(), dayB.AddHours(10), OtFinalizeStatus.Finalised, "Patient B", branchId);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.PrepareOtListAsync(
                new PrepareOtListRequest
                {
                    Date = dayA,
                    Items =
                    [
                        new PrepareOtListItem { ScheduleId = onA.Id, Sequence = 1 },
                        new PrepareOtListItem { ScheduleId = onB.Id, Sequence = 2 },
                    ],
                },
                tenantId,
                userId));

        Assert.Contains("not on the selected surgery date", ex.Message, StringComparison.OrdinalIgnoreCase);
        // Cross-date item must block entire batch — zero writes.
        Assert.Equal(OtFinalizeStatus.Finalised, (await db.OtFinalizeSchedules.FindAsync(onA.Id))!.Status);
        Assert.Equal(OtFinalizeStatus.Finalised, (await db.OtFinalizeSchedules.FindAsync(onB.Id))!.Status);
    }

    [Fact]
    public async Task PrepareOtListAsync_selected_date_prepares_only_matching_when_items_scoped()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var (userId, branchId) = SeedActor(db, tenantId);
        var dayA = new DateTime(2026, 9, 10, 0, 0, 0, DateTimeKind.Unspecified);
        var dayB = new DateTime(2026, 9, 11, 0, 0, 0, DateTimeKind.Unspecified);

        var onA = Seed(db, tenantId, Guid.NewGuid(), dayA.AddHours(9), OtFinalizeStatus.Finalised, "Patient A", branchId);
        var onB = Seed(db, tenantId, Guid.NewGuid(), dayB.AddHours(10), OtFinalizeStatus.Finalised, "Patient B", branchId);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        await service.PrepareOtListAsync(
            new PrepareOtListRequest
            {
                Date = dayA,
                Items = [new PrepareOtListItem { ScheduleId = onA.Id, Sequence = 1 }],
            },
            tenantId,
            userId);

        Assert.Equal(OtFinalizeStatus.OTPrepared, (await db.OtFinalizeSchedules.FindAsync(onA.Id))!.Status);
        Assert.Equal(OtFinalizeStatus.Finalised, (await db.OtFinalizeSchedules.FindAsync(onB.Id))!.Status);
    }

    [Fact]
    public async Task PrepareOtListAsync_empty_default_date_rejects_with_zero_writes()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var (userId, branchId) = SeedActor(db, tenantId);
        var dayA = new DateTime(2026, 9, 10, 9, 0, 0, DateTimeKind.Unspecified);
        var dayB = new DateTime(2026, 9, 11, 10, 0, 0, DateTimeKind.Unspecified);

        var a = Seed(db, tenantId, Guid.NewGuid(), dayA, OtFinalizeStatus.Finalised, "A", branchId);
        var b = Seed(db, tenantId, Guid.NewGuid(), dayB, OtFinalizeStatus.Finalised, "B", branchId);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.PrepareOtListAsync(
                new PrepareOtListRequest
                {
                    Date = default,
                    Items =
                    [
                        new PrepareOtListItem { ScheduleId = a.Id, Sequence = 1 },
                        new PrepareOtListItem { ScheduleId = b.Id, Sequence = 2 },
                    ],
                },
                tenantId,
                userId));

        Assert.Contains("Surgery date is required", ex.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(OtFinalizeStatus.Finalised, (await db.OtFinalizeSchedules.FindAsync(a.Id))!.Status);
        Assert.Equal(OtFinalizeStatus.Finalised, (await db.OtFinalizeSchedules.FindAsync(b.Id))!.Status);
    }

    [Fact]
    public async Task PrepareOtListAsync_null_equivalent_min_date_rejects()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var (userId, branchId) = SeedActor(db, tenantId);
        var candidate = Seed(
            db,
            tenantId,
            Guid.NewGuid(),
            new DateTime(2026, 9, 10, 9, 0, 0, DateTimeKind.Unspecified),
            OtFinalizeStatus.Finalised,
            "C",
            branchId);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.PrepareOtListAsync(
                new PrepareOtListRequest
                {
                    Date = DateTime.MinValue,
                    Items = [new PrepareOtListItem { ScheduleId = candidate.Id, Sequence = 1 }],
                },
                tenantId,
                userId));

        Assert.Equal(OtFinalizeStatus.Finalised, (await db.OtFinalizeSchedules.FindAsync(candidate.Id))!.Status);
    }

    [Fact]
    public async Task PrepareOtListAsync_includes_non_midnight_start_time_on_selected_date()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var (userId, branchId) = SeedActor(db, tenantId);
        var day = new DateTime(2026, 9, 10, 0, 0, 0, DateTimeKind.Unspecified);
        var candidate = Seed(db, tenantId, Guid.NewGuid(), day.AddHours(14).AddMinutes(30), OtFinalizeStatus.Finalised, "PM", branchId);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        await service.PrepareOtListAsync(
            new PrepareOtListRequest
            {
                Date = day,
                Items = [new PrepareOtListItem { ScheduleId = candidate.Id, Sequence = 1 }],
            },
            tenantId,
            userId);

        Assert.Equal(OtFinalizeStatus.OTPrepared, (await db.OtFinalizeSchedules.FindAsync(candidate.Id))!.Status);
    }

    [Fact]
    public async Task PrepareOtListAsync_does_not_reprocess_already_ot_prepared()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var (userId, branchId) = SeedActor(db, tenantId);
        var day = new DateTime(2026, 9, 10, 0, 0, 0, DateTimeKind.Unspecified);
        var prepared = Seed(db, tenantId, Guid.NewGuid(), day.AddHours(9), OtFinalizeStatus.OTPrepared, "Prep", branchId);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.PrepareOtListAsync(
                new PrepareOtListRequest
                {
                    Date = day,
                    Items = [new PrepareOtListItem { ScheduleId = prepared.Id, Sequence = 1 }],
                },
                tenantId,
                userId));

        Assert.Contains("not Finalised", ex.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(OtFinalizeStatus.OTPrepared, (await db.OtFinalizeSchedules.FindAsync(prepared.Id))!.Status);
    }

    [Fact]
    public async Task PrepareOtListAsync_rejects_cancelled_state()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var (userId, branchId) = SeedActor(db, tenantId);
        var day = new DateTime(2026, 9, 10, 0, 0, 0, DateTimeKind.Unspecified);
        var cancelled = Seed(db, tenantId, Guid.NewGuid(), day.AddHours(9), OtFinalizeStatus.Cancelled, "X", branchId);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.PrepareOtListAsync(
                new PrepareOtListRequest
                {
                    Date = day,
                    Items = [new PrepareOtListItem { ScheduleId = cancelled.Id, Sequence = 1 }],
                },
                tenantId,
                userId));

        Assert.Equal(OtFinalizeStatus.Cancelled, (await db.OtFinalizeSchedules.FindAsync(cancelled.Id))!.Status);
    }

    [Fact]
    public async Task PrepareOtListAsync_tenant_isolation()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var (userId, _) = SeedActor(db, tenantA);
        var day = new DateTime(2026, 9, 10, 0, 0, 0, DateTimeKind.Unspecified);
        var otherTenant = Seed(db, tenantB, Guid.NewGuid(), day.AddHours(9), OtFinalizeStatus.Finalised, "Other", Guid.NewGuid());
        await db.SaveChangesAsync();

        var service = CreateService(db);
        // ScheduleId exists but wrong tenant → entity not loaded → no status change (empty prepare).
        await service.PrepareOtListAsync(
            new PrepareOtListRequest
            {
                Date = day,
                Items = [new PrepareOtListItem { ScheduleId = otherTenant.Id, Sequence = 1 }],
            },
            tenantA,
            userId);

        Assert.Equal(OtFinalizeStatus.Finalised, (await db.OtFinalizeSchedules.FindAsync(otherTenant.Id))!.Status);
    }

    [Fact]
    public async Task PrepareOtListAsync_no_eligible_items_is_noop()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var (userId, _) = SeedActor(db, tenantId);
        var day = new DateTime(2026, 9, 10, 0, 0, 0, DateTimeKind.Unspecified);
        var service = CreateService(db);

        await service.PrepareOtListAsync(
            new PrepareOtListRequest { Date = day, Items = [] },
            tenantId,
            userId);

        Assert.Empty(await db.OtFinalizeSchedules.Where(s => s.TenantId == tenantId).ToListAsync());
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

    private static OtFinalizeSchedule Seed(
        AppDbContext db,
        Guid tenantId,
        Guid patientId,
        DateTime startTime,
        string status,
        string name,
        Guid branchId)
    {
        var entity = new OtFinalizeSchedule
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            PatientId = patientId,
            PatientName = name,
            SurgeryName = "Phaco",
            Eye = "RE",
            Status = status,
            StartTime = startTime,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.OtFinalizeSchedules.Add(entity);
        return entity;
    }
}
