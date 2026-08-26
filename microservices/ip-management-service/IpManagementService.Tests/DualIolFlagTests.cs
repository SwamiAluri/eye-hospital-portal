using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace IpManagementService.Tests;

public class DualIolFlagTests : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly IpManagementDbContext _db;
    private readonly PatientJourneyService _svc;
    private readonly IntraOpNoteService _notes;
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _actorId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();

    public DualIolFlagTests()
    {
        var services = new ServiceCollection();
        services.AddDbContext<IpManagementDbContext>(o =>
            o.UseInMemoryDatabase(Guid.NewGuid().ToString("N")));
        _provider = services.BuildServiceProvider();
        _db = _provider.GetRequiredService<IpManagementDbContext>();
        var ccms = new NoOpCcmsAdmissionClient();
        _svc = new PatientJourneyService(
            _db,
            new NoOpPreOpNotificationClient(),
            ccms,
            Uninit<SurgicalSafetyService>(),
            Uninit<ChecklistGateService>(),
            Uninit<PreOpClearanceService>(),
            Uninit<PreOpReadinessService>(),
            Uninit<WardChecklistAutoSyncService>(),
            new JourneyMutationGuardService(_db),
            new JourneySchedulingGuardService(_db),
            new IntegrationOutboxService(_db, ccms, NullLogger<IntegrationOutboxService>.Instance));
        _notes = new IntraOpNoteService(_db);
    }

    [Fact]
    public async Task VerifyIolBarcode_DoesNotWriteJourneyFlags()
    {
        var journey = SeedJourney(iolBarcode: "SN60WF", verified: false);

        var result = await _svc.VerifyIolBarcodeAsync(journey.Id, _tenantId, _actorId, "88213ABCDE");

        Assert.True(result.IsValid);
        var saved = await _db.PatientJourneys.AsNoTracking().SingleAsync(j => j.Id == journey.Id);
        Assert.Equal("SN60WF", saved.IolBarcode);
        Assert.False(saved.IolBarcodeVerified);
        Assert.Contains(_db.JourneyAuditLogs, a => a.Action == "IolBarcodeVerified");
    }

    [Fact]
    public async Task UpdateOtDetails_IgnoresBarcodeFlags_KeepsPlannedPower()
    {
        var journey = SeedJourney(iolBarcode: "SN60WF", verified: false, iolPower: "+19.00 D");

        await _svc.UpdateOtDetailsAsync(journey.Id, _tenantId, _actorId, new UpdateOtDetailsRequest(
            null, null, null, null, null,
            IolPower: "+21.00 D",
            IolIssuedFromIp: true,
            IolBarcodeVerified: true,
            IolBarcode: "(01)08901234567890(21)88213",
            PrimarySurgeonId: null));

        var saved = await _db.PatientJourneys.AsNoTracking().SingleAsync(j => j.Id == journey.Id);
        Assert.Equal("+21.00 D", saved.IolPower);
        Assert.True(saved.IolIssuedFromIp);
        Assert.Equal("SN60WF", saved.IolBarcode);
        Assert.False(saved.IolBarcodeVerified);
    }

    [Fact]
    public async Task IntraOpSave_IgnoresImplantUsed_GetOverlaysRegistry()
    {
        var journey = SeedJourney(iolBarcode: null, verified: false);
        _db.JourneyImplantUsages.Add(new JourneyImplantUsage
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            JourneyId = journey.Id,
            PatientId = journey.PatientId,
            Eye = "OD",
            Brand = "Alcon",
            Model = "SN60WF",
            Power = 21.00m,
            UsageStatus = ImplantUsageStatus.Implanted,
            ChargeStatus = ImplantChargeStatus.Pending,
            ScannedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        });
        await _db.SaveChangesAsync();

        var saved = await _notes.SaveAsync(journey.Id, _tenantId, _branchId, _actorId, new SaveIntraOpNoteRequest(
            null, null, null, null, null, null, "LA", null,
            "Phaco + IOL", "OD", null, null, "SN6AD1", "+22.50",
            null, null, false, null));

        Assert.Equal("Alcon SN60WF", saved.ImplantUsed);
        Assert.Equal("+21.00 D", saved.ImplantPower);

        var row = await _db.IntraOpNotes.AsNoTracking().SingleAsync();
        Assert.Null(row.ImplantUsed);
        Assert.Null(row.ImplantPower);
    }

    private PatientJourney SeedJourney(string? iolBarcode, bool verified, string? iolPower = null)
    {
        var journey = new PatientJourney
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            BranchId = _branchId,
            PatientId = Guid.NewGuid(),
            ClinicalState = ClinicalState.InOT,
            OtState = OtState.NotSent,
            FinancialState = FinancialState.NotCreated,
            IolPower = iolPower,
            IolBarcode = iolBarcode,
            IolBarcodeVerified = verified,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        };
        _db.PatientJourneys.Add(journey);
        _db.SaveChanges();
        return journey;
    }

    private static T Uninit<T>() where T : class =>
        (T)System.Runtime.Serialization.FormatterServices.GetUninitializedObject(typeof(T));

    public void Dispose()
    {
        _db.Dispose();
        _provider.Dispose();
    }
}
