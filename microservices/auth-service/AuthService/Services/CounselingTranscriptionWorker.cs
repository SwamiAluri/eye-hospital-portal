using AuthService.Services.Interfaces;

namespace AuthService.Services;

/// <summary>
/// Moves counselling transcription independently of browser status calls.
/// Does not use the billing outbox.
/// </summary>
public sealed class CounselingTranscriptionWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<CounselingTranscriptionWorker> _logger;

    public CounselingTranscriptionWorker(
        IServiceScopeFactory scopes,
        ILogger<CounselingTranscriptionWorker> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var transcription = scope.ServiceProvider.GetRequiredService<ITranscriptionService>();
                await transcription.ReconcileAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Counselling transcription reconcile cycle failed");
            }

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }
}
