using IpManagementService.Models.Dtos;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace IpManagementService.Tests;

public class WardInvestigationChecklistServiceTests : IDisposable
{
    private readonly WardPreOpTestContext _ctx = WardPreOpTestContext.Create();
    private WardPreOpSeed _seed = null!;

    public WardInvestigationChecklistServiceTests()
    {
        _seed = WardPreOpSeedData.SeedInvestigationJourneyAsync(_ctx.Db).GetAwaiter().GetResult();
    }

    public void Dispose() => _ctx.Dispose();

    [Fact]
    public async Task SaveResultAsync_without_value_throws()
    {
        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            _ctx.Investigation.SaveResultAsync(
                _seed.JourneyId,
                _seed.BloodSugarItemId,
                _seed.TenantId,
                _seed.UserId,
                new SaveWardInvestigationResultRequest("", null, null, null, null, null, null)));

        Assert.Contains("required", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SaveResultAsync_sets_entered_and_audit_fields()
    {
        var dto = await _ctx.Investigation.SaveResultAsync(
            _seed.JourneyId,
            _seed.BloodSugarItemId,
            _seed.TenantId,
            _seed.UserId,
            new SaveWardInvestigationResultRequest(
                "112",
                "mg/dL",
                "70-110",
                "Normal",
                "manual_ward",
                null,
                "Fasting sample"),
            "Nurse");

        var item = dto.Items.First(i => i.ItemId == _seed.BloodSugarItemId);
        Assert.Equal("112", item.ResultValue);
        Assert.Equal("mg/dL", item.ResultUnit);
        Assert.Equal("entered", item.EntryStatus);
        Assert.True(item.IsCompleted);

        var row = await _ctx.Db.PreOpCompletions
            .FirstAsync(c => c.ClearanceId == _seed.ClearanceId && c.ItemId == _seed.BloodSugarItemId);

        Assert.Equal("112", row.ResultValue);
        Assert.Equal("entered", row.EntryStatus);
        Assert.Equal(_seed.UserId, row.EnteredByUserId);
        Assert.NotNull(row.EnteredAt);
        Assert.Null(row.VerifiedByUserId);
        Assert.Null(row.VerifiedAt);
    }

    [Fact]
    public async Task VerifyAsync_without_value_throws()
    {
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _ctx.Investigation.VerifyAsync(
                _seed.JourneyId,
                _seed.BloodSugarItemId,
                _seed.TenantId,
                _seed.UserId,
                new VerifyWardInvestigationRequest(null)));

        Assert.Contains("without a result value", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task VerifyAsync_sets_verified_audit_fields()
    {
        await _ctx.Investigation.SaveResultAsync(
            _seed.JourneyId,
            _seed.BloodSugarItemId,
            _seed.TenantId,
            _seed.UserId,
            new SaveWardInvestigationResultRequest("98", "mg/dL", null, null, null, null, null));

        var verifierId = Guid.NewGuid();
        var dto = await _ctx.Investigation.VerifyAsync(
            _seed.JourneyId,
            _seed.BloodSugarItemId,
            _seed.TenantId,
            verifierId,
            new VerifyWardInvestigationRequest("Reviewed at ward"),
            "Doctor");

        var item = dto.Items.First(i => i.ItemId == _seed.BloodSugarItemId);
        Assert.Equal("verified", item.EntryStatus);

        var row = await _ctx.Db.PreOpCompletions
            .FirstAsync(c => c.ClearanceId == _seed.ClearanceId && c.ItemId == _seed.BloodSugarItemId);

        Assert.Equal("verified", row.EntryStatus);
        Assert.Equal(verifierId, row.VerifiedByUserId);
        Assert.NotNull(row.VerifiedAt);
        Assert.Equal("Reviewed at ward", row.Notes);
    }

    [Fact]
    public async Task VerifyAsync_when_already_verified_throws()
    {
        await _ctx.Investigation.SaveResultAsync(
            _seed.JourneyId,
            _seed.BloodSugarItemId,
            _seed.TenantId,
            _seed.UserId,
            new SaveWardInvestigationResultRequest("99", "mg/dL", null, null, null, null, null));

        await _ctx.Investigation.VerifyAsync(
            _seed.JourneyId,
            _seed.BloodSugarItemId,
            _seed.TenantId,
            _seed.UserId,
            new VerifyWardInvestigationRequest(null));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _ctx.Investigation.VerifyAsync(
                _seed.JourneyId,
                _seed.BloodSugarItemId,
                _seed.TenantId,
                _seed.UserId,
                new VerifyWardInvestigationRequest(null)));
    }

    [Fact]
    public async Task ApplyIntegrationResultAsync_populates_value_entered_not_verified()
    {
        await _ctx.Investigation.ApplyIntegrationResultAsync(
            _seed.JourneyId,
            _seed.BloodSugarItemId,
            _seed.TenantId,
            _seed.UserId,
            "6.2",
            "mg/dL",
            "0.7-1.3",
            "LIS auto-result");

        var row = await _ctx.Db.PreOpCompletions
            .FirstAsync(c => c.ClearanceId == _seed.ClearanceId && c.ItemId == _seed.BloodSugarItemId);

        Assert.Equal("6.2", row.ResultValue);
        Assert.Equal("integration", row.ResultSource);
        Assert.Equal("entered", row.EntryStatus);
        Assert.Null(row.VerifiedByUserId);
        Assert.Null(row.VerifiedAt);
        Assert.True(row.IsCompleted);
    }

    [Fact]
    public async Task Lis_webhook_populates_value_not_verified()
    {
        var result = await _ctx.Integration.ProcessLisResultAsync(
            _seed.TenantId,
            _seed.UserId,
            new LisIntegrationWebhookRequest(
                _seed.JourneyId,
                "CREAT",
                "Serum Creatinine",
                Status: "Completed",
                TestResult: "1.1",
                TestUnit: "mg/dL"));

        Assert.True(result.ItemsUpdated >= 1);
        Assert.Contains("serum_creatinine", result.ItemKeys);

        var row = await _ctx.Db.PreOpCompletions
            .FirstAsync(c => c.ClearanceId == _seed.ClearanceId && c.ItemId == _seed.CreatinineItemId);

        Assert.Equal("1.1", row.ResultValue);
        Assert.Equal("entered", row.EntryStatus);
        Assert.Null(row.VerifiedAt);
    }
}
