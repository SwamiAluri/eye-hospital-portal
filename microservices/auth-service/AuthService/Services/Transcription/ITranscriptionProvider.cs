namespace AuthService.Services.Transcription;

public interface ITranscriptionProvider
{
    /// <summary>
    /// True only when Azure Speech and trusted private-blob access are explicitly configured.
    /// </summary>
    bool IsReady { get; }

    Task<TranscriptionJobLookup> FindJobAsync(Guid recordingId, CancellationToken cancellationToken = default);

    Task<TranscriptionProviderJob> SubmitAsync(TranscriptionSubmitRequest request, CancellationToken cancellationToken = default);

    Task<TranscriptionProviderJob> GetJobAsync(string jobId, CancellationToken cancellationToken = default);

    Task<MappedTranscript> DownloadResultAsync(string jobId, string submittedLocale, CancellationToken cancellationToken = default);
}

public sealed class TranscriptionSubmitRequest
{
    public Guid RecordingId { get; init; }
    public string PrivateContentUrl { get; init; } = "";
    public string Locale { get; init; } = "";
    public IReadOnlyList<string> CandidateLocales { get; init; } = Array.Empty<string>();
}

public sealed class TranscriptionProviderJob
{
    public string JobId { get; init; } = "";
    public string ProviderStatus { get; init; } = "";
    public string? ErrorCategory { get; init; }
    public string? ProviderDetail { get; init; }
}

public sealed class TranscriptionJobLookup
{
    public bool LookupFailed { get; init; }
    public TranscriptionProviderJob? Job { get; init; }
    public string? ErrorCategory { get; init; }
}

public sealed class MappedTranscript
{
    public string LanguageCode { get; init; } = "";
    public string? LanguageName { get; init; }
    public string Text { get; init; } = "";
    public decimal? ConfidenceScore { get; init; }
    public int WordCount { get; init; }
    public int CharacterCount { get; init; }
    public List<AuthService.Models.Counselor.TranscriptSegment> Segments { get; init; } = new();
}
