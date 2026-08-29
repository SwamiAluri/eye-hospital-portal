using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace IpManagementService.Tests;

/// <summary>
/// Phase 24A — FR-6.3 follow-up link INSERT path (post_op_instructions row creation).
/// </summary>
public class PostOpInstructionsInsertTests : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly IpManagementDbContext _db;
    private readonly PostOpWorkflowService _svc;
    private readonly StubAppointmentClient _appointments;
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly Guid _patientId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    public PostOpInstructionsInsertTests()
    {
        var services = new ServiceCollection();
        services.AddDbContext<IpManagementDbContext>(o =>
            o.UseInMemoryDatabase(Guid.NewGuid().ToString("N")));
        _provider = services.BuildServiceProvider();
        _db = _provider.GetRequiredService<IpManagementDbContext>();
        _appointments = new StubAppointmentClient();
        var implants = new ImplantUsageService(_db, new NoOpOutbox());
        _svc = new PostOpWorkflowService(_db, implants, _appointments);
    }

    [Fact]
    public async Task FreshInsert_CreatesRowWithFollowupAppointmentAndRequiredDefaults()
    {
        var journey = SeedJourney();
        var apptId = Guid.NewGuid();
        var when = DateTime.UtcNow.AddDays(7);

        _appointments.SetStatus(apptId, Ok(when));

        var result = await _svc.SaveInstructionsAsync(
            journey.Id, _tenantId, _branchId, _userId,
            new SavePostOpInstructionRequest(
                Medications: null,
                ActivityRestrictions: null,
                DietaryInstructions: null,
                FollowupDate: null,
                FollowupDoctorId: null,
                EyeCareInstructions: null,
                WarningSigns: null,
                FollowupAppointmentId: apptId));

        Assert.Equal(apptId, result.FollowupAppointmentId);
        Assert.True(result.IsSaved);

        var row = await _db.PostOpInstructions.SingleAsync(i => i.PatientJourneyId == journey.Id);
        Assert.Equal(apptId, row.FollowupAppointmentId);
        Assert.Equal("[]", row.Medications);
        Assert.Equal("[]", row.WarningSigns);
        Assert.Equal("active", row.Status);
        Assert.Null(row.DeletedAt);
    }

    [Fact]
    public async Task UpdateExistingRow_PreservesFollowupLinkAndUpdatesFields()
    {
        var journey = SeedJourney();
        var apptId = Guid.NewGuid();
        _appointments.SetStatus(apptId, Ok(DateTime.UtcNow.AddDays(5)));

        await _svc.SaveInstructionsAsync(
            journey.Id, _tenantId, _branchId, _userId,
            LinkOnlyRequest(apptId));

        var firstId = (await _db.PostOpInstructions.SingleAsync(i => i.PatientJourneyId == journey.Id)).Id;

        var updated = await _svc.SaveInstructionsAsync(
            journey.Id, _tenantId, _branchId, _userId,
            new SavePostOpInstructionRequest(
                Medications: "[{\"drug\":\"Pred\"}]",
                ActivityRestrictions: "No heavy lifting",
                DietaryInstructions: null,
                FollowupDate: null,
                FollowupDoctorId: null,
                EyeCareInstructions: "Use shield at night",
                WarningSigns: "[\"pain\"]",
                FollowupAppointmentId: apptId));

        Assert.Equal(firstId, updated.Id);
        Assert.Equal(apptId, updated.FollowupAppointmentId);
        Assert.Equal("[{\"drug\":\"Pred\"}]", updated.Medications);
        Assert.Equal("No heavy lifting", updated.ActivityRestrictions);
        Assert.Equal("Use shield at night", updated.EyeCareInstructions);
        Assert.Equal("[\"pain\"]", updated.WarningSigns);
        Assert.Equal(1, await _db.PostOpInstructions.CountAsync(i => i.PatientJourneyId == journey.Id));
    }

    [Fact]
    public async Task ReplaySameFollowupLink_DoesNotDuplicateRow()
    {
        var journey = SeedJourney();
        var apptId = Guid.NewGuid();
        _appointments.SetStatus(apptId, Ok(DateTime.UtcNow.AddDays(3)));

        await _svc.SaveInstructionsAsync(journey.Id, _tenantId, _branchId, _userId, LinkOnlyRequest(apptId));
        var firstId = (await _db.PostOpInstructions.SingleAsync(i => i.PatientJourneyId == journey.Id)).Id;

        var replay = await _svc.SaveInstructionsAsync(journey.Id, _tenantId, _branchId, _userId, LinkOnlyRequest(apptId));

        Assert.Equal(firstId, replay.Id);
        Assert.Equal(apptId, replay.FollowupAppointmentId);
        Assert.Equal(1, await _db.PostOpInstructions.CountAsync(i => i.PatientJourneyId == journey.Id));
    }

    [Fact]
    public async Task InvalidAppointment_ThrowsArgumentException()
    {
        var journey = SeedJourney();
        var missingApptId = Guid.NewGuid();
        _appointments.SetStatus(missingApptId, new AuthAppointmentStatus(false, null, null, null, null, true));

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            _svc.SaveInstructionsAsync(journey.Id, _tenantId, _branchId, _userId, LinkOnlyRequest(missingApptId)));

        Assert.Contains("not found", ex.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(_db.PostOpInstructions);
    }

    [Fact]
    public async Task SaveInstructions_DoesNotEnqueueFinancialOutboxEvents()
    {
        var journey = SeedJourney();
        var apptId = Guid.NewGuid();
        _appointments.SetStatus(apptId, Ok(DateTime.UtcNow.AddDays(4)));

        var outboxBefore = await _db.IntegrationOutboxEvents.CountAsync();

        await _svc.SaveInstructionsAsync(journey.Id, _tenantId, _branchId, _userId, LinkOnlyRequest(apptId));

        Assert.Equal(outboxBefore, await _db.IntegrationOutboxEvents.CountAsync());
    }

    [Fact]
    public void PostOpInstruction_MapsJsonbColumnsAndStatus()
    {
        using var db = _provider.GetRequiredService<IpManagementDbContext>();
        var entity = db.Model.FindEntityType(typeof(PostOpInstruction))!;
        var meds = entity.FindProperty(nameof(PostOpInstruction.Medications))!;
        var signs = entity.FindProperty(nameof(PostOpInstruction.WarningSigns))!;
        Assert.Equal("jsonb", meds.FindAnnotation("Relational:ColumnType")?.Value);
        Assert.Equal("jsonb", signs.FindAnnotation("Relational:ColumnType")?.Value);
        Assert.Equal("status", entity.FindProperty(nameof(PostOpInstruction.Status))!.GetColumnName());
    }

    public void Dispose()
    {
        _db.Dispose();
        _provider.Dispose();
    }

    private PatientJourney SeedJourney()
    {
        var journey = new PatientJourney
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            BranchId = _branchId,
            PatientId = _patientId,
            Uhid = "UAT-POI-001",
            ClinicalState = ClinicalState.ReadyForDischarge,
            OtState = OtState.Completed,
            FinancialState = FinancialState.Draft,
            EyeOperated = "OD",
            SurgeryStartedAt = DateTime.UtcNow.AddDays(-1),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        };
        _db.PatientJourneys.Add(journey);
        _db.SaveChanges();
        return journey;
    }

    private static SavePostOpInstructionRequest LinkOnlyRequest(Guid apptId) =>
        new(null, null, null, null, null, null, null, apptId);

    private static AuthAppointmentStatus Ok(DateTime when) =>
        new(true, "Scheduled", when, Guid.NewGuid(),
            Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"), false);

    private sealed class NoOpOutbox : IIntegrationOutboxService
    {
        public void Enqueue(Guid tenantId, string eventType, Guid aggregateId, object payload,
            Guid? correlationId = null, string? idempotencyKey = null) { }

        public Task EnsureSchemaAsync(CancellationToken ct = default) => Task.CompletedTask;
        public Task<int> ProcessPendingAsync(int batchSize = 25, CancellationToken ct = default) => Task.FromResult(0);
        public Task<OutboxStats> GetStatsAsync(Guid? tenantId = null, CancellationToken ct = default) =>
            Task.FromResult(new OutboxStats(0, 0, 0, 0, 0));
        public Task<IReadOnlyList<OutboxDeadLetterDto>> ListDeadAsync(Guid tenantId, CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<OutboxDeadLetterDto>>(Array.Empty<OutboxDeadLetterDto>());
        public Task<OutboxEventDetailDto> GetEventAsync(Guid tenantId, Guid eventId, CancellationToken ct = default) =>
            throw new KeyNotFoundException();
        public Task<int> RequeueAsync(Guid tenantId, OutboxRequeueRequest request, CancellationToken ct = default) =>
            Task.FromResult(0);
        public Task AbandonAsync(Guid tenantId, Guid userId, OutboxAbandonRequest request, CancellationToken ct = default) =>
            Task.CompletedTask;
    }

    private sealed class StubAppointmentClient : IAuthAppointmentStatusClient
    {
        private readonly Dictionary<Guid, AuthAppointmentStatus> _statuses = new();

        public void SetStatus(Guid id, AuthAppointmentStatus status) => _statuses[id] = status;

        public Task<AuthAppointmentStatus> GetStatusAsync(Guid appointmentId, Guid tenantId) =>
            Task.FromResult(_statuses.TryGetValue(appointmentId, out var s)
                ? s
                : new AuthAppointmentStatus(false, null, null, null, null, true));
    }
}
