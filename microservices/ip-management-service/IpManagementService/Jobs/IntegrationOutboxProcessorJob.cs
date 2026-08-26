using IpManagementService.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace IpManagementService.Jobs;

/// <summary>Hangfire recurring job: drain IP → CCMS integration outbox.</summary>
public sealed class IntegrationOutboxProcessorJob
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<IntegrationOutboxProcessorJob> _log;

    public IntegrationOutboxProcessorJob(
        IServiceScopeFactory scopeFactory,
        ILogger<IntegrationOutboxProcessorJob> log)
    {
        _scopeFactory = scopeFactory;
        _log = log;
    }

    public async Task ExecuteAsync()
    {
        using var scope = _scopeFactory.CreateScope();
        var outbox = scope.ServiceProvider.GetRequiredService<IIntegrationOutboxService>();
        var count = await outbox.ProcessPendingAsync();
        if (count > 0)
            _log.LogInformation("Hangfire outbox processed {Count} event(s)", count);
    }
}
