using CcmsApi.Services;
using FluentAssertions;
using Xunit;

namespace CcmsApi.Tests.ServiceTests;

public class CoverageStatusClassifierTests
{
    [Theory]
    [InlineData("APPROVED", CoverageStatusClassifier.CoverageApproved)]
    [InlineData("ADMISSION_READY", CoverageStatusClassifier.CoverageApproved)]
    [InlineData("CLAIM_SUBMITTED", CoverageStatusClassifier.CoverageApproved)]
    [InlineData("WAITING_APPROVAL", CoverageStatusClassifier.CoveragePending)]
    [InlineData("PREAUTH_SENT", CoverageStatusClassifier.CoveragePending)]
    [InlineData("DRAFT", CoverageStatusClassifier.CoveragePending)]
    [InlineData("REJECTED", CoverageStatusClassifier.CoverageRejected)]
    [InlineData("EXPIRED", CoverageStatusClassifier.CoverageRejected)]
    [InlineData("CANCELLED", CoverageStatusClassifier.CoverageRejected)]
    [InlineData("PARTIAL_APPROVAL", CoverageStatusClassifier.CoverageChanged)]
    [InlineData("PARTIAL_SETTLEMENT", CoverageStatusClassifier.CoverageChanged)]
    public void Maps_Ccms_Workflow_States(string state, string expected)
        => CoverageStatusClassifier.Classify(state).Should().Be(expected);
}
