using Microsoft.EntityFrameworkCore;
using Xunit;

namespace IpManagementService.Tests;

public class CounsellorInvestigationCopyTests : IDisposable
{
    private readonly WardPreOpTestContext _ctx = WardPreOpTestContext.Create();
    private WardPreOpSeed _seed = null!;

    public CounsellorInvestigationCopyTests()
    {
        _seed = WardPreOpSeedData.SeedInvestigationJourneyAsync(_ctx.Db).GetAwaiter().GetResult();
    }

    public void Dispose() => _ctx.Dispose();

    [Fact]
    public async Task CopyOutpatientCompletions_maps_investigation_as_draft_not_verified()
    {
        await WardPreOpSeedData.SeedCounsellorInvestigationCopyAsync(_ctx.Db, _seed);

        await _ctx.Counsellor.CopyOutpatientCompletionsToClearanceAsync(
            _seed.CounselingSessionId,
            _seed.ClearanceId,
            _seed.TenantId,
            _seed.UserId);

        var ward = await _ctx.Db.PreOpCompletions
            .FirstAsync(c => c.ClearanceId == _seed.ClearanceId && c.ItemId == _seed.BloodSugarItemId);

        Assert.Equal("105", ward.ResultValue);
        Assert.Equal("mg/dL", ward.ResultUnit);
        Assert.Equal("draft", ward.EntryStatus);
        Assert.Equal("counsellor", ward.ResultSource);
        Assert.Equal("copied_from_counsellor", ward.Source);
        Assert.Null(ward.VerifiedByUserId);
        Assert.Null(ward.VerifiedAt);

        var checklist = await _ctx.Investigation.GetChecklistAsync(
            _seed.JourneyId, _seed.TenantId, _seed.UserId);

        var item = checklist.Items.First(i => i.ItemId == _seed.BloodSugarItemId);
        Assert.True(item.CounsellorDraft);
        Assert.Equal("draft", item.EntryStatus);
    }
}
