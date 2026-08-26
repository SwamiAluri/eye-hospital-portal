using CcmsApi.Models.Domain;
using CcmsApi.Services;
using FluentAssertions;
using Xunit;

namespace CcmsApi.Tests.ServiceTests;

public class CoverageShareProjectionTests
{
    [Fact]
    public void BillingSummary_WinsOverAuthorization()
    {
        var (payer, patient) = CoverageShareProjection.From(
            new CcmsCoverageCase { ApprovedAmount = 10_000 },
            new CcmsCoverageAuthorization { RequestedAmount = 50_000, ApprovedAmount = 40_000 },
            new CcmsBillingSummary { InsuranceShareAmount = 30_000, PatientShareAmount = 5_000 });

        payer.Should().Be(30_000);
        patient.Should().Be(5_000);
    }

    [Fact]
    public void PartialApproval_PatientShareIsRequestedMinusApproved()
    {
        var (payer, patient) = CoverageShareProjection.From(
            new CcmsCoverageCase { ApprovedAmount = 20_000 },
            new CcmsCoverageAuthorization { RequestedAmount = 35_000, ApprovedAmount = 20_000 },
            null);

        payer.Should().Be(20_000);
        patient.Should().Be(15_000);
    }

    [Fact]
    public void FullApproval_PatientShareZero()
    {
        var (payer, patient) = CoverageShareProjection.From(
            new CcmsCoverageCase { ApprovedAmount = 25_000 },
            new CcmsCoverageAuthorization { RequestedAmount = 25_000, ApprovedAmount = 25_000 },
            null);

        payer.Should().Be(25_000);
        patient.Should().Be(0);
    }
}
