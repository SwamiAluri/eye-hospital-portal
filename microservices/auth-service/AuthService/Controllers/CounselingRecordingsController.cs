using AuthService.Authorization;
using AuthService.Models.Counselor;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace AuthService.Controllers;

[Authorize]
[ApiController]
[Route("api/Counseling/sessions/{sessionId:guid}")]
public class CounselingRecordingsController : ControllerBase
{
    private readonly ICounselingConversationService _conversations;
    private readonly ILogger<CounselingRecordingsController> _logger;

    public CounselingRecordingsController(
        ICounselingConversationService conversations,
        ILogger<CounselingRecordingsController> logger)
    {
        _conversations = conversations;
        _logger = logger;
    }

    [HttpGet("conversations")]
    [RequirePermission("counseling_sessions.read")]
    public async Task<IActionResult> ListConversations(Guid sessionId)
    {
        try
        {
            var result = await _conversations.ListConversationsAsync(GetTenantId(), sessionId, GetCurrentUserId());
            if (!result.Success)
                return MapFailure(result.FailureKind, result.Message);

            return Ok(new
            {
                conversations = result.Conversations.Select(c => new
                {
                    id = c.Id,
                    conversationId = c.Id,
                    sequenceNumber = c.SequenceNumber,
                    startedAt = c.StartedAt,
                    endedAt = c.EndedAt,
                    status = c.Status,
                    duration = c.DurationSeconds,
                    createdAt = c.CreatedAt,
                    counsellorName = c.CounsellorName,
                    recordings = c.Recordings.Select(r => new
                    {
                        id = r.Id,
                        recordingId = r.Id,
                        createdAt = r.CreatedAt,
                        durationSeconds = r.DurationSeconds,
                        contentType = r.ContentType,
                        fileSizeBytes = r.FileSizeBytes,
                        updatedAt = r.UpdatedAt,
                        createdByUserId = r.CreatedByUserId,
                        recordingState = r.RecordingState,
                        transcriptionStatus = r.TranscriptionStatus,
                    }),
                }),
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Conversation history failed for session {SessionId}", sessionId);
            return StatusCode(500, new { message = "Conversations could not be loaded." });
        }
    }

    [HttpPost("conversations")]
    [RequirePermission("counseling_sessions.update")]
    public async Task<IActionResult> EnsureConversation(Guid sessionId, [FromBody] EnsureCounselingConversationRequest? request)
    {
        try
        {
            var result = await _conversations.EnsureActiveConversationAsync(
                GetTenantId(), sessionId, GetCurrentUserId(), request?.Version);
            return Map(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Conversation ensure failed for session {SessionId}", sessionId);
            return StatusCode(500, new { message = "Conversation could not be opened." });
        }
    }

    [HttpPost("recordings")]
    [RequirePermission("counseling_sessions.update")]
    [RequestSizeLimit(104857600)]
    public async Task<IActionResult> UploadRecording(
        Guid sessionId,
        [FromForm] IFormFile? audioFile,
        [FromForm] int? durationSeconds,
        [FromForm] int? version)
    {
        try
        {
            if (audioFile == null || audioFile.Length == 0)
                return BadRequest(new { message = "No audio file provided." });

            await using var stream = audioFile.OpenReadStream();
            var result = await _conversations.UploadRecordingAsync(
                GetTenantId(),
                sessionId,
                stream,
                audioFile.ContentType,
                audioFile.Length,
                durationSeconds,
                GetCurrentUserId(),
                version);
            return Map(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Recording upload failed for session {SessionId}", sessionId);
            return StatusCode(500, new { message = "Recording could not be saved." });
        }
    }

    [HttpGet("recordings/{recordingId:guid}/content")]
    [RequirePermission("counseling_sessions.update")]
    public async Task<IActionResult> OpenRecording(Guid sessionId, Guid recordingId)
    {
        RecordingContentResult result;
        try
        {
            result = await _conversations.OpenRecordingAsync(
                GetTenantId(), sessionId, recordingId, GetCurrentUserId());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Recording playback failed for session {SessionId}", sessionId);
            return StatusCode(500, new { message = "Recording could not be opened." });
        }

        if (!result.Success || result.Content == null)
            return MapFailure(result.FailureKind, result.Message);

        return File(result.Content.Content, result.Content.ContentType);
    }

    [HttpPost("recordings/download")]
    [RequirePermission("counseling_sessions.update")]
    public async Task<IActionResult> DownloadRecordings(Guid sessionId, [FromBody] CounselingRecordingIdsRequest? request)
    {
        RecordingContentResult result;
        try
        {
            result = await _conversations.DownloadRecordingsAsync(
                GetTenantId(), sessionId, request?.RecordingIds ?? Array.Empty<Guid>(), GetCurrentUserId());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Recording download failed for session {SessionId}", sessionId);
            return StatusCode(500, new { message = "Recording could not be downloaded." });
        }

        if (!result.Success || result.Content == null)
            return MapFailure(result.FailureKind, result.Message);

        return File(result.Content.Content, result.Content.ContentType, result.FileName ?? "recording");
    }

    [HttpPost("recordings/delete")]
    [RequirePermission("counseling_sessions.update")]
    public async Task<IActionResult> DeleteRecordings(Guid sessionId, [FromBody] CounselingRecordingIdsRequest? request)
    {
        try
        {
            var result = await _conversations.DeleteRecordingsAsync(
                GetTenantId(), sessionId, request?.RecordingIds ?? Array.Empty<Guid>(), GetCurrentUserId());
            return Map(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Recording delete failed for session {SessionId}", sessionId);
            return StatusCode(500, new { message = "Recording could not be deleted." });
        }
    }

    private IActionResult Map(ConversationCommandResult result)
    {
        if (result.Success)
        {
            return Ok(new
            {
                conversationId = result.ConversationId,
                sequenceNumber = result.SequenceNumber,
                recordingId = result.RecordingId,
                contentType = result.ContentType,
                recordingState = result.RecordingState,
                durationSeconds = result.DurationSeconds,
                createdAt = result.CreatedAt,
                deletedCount = result.DeletedCount,
                failedCount = result.FailedCount,
                message = result.Message,
            });
        }

        return MapFailure(result.FailureKind, result.Message);
    }

    private IActionResult MapFailure(SessionOperationFailureKind? kind, string message) =>
        kind switch
        {
            SessionOperationFailureKind.NotFound => NotFound(new { message }),
            SessionOperationFailureKind.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { message }),
            SessionOperationFailureKind.Conflict => Conflict(new { message }),
            _ => BadRequest(new { message }),
        };

    private Guid GetTenantId()
    {
        var tenantIdClaim = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantIdClaim) || !Guid.TryParse(tenantIdClaim, out var tenantId))
            throw new UnauthorizedAccessException("Tenant ID not found in token");
        return tenantId;
    }

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("User ID not found in token");
        return userId;
    }
}

public class EnsureCounselingConversationRequest
{
    public int? Version { get; set; }
}

public class CounselingRecordingIdsRequest
{
    public Guid[] RecordingIds { get; set; } = Array.Empty<Guid>();
}
