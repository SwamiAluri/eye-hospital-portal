using System.Collections.Concurrent;
using System.IO.Compression;
using AuthService.Context;
using AuthService.Models.Counselor;
using AuthService.Models.Domain;
using AuthService.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

/// <summary>
/// Child conversation and recording under an existing counseling session.
/// Does not change Start, Finish, ReQueue, Repeat, or Re-evaluate.
/// </summary>
public class CounselingConversationService : ICounselingConversationService
{
    public const long MaxAudioBytes = 100L * 1024 * 1024;
    private const int MaxDurationSeconds = 4 * 60 * 60;

    private static readonly ConcurrentDictionary<Guid, SemaphoreSlim> SessionGates = new();

    private readonly AppDbContext _context;
    private readonly IBlobStorageService _blobStorage;
    private readonly IFollowupBranchAccessService _branchAccess;
    private readonly ILogger<CounselingConversationService> _logger;

    public CounselingConversationService(
        AppDbContext context,
        IBlobStorageService blobStorage,
        IFollowupBranchAccessService branchAccess,
        ILogger<CounselingConversationService> logger)
    {
        _context = context;
        _blobStorage = blobStorage;
        _branchAccess = branchAccess;
        _logger = logger;
    }

    public Task<ConversationCommandResult> EnsureActiveConversationAsync(
        Guid tenantId,
        Guid sessionId,
        Guid actorUserId,
        int? expectedVersion,
        CancellationToken cancellationToken = default) =>
        WithSessionGate(sessionId, () => EnsureCoreAsync(
            tenantId, sessionId, actorUserId, expectedVersion, cancellationToken));

