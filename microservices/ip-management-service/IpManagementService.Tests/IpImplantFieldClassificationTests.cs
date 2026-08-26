using IpManagementService.Services;
using Xunit;

namespace IpManagementService.Tests;

public class IpImplantFieldClassificationTests
{
    [Fact]
    public void JourneyImplantUsage_IsUsageRecord()
    {
        var meta = IpImplantFieldClassification.Find("JourneyImplantUsage");
        Assert.NotNull(meta);
        Assert.Equal(IpImplantFieldClassification.UsageRecord, meta!.Classification);
        Assert.Equal("IP registry", meta.CanonicalOwner);
        Assert.False(IpImplantFieldClassification.WritesAreFrozen("JourneyImplantUsage"));
    }

    [Fact]
    public void PlannedPower_IsNotUsage()
    {
        var meta = IpImplantFieldClassification.Find("PatientJourney.IolPower");
        Assert.NotNull(meta);
        Assert.Equal(IpImplantFieldClassification.PlannedClinical, meta!.Classification);
        Assert.False(IpImplantFieldClassification.WritesAreFrozen("PatientJourney.IolPower"));
    }

    [Fact]
    public void BarcodeFlagsAndIntraOpFreeText_WritesAreFrozen()
    {
        Assert.True(IpImplantFieldClassification.WritesAreFrozen("PatientJourney.IolBarcode"));
        Assert.True(IpImplantFieldClassification.WritesAreFrozen("PatientJourney.IolBarcodeVerified"));
        Assert.True(IpImplantFieldClassification.WritesAreFrozen("IntraOpNote.ImplantUsed"));
        Assert.True(IpImplantFieldClassification.WritesAreFrozen("IntraOpNote.ImplantPower"));
    }
}
