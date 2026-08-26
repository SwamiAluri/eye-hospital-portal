using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace IpManagementService.Tests;

public class OpdJourneyCopyTests : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly IpManagementDbContext _db;
    private readonly PatientJourneyService _svc;
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _actorId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();

    public OpdJourneyCopyTests()
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
    }

    [Fact]
    public void ShouldWrite_NeverBlanks()
    {
        Assert.False(OpdJourneyCopy.ShouldWrite("+21.00 D", null, false));
        Assert.False(OpdJourneyCopy.ShouldWrite("+21.00 D", "", true));
        Assert.True(OpdJourneyCopy.ShouldWrite(null, "+21.00 D", false));
        Assert.True(OpdJourneyCopy.ShouldWrite("+19.00 D", "+21.00 D", true));
    }

    [Fact]
    public async Task ApplyCopy_FillsNullIolFromSession()
    {
        var otId = Guid.NewGuid();
        var journey = SeedJourney(otId, iol: null, procedure: null, eye: null);

        var result = await _svc.ApplyOpdClinicalCopyAsync(new ApplyOpdClinicalCopyRequest(
            otId, _tenantId, "Phaco + IOL", "RE", "+21.00 D", ForceRefresh: false, _actorId.ToString()));

        Assert.NotNull(result);
        Assert.Equal("+21.00 D", result!.IolPower);
        Assert.Equal("Phaco + IOL", result.ProcedureName);
        Assert.Equal("OD", result.EyeOperated);
        var saved = await _db.PatientJourneys.AsNoTracking().SingleAsync(j => j.Id == journey.Id);
        Assert.Equal("+21.00 D", saved.IolPower);
        Assert.Contains(_db.JourneyAuditLogs, a => a.Action == "OpdClinicalCopied");
    }

    [Fact]
    public async Task SecondCopy_DoesNotBlankPopulatedIol()
    {
        var otId = Guid.NewGuid();
        SeedJourney(otId, iol: "+21.00 D", procedure: "Phaco + IOL", eye: "OD");

        var result = await _svc.ApplyOpdClinicalCopyAsync(new ApplyOpdClinicalCopyRequest(
            otId, _tenantId, null, null, null, ForceRefresh: false, _actorId.ToString()));

        Assert.Equal("+21.00 D", result!.IolPower);
        Assert.Equal("Phaco + IOL", result.ProcedureName);
        Assert.Equal("OD", result.EyeOperated);
    }

    [Fact]
    public async Task ForceRefresh_OverwritesIol()
    {
        var otId = Guid.NewGuid();
        SeedJourney(otId, iol: "+19.00 D", procedure: "Phaco + IOL", eye: "OD");

        var result = await _svc.ApplyOpdClinicalCopyAsync(new ApplyOpdClinicalCopyRequest(
            otId, _tenantId, "Phaco + IOL", "OD", "+21.00 D", ForceRefresh: true, _actorId.ToString()));

        Assert.Equal("+21.00 D", result!.IolPower);
        Assert.Contains(_db.JourneyAuditLogs, a => a.Action == "OpdClinicalRefreshed");
    }

    private PatientJourney SeedJourney(Guid otId, string? iol, string? procedure, string? eye)
    {
        var journey = new PatientJourney
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            BranchId = _branchId,
            PatientId = Guid.NewGuid(),
            OtFinalizeScheduleId = otId,
            ClinicalState = ClinicalState.Expected,
            OtState = OtState.NotSent,
            FinancialState = FinancialState.NotCreated,
            IolPower = iol,
            ProcedureName = procedure,
            EyeOperated = eye,
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
