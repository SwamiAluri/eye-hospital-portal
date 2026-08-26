namespace AuthService.Services;

/// <summary>Drains billing_ccms_outbox to CCMS. Failures stay Failed/Dead for retry.</summary>
public sealed class BillingCcmsOutboxProcessor : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<BillingCcmsOutboxProcessor> _log;

    public BillingCcmsOutboxProcessor(
        IServiceScopeFactory scopes,
        ILogger<BillingCcmsOutboxProcessor> log)
    {
        _scopes = scopes;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var outbox = scope.ServiceProvider.GetRequiredService<IBillingCcmsOutboxService>();
                var n = await outbox.ProcessPendingAsync(ct: stoppingToken);
                if (n > 0)
                    _log.LogInformation("Billing CCMS outbox delivered {Count} event(s)", n);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Billing CCMS outbox processor cycle failed");
            }

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }
}
