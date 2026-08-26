using CcmsApi.Models.Domain;
using Xunit;

namespace CcmsApi.Tests.ServiceTests;

public class ClaimStatusAuditFieldsTests
{
    [Fact]
    public void ClaimStatusEvent_CarriesPreviousStateActorAndCorrelation()
    {
        var caseId = Guid.NewGuid();
        var actor = Guid.NewGuid();
        var evt = new CcmsApprovalEvent
        {
            Id = Guid.NewGuid(),
            CoverageCase_Id = caseId,
            EventType = "CLAIM_STATUS_CHANGED",
            ApprovalStatus = "CLAIM_READY",
            PreviousState = "BILL_FINALIZED",
            CorrelationId = caseId,
            RecordedByUserId = actor,
            RecordedAt = DateTime.UtcNow,
        };

        Assert.Equal("CLAIM_STATUS_CHANGED", evt.EventType);
        Assert.Equal("BILL_FINALIZED", evt.PreviousState);
        Assert.Equal("CLAIM_READY", evt.ApprovalStatus);
        Assert.Equal(caseId, evt.CorrelationId);
        Assert.Equal(actor, evt.RecordedByUserId);
        Assert.NotEqual(default, evt.RecordedAt);
    }
}