    public async Task<ConversationCommandResult> UploadRecordingAsync(
        Guid tenantId,
        Guid sessionId,
        Stream content,
        string? contentType,
        long contentLength,
        int? durationSeconds,
        Guid actorUserId,
        int? expectedVersion,
        CancellationToken cancellationToken = default)
    {
        if (contentLength <= 0)
            return Fail(SessionOperationFailureKind.BadRequest, "No audio file provided.");
        if (contentLength > MaxAudioBytes)
            return Fail(SessionOperationFailureKind.BadRequest, "File size exceeds maximum allowed size of 100MB.");
        if (durationSeconds is < 0 or > MaxDurationSeconds)
            return Fail(SessionOperationFailureKind.BadRequest, "Recording duration is not valid.");

        if (!SessionAudioContentTypes.TryNormalize(contentType, out var normalizedType, out var extension))
            return Fail(SessionOperationFailureKind.BadRequest, "Audio format is not supported.");

        return await WithSessionGate(sessionId, async () =>
        {
            var ensured = await EnsureCoreAsync(
                tenantId, sessionId, actorUserId, expectedVersion, cancellationToken);
            if (!ensured.Success || ensured.ConversationId is null)
                return ensured;

            var recordingId = Guid.NewGuid();
            var objectKey = SessionAudioObjectKey.Build(
                tenantId, sessionId, ensured.ConversationId.Value, recordingId, extension);
            var now = DateTime.UtcNow;
            var recording = new SessionRecording
            {
                Id = recordingId,
                TenantId = tenantId,
                SessionId = sessionId,
                ConversationId = ensured.ConversationId.Value,
                RecordingType = "Audio",
                RecordingState = CounselingRecordingState.Created,
                FileUrl = objectKey,
                FileName = "recording" + extension,
                FileSizeBytes = contentLength,
                DurationSeconds = durationSeconds,
                MimeType = normalizedType,
                TranscriptionStatus = "NotRequested",
                TranslationStatus = "NotRequested",
                Status = "active",
                CreatedAt = now,
                CreatedByUserId = actorUserId,
                UpdatedAt = now,
                UpdatedByUserId = actorUserId,
            };
            _context.SessionRecordings.Add(recording);
            await _context.SaveChangesAsync(cancellationToken);

            try
            {
                await _blobStorage.UploadExactKeyAsync(
                    SessionAudioObjectKey.ContainerName,
                    objectKey,
                    content,
                    normalizedType,
                    cancellationToken);
            }
            catch (BlobObjectKeyConflictException)
            {
                recording.RecordingState = CounselingRecordingState.Failed;
                recording.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(cancellationToken);
                _logger.LogWarning(
                    "Recording upload conflict for session {SessionId} recording {RecordingId}",
                    sessionId, recordingId);
                return Fail(SessionOperationFailureKind.BadRequest, "Recording could not be saved.");
            }
            catch (Exception ex)
            {
                recording.RecordingState = CounselingRecordingState.Failed;
                recording.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(cancellationToken);
                LogStorageFailure("upload", ex, sessionId, recordingId);
                return Fail(SessionOperationFailureKind.BadRequest, "Recording could not be saved.");
            }

            var document = new CounselingSessionDocument
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                SessionId = sessionId,
                DocumentType = "AudioRecording",
                DocumentName = recording.FileName,
                DocumentDescription = "Counselling conversation recording",
                FilePath = objectKey,
                FileType = extension.TrimStart('.').ToUpperInvariant(),
                FileSizeBytes = contentLength,
                IsVerified = false,
                Status = "active",
                CreatedAt = DateTime.UtcNow,
                CreatedByUserId = actorUserId,
                UpdatedAt = DateTime.UtcNow,
                UpdatedByUserId = actorUserId,
            };
            _context.CounselingSessionDocuments.Add(document);
            recording.DocumentId = document.Id;
            recording.RecordingState = CounselingRecordingState.Uploaded;
            recording.UpdatedAt = DateTime.UtcNow;
            try
            {
                await _context.SaveChangesAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Recording metadata save failed after storage for session {SessionId} recording {RecordingId}. Blob retained.",
                    sessionId,
                    recordingId);
                return Fail(SessionOperationFailureKind.BadRequest, "Recording could not be saved.");
            }

            _logger.LogInformation(
                "Uploaded counselling recording {RecordingId} for conversation {ConversationId} session {SessionId}",
                recordingId, ensured.ConversationId, sessionId);

            return new ConversationCommandResult
            {
                Success = true,
                Message = "Recording saved.",
                ConversationId = ensured.ConversationId,
                SequenceNumber = ensured.SequenceNumber,
                RecordingId = recordingId,
                ContentType = normalizedType,
                RecordingState = CounselingRecordingState.Uploaded,
                DurationSeconds = durationSeconds,
                CreatedAt = recording.CreatedAt,
            };
        });
    }

    public async Task<RecordingContentResult> OpenRecordingAsync(
        Guid tenantId,
        Guid sessionId,
        Guid recordingId,
        Guid actorUserId,
        CancellationToken cancellationToken = default)
    {
        var auth = await AuthorizeAsync(tenantId, sessionId, actorUserId, expectedVersion: null, requireInProgress: false, cancellationToken: cancellationToken);
        if (auth.Failure != null)
        {
            _logger.LogWarning(
                "Playback authorization failed for recording {RecordingId} session {SessionId}",
                recordingId, sessionId);
            return new RecordingContentResult
            {
                Success = false,
                FailureKind = auth.Failure.FailureKind,
                Message = auth.Failure.Message,
            };
        }

        var recording = await _context.SessionRecordings
            .AsNoTracking()
            .FirstOrDefaultAsync(r =>
                r.Id == recordingId
                && r.SessionId == sessionId
                && r.TenantId == tenantId
                && r.DeletedAt == null, cancellationToken);

        if (recording == null
            || recording.ConversationId == null
            || recording.RecordingState != CounselingRecordingState.Uploaded
            || string.IsNullOrWhiteSpace(recording.FileUrl))
        {
            return new RecordingContentResult
            {
                Success = false,
                FailureKind = SessionOperationFailureKind.NotFound,
                Message = "Recording not found",
            };
        }

        var conversationOk = await _context.CounselingConversations.AsNoTracking().AnyAsync(c =>
            c.Id == recording.ConversationId
            && c.SessionId == sessionId
            && c.TenantId == tenantId
            && c.DeletedAt == null, cancellationToken);
        if (!conversationOk)
        {
            return new RecordingContentResult
            {
                Success = false,
                FailureKind = SessionOperationFailureKind.NotFound,
                Message = "Recording not found",
            };
        }

        ExactBlobRead? blob;
        try
        {
            SessionAudioObjectKey.Validate(recording.FileUrl);
            blob = await _blobStorage.OpenReadExactAsync(
                SessionAudioObjectKey.ContainerName,
                recording.FileUrl,
                cancellationToken);
        }
        catch (Exception ex)
        {
            LogStorageFailure("playback", ex, sessionId, recordingId);
            return new RecordingContentResult
            {
                Success = false,
                FailureKind = SessionOperationFailureKind.BadRequest,
                Message = "Recording could not be opened.",
            };
        }

        if (blob == null)
        {
            return new RecordingContentResult
            {
                Success = false,
                FailureKind = SessionOperationFailureKind.NotFound,
                Message = "Recording not found",
            };
        }

        return new RecordingContentResult { Success = true, Content = blob, Message = "OK" };
    }

    public async Task<RecordingContentResult> DownloadRecordingsAsync(
        Guid tenantId,
        Guid sessionId,
        IReadOnlyList<Guid> recordingIds,
        Guid actorUserId,
        CancellationToken cancellationToken = default)
    {
        var distinct = recordingIds?.Where(id => id != Guid.Empty).Distinct().ToList() ?? new List<Guid>();
        if (distinct.Count == 0)
        {
            return new RecordingContentResult
            {
                Success = false,
                FailureKind = SessionOperationFailureKind.BadRequest,
                Message = "No recordings were selected.",
            };
        }

        var auth = await AuthorizeAsync(
            tenantId, sessionId, actorUserId, expectedVersion: null, requireInProgress: false, cancellationToken: cancellationToken);
        if (auth.Failure != null)
        {
            return new RecordingContentResult
            {
                Success = false,
                FailureKind = auth.Failure.FailureKind,
                Message = auth.Failure.Message,
            };
        }

        if (distinct.Count == 1)
        {
            var single = await OpenRecordingAsync(tenantId, sessionId, distinct[0], actorUserId, cancellationToken);
            if (!single.Success || single.Content == null) return single;
            var recording = await _context.SessionRecordings.AsNoTracking()
                .FirstAsync(r => r.Id == distinct[0], cancellationToken);
            var extension = Path.GetExtension(recording.FileUrl);
            if (string.IsNullOrWhiteSpace(extension)) extension = ".webm";
            return new RecordingContentResult
            {
                Success = true,
                Content = single.Content,
                FileName = "recording" + extension,
                Message = "OK",
            };
        }

        var recordings = await _context.SessionRecordings.AsNoTracking()
            .Where(r => distinct.Contains(r.Id) && r.SessionId == sessionId && r.TenantId == tenantId && r.DeletedAt == null)
            .OrderBy(r => r.CreatedAt).ThenBy(r => r.Id)
            .ToListAsync(cancellationToken);
        if (recordings.Count != distinct.Count)
        {
            return new RecordingContentResult
            {
                Success = false,
                FailureKind = SessionOperationFailureKind.NotFound,
                Message = "Recording not found",
            };
        }

        var conversationIds = recordings.Select(r => r.ConversationId).Distinct().ToList();
        int? sequence = null;
        if (conversationIds.Count == 1 && conversationIds[0].HasValue)
        {
            sequence = await _context.CounselingConversations.AsNoTracking()
                .Where(c => c.Id == conversationIds[0]!.Value && c.DeletedAt == null)
                .Select(c => (int?)c.SequenceNumber)
                .FirstOrDefaultAsync(cancellationToken);
        }

        var buffer = new MemoryStream();
        using (var zip = new ZipArchive(buffer, ZipArchiveMode.Create, leaveOpen: true))
        {
            for (var index = 0; index < recordings.Count; index++)
            {
                var recording = recordings[index];
                if (string.IsNullOrWhiteSpace(recording.FileUrl))
                {
                    return new RecordingContentResult
                    {
                        Success = false,
                        FailureKind = SessionOperationFailureKind.NotFound,
                        Message = "Recording not found",
                    };
                }

                var blob = await _blobStorage.OpenReadExactAsync(
                    SessionAudioObjectKey.ContainerName, recording.FileUrl, cancellationToken);
                if (blob == null)
                {
                    return new RecordingContentResult
                    {
                        Success = false,
                        FailureKind = SessionOperationFailureKind.NotFound,
                        Message = "Recording not found",
                    };
                }

                await using (blob)
                {
                    var extension = Path.GetExtension(recording.FileUrl);
                    if (string.IsNullOrWhiteSpace(extension)) extension = ".webm";
                    var entry = zip.CreateEntry($"Recording-{index + 1:00}{extension}", CompressionLevel.Fastest);
                    await using var entryStream = entry.Open();
                    await blob.Content.CopyToAsync(entryStream, cancellationToken);
                }
            }
        }

        buffer.Position = 0;
        var fileName = sequence.HasValue
            ? $"Counselling-Conversation-{sequence.Value}-Recordings.zip"
            : "Counselling-Recordings.zip";
        return new RecordingContentResult
        {
            Success = true,
            Content = new ExactBlobRead
            {
                Content = buffer,
                ContentType = "application/zip",
                ContentLength = buffer.Length,
            },
            FileName = fileName,
            Message = "OK",
        };
    }

    public async Task<ConversationCommandResult> DeleteRecordingsAsync(
        Guid tenantId,
        Guid sessionId,
        IReadOnlyList<Guid> recordingIds,
        Guid actorUserId,
        CancellationToken cancellationToken = default)
    {
        var distinct = recordingIds?.Where(id => id != Guid.Empty).Distinct().ToList() ?? new List<Guid>();
        if (distinct.Count == 0)
            return Fail(SessionOperationFailureKind.BadRequest, "No recordings were selected.");

        var auth = await AuthorizeAsync(
            tenantId, sessionId, actorUserId, expectedVersion: null, requireInProgress: false, cancellationToken: cancellationToken);
        if (auth.Failure != null)
            return auth.Failure;

        var recordings = await _context.SessionRecordings
            .Where(r => distinct.Contains(r.Id) && r.SessionId == sessionId && r.TenantId == tenantId && r.DeletedAt == null)
            .ToListAsync(cancellationToken);
        if (recordings.Count != distinct.Count)
            return Fail(SessionOperationFailureKind.NotFound, "Recording not found");

        var now = DateTime.UtcNow;
        var deletedCount = 0;
        var failedCount = 0;
        foreach (var recording in recordings)
        {
            if (string.IsNullOrWhiteSpace(recording.FileUrl))
            {
                failedCount++;
                continue;
            }

            try
            {
                await _blobStorage.DeleteExactKeyAsync(
                    SessionAudioObjectKey.ContainerName, recording.FileUrl, cancellationToken);
            }
            catch (Exception ex)
            {
                failedCount++;
                LogStorageFailure("delete", ex, sessionId, recording.Id);
                continue;
            }

            recording.DeletedAt = now;
            recording.UpdatedAt = now;
            recording.UpdatedByUserId = actorUserId;
            recording.Status = "deleted";
            if (recording.DocumentId.HasValue)
            {
                var document = await _context.CounselingSessionDocuments.FirstOrDefaultAsync(
                    d => d.Id == recording.DocumentId.Value && d.SessionId == sessionId && d.TenantId == tenantId && d.DeletedAt == null,
                    cancellationToken);
                if (document != null)
                {
                    document.DeletedAt = now;
                    document.UpdatedAt = now;
                    document.UpdatedByUserId = actorUserId;
                    document.Status = "deleted";
                }
            }

            _context.CounselingSessionAuditLog.Add(new CounselingSessionAuditLog
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                SessionId = sessionId,
                ChangeType = "RecordingDeleted",
                OldValue = recording.Id.ToString(),
                NewValue = "deleted",
                Reason = "Counsellor deleted a conversation recording",
                ChangedByUserId = actorUserId,
                ChangedAt = now,
            });
            deletedCount++;
        }

        if (deletedCount == 0)
            return Fail(SessionOperationFailureKind.BadRequest, "Recording could not be deleted.");

        await _context.SaveChangesAsync(cancellationToken);
        return new ConversationCommandResult
        {
            Success = true,
            Message = failedCount == 0 ? "Recordings deleted." : "Some recordings could not be deleted.",
            DeletedCount = deletedCount,
            FailedCount = failedCount,
        };
    }

    public async Task<ConversationHistoryResult> ListConversationsAsync(
        Guid tenantId,
        Guid sessionId,
        Guid actorUserId,
        CancellationToken cancellationToken = default)
    {
        var auth = await AuthorizeAsync(
            tenantId, sessionId, actorUserId, expectedVersion: null, requireInProgress: false, requireOwner: false, cancellationToken: cancellationToken);
        if (auth.Failure != null)
        {
            _logger.LogWarning("Conversation history authorization failed for session {SessionId}", sessionId);
            return new ConversationHistoryResult
            {
                Success = false,
                FailureKind = auth.Failure.FailureKind,
                Message = auth.Failure.Message,
            };
        }

        var conversations = await _context.CounselingConversations.AsNoTracking()
            .Where(c => c.SessionId == sessionId && c.TenantId == tenantId && c.DeletedAt == null)
            .OrderBy(c => c.SequenceNumber)
            .ToListAsync(cancellationToken);

        var conversationIds = conversations.Select(c => c.Id).ToList();
        var recordings = conversationIds.Count == 0
            ? new List<SessionRecording>()
            : await _context.SessionRecordings.AsNoTracking()
                .Where(r =>
                    r.SessionId == sessionId
                    && r.TenantId == tenantId
                    && r.DeletedAt == null
                    && r.ConversationId != null
                    && conversationIds.Contains(r.ConversationId.Value))
                .OrderBy(r => r.CreatedAt)
                .ThenBy(r => r.Id)
                .ToListAsync(cancellationToken);

        var ownerIds = conversations.Select(c => c.CreatedByUserId).Distinct().ToList();
        var names = ownerIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await _context.Users.AsNoTracking()
                .Where(u => u.TenantId == tenantId && ownerIds.Contains(u.Id))
                .Select(u => new { u.Id, u.FirstName, u.LastName })
                .ToDictionaryAsync(
                    u => u.Id,
                    u => $"{u.FirstName} {u.LastName}".Trim(),
                    cancellationToken);

        return new ConversationHistoryResult
        {
            Success = true,
            Message = "OK",
            Conversations = conversations.Select(c => new ConversationHistoryItem
            {
                Id = c.Id,
                SequenceNumber = c.SequenceNumber,
                StartedAt = c.StartedAt,
                EndedAt = c.EndedAt,
                Status = c.Status,
                CreatedAt = c.CreatedAt,
                DurationSeconds = ConversationDuration(recordings.Where(r => r.ConversationId == c.Id)),
                CounsellorName = names.TryGetValue(c.CreatedByUserId, out var name) && !string.IsNullOrWhiteSpace(name)
                    ? name
                    : null,
                Recordings = recordings
                    .Where(r => r.ConversationId == c.Id)
                    .Select(r => new ConversationRecordingItem
                    {
                        Id = r.Id,
                        CreatedAt = r.CreatedAt,
                        DurationSeconds = r.DurationSeconds,
                        ContentType = r.MimeType,
                        FileSizeBytes = r.FileSizeBytes,
                        UpdatedAt = r.UpdatedAt,
                        CreatedByUserId = r.CreatedByUserId,
                        RecordingState = r.RecordingState,
                        TranscriptionStatus = r.TranscriptionStatus,
                    })
                    .ToList(),
            }).ToList(),
        };
    }

    private static int? ConversationDuration(IEnumerable<SessionRecording> recordings)
    {
        var durations = recordings.Select(r => r.DurationSeconds).ToList();
        if (durations.Count == 0 || durations.Any(d => !d.HasValue))
            return null;
        return durations.Sum();
    }

    private async Task<ConversationCommandResult> EnsureCoreAsync(
        Guid tenantId,
        Guid sessionId,
        Guid actorUserId,
        int? expectedVersion,
        CancellationToken cancellationToken)
    {
        var auth = await AuthorizeAsync(
            tenantId, sessionId, actorUserId, expectedVersion, requireInProgress: true, cancellationToken: cancellationToken);
        if (auth.Failure != null)
            return auth.Failure;
        var session = auth.Session!;

        var open = await _context.CounselingConversations
            .Where(c => c.SessionId == sessionId && c.TenantId == tenantId && c.DeletedAt == null && c.EndedAt == null)
            .OrderByDescending(c => c.SequenceNumber)
            .FirstOrDefaultAsync(cancellationToken);

        if (open != null && !await ShouldSupersedeAsync(session, open, cancellationToken))
        {
            return new ConversationCommandResult
            {
                Success = true,
                Message = "Conversation already open.",
                ConversationId = open.Id,
                SequenceNumber = open.SequenceNumber,
                CreatedAt = open.CreatedAt,
            };
        }

        var now = DateTime.UtcNow;
        if (open != null)
        {
            open.EndedAt = now;
            open.Status = CounselingConversationStatus.Ended;
            open.UpdatedAt = now;
            open.Version += 1;
        }

        var nextSequence = await _context.CounselingConversations
            .Where(c => c.SessionId == sessionId && c.TenantId == tenantId && c.DeletedAt == null)
            .Select(c => (int?)c.SequenceNumber)
            .MaxAsync(cancellationToken) ?? 0;

        var created = new CounselingConversation
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = session.BranchId,
            SessionId = sessionId,
            SequenceNumber = nextSequence + 1,
            StartedAt = session.SessionStartTime!.Value,
            Status = CounselingConversationStatus.Active,
            Version = 1,
            CreatedAt = now,
            CreatedByUserId = actorUserId,
        };
        _context.CounselingConversations.Add(created);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Opened counselling conversation {ConversationId} sequence {Sequence} for session {SessionId}",
            created.Id, created.SequenceNumber, sessionId);

        return new ConversationCommandResult
        {
            Success = true,
            Message = "Conversation opened.",
            ConversationId = created.Id,
            SequenceNumber = created.SequenceNumber,
            CreatedAt = created.CreatedAt,
        };
    }

    private async Task<bool> ShouldSupersedeAsync(
        CounselingSession session,
        CounselingConversation open,
        CancellationToken cancellationToken)
    {
        var restarted = session.SessionStartTime.HasValue && session.SessionStartTime.Value > open.CreatedAt;
        if (!restarted)
            return false;

        var finishedAfter = session.SessionEndTime.HasValue && session.SessionEndTime.Value > open.CreatedAt;
        if (finishedAfter)
            return true;

        return await _context.CounselingSessionAuditLog.AsNoTracking().AnyAsync(h =>
            h.SessionId == session.Id
            && h.TenantId == session.TenantId
            && h.ChangeType == CounselingWorkflowService.OwnershipAuditEvents.Requeued
            && h.ChangedAt > open.CreatedAt, cancellationToken);
    }

    public async Task<ConversationCommandResult> AuthorizeRecordingContentAsync(
        Guid tenantId,
        Guid sessionId,
        Guid actorUserId,
        CancellationToken cancellationToken = default)
    {
        var auth = await AuthorizeAsync(
            tenantId,
            sessionId,
            actorUserId,
            expectedVersion: null,
            requireInProgress: false,
            requireOwner: true,
            cancellationToken: cancellationToken);
        return auth.Failure ?? new ConversationCommandResult { Success = true, Message = "OK" };
    }

    private async Task<(CounselingSession? Session, ConversationCommandResult? Failure)> AuthorizeAsync(
        Guid tenantId,
        Guid sessionId,
        Guid actorUserId,
        int? expectedVersion,
        bool requireInProgress,
        bool requireOwner = true,
        CancellationToken cancellationToken = default)
    {
        var session = await _context.CounselingSession
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null, cancellationToken);

        if (session == null)
            return (null, Fail(SessionOperationFailureKind.NotFound, "Session not found"));

        if (requireInProgress)
        {
            if (!expectedVersion.HasValue)
                return (null, Fail(SessionOperationFailureKind.BadRequest, "Version is required."));
            if (session.Version != expectedVersion.Value)
                return (null, Fail(SessionOperationFailureKind.Conflict, SessionConcurrency.StaleMessage));
            if (!string.Equals(session.Status, "InProgress", StringComparison.OrdinalIgnoreCase)
                || !session.SessionStartTime.HasValue)
            {
                return (null, Fail(
                    SessionOperationFailureKind.BadRequest,
                    "Recording is available only while counselling is in progress."));
            }
        }

        if (requireOwner && !session.CounselorId.HasValue)
        {
            return (null, Fail(
                SessionOperationFailureKind.Forbidden,
                "Session is unassigned. Ownership must be established through Assign or claim-for-lifecycle before recording."));
        }

        if (requireOwner && session.CounselorId.HasValue && session.CounselorId.Value != actorUserId)
        {
            return (null, Fail(
                SessionOperationFailureKind.Forbidden,
                requireInProgress
                    ? "Only the assigned counsellor may record this session."
                    : "Only the assigned counsellor may access this recording."));
        }

        try
        {
            if (session.BranchId.HasValue)
            {
                await _branchAccess.ResolveAccessibleBranchesAsync(
                    tenantId, actorUserId, session.BranchId, cancellationToken);
            }
            else
            {
                var accessible = await _branchAccess.ResolveAccessibleBranchesAsync(
                    tenantId, actorUserId, null, cancellationToken);
                if (accessible.Count == 0)
                {
                    return (null, Fail(
                        SessionOperationFailureKind.Forbidden,
                        "Not authorized for this session branch."));
                }
            }
        }
        catch (UnauthorizedAccessException)
        {
            return (null, Fail(
                SessionOperationFailureKind.Forbidden,
                "Not authorized for this session branch."));
        }

        return (session, null);
    }

    private static async Task<T> WithSessionGate<T>(Guid sessionId, Func<Task<T>> action)
    {
        var gate = SessionGates.GetOrAdd(sessionId, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync();
        try
        {
            return await action();
        }
        finally
        {
            gate.Release();
        }
    }

    private void LogStorageFailure(string operation, Exception ex, Guid sessionId, Guid recordingId)
    {
        if (ex is Azure.RequestFailedException storage)
        {
            _logger.LogWarning(
                "Recording {Operation} failed for session {SessionId} recording {RecordingId} status {Status} code {ErrorCode}",
                operation, sessionId, recordingId, storage.Status, storage.ErrorCode);
            return;
        }

        _logger.LogWarning(
            "Recording {Operation} failed for session {SessionId} recording {RecordingId} exception {ExceptionType}",
            operation, sessionId, recordingId, ex.GetType().Name);
    }

    private static ConversationCommandResult Fail(SessionOperationFailureKind kind, string message) =>
        new() { Success = false, FailureKind = kind, Message = message };
}

public static class SessionAudioContentTypes
{
    private static readonly Dictionary<string, string> ExtensionByType = new(StringComparer.OrdinalIgnoreCase)
    {
        ["audio/webm"] = ".webm",
        ["audio/ogg"] = ".ogg",
        ["audio/opus"] = ".opus",
        ["audio/mp4"] = ".m4a",
        ["audio/mpeg"] = ".mp3",
        ["audio/wav"] = ".wav",
        ["audio/x-wav"] = ".wav",
    };

    public static bool TryNormalize(string? contentType, out string normalized, out string extension)
    {
        normalized = "";
        extension = "";
        if (string.IsNullOrWhiteSpace(contentType))
            return false;
        var baseType = contentType.Split(';')[0].Trim();
        if (!ExtensionByType.TryGetValue(baseType, out var ext))
            return false;
        normalized = baseType.ToLowerInvariant();
        extension = ext;
        return true;
    }
}
