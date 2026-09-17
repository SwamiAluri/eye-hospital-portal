using AuthService.Services;
using Xunit;

namespace AuthService.Tests;

public class CounselorCommunicationContractsTests
{
    [Theory]
    [InlineData("REMINDER", "General")]
    [InlineData("SCHEDULED", "General")]
    [InlineData("FOLLOW_UP", "General")]
    [InlineData("NO_SHOW", "DelayReason")]
    [InlineData("URGENT", "General")]
    [InlineData("General", "General")]
    [InlineData("PreSurgery", "PreSurgery")]
    [InlineData(null, "General")]
    [InlineData("", "General")]
    public void NormalizeCallbackType_MapsMasterCodesOntoDbAllowlist(string? input, string expected)
    {
        Assert.Equal(expected, CounselorCommunicationContracts.NormalizeCallbackType(input));
    }

    [Theory]
    [InlineData("Phone", "Phone")]
    [InlineData("Email", "Phone")]
    [InlineData("EMAIL", "Phone")]
    [InlineData("WhatsApp", "WhatsApp")]
    [InlineData("InPerson", "Phone")]
    public void NormalizeCallbackChannel_MapsOntoDbAllowlist(string input, string expected)
    {
        Assert.Equal(expected, CounselorCommunicationContracts.NormalizeCallbackChannel(input));
    }

    [Theory]
    [InlineData("Answered", "Answered")]
    [InlineData("LeftMessage", "Voicemail")]
    [InlineData("Declined", "DeclinedContact")]
    [InlineData("NoAnswer", "NoAnswer")]
    public void NormalizeCommOutcome_MapsUiShorthand(string input, string expected)
    {
        Assert.Equal(expected, CounselorCommunicationContracts.NormalizeCommOutcome(input));
    }

    [Fact]
    public void NormalizeCommOutcome_RejectsUnknown()
    {
        Assert.Throws<ArgumentException>(() =>
            CounselorCommunicationContracts.NormalizeCommOutcome("TotallyInvalid"));
    }
}
