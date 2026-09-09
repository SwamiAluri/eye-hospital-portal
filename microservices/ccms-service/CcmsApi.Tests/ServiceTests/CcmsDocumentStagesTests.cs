using CcmsApi.Services;
using FluentAssertions;
using Xunit;

namespace CcmsApi.Tests.ServiceTests;

public class CcmsDocumentStagesTests
{
    [Theory]
    [InlineData(null, "preauth")]
    [InlineData("", "preauth")]
    [InlineData("   ", "preauth")]
    [InlineData("preauth", "preauth")]
    [InlineData("PRE_AUTH", "preauth")]
    [InlineData("pre-auth", "preauth")]
    [InlineData("general", "preauth")]
    [InlineData("claim", "claim")]
    [InlineData("claims", "claim")]
    public void Normalize_maps_legacy_and_empty_values(string? input, string expected)
    {
        CcmsDocumentStages.Normalize(input).Should().Be(expected);
    }
}
