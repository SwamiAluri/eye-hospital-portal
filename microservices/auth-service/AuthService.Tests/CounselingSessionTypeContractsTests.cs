using AuthService.Services;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Phase 3I Slice 8 fix — counseling_sessions.session_type CHECK allowlist
/// (Initial | Followup | Recheck | Urgent). Master UI codes must normalize before persist.
/// </summary>
public class CounselingSessionTypeContractsTests
{
    [Theory]
    [InlineData("FOLLOW_UP", "Followup")]
    [InlineData("follow_up", "Followup")]
    [InlineData("INITIAL", "Initial")]
    [InlineData("URGENT", "Urgent")]
    [InlineData("PRE_OP", "Recheck")]
    [InlineData("POST_OP", "Followup")]
    [InlineData("PACKAGE", "Initial")]
    [InlineData("Initial", "Initial")]
    [InlineData("Followup", "Followup")]
    [InlineData("Recheck", "Recheck")]
    [InlineData("Urgent", "Urgent")]
    public void TryNormalizeWritableSessionType_MapsMasterAndDbValues(string input, string expected)
    {
        var ok = CounselingSessionTypeContracts.TryNormalizeWritableSessionType(
            input, out var normalized, out var error);

        Assert.True(ok);
        Assert.Equal(expected, normalized);
        Assert.Null(error);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void TryNormalizeWritableSessionType_Blank_IsNoOp(string? input)
    {
        var ok = CounselingSessionTypeContracts.TryNormalizeWritableSessionType(
            input, out var normalized, out var error);

        Assert.True(ok);
        Assert.Null(normalized);
        Assert.Null(error);
    }

    [Theory]
    [InlineData("TotallyInvalid")]
    [InlineData("Follow-Up")]
    [InlineData("NotAType")]
    public void TryNormalizeWritableSessionType_Unknown_FailsClosed(string input)
    {
        var ok = CounselingSessionTypeContracts.TryNormalizeWritableSessionType(
            input, out var normalized, out var error);

        Assert.False(ok);
        Assert.Null(normalized);
        Assert.False(string.IsNullOrWhiteSpace(error));
    }

    [Fact]
    public void AllowedDbValues_MatchPostgresCheckConstraint()
    {
        Assert.Equal(
            new[] { "Initial", "Followup", "Recheck", "Urgent" },
            CounselingSessionTypeContracts.AllowedDbValues);
    }
}
