using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using AuthService.Models.Counselor;

namespace AuthService.Services.Interfaces
{
    public interface ITranscriptionService
    {
        Task<TranscriptionJobResponse> StartTranscriptionAsync(
            Guid tenantId,
            Guid recordingId,
            Guid actorUserId,
            CancellationToken cancellationToken = default);

        Task<TranscriptionJobResponse> GetTranscriptionStatusAsync(
            Guid tenantId,
            Guid recordingId,
            Guid actorUserId,
            CancellationToken cancellationToken = default);

        Task ReconcileAsync(CancellationToken cancellationToken = default);

        Task<TranslationJobResponse> StartTranslationAsync(
            Guid tenantId,
            Guid recordingId,
            Guid sourceTranscriptId,
            List<string> targetLanguages,
            Guid actorUserId,
            CancellationToken cancellationToken = default);

        Task<List<SessionTranscriptDto>> GetTranscriptsAsync(
            Guid tenantId,
            Guid recordingId,
            Guid actorUserId,
            CancellationToken cancellationToken = default);

        Task<TranscriptEditDto> EditTranscriptSegmentAsync(
            Guid tenantId,
            EditTranscriptRequest request,
            Guid currentUserId,
            CancellationToken cancellationToken = default);

        Task<List<TranscriptEditDto>> GetTranscriptEditsAsync(
            Guid tenantId,
            Guid transcriptId,
            Guid actorUserId,
            CancellationToken cancellationToken = default);
    }
}
