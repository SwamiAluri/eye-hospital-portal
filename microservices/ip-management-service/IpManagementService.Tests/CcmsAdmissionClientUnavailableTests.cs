using System.Net;
using IpManagementService.Models.Domain;
using IpManagementService.Services;
using IpManagementService.Services.Uat;
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

    [Fact]
    public async Task ValidateAdmissionAsync_SendsInternalKeyAndTenant()
    {
        HttpRequestMessage? captured = null;
        var client = CreateClient(new CaptureHandler(msg => captured = msg, HttpStatusCode.OK));
        var tenant = Guid.NewGuid();
        await client.ValidateAdmissionAsync(Guid.NewGuid(), null, tenant, coverageBased: true);

        Assert.NotNull(captured);
        Assert.True(captured!.Headers.TryGetValues("X-Internal-Key", out var keys));
        Assert.Equal("test-key", keys.Single());
        Assert.True(captured.Headers.TryGetValues("X-Tenant-ID", out var tenants));
        Assert.Equal(tenant.ToString(), tenants.Single());
    }

    [Fact]
    public async Task DeliverOutboxEventAsync_JourneyReadyForOt_AcksWithoutHttp()
    {
        var client = CreateClient(new ThrowingHandler());
        var ex = await Record.ExceptionAsync(() =>
            client.DeliverOutboxEventAsync(
                IntegrationEventTypes.JourneyReadyForOt,
                "{\"tenantId\":\"00000000-0000-0000-0000-000000000001\"}",
                "JourneyReadyForOt:test"));
        Assert.Null(ex);
    }

    [Fact]
    public async Task DeliverOutboxEventAsync_JourneyReadyReverted_AcksWithoutHttp()
    {
        var client = CreateClient(new ThrowingHandler());
        var ex = await Record.ExceptionAsync(() =>
            client.DeliverOutboxEventAsync(
                IntegrationEventTypes.JourneyReadyReverted, "{}", "JourneyReadyReverted:test"));
        Assert.Null(ex);
    }

    [Fact]
    public async Task DeliverOutboxEventAsync_ImplantUsed_AcksWithoutHttp()
    {
        var client = CreateClient(new ThrowingHandler());
        var ex = await Record.ExceptionAsync(() =>
            client.DeliverOutboxEventAsync(
                IntegrationEventTypes.ImplantUsed, "{\"usageStatus\":\"Implanted\"}", "ImplantUsed:test"));
        Assert.Null(ex);
    }

    [Fact]
    public async Task DeliverOutboxEventAsync_ConsumablesConsumed_AcksWithoutHttp()
    {
        var client = CreateClient(new ThrowingHandler());
        var ex = await Record.ExceptionAsync(() =>
            client.DeliverOutboxEventAsync(
                IntegrationEventTypes.ConsumablesConsumed, "{\"lines\":[]}", "ConsumablesConsumed:test"));
        Assert.Null(ex);
    }

    [Fact]
    public async Task DeliverOutboxEventAsync_ConsumablesReturned_AcksWithoutHttp()
    {
        var client = CreateClient(new ThrowingHandler());
        var ex = await Record.ExceptionAsync(() =>
            client.DeliverOutboxEventAsync(
                IntegrationEventTypes.ConsumablesReturned, "{\"lines\":[]}", "ConsumablesReturned:test"));
        Assert.Null(ex);
    }

    [Fact]
    public async Task DeliverOutboxEventAsync_JourneyScheduled_AcksWithoutHttp()
    {
        var client = CreateClient(new ThrowingHandler());
        var ex = await Record.ExceptionAsync(() =>
            client.DeliverOutboxEventAsync(
                IntegrationEventTypes.JourneyScheduled, "{\"session\":\"Morning\"}", "JourneyScheduled:test"));
        Assert.Null(ex);
    }

    [Fact]
    public async Task DeliverOutboxEventAsync_BedTransferred_AcksWithoutHttp()
    {
        var client = CreateClient(new ThrowingHandler());
        var ex = await Record.ExceptionAsync(() =>
            client.DeliverOutboxEventAsync(
                IntegrationEventTypes.BedTransferred, "{\"fromBedId\":null}", "BedTransferred:test"));
        Assert.Null(ex);
    }

    [Fact]
    public async Task DeliverOutboxEventAsync_UnknownType_ThrowsWithoutBeingAckOnly()
    {
        var client = CreateClient(new ThrowingHandler());
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            client.DeliverOutboxEventAsync("NotARealEvent", "{}", "x"));
    }

    [Fact]
    public async Task ValidateAdmissionAsync_PascalCase200_IsNotUnavailable()
    {
        var json = "{\"Allowed\":true,\"WarningLevel\":\"info\",\"WarningMessage\":\"No coverage case found. Proceeding normally.\",\"BlockReason\":null,\"CaseId\":null,\"Decision\":\"ALLOW\"}";
        var client = CreateClient(new FixedJsonHandler(HttpStatusCode.OK, json));
        var result = await client.ValidateAdmissionAsync(
            Guid.NewGuid(), null, Guid.NewGuid(), coverageBased: true);

        Assert.False(result.CcmsUnavailable);
        Assert.True(result.Allowed);
        Assert.Equal("ALLOW", result.Decision);
        Assert.Null(result.CaseId);
    }

    [Fact]
    public async Task DeliverOutboxEventAsync_ProbeKey_ThrowsWhenCcmsOutboxFailFlagOn()
    {
        UatFailureFlags.Clear();
        UatFailureFlags.Set("ccms_outbox_fail", true);
        try
        {
            var client = CreateClient(new FixedJsonHandler(HttpStatusCode.OK, "{}"));
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                client.DeliverOutboxEventAsync(
                    IntegrationEventTypes.JourneyAdmitted,
                    """{"tenantId":"155fe198-6ae5-4a01-9254-ead5b427247e"}""",
                    "w7-outbox-probe:deadbeef"));
            Assert.Contains("500", ex.Message);
        }
        finally
        {
            UatFailureFlags.Clear();
        }
    }

    [Fact]
    public async Task DeliverOutboxEventAsync_NonProbeKey_IgnoresCcmsOutboxFailFlag()
    {
        UatFailureFlags.Clear();
        UatFailureFlags.Set("ccms_outbox_fail", true);
        try
        {
            var client = CreateClient(new FixedJsonHandler(HttpStatusCode.OK, "{}"));
            var ex = await Record.ExceptionAsync(() =>
                client.DeliverOutboxEventAsync(
                    IntegrationEventTypes.JourneyAdmitted,
                    """{"tenantId":"155fe198-6ae5-4a01-9254-ead5b427247e"}""",
                    "JourneyAdmitted:not-a-probe"));
            Assert.Null(ex);
        }
        finally
        {
            UatFailureFlags.Clear();
        }
    }

    private sealed class FixedJsonHandler : HttpMessageHandler
    {
        private readonly HttpStatusCode _status;
        private readonly string _json;
        public FixedJsonHandler(HttpStatusCode status, string json)
        {
            _status = status;
            _json = json;
        }
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(new HttpResponseMessage(_status)
            {
                Content = new StringContent(_json, System.Text.Encoding.UTF8, "application/json"),
            });
    }

    private sealed class CaptureHandler : HttpMessageHandler
    {
        private readonly Action<HttpRequestMessage> _capture;
        private readonly HttpStatusCode _status;
        public CaptureHandler(Action<HttpRequestMessage> capture, HttpStatusCode status)
        {
            _capture = capture;
            _status = status;
        }
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            _capture(request);
            return Task.FromResult(new HttpResponseMessage(_status)
            {
                Content = new StringContent("{\"allowed\":true,\"warningLevel\":\"none\",\"decision\":\"ALLOW\"}"),
            });
        }
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

