using IpManagementService.Services;
using Xunit;

namespace IpManagementService.Tests;

public class JourneyClinicalAuditTests
{
    [Fact]
    public void Entry_TruncatesOldAndNewValue_AndSetsCorrelation()
    {
        var tenant = Guid.NewGuid();
        var journey = Guid.NewGuid();
        var user = Guid.NewGuid();
        var correlation = Guid.NewGuid();
        var longValue = new string('x', 80);

        var row = JourneyClinicalAudit.Entry(
            tenant, journey, user, "VitalRecorded", "Vitals",
            longValue, "120/80", notes: "PreOp", correlationId: correlation);

        Assert.Equal("VitalRecorded", row.Action);
        Assert.Equal("Vitals", row.StateType);
        Assert.Equal(50, row.OldValue!.Length);
        Assert.Equal("120/80", row.NewValue);
        Assert.Equal(correlation, row.CorrelationId);
        Assert.Equal(user, row.PerformedByUserId);
        Assert.Equal("active", row.Status);
    }
}
