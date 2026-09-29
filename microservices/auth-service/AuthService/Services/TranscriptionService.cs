using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using AuthService.Context;
using AuthService.Models.Counselor;
using AuthService.Services.Interfaces;
using AuthService.Services.Transcription;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AuthService.Services;

public class TranscriptionService : ITranscriptionService
{
    private const string SafeMessage = CounselingTranscriptionErrors.SafeClientMessage;
    private static readonly ConcurrentDictionary<Guid, SemaphoreSlim> Gates = new();
    private static readonly JsonSerializerOptions SegmentJson = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private readonly AppDbContext _context;
    private readonly ILogger<TranscriptionService> _logger;
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    private readonly ICounselingConversationService _conversations;
    private readonly ITranscriptionProvider _provider;
    private readonly string? _translatorKey;
    private readonly string? _translatorRegion;
    private readonly string? _translatorEndpoint;

    public TranscriptionService(
        AppDbContext context,
        ILogger<TranscriptionService> logger,
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory,
        ICounselingConversationService conversations,
        ITranscriptionProvider provider)
    {
        _context = context;
        _logger = logger;
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient();
        _conversations = conversations;
        _provider = provider;
        _translatorKey = configuration["AzureTranslator:Key"];
        _translatorRegion = configuration["AzureTranslator:Region"];
        _translatorEndpoint = configuration["AzureTranslator:Endpoint"];
    }

    public async Task<TranscriptionJobResponse> StartTranscriptionAsync(
        Guid tenantId,
        Guid recordingId,
        Guid actorUserId,
        CancellationToken cancellationToken = default)
    {
        var recording = await LoadRecordingAsync(tenantId, recordingId, cancellationToken);
        if (recording == null)
            return Denied(recordingId, SessionOperationFailureKind.NotFound, "Recording not found");

        var denied = await DenyUnlessOwnerAsync(tenantId, recording.SessionId, actorUserId, recordingId, cancellationToken);
        if (denied != null)
            return denied;

        if (recording.RecordingState is not (CounselingRecordingState.Uploaded or CounselingRecordingState.Completed))
        {
            return new TranscriptionJobResponse
            {
                RecordingId = recordingId,
                Status = CounselingTranscriptionStatus.NotRequested,
                FailureKind = SessionOperationFailureKind.BadRequest,
                Message = "Recording is not ready for transcription.",
            };
        }

        if (recording.TranscriptionStatus == CounselingTranscriptionStatus.Completed)
        {
            return new TranscriptionJobResponse
            {
                RecordingId = recordingId,
                Status = "AlreadyCompleted",
                Message = "Transcription already completed",
            };
        }

        if (recording.TranscriptionStatus is CounselingTranscriptionStatus.Pending or CounselingTranscriptionStatus.InProgress)
        {
            return new TranscriptionJobResponse
            {
                RecordingId = recordingId,
                Status = recording.TranscriptionStatus,
                Message = recording.TranscriptionStatus == CounselingTranscriptionStatus.Pending
                    ? "Transcription is already queued."
                    : "Transcription is already in progress.",
            };
        }

        if (recording.TranscriptionStatus != CounselingTranscriptionStatus.NotRequested
            && recording.TranscriptionStatus != CounselingTranscriptionStatus.Failed)
        {
            return new TranscriptionJobResponse
            {
                RecordingId = recordingId,
                Status = recording.TranscriptionStatus,
                FailureKind = SessionOperationFailureKind.BadRequest,
                Message = SafeMessage,
            };
        }

        var from = recording.TranscriptionStatus;
        if (!_provider.IsReady)
        {
            _logger.LogWarning(
                "Transcription was not submitted for recording {RecordingId}. Trusted Azure Speech blob access is not configured.",
                recordingId);
            await TransitionAsync(
                recordingId,
                from,
                CounselingTranscriptionStatus.Failed,
                clearJob: true,
                nextJobId: null,
                error: CounselingTranscriptionErrors.ConfigurationMissing,
                setStarted: false,
                setCompleted: false,
                cancellationToken);
            return new TranscriptionJobResponse
            {
                RecordingId = recordingId,
                Status = CounselingTranscriptionStatus.Failed,
                ErrorCategory = CounselingTranscriptionErrors.ConfigurationMissing,
                Message = SafeMessage,
            };
        }

        var moved = await TransitionAsync(
            recordingId,
            from,
            CounselingTranscriptionStatus.Pending,
            clearJob: true,
            nextJobId: null,
            error: null,
            setStarted: true,
            setCompleted: false,
            cancellationToken);
        if (!moved)
        {
            var current = await LoadRecordingAsync(tenantId, recordingId, cancellationToken);
            return new TranscriptionJobResponse
            {
                RecordingId = recordingId,
                Status = current?.TranscriptionStatus ?? from,
                Message = "Transcription is already queued.",
            };
        }

        _logger.LogInformation(
            "Transcription queued for recording {RecordingId} conversation {ConversationId}",
            recordingId, recording.ConversationId);
        return new TranscriptionJobResponse
        {
            RecordingId = recordingId,
            Status = CounselingTranscriptionStatus.Pending,
            Message = "Transcription queued.",
        };
    }

