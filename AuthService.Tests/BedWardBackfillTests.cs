using AuthService.Services;
using Xunit;

namespace AuthService.Tests;

/// <summary>Mirrors 165 name backfill plus 167 Wave7 alias attach.</summary>
public class BedWardBackfillTests
{
    private sealed class BedRow
    {
        public Guid TenantId { get; init; }
        public Guid BranchId { get; init; }
        public string? WardName { get; set; }
        public Guid? WardId { get; set; }
    }

    [Fact]
    public void Backfill_MatchesNameWithinTenantAndBranch_AttachesWave7ToDayCare_AndSkipsUnknown()
    {
        var tenant = Guid.NewGuid();
        var otherTenant = Guid.NewGuid();
        var branch = Guid.NewGuid();
        var otherBranch = Guid.NewGuid();
        var dayCareId = Guid.NewGuid();
        var generalId = Guid.NewGuid();
        var preserved = Guid.NewGuid();

        var wards = new[]
        {
            new BedWardMatcher.WardNameRow(dayCareId, tenant, branch, "Day Care Ward", "DayCare"),
            new BedWardMatcher.WardNameRow(generalId, tenant, branch, "General Ward", "General"),
            new BedWardMatcher.WardNameRow(Guid.NewGuid(), tenant, otherBranch, "Day Care Ward", "DayCare"),
            new BedWardMatcher.WardNameRow(Guid.NewGuid(), otherTenant, branch, "Day Care Ward", "DayCare"),
        };

        var beds = new[]
        {
            new BedRow { TenantId = tenant, BranchId = branch, WardName = "day care ward", WardId = null },
            new BedRow { TenantId = tenant, BranchId = branch, WardName = "Wave7", WardId = null },
            new BedRow { TenantId = tenant, BranchId = branch, WardName = "West Wing", WardId = null },
            new BedRow { TenantId = tenant, BranchId = branch, WardName = "General Ward", WardId = preserved },
        };

        foreach (var bed in beds.Where(b => b.WardId is null))
        {
            var id = BedWardMatcher.ResolveWardId(bed.TenantId, bed.BranchId, bed.WardName, wards);
            bed.WardId = id;
            var canonical = BedWardMatcher.CanonicalWardName(id, wards);
            if (!string.IsNullOrWhiteSpace(canonical))
                bed.WardName = canonical;
        }

        Assert.Equal(dayCareId, beds[0].WardId);
        Assert.Equal("Day Care Ward", beds[0].WardName);
        Assert.Equal(dayCareId, beds[1].WardId);
        Assert.Equal("Day Care Ward", beds[1].WardName);
        Assert.Null(beds[2].WardId);
        Assert.Equal("West Wing", beds[2].WardName);
        Assert.Equal(preserved, beds[3].WardId);
    }
}
