using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using AuthService.Models.Counselor;

namespace AuthService.Services
{
    public interface ICounselingWorkflowService
    {
        // ============================================================================
        // COUNSELING SESSIONS
        // ============================================================================

        Task<SessionListResponse> GetAllSessionsAsync(SessionFilters filters);
        Task<CounselingSessionDetailsDto?> GetSessionByIdAsync(Guid tenantId, Guid sessionId);
        Task<CounselingSessionDetailsDto?> GetSessionByNumberAsync(Guid tenantId, string sessionNumber);
        Task<SessionOperationResult> CreateSessionAsync(CreateCounselingSessionRequest request, Guid currentUserId);
        Task<SessionOperationResult> UpdateSessionAsync(Guid tenantId, Guid sessionId, UpdateCounselingSessionRequest request, Guid currentUserId);
        Task<SessionOperationResult> StartSessionAsync(Guid tenantId, Guid sessionId, Guid currentUserId, string? sessionType = null);
        Task<SessionOperationResult> CompleteSessionAsync(Guid tenantId, Guid sessionId, Guid currentUserId);
        Task<SessionOperationResult> CancelSessionAsync(Guid tenantId, Guid sessionId, string reason, Guid currentUserId);
        Task<SessionOperationResult> MarkAddOnSurgeryAsync(Guid tenantId, Guid sessionId, Guid currentUserId);
        Task<bool> DeleteSessionAsync(Guid tenantId, Guid sessionId, Guid currentUserId);

        /// <summary>
        /// Merges CCMS case linkage fields into the session's PackageAddonsJson (internal callback).
        /// </summary>
        Task<bool> ApplyCcmsCallbackAsync(
            Guid sessionId,
            Guid? tenantId,
            Guid coverageCaseId,
            string caseNumber,
            string eventType,
            string? currentState = null);

        // ============================================================================
        // COUNSELOR QUEUE
        // ============================================================================

        Task<QueueListResponse> GetQueueAsync(Guid tenantId, Guid? branchId = null, string? status = null);
        Task<CounselorQueueItemDto?> GetQueueItemByIdAsync(Guid tenantId, Guid queueItemId);
        Task<CounselorQueueItemDto?> GetQueueItemBySessionIdAsync(Guid tenantId, Guid sessionId);
        Task<CounselorQueueItemDto> AddToQueueAsync(AddToQueueRequest request);
        Task<CounselorQueueItemDto> UpdateQueueItemStatusAsync(Guid tenantId, Guid queueItemId, string status, Guid currentUserId);
        Task<CallNextPatientResponse> CallNextPatientAsync(CallNextPatientRequest request, Guid currentUserId);
        Task<bool> StartSessionFromQueueAsync(Guid tenantId, Guid queueItemId, Guid currentUserId);
        Task<bool> CompleteQueueItemAsync(Guid tenantId, Guid queueItemId, Guid currentUserId);
        Task<bool> RemoveFromQueueAsync(Guid tenantId, Guid queueItemId, string reason, Guid currentUserId);

        // ============================================================================
        // SESSION NOTES
        // ============================================================================

        Task<List<SessionNoteDto>> GetSessionNotesAsync(Guid tenantId, Guid sessionId);
        Task<SessionNoteDto?> GetNoteByIdAsync(Guid tenantId, Guid noteId);
        Task<SessionNoteDto> CreateSessionNoteAsync(CreateSessionNoteRequest request, Guid currentUserId);
        Task<SessionNoteDto> UpdateSessionNoteAsync(Guid tenantId, Guid noteId, UpdateSessionNoteRequest request, Guid currentUserId);
        Task<bool> DeleteSessionNoteAsync(Guid tenantId, Guid noteId, Guid currentUserId);

        // ============================================================================
        // SESSION DOCUMENTS
        // ============================================================================

        Task<List<SessionDocumentDto>> GetSessionDocumentsAsync(Guid tenantId, Guid sessionId);
        Task<SessionDocumentDto?> GetDocumentByIdAsync(Guid tenantId, Guid documentId);
        Task<SessionDocumentDto> CreateSessionDocumentAsync(CreateSessionDocumentRequest request, Guid currentUserId);
        Task<SessionDocumentDto> UploadSessionAudioAsync(Guid tenantId, Guid sessionId, Microsoft.AspNetCore.Http.IFormFile audioFile, Guid currentUserId);
        Task<SessionDocumentDto> VerifyDocumentAsync(Guid tenantId, Guid documentId, VerifyDocumentRequest request, Guid currentUserId);
        Task<bool> DeleteSessionDocumentAsync(Guid tenantId, Guid documentId, Guid currentUserId);

        // ============================================================================
        // MASTER CATALOG & INVESTIGATIONS
        // ============================================================================

        Task<List<MasterCatalogItemDto>> GetMasterCatalogAsync(Guid tenantId, string? testType = null);
        Task SaveSessionInvestigationsAsync(Guid tenantId, Guid sessionId, Guid orderedByUserId, List<InvestigationOrderItemDto> investigations);

        // ============================================================================
        // BUSINESS LOGIC & UTILITIES
        // ============================================================================

        Task<string> GenerateSessionNumberAsync(Guid tenantId, Guid branchId);
        Task<int> CalculateDurationMinutesAsync(DateTime startTime, DateTime endTime);
        Task<decimal> CalculatePriorityScoreAsync(string urgencyLevel, int waitMinutes);
    }
}
