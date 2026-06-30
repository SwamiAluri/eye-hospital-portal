using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace IpManagementService.Tests;

public class JourneySchedulingGuardServiceTests
{
    [Fact]
    public async Task ValidateSameDaySingleEyeAsync_blocks_second_single_eye_journey()
    {
        var tenantId = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        var surgeryDate = DateTime.UtcNow.Date.AddDays(3);

        await using var db = CreateDb();
        db.PatientJourneys.Add(MakeJourney(tenantId, patientId, "OD", surgeryDate));
        await db.SaveChangesAsync();

        var guard = new JourneySchedulingGuardService(db);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            guard.ValidateSameDaySingleEyeAsync(tenantId, patientId, "OS", surgeryDate));

        Assert.Contains("single-eye", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ValidateSameDaySingleEyeAsync_allows_bilateral_when_no_conflict()
    {
        var tenantId = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        var surgeryDate = DateTime.UtcNow.Date.AddDays(4);

        await using var db = CreateDb();
        var guard = new JourneySchedulingGuardService(db);
        var ex = await Record.ExceptionAsync(() =>
            guard.ValidateSameDaySingleEyeAsync(tenantId, patientId, "BE", surgeryDate));

        Assert.Null(ex);
    }

    [Fact]
    public async Task ValidateSameDaySingleEyeAsync_blocks_single_eye_when_bilateral_same_day()
    {
        var tenantId = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        var surgeryDate = DateTime.UtcNow.Date.AddDays(4);

        await using var db = CreateDb();
        db.PatientJourneys.Add(MakeJourney(tenantId, patientId, "BE", surgeryDate));
        await db.SaveChangesAsync();

        var guard = new JourneySchedulingGuardService(db);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            guard.ValidateSameDaySingleEyeAsync(tenantId, patientId, "OD", surgeryDate));

        Assert.Contains("bilateral", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ValidateSameDaySingleEyeAsync_excludes_current_journey_on_rebook()
    {
        var tenantId = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        var surgeryDate = DateTime.UtcNow.Date.AddDays(5);
        var journeyId = Guid.NewGuid();

        await using var db = CreateDb();
        db.PatientJourneys.Add(MakeJourney(tenantId, patientId, "OD", surgeryDate, journeyId));
        await db.SaveChangesAsync();

        var guard = new JourneySchedulingGuardService(db);
        var ex = await Record.ExceptionAsync(() =>
            guard.ValidateSameDaySingleEyeAsync(tenantId, patientId, "OD", surgeryDate, journeyId));

        Assert.Null(ex);
    }

    private static IpManagementDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<IpManagementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new IpManagementDbContext(options);
    }

    private static PatientJourney MakeJourney(
        Guid tenantId,
        Guid patientId,
        string eye,
        DateTime surgeryDate,
        Guid? id = null)
    {
        var now = DateTime.UtcNow;
        return new PatientJourney
        {
            Id = id ?? Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = Guid.NewGuid(),
            PatientId = patientId,
            EyeOperated = eye,
            ClinicalState = ClinicalState.Expected,
            OtState = OtState.NotSent,
            FinancialState = FinancialState.NotCreated,
            PostOpState = PostOpState.NotStarted,
            SurgeryScheduledAt = surgeryDate.AddHours(10),
            CreatedAt = now,
            UpdatedAt = now,
        };
    }
}
