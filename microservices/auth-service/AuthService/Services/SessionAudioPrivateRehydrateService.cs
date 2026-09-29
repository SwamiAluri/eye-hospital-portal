using AuthService.Context;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

/// <summary>
/// Copies one configured recording from development storage into the private Azure container.
/// Does nothing unless AzureSpeech:RehydrateRecordingId is set. Does not delete the source object.
/// </summary>
public sealed class SessionAudioPrivateRehydrateService : IHostedService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly IConfiguration _configuration;
    private readonly ILogger<SessionAudioPrivateRehydrateService> _logger;

    public SessionAudioPrivateRehydrateService(
        IServiceScopeFactory scopes,
        IConfiguration configuration,
        ILogger<SessionAudioPrivateRehydrateService> logger)
    {
        _scopes = scopes;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(_configuration["AzureSpeech:RehydrateRecordingId"], out var recordingId))
            return;

        try
        {
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var storage = scope.ServiceProvider.GetRequiredService<BlobStorageService>();
            var recording = await db.SessionRecordings.AsNoTracking()
                .FirstOrDefaultAsync(row => row.Id == recordingId && row.DeletedAt == null, cancellationToken);
            if (recording == null || string.IsNullOrWhiteSpace(recording.FileUrl))
            {
                _logger.LogWarning("Session audio rehydrate skipped. Recording {RecordingId} was not found.", recordingId);
                return;
            }

            if (recording.FileUrl.Contains('?', StringComparison.Ordinal)
                || recording.FileUrl.Contains("://", StringComparison.Ordinal))
            {
                _logger.LogWarning("Session audio rehydrate skipped. Recording {RecordingId} key is not a private object key.", recordingId);
                return;
            }

            var result = await storage.CopyDevelopmentSessionAudioToPrivateStoreAsync(recording.FileUrl, cancellationToken);
            _logger.LogInformation(
                "Session audio rehydrate for recording {RecordingId} result {Result}",
                recordingId, result);
        }
        catch (Azure.RequestFailedException ex)
        {
            _logger.LogWarning(
                "Session audio rehydrate failed for recording {RecordingId} status {Status} code {ErrorCode}",
                recordingId, ex.Status, ex.ErrorCode);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Session audio rehydrate failed for recording {RecordingId}", recordingId);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
