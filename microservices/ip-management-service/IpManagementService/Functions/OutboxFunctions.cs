using System.Net;
using IpManagementService.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace IpManagementService.Functions;

/// <summary>
/// Processes the integration outbox for reliable IP → CCMS lifecycle delivery (Phase 2).
/// </summary>
public class OutboxFunctions
{
    private readonly IIntegrationOutboxService _outbox;
    private readonly ILogger<OutboxFunctions> _log;

    public OutboxFunctions(IIntegrationOutboxService outbox, ILogger<OutboxFunctions> log)
    {
        _outbox = outbox;
        _log = log;
    }

    /// <summary>Timer every 30s — deliver pending/failed outbox events.</summary>
    [Function("ProcessIntegrationOutbox")]
    public async Task ProcessIntegrationOutbox(
        [TimerTrigger("*/30 * * * * *")] TimerInfo timer)
    {
        var count = await _outbox.ProcessPendingAsync();
        if (count > 0)
            _log.LogInformation("Integration outbox processed {Count} event(s)", count);
    }

    /// <summary>Manual/ops endpoint to drain the outbox (authorized via function key).</summary>
    [Function("ProcessIntegrationOutboxNow")]
    public async Task<HttpResponseData> ProcessIntegrationOutboxNow(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/integration/outbox/process")] HttpRequestData req)
    {
        var count = await _outbox.ProcessPendingAsync(batchSize: 100);
        var resp = req.CreateResponse(HttpStatusCode.OK);
        await resp.WriteAsJsonAsync(new { processed = count });
        return resp;
    }
}
