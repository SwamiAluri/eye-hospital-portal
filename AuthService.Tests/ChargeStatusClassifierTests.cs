using AuthService.Services;
using Xunit;

namespace AuthService.Tests;

public class ChargeStatusClassifierTests
{
    [Fact]
    public void Unmapped_WinsOverMissing()
    {
        var (status, label) = ChargeStatusClassifier.Classify(missingChargeCount: 2, unmappedCount: 1);
        Assert.Equal(ChargeStatusClassifier.Unmapped, status);
        Assert.Equal("1 unmapped", label);
    }

    [Fact]
    public void MissingCharges_FormatsCount()
    {
        var (status, label) = ChargeStatusClassifier.Classify(3, 0);
        Assert.Equal(ChargeStatusClassifier.MissingCharges, status);
        Assert.Equal("3 missing", label);
    }

    [Fact]
    public void Complete_WhenNothingOutstanding()
    {
        var (status, label) = ChargeStatusClassifier.Classify(0, 0);
        Assert.Equal(ChargeStatusClassifier.Complete, status);
        Assert.Equal("Complete", label);
    }
}
