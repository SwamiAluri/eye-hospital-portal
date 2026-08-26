using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace IpManagementService.Tests;

public class PostOpTaperTests : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly IpManagementDbContext _db;
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _actorId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();

    public PostOpTaperTests()
    {
        var services = new ServiceCollection();
        services.AddDbContext<IpManagementDbContext>(o =>
            o.UseInMemoryDatabase(Guid.NewGuid().ToString("N")));
        _provider = services.BuildServiceProvider();
        _db = _provider.GetRequiredService<IpManagementDbContext>();
    }

    [Fact]
    public async Task PutThreeSteps_GetRoundTrips()
    {
        var journey = SeedJourney();
        var svc = new PostOpTaperService(_db);

        var saved = await svc.ReplaceAsync(journey.Id, _tenantId, _actorId, new SavePostOpTaperRequest(
        [
            new("Prednisolone 1%", "RIGHT", "6 times a day", 7),
            new("Prednisolone 1%", "OD", "4 times a day", 7),
            new("Moxifloxacin 0.5%", "OD", "4 times a day", 14),
        ]));

        Assert.Equal(3, saved.Steps.Count);
        Assert.Empty(saved.History);
        Assert.Equal("OD", saved.Steps[0].Eye);
        Assert.Equal(1, saved.Steps.First(s => s.DrugName.StartsWith("Prednisolone") && s.FrequencyLabel.StartsWith("6")).StepNo);
        Assert.Equal(2, saved.Steps.First(s => s.DrugName.StartsWith("Prednisolone") && s.FrequencyLabel.StartsWith("4")).StepNo);

        var loaded = await svc.GetAsync(journey.Id, _tenantId);
        Assert.Equal(3, loaded.Steps.Count);
        Assert.All(loaded.Steps, s => Assert.Null(s.DeletedAt));
    }

    [Fact]
    public async Task Replace_SoftDeletesPrevious_DoesNotEditInPlace()
    {
        var journey = SeedJourney();
        var svc = new PostOpTaperService(_db);

        var first = await svc.ReplaceAsync(journey.Id, _tenantId, _actorId, new SavePostOpTaperRequest(
        [
            new("Prednisolone 1%", "OD", "6 times a day", 7),
        ]));
        var firstId = Assert.Single(first.Steps).Id;

        var second = await svc.ReplaceAsync(journey.Id, _tenantId, _actorId, new SavePostOpTaperRequest(
        [
            new("Prednisolone 1%", "OD", "4 times a day", 7),
        ]));

        Assert.NotEqual(firstId, Assert.Single(second.Steps).Id);
        Assert.Single(second.History);
        Assert.Equal(firstId, second.History[0].Id);
        Assert.NotNull(second.History[0].DeletedAt);
    }

    [Fact]
    public async Task BoundWithoutPostOpManage_IsForbidden()
    {
        var journey = SeedJourney();
        var auth = new JourneyCommandAuthContext();
        auth.Bind(["ward.checklist.edit", "ip.discharge"]);
        var svc = new PostOpTaperService(_db, auth);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            svc.ReplaceAsync(journey.Id, _tenantId, _actorId, new SavePostOpTaperRequest(
            [
                new("Prednisolone 1%", "OD", "6 times a day", 7),
            ])));
        Assert.Empty(_db.PostOpTaperSteps);
    }

    [Fact]
    public async Task BoundWithPostOpManage_Saves()
    {
        var journey = SeedJourney();
        var auth = new JourneyCommandAuthContext();
        auth.Bind(["ip.postop.manage"]);
        var svc = new PostOpTaperService(_db, auth);

        var saved = await svc.ReplaceAsync(journey.Id, _tenantId, _actorId, new SavePostOpTaperRequest(
        [
            new("Prednisolone 1%", "OS", "2 times a day", 7),
        ]));
        Assert.Single(saved.Steps);
    }

    [Fact]
    public async Task DaysMustBePositive()
    {
        var journey = SeedJourney();
        var svc = new PostOpTaperService(_db);
        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            svc.ReplaceAsync(journey.Id, _tenantId, _actorId, new SavePostOpTaperRequest(
            [
                new("Prednisolone 1%", "OD", "QID", 0),
            ])));
        Assert.Contains("Days", ex.Message, StringComparison.OrdinalIgnoreCase);
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
            PatientId = Guid.NewGuid(),
            Uhid = "UAT-002",
            ClinicalState = ClinicalState.PostOp,
            OtState = OtState.NotSent,
            FinancialState = FinancialState.Draft,
            EyeOperated = "OD",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        };
        _db.PatientJourneys.Add(journey);
        _db.SaveChanges();
        return journey;
    }
}
