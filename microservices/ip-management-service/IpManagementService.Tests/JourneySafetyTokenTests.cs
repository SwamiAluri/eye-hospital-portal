using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace IpManagementService.Tests;

public class JourneySafetyTokenTests : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly IpManagementDbContext _db;
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _actorId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();

    public JourneySafetyTokenTests()
    {
        var services = new ServiceCollection();
        services.AddDbContext<IpManagementDbContext>(o =>
            o.UseInMemoryDatabase(Guid.NewGuid().ToString("N")));
        _provider = services.BuildServiceProvider();
        _db = _provider.GetRequiredService<IpManagementDbContext>();
    }

    [Fact]
    public async Task SecondIssue_ReturnsSameId_WithoutSecondRow()
    {
        var journey = SeedJourney(ClinicalState.Admitted, "OD", "UAT-002");
        var svc = new JourneySafetyTokenService(_db);

        var first = await svc.IssueAsync(journey.Id, _tenantId, _actorId);
        var second = await svc.IssueAsync(journey.Id, _tenantId, _actorId);

        Assert.Equal(first.Id, second.Id);
        Assert.Equal(first.TokenCode, second.TokenCode);
        Assert.True(second.AlreadyIssued);
        Assert.False(first.AlreadyIssued);
        Assert.Single(_db.JourneySafetyTokens);
        Assert.Matches(@"^WB-\d{6}-\d{5}$", first.TokenCode);
        Assert.Equal($"{first.TokenCode}|UAT-002|OD", first.BarcodeValue);
        Assert.Single(_db.JourneyAuditLogs.Where(a => a.Action == "SafetyTokenIssued"));
    }

    [Fact]
    public async Task Reprint_UpdatesPrintedAt_AndAudits()
    {
        var journey = SeedJourney(ClinicalState.Admitted, "OS", "UAT-014");
        var svc = new JourneySafetyTokenService(_db);
        var issued = await svc.IssueAsync(journey.Id, _tenantId, _actorId);
        var row = _db.JourneySafetyTokens.Single();
        var previousPrintedAt = DateTime.UtcNow.AddMinutes(-1);
        row.PrintedAt = previousPrintedAt;
        await _db.SaveChangesAsync();

        var reprinted = await svc.ReprintAsync(journey.Id, _tenantId, _actorId);

        Assert.Equal(issued.Id, reprinted.Id);
        Assert.Equal(issued.TokenCode, reprinted.TokenCode);
        Assert.True(reprinted.PrintedAt > previousPrintedAt);
        Assert.Equal(_actorId, reprinted.PrintedBy);
        Assert.Contains(_db.JourneyAuditLogs, a => a.Action == "SafetyTokenReprinted" && a.NewValue == issued.TokenCode);
    }

    [Fact]
    public async Task GetActive_ReturnsNullWhenMissing()
    {
        var journey = SeedJourney(ClinicalState.Admitted, "OD", "UAT-002");
        var svc = new JourneySafetyTokenService(_db);
        Assert.Null(await svc.GetActiveAsync(journey.Id, _tenantId));
    }

    [Fact]
    public async Task Issue_BeforeAdmit_Throws()
    {
        var journey = SeedJourney(ClinicalState.Expected, "OD", "UAT-002");
        var svc = new JourneySafetyTokenService(_db);
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.IssueAsync(journey.Id, _tenantId, _actorId));
        Assert.Empty(_db.JourneySafetyTokens);
    }

    [Fact]
    public async Task Reprint_WithoutToken_Throws()
    {
        var journey = SeedJourney(ClinicalState.Admitted, "OD", "UAT-002");
        var svc = new JourneySafetyTokenService(_db);
        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.ReprintAsync(journey.Id, _tenantId, _actorId));
    }

    [Fact]
    public async Task BoundWithoutPrintPermission_BlocksIssue()
    {
        var journey = SeedJourney(ClinicalState.Admitted, "OD", "UAT-002");
        var auth = new JourneyCommandAuthContext();
        auth.Bind(["ward.checklist.edit"]);
        var svc = new JourneySafetyTokenService(_db, auth);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => svc.IssueAsync(journey.Id, _tenantId, _actorId));
        Assert.Empty(_db.JourneySafetyTokens);
    }

    [Fact]
    public async Task BoundWithPrintPermission_Issues()
    {
        var journey = SeedJourney(ClinicalState.Admitted, "OU", "HID-1");
        var auth = new JourneyCommandAuthContext();
        auth.Bind(["ip.safety_token.print"]);
        var svc = new JourneySafetyTokenService(_db, auth);

        var dto = await svc.IssueAsync(journey.Id, _tenantId, _actorId);
        Assert.Equal("OU", dto.Laterality);
        Assert.EndsWith("|HID-1|OU", dto.BarcodeValue);
    }

    [Fact]
    public void BarcodeValue_StaysWithin64()
    {
        var longUhid = new string('U', 80);
        var value = JourneySafetyTokenService.BuildBarcodeValue("WB-260825-00001", longUhid, "OD");
        Assert.True(value.Length <= 64);
        Assert.StartsWith("WB-260825-00001|", value);
        Assert.EndsWith("|OD", value);
    }

    public void Dispose()
    {
        _db.Dispose();
        _provider.Dispose();
    }

    private PatientJourney SeedJourney(string clinicalState, string eye, string uhid)
    {
        var journey = new PatientJourney
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            BranchId = _branchId,
            PatientId = Guid.NewGuid(),
            Uhid = uhid,
            ClinicalState = clinicalState,
            OtState = OtState.NotSent,
            FinancialState = FinancialState.Draft,
            EyeOperated = eye,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        };
        _db.PatientJourneys.Add(journey);
        _db.SaveChanges();
        return journey;
    }
}
