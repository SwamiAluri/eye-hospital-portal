using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using AuthService.Authorization;
using AuthService.Models.Counselor;
using AuthService.Services;
using AuthService.Services.Interfaces;

namespace AuthService.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class TranscriptionController : ControllerBase
    {
        private readonly ITranscriptionService _transcriptionService;
        private readonly ILogger<TranscriptionController> _logger;

        public TranscriptionController(
            ITranscriptionService transcriptionService,
            ILogger<TranscriptionController> logger)
        {
            _transcriptionService = transcriptionService;
            _logger = logger;
        }

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

        [HttpPost("start/{recordingId}")]
        [RequirePermission("transcription.start")]
        public async Task<IActionResult> StartTranscription(Guid recordingId)
        {
            try
            {
                var response = await _transcriptionService.StartTranscriptionAsync(
                    GetTenantId(),
                    recordingId,
                    GetCurrentUserId());
                if (response.FailureKind.HasValue)
                    return MapFailure(response.FailureKind, response.Message);
                return Ok(new
                {
                    recordingId = response.RecordingId,
                    status = response.Status,
                    message = response.Message,
                    errorCategory = response.ErrorCategory,
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error starting transcription for recording {RecordingId}", recordingId);
                return StatusCode(500, new { message = CounselingTranscriptionErrors.SafeClientMessage });
            }
        }

        [HttpGet("status/{recordingId}")]
        [RequirePermission("transcription.view")]
        public async Task<IActionResult> GetTranscriptionStatus(Guid recordingId)
        {
            try
            {
                var status = await _transcriptionService.GetTranscriptionStatusAsync(
                    GetTenantId(), recordingId, GetCurrentUserId());
                if (status.FailureKind.HasValue)
                    return MapFailure(status.FailureKind, status.Message);
                return Ok(new
                {
                    recordingId = status.RecordingId,
                    status = status.Status,
                    message = status.Message,
                    errorCategory = status.ErrorCategory,
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking transcription status for recording {RecordingId}", recordingId);
                return StatusCode(500, new { message = CounselingTranscriptionErrors.SafeClientMessage });
            }
        }

        [HttpGet("{recordingId}/transcripts")]
        [RequirePermission("transcription.view")]
        public async Task<IActionResult> GetTranscripts(Guid recordingId)
        {
            try
            {
                var transcripts = await _transcriptionService.GetTranscriptsAsync(
                    GetTenantId(), recordingId, GetCurrentUserId());
                return Ok(transcripts);
            }
            catch (TranscriptionAccessException ex)
            {
                return MapFailure(ex.Kind, ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving transcripts for recording {RecordingId}", recordingId);
                return StatusCode(500, new { message = CounselingTranscriptionErrors.SafeClientMessage });
            }
        }

        [HttpPost("translate")]
        [RequirePermission("transcription.translate")]
        public async Task<IActionResult> StartTranslation([FromBody] StartTranslationRequest request)
        {
            try
            {
                var response = await _transcriptionService.StartTranslationAsync(
                    GetTenantId(),
                    request.RecordingId,
                    request.SourceTranscriptId,
                    request.TargetLanguages,
                    GetCurrentUserId());
                return Ok(response);
            }
            catch (TranscriptionAccessException ex)
            {
                return MapFailure(ex.Kind, ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error starting translation for transcript {TranscriptId}", request.SourceTranscriptId);
                return StatusCode(500, new { message = CounselingTranscriptionErrors.SafeClientMessage });
            }
        }

        [HttpPatch("edit")]
        [RequirePermission("transcription.edit")]
        public async Task<IActionResult> EditTranscriptSegment([FromBody] EditTranscriptRequest request)
        {
            try
            {
                var result = await _transcriptionService.EditTranscriptSegmentAsync(
                    GetTenantId(),
                    request,
                    GetCurrentUserId());
                return Ok(result);
            }
            catch (TranscriptionAccessException ex)
            {
                return MapFailure(ex.Kind, ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error editing transcript {TranscriptId}", request.TranscriptId);
                return StatusCode(500, new { message = CounselingTranscriptionErrors.SafeClientMessage });
            }
        }

        [HttpGet("{transcriptId}/edits")]
        [RequirePermission("transcription.view")]
        public async Task<IActionResult> GetTranscriptEdits(Guid transcriptId)
        {
            try
            {
                var edits = await _transcriptionService.GetTranscriptEditsAsync(
                    GetTenantId(), transcriptId, GetCurrentUserId());
                return Ok(edits);
            }
            catch (TranscriptionAccessException ex)
            {
                return MapFailure(ex.Kind, ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving edit history for transcript {TranscriptId}", transcriptId);
                return StatusCode(500, new { message = CounselingTranscriptionErrors.SafeClientMessage });
            }
        }

        [HttpGet("languages")]
        [RequirePermission("transcription.view")]
        public IActionResult GetSupportedLanguages()
        {
            var languages = new[]
            {
                new { code = "en-US", name = "English" },
                new { code = "hi-IN", name = "Hindi" },
                new { code = "te-IN", name = "Telugu" },
            };
            return Ok(languages);
        }

        private IActionResult MapFailure(SessionOperationFailureKind? kind, string? message) =>
            kind switch
            {
                SessionOperationFailureKind.NotFound => NotFound(new { message }),
                SessionOperationFailureKind.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { message }),
                SessionOperationFailureKind.Conflict => Conflict(new { message }),
                _ => BadRequest(new { message }),
            };
    }
}
