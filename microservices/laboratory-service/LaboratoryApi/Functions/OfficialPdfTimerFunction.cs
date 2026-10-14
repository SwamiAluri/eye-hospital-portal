using LaboratoryApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace LaboratoryApi.Functions;

/// <summary>
/// L-REP-03 CUT B — Azure Timer drain for Official PDF jobs (PD-PDF-10). No Service Bus.
/// </summary>
public class OfficialPdfTimerFunction
{
    private readonly IOfficialPdfService _pdf;
    private readonly ILogger<OfficialPdfTimerFunction> _log;

    public OfficialPdfTimerFunction(IOfficialPdfService pdf, ILogger<OfficialPdfTimerFunction> log)
    {
        _pdf = pdf;
        _log = log;
    }

    /// <summary>Every 15s — process Pending Official PDF jobs (technical schedule, not a product decision).</summary>
    [Function("LmsOfficialPdfJobDrain")]
    public async Task Run(
        [TimerTrigger("*/15 * * * * *", UseMonitor = false)] TimerInfo timer,
        CancellationToken ct)
    {
        var processed = await _pdf.ProcessPendingJobsAsync(batchSize: 10, ct);
        if (processed > 0)
            _log.LogInformation("Official PDF drain processed {Count} job(s)", processed);
    }
}
