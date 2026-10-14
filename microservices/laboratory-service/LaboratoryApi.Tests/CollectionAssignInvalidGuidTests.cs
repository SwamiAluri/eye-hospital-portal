using System.Text;
using System.Text.Json;
using LaboratoryApi.Services;
using Xunit;

namespace LaboratoryApi.Tests;

/// <summary>
/// L-COL-01B — malformed Assign <c>assignToUserId</c> must map to 400 <c>assignee_invalid</c>
/// (not an unhandled JsonException / HTTP 500).
/// </summary>
public class CollectionAssignInvalidGuidTests
{
    [Theory]
    [InlineData("ram")]
    [InlineData("reddy")]
    [InlineData("not-a-guid")]
    [InlineData("")]
    public void Parse_Malformed_AssignToUserId_Throws_Assignee_Invalid(string raw)
    {
        var json = $$"""{"expectedRowVersion":1,"assignToUserId":{{JsonSerializer.Serialize(raw)}}}""";

        var ex = Assert.Throws<CollectionDomainException>(() => CollectionAssignJson.Parse(json));

        Assert.Equal(400, ex.StatusCode);
        Assert.Equal(CollectionAssignJson.InvalidAssigneeCode, ex.Code);
        Assert.Equal(CollectionAssignJson.InvalidAssigneeMessage, ex.Message);
    }

    [Fact]
    public void Parse_Empty_Guid_Deserializes_For_Domain_Assignee_Required()
    {
        var json = """{"expectedRowVersion":1,"assignToUserId":"00000000-0000-0000-0000-000000000000"}""";
        var body = CollectionAssignJson.Parse(json);
        Assert.Equal(Guid.Empty, body.AssignToUserId);
    }

    [Fact]
    public void Parse_Valid_Guid_Succeeds()
    {
        var id = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
        var json = $$"""{"expectedRowVersion":3,"assignToUserId":"{{id}}"}""";
        var body = CollectionAssignJson.Parse(json);
        Assert.Equal(id, body.AssignToUserId);
        Assert.Equal(3, body.ExpectedRowVersion);
    }

    [Fact]
    public async Task ReadAsync_Malformed_AssignToUserId_Throws_Assignee_Invalid()
    {
        await using var stream = new MemoryStream(
            Encoding.UTF8.GetBytes("""{"expectedRowVersion":1,"assignToUserId":"ram"}"""));

        var ex = await Assert.ThrowsAsync<CollectionDomainException>(
            () => CollectionAssignJson.ReadAsync(stream));

        Assert.Equal(400, ex.StatusCode);
        Assert.Equal("assignee_invalid", ex.Code);
    }

    [Fact]
    public void Parse_Does_Not_Weaken_Valid_Contract_Shape()
    {
        Assert.Equal("assignee_invalid", CollectionAssignJson.InvalidAssigneeCode);
        Assert.Contains("GUID", CollectionAssignJson.InvalidAssigneeMessage, StringComparison.OrdinalIgnoreCase);
    }
}
