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

/// <summary>G6 — same-day single-eye guard at OT prepare (OtFinalizeService).</summary>
public class OtFinalizeSchedulingGuardTests
{
    [Fact]
    public async Task PrepareOtListAsync_blocks_second_single_eye_same_day()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var (userId, branchId) = SeedActor(db, tenantId);
        var patientId = Guid.NewGuid();
        var surgeryDate = DateTime.UtcNow.Date.AddDays(7);

        var existing = SeedSchedule(db, tenantId, patientId, "RE", surgeryDate.AddHours(9), OtFinalizeStatus.OTPrepared, branchId);
        var candidate = SeedSchedule(db, tenantId, patientId, "LE", surgeryDate.AddHours(11), OtFinalizeStatus.Finalised, branchId);
        await db.SaveChangesAsync();

        var service = CreateService(db);

        var request = new PrepareOtListRequest
        {
            Date = surgeryDate,
            Items =
            [
                new PrepareOtListItem { ScheduleId = candidate.Id, Sequence = 1 },
            ],
        };

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.PrepareOtListAsync(request, tenantId, userId));

        Assert.Contains("single-eye", ex.Message, StringComparison.OrdinalIgnoreCase);
        Assert.NotEqual(existing.Id, candidate.Id);
    }

    [Fact]
    public async Task PrepareOtListAsync_allows_single_eye_when_no_conflict()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var (userId, branchId) = SeedActor(db, tenantId);
        var patientId = Guid.NewGuid();
        var surgeryDate = DateTime.UtcNow.Date.AddDays(8);

        var candidate = SeedSchedule(db, tenantId, patientId, "RE", surgeryDate.AddHours(9), OtFinalizeStatus.Finalised, branchId);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var request = new PrepareOtListRequest
        {
            Date = surgeryDate,
            Items = [new PrepareOtListItem { ScheduleId = candidate.Id, Sequence = 1 }],
        };

        await service.PrepareOtListAsync(request, tenantId, userId);

        var updated = await db.OtFinalizeSchedules.FindAsync(candidate.Id);
        Assert.Equal(OtFinalizeStatus.OTPrepared, updated!.Status);
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
        var httpFactory = new Mock<IHttpClientFactory>();
        httpFactory.Setup(f => f.CreateClient(It.IsAny<string>())).Returns(new HttpClient());

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        return new OtFinalizeService(
            db, httpFactory.Object, config, NullLogger<OtFinalizeService>.Instance,
            new FollowupBranchAccessService(db));
    }

    private static OtFinalizeSchedule SeedSchedule(
        AppDbContext db,
        Guid tenantId,
        Guid patientId,
        string eye,
        DateTime surgeryDate,
        string status,
        Guid branchId)
    {
        var entity = new OtFinalizeSchedule
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            PatientId = patientId,
            PatientName = "E2E Patient",
            SurgeryName = "Phaco",
            Eye = eye,
            Status = status,
            StartTime = surgeryDate,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.OtFinalizeSchedules.Add(entity);
        return entity;
    }
}