    public async Task<TranscriptionJobResponse> GetTranscriptionStatusAsync(
        Guid tenantId,
        Guid recordingId,
        Guid actorUserId,
        CancellationToken cancellationToken = default)
    {
        var recording = await LoadRecordingAsync(tenantId, recordingId, cancellationToken);
        if (recording == null)
            return Denied(recordingId, SessionOperationFailureKind.NotFound, "Recording not found");

        var denied = await DenyUnlessOwnerAsync(tenantId, recording.SessionId, actorUserId, recordingId, cancellationToken);
        if (denied != null)
            return denied;

        return new TranscriptionJobResponse
        {
            RecordingId = recordingId,
            Status = recording.TranscriptionStatus,
            ErrorCategory = recording.TranscriptionStatus == CounselingTranscriptionStatus.Failed
                ? SafeCategory(recording.TranscriptionError)
                : null,
            Message = recording.TranscriptionStatus == CounselingTranscriptionStatus.Failed ? SafeMessage : null,
        };
    }

    public async Task ReconcileAsync(CancellationToken cancellationToken = default)
    {
        var ids = await _context.SessionRecordings.AsNoTracking()
            .Where(r => r.DeletedAt == null
                && (r.TranscriptionStatus == CounselingTranscriptionStatus.Pending
                    || r.TranscriptionStatus == CounselingTranscriptionStatus.InProgress))
            .Select(r => r.Id)
            .ToListAsync(cancellationToken);

        foreach (var id in ids)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                await ReconcileOneAsync(id, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Transcription reconcile failed for recording {RecordingId}", id);
                await FailAsync(id, CounselingTranscriptionErrors.ProcessingFailed, cancellationToken);
            }
        }
    }

    public async Task<List<SessionTranscriptDto>> GetTranscriptsAsync(
        Guid tenantId,
        Guid recordingId,
        Guid actorUserId,
        CancellationToken cancellationToken = default)
    {
        var recording = await LoadRecordingAsync(tenantId, recordingId, cancellationToken);
        if (recording == null)
            throw new TranscriptionAccessException(SessionOperationFailureKind.NotFound, "Recording not found");

        var denied = await DenyUnlessOwnerAsync(tenantId, recording.SessionId, actorUserId, recordingId, cancellationToken);
        if (denied != null)
            throw new TranscriptionAccessException(denied.FailureKind ?? SessionOperationFailureKind.Forbidden, denied.Message ?? SafeMessage);

        var transcripts = await _context.SessionTranscripts
            .Where(t => t.RecordingId == recordingId && t.TenantId == tenantId && t.DeletedAt == null)
            .OrderBy(t => t.IsOriginalLanguage ? 0 : 1)
            .ThenBy(t => t.LanguageCode)
            .ToListAsync(cancellationToken);

        return transcripts.Select(MapTranscript).ToList();
    }

    private async Task ReconcileOneAsync(Guid recordingId, CancellationToken cancellationToken)
    {
        _context.ChangeTracker.Clear();
        var recording = await _context.SessionRecordings.FirstOrDefaultAsync(r => r.Id == recordingId, cancellationToken);
        if (recording == null || recording.DeletedAt != null)
            return;
        if (recording.RecordingState is not (CounselingRecordingState.Uploaded or CounselingRecordingState.Completed))
        {
            await FailAsync(recordingId, CounselingTranscriptionErrors.InvalidRecording, cancellationToken);
            return;
        }

        if (recording.TranscriptionStatus == CounselingTranscriptionStatus.Pending)
        {
            if (!_provider.IsReady)
            {
                await FailAsync(recordingId, CounselingTranscriptionErrors.ConfigurationMissing, cancellationToken);
                return;
            }

            var claimed = await TransitionAsync(
                recordingId,
                CounselingTranscriptionStatus.Pending,
                CounselingTranscriptionStatus.InProgress,
                clearJob: false,
                nextJobId: TranscriptionReservation.For(recordingId),
                error: null,
                setStarted: false,
                setCompleted: false,
                cancellationToken);
            if (!claimed)
                return;
            recording = await ReloadAsync(recordingId, cancellationToken);
            if (recording == null)
                return;
        }

        if (recording.TranscriptionStatus != CounselingTranscriptionStatus.InProgress)
            return;

        if (TranscriptionReservation.IsReservation(recording.AzureJobId) || string.IsNullOrWhiteSpace(recording.AzureJobId))
        {
            var lookup = await _provider.FindJobAsync(recording.Id, cancellationToken);
            if (lookup.LookupFailed)
            {
                _logger.LogWarning(
                    "Transcription job lookup failed for recording {RecordingId} category {Category}",
                    recording.Id, lookup.ErrorCategory);
                return;
            }

            if (lookup.Job == null)
            {
                if (!CounselingAudioBlobReference.TryCreatePrivateContentUrl(
                        _configuration["AzureSpeech:StorageAccountName"],
                        recording.FileUrl,
                        out var privateUrl))
                {
                    await FailAsync(recordingId, CounselingTranscriptionErrors.ConfigurationMissing, cancellationToken);
                    return;
                }

                var locales = ConfiguredLocales();
                var submitted = await _provider.SubmitAsync(new TranscriptionSubmitRequest
                {
                    RecordingId = recording.Id,
                    PrivateContentUrl = privateUrl,
                    Locale = locales[0],
                    CandidateLocales = locales,
                }, cancellationToken);

                if (string.IsNullOrWhiteSpace(submitted.JobId) || string.Equals(submitted.ProviderStatus, "Failed", StringComparison.OrdinalIgnoreCase))
                {
                    await FailAsync(recordingId, submitted.ErrorCategory ?? CounselingTranscriptionErrors.ProviderRejected, cancellationToken);
                    return;
                }

                await SaveJobAsync(recordingId, submitted, cancellationToken);
                if (string.Equals(submitted.ProviderStatus, "Succeeded", StringComparison.OrdinalIgnoreCase))
                    await CompleteAsync(recording, submitted.JobId, locales[0], cancellationToken);
                return;
            }

            await SaveJobAsync(recordingId, lookup.Job, cancellationToken);
            recording.AzureJobId = lookup.Job.JobId;
            if (!IsTerminalSuccess(lookup.Job.ProviderStatus) && !IsTerminalFailure(lookup.Job.ProviderStatus))
                return;
            if (IsTerminalFailure(lookup.Job.ProviderStatus))
            {
                await FailAsync(recordingId, lookup.Job.ErrorCategory ?? CounselingTranscriptionErrors.ProviderRejected, cancellationToken);
                return;
            }
        }

        if (string.IsNullOrWhiteSpace(recording.AzureJobId) || TranscriptionReservation.IsReservation(recording.AzureJobId))
            return;

        var job = await _provider.GetJobAsync(recording.AzureJobId, cancellationToken);
        _logger.LogInformation(
            "Transcription job {JobId} for recording {RecordingId} conversation {ConversationId} is {ProviderStatus}",
            job.JobId, recording.Id, recording.ConversationId, job.ProviderStatus);

        if (IsTerminalFailure(job.ProviderStatus))
        {
            await FailAsync(recordingId, job.ErrorCategory ?? CounselingTranscriptionErrors.ProviderRejected, cancellationToken);
            return;
        }

        if (IsTerminalSuccess(job.ProviderStatus))
            await CompleteAsync(recording, job.JobId, ConfiguredLocales()[0], cancellationToken);
    }

    private async Task CompleteAsync(SessionRecording recording, string jobId, string submittedLocale, CancellationToken cancellationToken)
    {
        var gate = Gates.GetOrAdd(recording.Id, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);
        try
        {
            _context.ChangeTracker.Clear();
            var current = await _context.SessionRecordings.FirstOrDefaultAsync(r => r.Id == recording.Id, cancellationToken);
            if (current == null || current.DeletedAt != null)
                return;
            if (current.TranscriptionStatus == CounselingTranscriptionStatus.Completed)
                return;

            var mapped = await _provider.DownloadResultAsync(jobId, submittedLocale, cancellationToken);
            var language = string.IsNullOrWhiteSpace(mapped.LanguageCode) ? submittedLocale : mapped.LanguageCode;
            if (language.Length > 10)
            {
                await FailTrackedAsync(current, CounselingTranscriptionErrors.ProcessingFailed, cancellationToken);
                return;
            }

            var exists = await _context.SessionTranscripts.AnyAsync(
                t => t.RecordingId == current.Id && t.LanguageCode == language && t.DeletedAt == null,
                cancellationToken);
            if (!exists)
            {
                _context.SessionTranscripts.Add(new SessionTranscript
                {
                    Id = Guid.NewGuid(),
                    TenantId = current.TenantId,
                    RecordingId = current.Id,
                    SessionId = current.SessionId,
                    LanguageCode = language,
                    LanguageName = mapped.LanguageName ?? BatchTranscriptMapper.LanguageName(language),
                    IsOriginalLanguage = true,
                    TranscriptText = mapped.Text ?? "",
                    ConfidenceScore = mapped.ConfidenceScore,
                    WordCount = mapped.WordCount,
                    CharacterCount = mapped.CharacterCount,
                    Segments = JsonSerializer.Serialize(mapped.Segments, SegmentJson),
                    Status = "active",
                    CreatedAt = DateTime.UtcNow,
                });
            }

            var completedAt = DateTime.UtcNow;
            current.TranscriptionStatus = CounselingTranscriptionStatus.Completed;
            current.TranscriptionCompletedAt = completedAt;
            current.TranscriptionError = null;
            current.AzureJobId = jobId;
            current.UpdatedAt = completedAt;
            if (current.TranscriptionStartedAt.HasValue)
            {
                var elapsed = (completedAt - current.TranscriptionStartedAt.Value).TotalMilliseconds;
                current.ProcessingDurationMs = elapsed < 0 ? 0 : (int)Math.Min(int.MaxValue, elapsed);
            }

            await _context.SaveChangesAsync(cancellationToken);
            _logger.LogInformation(
                "Transcription completed for recording {RecordingId} conversation {ConversationId} job {JobId} in {DurationMs} ms locale {Locale}",
                current.Id, current.ConversationId, jobId, current.ProcessingDurationMs, language);
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task<bool> TransitionAsync(
        Guid recordingId,
        string fromStatus,
        string toStatus,
        bool clearJob,
        string? nextJobId,
        string? error,
        bool setStarted,
        bool setCompleted,
        CancellationToken cancellationToken)
    {
        var gate = Gates.GetOrAdd(recordingId, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);
        try
        {
            var now = DateTime.UtcNow;
            if (_context.Database.IsRelational())
            {
                var query = _context.SessionRecordings.Where(r =>
                    r.Id == recordingId && r.DeletedAt == null && r.TranscriptionStatus == fromStatus);
                var rows = setStarted
                    ? await query.ExecuteUpdateAsync(setters => setters
                        .SetProperty(r => r.TranscriptionStatus, toStatus)
                        .SetProperty(r => r.TranscriptionError, error)
                        .SetProperty(r => r.AzureJobId, nextJobId)
                        .SetProperty(r => r.UpdatedAt, now)
                        .SetProperty(r => r.TranscriptionStartedAt, now), cancellationToken)
                    : await query.ExecuteUpdateAsync(setters => setters
                        .SetProperty(r => r.TranscriptionStatus, toStatus)
                        .SetProperty(r => r.TranscriptionError, error)
                        .SetProperty(r => r.AzureJobId, nextJobId)
                        .SetProperty(r => r.UpdatedAt, now), cancellationToken);
                return rows == 1;
            }

            _context.ChangeTracker.Clear();
            var recording = await _context.SessionRecordings.FirstOrDefaultAsync(r => r.Id == recordingId, cancellationToken);
            if (recording == null || recording.DeletedAt != null || recording.TranscriptionStatus != fromStatus)
                return false;
            recording.TranscriptionStatus = toStatus;
            recording.TranscriptionError = error;
            if (clearJob)
                recording.AzureJobId = null;
            else if (nextJobId != null)
                recording.AzureJobId = nextJobId;
            recording.UpdatedAt = now;
            if (setStarted)
                recording.TranscriptionStartedAt = now;
            if (setCompleted)
                recording.TranscriptionCompletedAt = now;
            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task FailAsync(Guid recordingId, string category, CancellationToken cancellationToken)
    {
        var gate = Gates.GetOrAdd(recordingId, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);
        try
        {
            _context.ChangeTracker.Clear();
            var recording = await _context.SessionRecordings.FirstOrDefaultAsync(r => r.Id == recordingId, cancellationToken);
            if (recording == null || recording.DeletedAt != null)
                return;
            if (recording.TranscriptionStatus is CounselingTranscriptionStatus.Completed)
                return;
            await FailTrackedAsync(recording, category, cancellationToken);
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task FailTrackedAsync(SessionRecording recording, string category, CancellationToken cancellationToken)
    {
        var safe = SafeCategory(category) ?? CounselingTranscriptionErrors.ProcessingFailed;
        recording.TranscriptionStatus = CounselingTranscriptionStatus.Failed;
        recording.TranscriptionError = safe;
        recording.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        _logger.LogWarning(
            "Transcription failed for recording {RecordingId} conversation {ConversationId} category {Category}",
            recording.Id, recording.ConversationId, safe);
    }

    private async Task SaveJobAsync(Guid recordingId, TranscriptionProviderJob job, CancellationToken cancellationToken)
    {
        var gate = Gates.GetOrAdd(recordingId, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);
        try
        {
            _context.ChangeTracker.Clear();
            var recording = await _context.SessionRecordings.FirstOrDefaultAsync(r => r.Id == recordingId, cancellationToken);
            if (recording == null || recording.DeletedAt != null)
                return;
            if (!string.IsNullOrWhiteSpace(recording.AzureJobId)
                && !TranscriptionReservation.IsReservation(recording.AzureJobId)
                && recording.AzureJobId != job.JobId)
                return;
            recording.AzureJobId = job.JobId;
            recording.TranscriptionStatus = CounselingTranscriptionStatus.InProgress;
            recording.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);
            _logger.LogInformation(
                "Transcription job {JobId} stored for recording {RecordingId} conversation {ConversationId}",
                job.JobId, recording.Id, recording.ConversationId);
        }
        finally
        {
            gate.Release();
        }
    }

    private string[] ConfiguredLocales()
    {
        var configured = _configuration.GetSection("AzureSpeech:SupportedLanguages").Get<string[]>()
            ?.Where(code => !string.IsNullOrWhiteSpace(code))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        return configured is { Length: > 0 } ? configured : new[] { "en-US", "hi-IN", "te-IN" };
    }

    private async Task<SessionRecording?> LoadRecordingAsync(Guid tenantId, Guid recordingId, CancellationToken cancellationToken) =>
        await _context.SessionRecordings.AsNoTracking().FirstOrDefaultAsync(
            r => r.Id == recordingId && r.TenantId == tenantId && r.DeletedAt == null,
            cancellationToken);

    private async Task<SessionRecording?> ReloadAsync(Guid recordingId, CancellationToken cancellationToken)
    {
        _context.ChangeTracker.Clear();
        return await _context.SessionRecordings.FirstOrDefaultAsync(r => r.Id == recordingId, cancellationToken);
    }

    private async Task<TranscriptionJobResponse?> DenyUnlessOwnerAsync(
        Guid tenantId,
        Guid sessionId,
        Guid actorUserId,
        Guid recordingId,
        CancellationToken cancellationToken)
    {
        var auth = await _conversations.AuthorizeRecordingContentAsync(tenantId, sessionId, actorUserId, cancellationToken);
        if (auth.Success)
            return null;
        return Denied(recordingId, auth.FailureKind ?? SessionOperationFailureKind.Forbidden, auth.Message);
    }

    private static TranscriptionJobResponse Denied(Guid recordingId, SessionOperationFailureKind kind, string? message) =>
        new()
        {
            RecordingId = recordingId,
            Status = "Denied",
            FailureKind = kind,
            Message = string.IsNullOrWhiteSpace(message) ? SafeMessage : message,
        };

    private static bool IsTerminalSuccess(string? status) =>
        string.Equals(status, "Succeeded", StringComparison.OrdinalIgnoreCase);

    private static bool IsTerminalFailure(string? status) =>
        string.Equals(status, "Failed", StringComparison.OrdinalIgnoreCase);

    private static string? SafeCategory(string? value) => value switch
    {
        CounselingTranscriptionErrors.ProviderUnavailable => value,
        CounselingTranscriptionErrors.ProviderRejected => value,
        CounselingTranscriptionErrors.StorageAccessDenied => value,
        CounselingTranscriptionErrors.InvalidRecording => value,
        CounselingTranscriptionErrors.AuthorizationFailed => value,
        CounselingTranscriptionErrors.ConfigurationMissing => value,
        CounselingTranscriptionErrors.ProcessingFailed => value,
        _ => null,
    };

    private static SessionTranscriptDto MapTranscript(SessionTranscript transcript) => new()
    {
        Id = transcript.Id,
        RecordingId = transcript.RecordingId,
        LanguageCode = transcript.LanguageCode,
        LanguageName = transcript.LanguageName,
        IsOriginalLanguage = transcript.IsOriginalLanguage,
        TranscriptText = transcript.TranscriptText,
        ConfidenceScore = transcript.ConfidenceScore,
        WordCount = transcript.WordCount,
        Segments = string.IsNullOrEmpty(transcript.Segments)
            ? new List<TranscriptSegment>()
            : JsonSerializer.Deserialize<List<TranscriptSegment>>(transcript.Segments) ?? new List<TranscriptSegment>(),
        CreatedAt = transcript.CreatedAt,
    };

    public async Task<TranslationJobResponse> StartTranslationAsync(
        Guid tenantId,
        Guid recordingId,
        Guid sourceTranscriptId,
        List<string> targetLanguages,
        Guid actorUserId,
        CancellationToken cancellationToken = default)
    {
        var sourceTranscript = await _context.SessionTranscripts
            .FirstOrDefaultAsync(t => t.Id == sourceTranscriptId && t.TenantId == tenantId && t.DeletedAt == null, cancellationToken);
        if (sourceTranscript == null)
            throw new TranscriptionAccessException(SessionOperationFailureKind.NotFound, "Source transcript not found");

        var denied = await DenyUnlessOwnerAsync(tenantId, sourceTranscript.SessionId, actorUserId, recordingId, cancellationToken);
        if (denied != null)
            throw new TranscriptionAccessException(denied.FailureKind ?? SessionOperationFailureKind.Forbidden, denied.Message ?? SafeMessage);

        if (string.IsNullOrEmpty(_translatorKey) || string.IsNullOrEmpty(_translatorEndpoint))
        {
            return new TranslationJobResponse
            {
                RecordingId = recordingId,
                TargetLanguages = targetLanguages,
                Status = "NotConfigured",
                Message = "Azure Translator Service is not configured",
            };
        }

        foreach (var targetLang in targetLanguages)
        {
            var translatedText = await TranslateTextAsync(sourceTranscript.TranscriptText, sourceTranscript.LanguageCode, targetLang);
            _context.SessionTranscripts.Add(new SessionTranscript
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                RecordingId = recordingId,
                SessionId = sourceTranscript.SessionId,
                LanguageCode = targetLang,
                LanguageName = BatchTranscriptMapper.LanguageName(targetLang) ?? targetLang,
                IsOriginalLanguage = false,
                TranscriptText = translatedText,
                WordCount = translatedText.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length,
                CharacterCount = translatedText.Length,
                CreatedAt = DateTime.UtcNow,
            });
        }

        var recording = await _context.SessionRecordings.FirstOrDefaultAsync(r => r.Id == recordingId && r.TenantId == tenantId, cancellationToken);
        if (recording != null)
        {
            recording.TranslationStatus = "Completed";
            recording.TranslationCompletedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);
        return new TranslationJobResponse
        {
            RecordingId = recordingId,
            TargetLanguages = targetLanguages,
            Status = "Completed",
            Message = $"Translated to {targetLanguages.Count} language(s)",
        };
    }

    private async Task<string> TranslateTextAsync(string text, string fromLang, string toLang)
    {
        var endpoint = $"{_translatorEndpoint}/translate?api-version=3.0&from={fromLang}&to={toLang}";
        var requestBody = new[] { new { Text = text } };
        var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json"),
        };
        request.Headers.Add("Ocp-Apim-Subscription-Key", _translatorKey);
        request.Headers.Add("Ocp-Apim-Subscription-Region", _translatorRegion);
        var response = await _httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();
        var responseContent = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<JsonElement>(responseContent);
        return result[0].GetProperty("translations")[0].GetProperty("text").GetString() ?? text;
    }

    public async Task<TranscriptEditDto> EditTranscriptSegmentAsync(
        Guid tenantId,
        EditTranscriptRequest request,
        Guid currentUserId,
        CancellationToken cancellationToken = default)
    {
        var transcript = await _context.SessionTranscripts
            .FirstOrDefaultAsync(t => t.Id == request.TranscriptId && t.TenantId == tenantId && t.DeletedAt == null, cancellationToken);
        if (transcript == null)
            throw new TranscriptionAccessException(SessionOperationFailureKind.NotFound, "Transcript not found");

        var denied = await DenyUnlessOwnerAsync(tenantId, transcript.SessionId, currentUserId, transcript.RecordingId, cancellationToken);
        if (denied != null)
            throw new TranscriptionAccessException(denied.FailureKind ?? SessionOperationFailureKind.Forbidden, denied.Message ?? SafeMessage);

        var segments = string.IsNullOrEmpty(transcript.Segments)
            ? new List<TranscriptSegment>()
            : JsonSerializer.Deserialize<List<TranscriptSegment>>(transcript.Segments) ?? new List<TranscriptSegment>();
        if (request.SegmentIndex < 0 || request.SegmentIndex >= segments.Count)
            throw new TranscriptionAccessException(SessionOperationFailureKind.BadRequest, "Invalid segment index");

        var originalText = segments[request.SegmentIndex].Text;
        segments[request.SegmentIndex].Text = request.EditedText;
        transcript.Segments = JsonSerializer.Serialize(segments, SegmentJson);
        transcript.TranscriptText = string.Join(" ", segments.Select(s => s.Text));
        transcript.UpdatedAt = DateTime.UtcNow;

        var edit = new TranscriptEdit
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            TranscriptId = request.TranscriptId,
            SegmentIndex = request.SegmentIndex,
            OriginalText = originalText,
            EditedText = request.EditedText,
            EditReason = request.EditReason,
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = currentUserId,
        };
        _context.TranscriptEdits.Add(edit);
        await _context.SaveChangesAsync(cancellationToken);
        var user = await _context.Users.FindAsync(new object[] { currentUserId }, cancellationToken);
        return new TranscriptEditDto
        {
            Id = edit.Id,
            TranscriptId = edit.TranscriptId,
            SegmentIndex = edit.SegmentIndex,
            OriginalText = edit.OriginalText,
            EditedText = edit.EditedText,
            EditReason = edit.EditReason,
            CreatedAt = edit.CreatedAt,
            CreatedByUserName = user?.FirstName + " " + user?.LastName ?? "Unknown",
        };
    }

    public async Task<List<TranscriptEditDto>> GetTranscriptEditsAsync(
        Guid tenantId,
        Guid transcriptId,
        Guid actorUserId,
        CancellationToken cancellationToken = default)
    {
        var transcript = await _context.SessionTranscripts.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == transcriptId && t.TenantId == tenantId && t.DeletedAt == null, cancellationToken);
        if (transcript == null)
            throw new TranscriptionAccessException(SessionOperationFailureKind.NotFound, "Transcript not found");

        var denied = await DenyUnlessOwnerAsync(tenantId, transcript.SessionId, actorUserId, transcript.RecordingId, cancellationToken);
        if (denied != null)
            throw new TranscriptionAccessException(denied.FailureKind ?? SessionOperationFailureKind.Forbidden, denied.Message ?? SafeMessage);

        var edits = await _context.TranscriptEdits
            .Where(e => e.TranscriptId == transcriptId && e.TenantId == tenantId)
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync(cancellationToken);
        var userIds = edits.Select(e => e.CreatedByUserId).Distinct().ToList();
        var users = await _context.Users
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FirstName + " " + u.LastName, cancellationToken);
        return edits.Select(e => new TranscriptEditDto
        {
            Id = e.Id,
            TranscriptId = e.TranscriptId,
            SegmentIndex = e.SegmentIndex,
            OriginalText = e.OriginalText,
            EditedText = e.EditedText,
            EditReason = e.EditReason,
            CreatedAt = e.CreatedAt,
            CreatedByUserName = users.TryGetValue(e.CreatedByUserId, out var name) ? name : "Unknown",
        }).ToList();
    }
}

public sealed class TranscriptionAccessException : Exception
{
    public TranscriptionAccessException(SessionOperationFailureKind kind, string message)
        : base(message)
    {
        Kind = kind;
    }

    public SessionOperationFailureKind Kind { get; }
}

internal static class TranscriptionReservation
{
    public static string For(Guid recordingId) => "local-submit:" + recordingId.ToString("N");

    public static bool IsReservation(string? jobId) =>
        jobId != null && jobId.StartsWith("local-submit:", StringComparison.Ordinal);
}
