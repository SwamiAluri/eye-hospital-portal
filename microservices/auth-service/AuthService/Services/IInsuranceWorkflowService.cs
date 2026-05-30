using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using AuthService.Models.Counselor;

namespace AuthService.Services
{
    public interface IInsuranceWorkflowService
    {
        // Pre-Authorization Management
        Task<PreAuthListResponse> GetAllPreAuthsAsync(Guid tenantId, Guid? sessionId = null, string? status = null, int pageNumber = 1, int pageSize = 50);
        Task<InsurancePreAuthDto?> GetPreAuthByIdAsync(Guid preAuthId, Guid tenantId);
        Task<InsurancePreAuthDto?> GetPreAuthByNumberAsync(string preAuthNumber, Guid tenantId);
        Task<InsurancePreAuthDto> CreatePreAuthAsync(CreatePreAuthRequest request, Guid tenantId, Guid createdByUserId);
        Task<InsurancePreAuthDto> UpdatePreAuthAsync(Guid preAuthId, UpdatePreAuthRequest request, Guid tenantId, Guid updatedByUserId);
        Task<InsurancePreAuthDto> SubmitToTPAAsync(Guid preAuthId, SubmitToTPARequest request, Guid tenantId, Guid submittedByUserId);
        Task<InsurancePreAuthDto> ProcessTPAResponseAsync(Guid preAuthId, TPAResponseRequest request, Guid tenantId, Guid processedByUserId);
        Task DeletePreAuthAsync(Guid preAuthId, Guid tenantId, Guid deletedByUserId);

        // Approval Workflow
        Task<List<ApprovalWorkflowDto>> GetWorkflowStagesAsync(Guid preAuthId, Guid tenantId);
        Task<ApprovalWorkflowDto> ProcessApprovalStageAsync(Guid workflowId, ProcessApprovalRequest request, Guid tenantId, Guid approverUserId);

        // Insurance Documents
        Task<List<InsuranceDocumentDto>> GetPreAuthDocumentsAsync(Guid preAuthId, Guid tenantId);
        Task<InsuranceDocumentDto> UploadDocumentAsync(UploadInsuranceDocumentRequest request, Guid tenantId, Guid uploadedByUserId);
        Task<InsuranceDocumentDto> VerifyDocumentAsync(Guid documentId, Guid tenantId, Guid verifiedByUserId);
        Task DeleteDocumentAsync(Guid documentId, Guid tenantId);

        // TPA Communication
        Task<List<TPACommunicationDto>> GetTPACommunicationsAsync(Guid preAuthId, Guid tenantId);
        Task<TPACommunicationDto> LogCommunicationAsync(LogTPACommunicationRequest request, Guid tenantId, Guid loggedByUserId);
        Task<TPACommunicationDto> RecordResponseAsync(Guid communicationId, string responseText, Guid tenantId);

        // CCMS Support Endpoints
        Task<List<SessionSummaryDto>> GetSessionSummariesBatchAsync(List<Guid> sessionIds, Guid tenantId);
        Task<UnderwritingProfileDto?> GetUnderwritingProfileAsync(Guid patientId, Guid tenantId);

        // Chronic conditions CRUD
        Task<ChronicConditionsDto> GetChronicConditionsAsync(Guid patientId, Guid tenantId);
        Task UpsertChronicConditionsAsync(Guid patientId, Guid tenantId, UpsertChronicConditionsRequest request);

        // patient_insurance sync from CCMS primary policy (fire-and-forget, best-effort)
        Task SyncPatientInsuranceFromCcmsAsync(Guid patientId, PatientInsuranceSyncRequest request);
    }

    // ── CCMS-facing DTOs ─────────────────────────────────────────────────────────

    public record SessionSummaryDto(
        Guid    SessionId,
        string? PatientName,
        string? PatientMobile,
        string? ProcedureName,
        string? CounsellorName,
        string? PaymentType,
        DateTime? CounselledAt
    );

    public record UnderwritingConditionDto(
        string  ConditionName,
        string? Icd10Code,
        string  Severity,        // mild | moderate | severe
        bool    IsPreExisting,
        string? Notes
    );

    public record UnderwritingProfileDto(
        Guid    PatientId,
        List<UnderwritingConditionDto> Conditions,
        string? Notes,
        DateTime? LastUpdated
    );

    public record ChronicConditionsDto(
        Guid    PatientId,
        List<UnderwritingConditionDto> Conditions,
        string? Notes,
        DateTime? LastUpdated
    );

    public record UpsertChronicConditionsRequest(
        List<UnderwritingConditionDto> Conditions,
        string? Notes = null
    );

    public record PatientInsuranceSyncRequest(
        string  PatientId,
        string  PolicyNumber,
        string  ProviderName,
        string? InsuredName,
        string? Relationship,
        string? ContactPhone,
        string? StartDate,
        string? EndDate
    );
}
