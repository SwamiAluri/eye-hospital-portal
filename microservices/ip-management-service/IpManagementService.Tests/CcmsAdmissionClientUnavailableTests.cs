using System.Net;
using IpManagementService.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace IpManagementService.Tests;

/// <summary>Phase 5 Scenario 6 — real client fail-closed / fail-open on CCMS outage.</summary>
public class CcmsAdmissionClientUnavailableTests
{
    private static CcmsAdmissionClient CreateClient(HttpMessageHandler handler)
    {
        var http = new HttpClient(handler) { BaseAddress = new Uri("http://ccms.test/") };
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["CcmsService:InternalApiKey"] = "test-key",
        }).Build();
        return new CcmsAdmissionClient(http, NullLogger<CcmsAdmissionClient>.Instance, config);
    }

    [Fact]
    public void ForCcmsUnavailable_CoverageBased_Blocks()
    {
        var result = CcmsAdmissionValidation.ForCcmsUnavailable(coverageBased: true);
        Assert.False(result.Allowed);
        Assert.Equal("BLOCK", result.Decision);
        Assert.True(result.CcmsUnavailable);
        Assert.True(result.RequiresOverride);
    }

    [Fact]
    public void ForCcmsUnavailable_Cash_Allows()
    {
        var result = CcmsAdmissionValidation.ForCcmsUnavailable(coverageBased: false);
        Assert.True(result.Allowed);
        Assert.Equal("ALLOW", result.Decision);
        Assert.True(result.CcmsUnavailable);
        Assert.False(result.RequiresOverride);
    }

    [Fact]
    public async Task ValidateAdmissionAsync_Http500_CoverageBased_Blocks()
    {
        var client = CreateClient(new FixedStatusHandler(HttpStatusCode.InternalServerError));
        var result = await client.ValidateAdmissionAsync(
            Guid.NewGuid(), null, Guid.NewGuid(), coverageBased: true);

        Assert.False(result.Allowed);
        Assert.Equal("BLOCK", result.Decision);
        Assert.True(result.CcmsUnavailable);
    }

    [Fact]
    public async Task ValidateAdmissionAsync_Http500_Cash_Allows()
    {
        var client = CreateClient(new FixedStatusHandler(HttpStatusCode.InternalServerError));
        var result = await client.ValidateAdmissionAsync(
            Guid.NewGuid(), null, Guid.NewGuid(), coverageBased: false);

        Assert.True(result.Allowed);
        Assert.Equal("ALLOW", result.Decision);
        Assert.True(result.CcmsUnavailable);
    }

    [Fact]
    public async Task ValidateAdmissionAsync_HttpThrows_CoverageBased_Blocks()
    {
        var client = CreateClient(new ThrowingHandler());
        var result = await client.ValidateAdmissionAsync(
            Guid.NewGuid(), null, Guid.NewGuid(), coverageBased: true);

        Assert.False(result.Allowed);
        Assert.Equal("BLOCK", result.Decision);
        Assert.True(result.CcmsUnavailable);
    }

    private sealed class FixedStatusHandler : HttpMessageHandler
    {
        private readonly HttpStatusCode _status;
        public FixedStatusHandler(HttpStatusCode status) => _status = status;
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(new HttpResponseMessage(_status));
    }

    private sealed class ThrowingHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
            => throw new HttpRequestException("CCMS unreachable");
    }
}
