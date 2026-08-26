using IpManagementService.Data;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace IpManagementService.Tests;

public class IntraOpNoteAuditTests : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly IpManagementDbContext _db;
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _actorId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly Guid _journeyId = Guid.NewGuid();

    public IntraOpNoteAuditTests()
    {
        var services = new ServiceCollection();
        services.AddDbContext<IpManagementDbContext>(o =>
            o.UseInMemoryDatabase(Guid.NewGuid().ToString("N")));
        _provider = services.BuildServiceProvider();
        _db = _provider.GetRequiredService<IpManagementDbContext>();
    }

    [Fact]
    public async Task Save_WritesIntraOpNoteSavedAudit()
    {
        var svc = new IntraOpNoteService(_db);
        await svc.SaveAsync(_journeyId, _tenantId, _branchId, _actorId, new SaveIntraOpNoteRequest(
            null, null, null, null, null, null, "LA", null,
            "Phaco + IOL", "OD", null, null, "SN60WF", "+21.00",
            null, null, false, null));

        var row = Assert.Single(await _db.JourneyAuditLogs.ToListAsync());
        Assert.Equal("IntraOpNoteSaved", row.Action);
        Assert.Equal("IntraOp", row.StateType);
        Assert.Equal(_journeyId, row.PatientJourneyId);
        Assert.Equal(_actorId, row.PerformedByUserId);
    }

    [Fact]
    public async Task Sign_WritesIntraOpNoteSignedAudit()
    {
        var svc = new IntraOpNoteService(_db);
        await svc.SaveAsync(_journeyId, _tenantId, _branchId, _actorId, new SaveIntraOpNoteRequest(
            null, null, null, null, null, null, null, null,
            "Phaco", "OD", null, null, null, null,
            null, null, false, null));
        await svc.SignAsync(_journeyId, _tenantId, _actorId);

        var signed = Assert.Single(
            await _db.JourneyAuditLogs.Where(a => a.Action == "IntraOpNoteSigned").ToListAsync());
        Assert.Equal("Signed", signed.NewValue);
        Assert.Equal("Draft", signed.OldValue);
    }

    public void Dispose()
    {
        _db.Dispose();
        _provider.Dispose();
    }
}
