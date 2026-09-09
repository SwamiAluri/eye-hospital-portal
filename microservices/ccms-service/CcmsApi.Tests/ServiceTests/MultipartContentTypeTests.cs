using FluentAssertions;
using Microsoft.Net.Http.Headers;
using Xunit;

namespace CcmsApi.Tests.ServiceTests;

/// <summary>
/// Documents why axios must not send multipart/form-data without a boundary.
/// </summary>
public sealed class MultipartContentTypeTests
{
    [Fact]
    public void ParseMultipartContentType_WithoutBoundary_HasNoBoundary()
    {
        var parsed = MediaTypeHeaderValue.Parse("multipart/form-data");
        parsed.Boundary.HasValue.Should().BeFalse();
    }

    [Fact]
    public void ParseMultipartContentType_WithBoundary_ParsesBoundary()
    {
        var parsed = MediaTypeHeaderValue.Parse("multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW");
        parsed.Boundary.HasValue.Should().BeTrue();
        parsed.Boundary.Value.ToString().Should().Be("----WebKitFormBoundary7MA4YWxkTrZu0gW");
    }
}
