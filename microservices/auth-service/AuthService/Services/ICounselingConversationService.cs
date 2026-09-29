using AuthService.Models.Counselor;
using AuthService.Services.Interfaces;

namespace AuthService.Services;

public interface ICounselingConversationService
{
    Task<ConversationCommandResult> EnsureActiveConversationAsync(
        Guid tenantId,
        Guid sessionId,
        Guid actorUserId,
        int? expectedVersion,
        CancellationToken cancellationToken = default);

    Task<ConversationCommandResult> UploadRecordingAsync(
        Guid tenantId,
        Guid sessionId,
        Stream content,
        string? contentType,
        long contentLength,
        int? durationSeconds,
        Guid actorUserId,
        int? expectedVersion,
        CancellationToken cancellationToken = default);

    Task<RecordingContentResult> OpenRecordingAsync(
        Guid tenantId,
        Guid sessionId,
        Guid recordingId,
        Guid actorUserId,
        CancellationToken cancellationToken = default);

    Task<RecordingContentResult> DownloadRecordingsAsync(
        Guid tenantId,
        Guid sessionId,
        IReadOnlyList<Guid> recordingIds,
        Guid actorUserId,
        CancellationToken cancellationToken = default);

    Task<ConversationCommandResult> DeleteRecordingsAsync(
        Guid tenantId,
        Guid sessionId,
        IReadOnlyList<Guid> recordingIds,
        Guid actorUserId,
        CancellationToken cancellationToken = default);

    /// <summary>Read-only history. Does not create a conversation.</summary>
    Task<ConversationHistoryResult> ListConversationsAsync(
        Guid tenantId,
        Guid sessionId,
        Guid actorUserId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Same owner, tenant, and branch boundary as recording playback.
    /// </summary>
    Task<ConversationCommandResult> AuthorizeRecordingContentAsync(
        Guid tenantId,
        Guid sessionId,
        Guid actorUserId,
        CancellationToken cancellationToken = default);
}

public sealed class ConversationCommandResult
{
    public bool Success { get; init; }
    public SessionOperationFailureKind? FailureKind { get; init; }
    public string Message { get; init; } = "";
    public Guid? ConversationId { get; init; }
    public int? SequenceNumber { get; init; }
    public Guid? RecordingId { get; init; }
    public string? ContentType { get; init; }
    public string? RecordingState { get; init; }
    public int? DurationSeconds { get; init; }
    public int DeletedCount { get; init; }
    public int FailedCount { get; init; }
    public DateTime? CreatedAt { get; init; }
}

public sealed class RecordingContentResult
{
    public bool Success { get; init; }
    public SessionOperationFailureKind? FailureKind { get; init; }
    public string Message { get; init; } = "";
    public ExactBlobRead? Content { get; init; }
    public string? FileName { get; init; }
}

public sealed class ConversationHistoryResult
{
    public bool Success { get; init; }
    public SessionOperationFailureKind? FailureKind { get; init; }
    public string Message { get; init; } = "";
    public List<ConversationHistoryItem> Conversations { get; init; } = new();
}

public sealed class ConversationHistoryItem
{
    public Guid Id { get; init; }
    public int SequenceNumber { get; init; }
    public DateTime StartedAt { get; init; }
    public DateTime? EndedAt { get; init; }
    public string Status { get; init; } = "";
    public DateTime CreatedAt { get; init; }
    public int? DurationSeconds { get; init; }
    public string? CounsellorName { get; init; }
    public List<ConversationRecordingItem> Recordings { get; init; } = new();
}

public sealed class ConversationRecordingItem
{
    public Guid Id { get; init; }
    public DateTime CreatedAt { get; init; }
    public int? DurationSeconds { get; init; }
    public string? ContentType { get; init; }
    public long? FileSizeBytes { get; init; }
    public DateTime? UpdatedAt { get; init; }
    public Guid? CreatedByUserId { get; init; }
    public string RecordingState { get; init; } = "";
    public string TranscriptionStatus { get; init; } = "";
}
