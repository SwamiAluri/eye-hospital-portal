using IpManagementService.Services;
using Xunit;

namespace IpManagementService.Tests;

public class ChecklistPhaseStatusServiceTests
{
    [Fact]
    public void Parse_reads_bool_flags_and_ignores_numeric_keys()
    {
        var json = """
            {
              "ward_investigation_complete": true,
              "pac_completed": false,
              "investigations_verified_count": 3
            }
            """;

        var dict = ChecklistPhaseStatusService.Parse(json);

        Assert.True(dict["ward_investigation_complete"]);
        Assert.False(dict["pac_completed"]);
        Assert.False(dict.ContainsKey("investigations_verified_count"));
    }
}

public class ChecklistPhaseStatusServiceInvestigationTests
{
    [Fact]
    public void ParseInvestigationSummary_reads_counts_and_critical_keys()
    {
        var json = """
            {
              "ward_investigation_complete": false,
              "investigations_verified_count": 2,
              "investigations_total_applicable": 5,
              "investigations_unverified_critical": ["serum_creatinine", "hiv_done"]
            }
            """;

        var summary = ChecklistPhaseStatusService.ParseInvestigationSummary(json);

        Assert.NotNull(summary);
        Assert.Equal(2, summary!.VerifiedCount);
        Assert.Equal(5, summary.TotalApplicable);
        Assert.Equal(2, summary.UnverifiedCritical.Count);
    }
}
