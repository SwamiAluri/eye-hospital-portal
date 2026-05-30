using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Counselor;
using AuthService.Models.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AuthService.Services
{
    public class InsuranceWorkflowService : IInsuranceWorkflowService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<InsuranceWorkflowService> _logger;
        private readonly IBranchCacheService _branchCache;
        private readonly IWorkflowOrchestrationService _workflowOrchestration;

        public InsuranceWorkflowService(AppDbContext context, ILogger<InsuranceWorkflowService> logger, IBranchCacheService branchCache, IWorkflowOrchestrationService workflowOrchestration)
        {
            _context = context;
            _logger = logger;
            _branchCache = branchCache;
            _workflowOrchestration = workflowOrchestration;
        }

        // Pre-Authorization Management
        public async Task<PreAuthListResponse> GetAllPreAuthsAsync(Guid tenantId, Guid? sessionId = null, string? status = null, int pageNumber = 1, int pageSize = 50)
        {
            var query = _context.InsurancePreAuthorizations
                .Where(p => p.TenantId == tenantId && p.DeletedAt == null);

            if (sessionId.HasValue)
                query = query.Where(p => p.SessionId == sessionId.Value);

            if (!string.IsNullOrEmpty(status))
                query = query.Where(p => p.Status == status);

            var totalCount = await query.CountAsync();
            var preAuths = await query
                .OrderByDescending(p => p.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return new PreAuthListResponse
            {
                PreAuths = preAuths.Select(ToPreAuthDto).ToList(),
                TotalCount = totalCount,
                PageNumber = pageNumber,
                PageSize = pageSize
            };
        }

        public async Task<InsurancePreAuthDto?> GetPreAuthByIdAsync(Guid preAuthId, Guid tenantId)
        {
            var preAuth = await _context.InsurancePreAuthorizations
                .FirstOrDefaultAsync(p => p.Id == preAuthId && p.TenantId == tenantId && p.DeletedAt == null);
            return preAuth != null ? ToPreAuthDto(preAuth) : null;
        }

        public async Task<InsurancePreAuthDto?> GetPreAuthByNumberAsync(string preAuthNumber, Guid tenantId)
        {
            var preAuth = await _context.InsurancePreAuthorizations
                .FirstOrDefaultAsync(p => p.PreAuthNumber == preAuthNumber && p.TenantId == tenantId && p.DeletedAt == null);
            return preAuth != null ? ToPreAuthDto(preAuth) : null;
        }

        public async Task<InsurancePreAuthDto> CreatePreAuthAsync(CreatePreAuthRequest request, Guid tenantId, Guid createdByUserId)
        {
            if (!string.IsNullOrEmpty(request.ItemizedBreakdown))
            {
                try { JsonDocument.Parse(request.ItemizedBreakdown); }
                catch { throw new ArgumentException("Invalid JSON for itemized breakdown"); }
            }

            var branch = await _branchCache.GetDefaultBranchForTenantAsync(tenantId);
            if (branch == null) throw new InvalidOperationException("Branch not found for tenant");

            var preAuth = new InsurancePreAuthorization
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                BranchId = branch.Id,
                SessionId = request.SessionId,
                PatientId = request.PatientId,
                InsuranceType = request.InsuranceType,
                InsuranceProvider = request.InsuranceProvider,
                TPAName = request.TPAName,
                PolicyNumber = request.PolicyNumber,
                PolicyHolderName = request.PolicyHolderName,
                SurgeryType = request.SurgeryType,
                PlannedProcedure = request.PlannedProcedure,
                DiagnosisCode = request.DiagnosisCode,
                ProcedureCode = request.ProcedureCode,
                EyeOperated = request.EyeOperated,
                RequestedAmount = request.RequestedAmount,
                CopayAmount = request.CopayAmount ?? 0,
                DeductibleAmount = request.DeductibleAmount ?? 0,
                PackageId = request.PackageId,
                ItemizedBreakdown = request.ItemizedBreakdown,
                Status = "Draft",
                CreatedAt = DateTime.UtcNow,
                CreatedByUserId = createdByUserId
            };

            _context.InsurancePreAuthorizations.Add(preAuth);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Created insurance pre-auth {PreAuthId} for session {SessionId}", preAuth.Id, request.SessionId);

            // Initialize approval workflow stages
            var stages = new[]
            {
                new InsuranceApprovalWorkflow { Id = Guid.NewGuid(), TenantId = tenantId, PreAuthId = preAuth.Id, StageName = "InsuranceDeptReview", StageSequence = 1, IsCurrentStage = true },
                new InsuranceApprovalWorkflow { Id = Guid.NewGuid(), TenantId = tenantId, PreAuthId = preAuth.Id, StageName = "PaymentDeptReview", StageSequence = 2 },
                new InsuranceApprovalWorkflow { Id = Guid.NewGuid(), TenantId = tenantId, PreAuthId = preAuth.Id, StageName = "TPASubmission", StageSequence = 3 },
                new InsuranceApprovalWorkflow { Id = Guid.NewGuid(), TenantId = tenantId, PreAuthId = preAuth.Id, StageName = "TPAReview", StageSequence = 4 },
                new InsuranceApprovalWorkflow { Id = Guid.NewGuid(), TenantId = tenantId, PreAuthId = preAuth.Id, StageName = "TPAApproval", StageSequence = 5 }
            };
            _context.InsuranceApprovalWorkflows.AddRange(stages);
            await _context.SaveChangesAsync();

            return ToPreAuthDto(preAuth);
        }

        public async Task<InsurancePreAuthDto> UpdatePreAuthAsync(Guid preAuthId, UpdatePreAuthRequest request, Guid tenantId, Guid updatedByUserId)
        {
            var preAuth = await _context.InsurancePreAuthorizations
                .FirstOrDefaultAsync(p => p.Id == preAuthId && p.TenantId == tenantId && p.DeletedAt == null)
                ?? throw new KeyNotFoundException("Pre-authorization not found");

            if (preAuth.Status != "Draft")
                throw new InvalidOperationException("Only draft pre-authorizations can be updated");

            if (!string.IsNullOrEmpty(request.ItemizedBreakdown))
            {
                try { JsonDocument.Parse(request.ItemizedBreakdown); }
                catch { throw new ArgumentException("Invalid JSON for itemized breakdown"); }
            }

            if (request.InsuranceProvider != null) preAuth.InsuranceProvider = request.InsuranceProvider;
            if (request.TPAName != null) preAuth.TPAName = request.TPAName;
            if (request.PolicyNumber != null) preAuth.PolicyNumber = request.PolicyNumber;
            if (request.PlannedProcedure != null) preAuth.PlannedProcedure = request.PlannedProcedure;
            if (request.RequestedAmount.HasValue) preAuth.RequestedAmount = request.RequestedAmount.Value;
            if (request.CopayAmount.HasValue) preAuth.CopayAmount = request.CopayAmount.Value;
            if (request.DeductibleAmount.HasValue) preAuth.DeductibleAmount = request.DeductibleAmount.Value;
            if (request.ItemizedBreakdown != null) preAuth.ItemizedBreakdown = request.ItemizedBreakdown;

            preAuth.UpdatedAt = DateTime.UtcNow;
            preAuth.UpdatedByUserId = updatedByUserId;

            await _context.SaveChangesAsync();
            _logger.LogInformation("Updated insurance pre-auth {PreAuthId}", preAuthId);
            return ToPreAuthDto(preAuth);
        }

        public async Task<InsurancePreAuthDto> SubmitToTPAAsync(Guid preAuthId, SubmitToTPARequest request, Guid tenantId, Guid submittedByUserId)
        {
            var preAuth = await _context.InsurancePreAuthorizations
                .FirstOrDefaultAsync(p => p.Id == preAuthId && p.TenantId == tenantId && p.DeletedAt == null)
                ?? throw new KeyNotFoundException("Pre-authorization not found");

            if (preAuth.Status != "PaymentDeptReviewed")
                throw new InvalidOperationException("Pre-authorization must pass payment dept review before TPA submission");

            preAuth.Status = "SubmittedToTPA";
            preAuth.SubmittedToTPAAt = DateTime.UtcNow;
            preAuth.SubmittedByUserId = submittedByUserId;
            preAuth.ExpectedApprovalDate = request.ExpectedApprovalDate;
            preAuth.UpdatedAt = DateTime.UtcNow;
            preAuth.UpdatedByUserId = submittedByUserId;

            // Update workflow stage
            var stages = await _context.InsuranceApprovalWorkflows
                .Where(w => w.PreAuthId == preAuthId)
                .ToListAsync();
            foreach (var stage in stages) stage.IsCurrentStage = false;
            var tpaReviewStage = stages.FirstOrDefault(s => s.StageName == "TPAReview");
            if (tpaReviewStage != null) tpaReviewStage.IsCurrentStage = true;

            await _context.SaveChangesAsync();
            _logger.LogInformation("Submitted pre-auth {PreAuthId} to TPA", preAuthId);

            // Wire counselling workflow → InsuranceProcessing state
            _ = Task.Run(async () =>
            {
                try
                {
                    await _workflowOrchestration.UpdateWorkflowStageAsync(
                        preAuth.SessionId,
                        new UpdateWorkflowStageRequest { TargetState = "InsuranceProcessing", TriggeredBy = "System", TransitionNotes = "Pre-auth submitted to TPA" },
                        submittedByUserId);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to advance workflow to InsuranceProcessing for session {SessionId}", preAuth.SessionId);
                }
            });

            return ToPreAuthDto(preAuth);
        }

        public async Task<InsurancePreAuthDto> ProcessTPAResponseAsync(Guid preAuthId, TPAResponseRequest request, Guid tenantId, Guid processedByUserId)
        {
            var preAuth = await _context.InsurancePreAuthorizations
                .FirstOrDefaultAsync(p => p.Id == preAuthId && p.TenantId == tenantId && p.DeletedAt == null)
                ?? throw new KeyNotFoundException("Pre-authorization not found");

            switch (request.ActionType)
            {
                case "Approve":
                    preAuth.Status = "TPAApproved";
                    preAuth.ApprovedAmount = request.ApprovedAmount;
                    preAuth.ActualApprovalDate = DateTime.UtcNow;
                    break;
                case "PartiallyApprove":
                    preAuth.Status = "TPAPartiallyApproved";
                    preAuth.ApprovedAmount = request.ApprovedAmount;
                    preAuth.ActualApprovalDate = DateTime.UtcNow;
                    break;
                case "Deny":
                    preAuth.Status = "TPADenied";
                    preAuth.TPADenialReason = request.TPADenialReason;
                    break;
                case "QueryRaise":
                    preAuth.Status = "QueryRaised";
                    preAuth.QueriesRaised = request.QueriesRaised;
                    break;
                default:
                    throw new ArgumentException($"Invalid action type: {request.ActionType}");
            }

            preAuth.PatientPayable = request.PatientPayable;
            preAuth.TPAApprovalNumber = request.TPAApprovalNumber;
            preAuth.TPAApprovalLetterUrl = request.TPAApprovalLetterUrl;
            preAuth.TPAResponseNotes = request.TPAResponseNotes;
            preAuth.ValidFrom = request.ValidFrom;
            preAuth.ValidUntil = request.ValidUntil;
            preAuth.UpdatedAt = DateTime.UtcNow;
            preAuth.UpdatedByUserId = processedByUserId;

            await _context.SaveChangesAsync();
            _logger.LogInformation("Processed TPA response for pre-auth {PreAuthId}: {Action}", preAuthId, request.ActionType);

            // Wire counselling workflow state for Approve / PartiallyApprove
            if (request.ActionType is "Approve" or "PartiallyApprove")
            {
                var targetState = request.ActionType == "Approve" ? "InsuranceApproved" : "InsurancePartiallyApproved";
                _ = Task.Run(async () =>
                {
                    try
                    {
                        await _workflowOrchestration.UpdateWorkflowStageAsync(
                            preAuth.SessionId,
                            new UpdateWorkflowStageRequest { TargetState = targetState, TriggeredBy = "System", TransitionNotes = $"TPA response: {request.ActionType}" },
                            processedByUserId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to advance workflow to {State} for session {SessionId}", targetState, preAuth.SessionId);
                    }
                });
            }

            return ToPreAuthDto(preAuth);
        }

        public async Task DeletePreAuthAsync(Guid preAuthId, Guid tenantId, Guid deletedByUserId)
        {
            var preAuth = await _context.InsurancePreAuthorizations
                .FirstOrDefaultAsync(p => p.Id == preAuthId && p.TenantId == tenantId && p.DeletedAt == null)
                ?? throw new KeyNotFoundException("Pre-authorization not found");

            preAuth.DeletedAt = DateTime.UtcNow;
            preAuth.UpdatedByUserId = deletedByUserId;
            await _context.SaveChangesAsync();
            _logger.LogInformation("Deleted pre-auth {PreAuthId}", preAuthId);
        }

        // Approval Workflow
        public async Task<List<ApprovalWorkflowDto>> GetWorkflowStagesAsync(Guid preAuthId, Guid tenantId)
        {
            var stages = await _context.InsuranceApprovalWorkflows
                .Where(w => w.PreAuthId == preAuthId && w.TenantId == tenantId)
                .OrderBy(w => w.StageSequence)
                .ToListAsync();
            return stages.Select(ToWorkflowDto).ToList();
        }

        public async Task<ApprovalWorkflowDto> ProcessApprovalStageAsync(Guid workflowId, ProcessApprovalRequest request, Guid tenantId, Guid approverUserId)
        {
            var workflow = await _context.InsuranceApprovalWorkflows
                .FirstOrDefaultAsync(w => w.Id == workflowId && w.TenantId == tenantId)
                ?? throw new KeyNotFoundException("Workflow stage not found");

            if (!workflow.IsCurrentStage)
                throw new InvalidOperationException("This is not the current workflow stage");

            workflow.ActionTaken = request.ActionTaken;
            workflow.ActionTimestamp = DateTime.UtcNow;
            workflow.ApproverUserId = approverUserId;
            workflow.Comments = request.Comments;
            workflow.DocumentsUploaded = request.DocumentsUploaded;
            workflow.Completed = request.ActionTaken == "Approved";
            workflow.IsCurrentStage = false;

            // Update pre-auth status
            var preAuth = await _context.InsurancePreAuthorizations.FindAsync(workflow.PreAuthId);
            if (preAuth != null && request.ActionTaken == "Approved")
            {
                if (workflow.StageName == "InsuranceDeptReview")
                    preAuth.Status = "InsuranceDeptReviewed";
                else if (workflow.StageName == "PaymentDeptReview")
                    preAuth.Status = "PaymentDeptReviewed";

                // Move to next stage
                var nextStage = await _context.InsuranceApprovalWorkflows
                    .Where(w => w.PreAuthId == workflow.PreAuthId && w.StageSequence == workflow.StageSequence + 1)
                    .FirstOrDefaultAsync();
                if (nextStage != null) nextStage.IsCurrentStage = true;
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("Processed workflow stage {WorkflowId}: {Action}", workflowId, request.ActionTaken);
            return ToWorkflowDto(workflow);
        }

        // Insurance Documents
        public async Task<List<InsuranceDocumentDto>> GetPreAuthDocumentsAsync(Guid preAuthId, Guid tenantId)
        {
            var documents = await _context.InsuranceDocuments
                .Where(d => d.PreAuthId == preAuthId && d.TenantId == tenantId && d.DeletedAt == null)
                .OrderByDescending(d => d.UploadedAt)
                .ToListAsync();
            return documents.Select(ToDocumentDto).ToList();
        }

        public async Task<InsuranceDocumentDto> UploadDocumentAsync(UploadInsuranceDocumentRequest request, Guid tenantId, Guid uploadedByUserId)
        {
            var document = new InsuranceDocument
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PreAuthId = request.PreAuthId,
                DocumentType = request.DocumentType,
                DocumentName = request.DocumentName,
                FileUrl = request.FileUrl,
                FileSizeBytes = request.FileSizeBytes,
                MimeType = request.MimeType,
                UploadedByUserId = uploadedByUserId,
                UploadedAt = DateTime.UtcNow,
                Notes = request.Notes,
                CreatedAt = DateTime.UtcNow
            };

            _context.InsuranceDocuments.Add(document);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Uploaded insurance document {DocumentId} for pre-auth {PreAuthId}", document.Id, request.PreAuthId);
            return ToDocumentDto(document);
        }

        public async Task<InsuranceDocumentDto> VerifyDocumentAsync(Guid documentId, Guid tenantId, Guid verifiedByUserId)
        {
            var document = await _context.InsuranceDocuments
                .FirstOrDefaultAsync(d => d.Id == documentId && d.TenantId == tenantId && d.DeletedAt == null)
                ?? throw new KeyNotFoundException("Document not found");

            document.IsVerified = true;
            document.VerifiedByUserId = verifiedByUserId;
            document.VerifiedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            _logger.LogInformation("Verified insurance document {DocumentId}", documentId);
            return ToDocumentDto(document);
        }

        public async Task DeleteDocumentAsync(Guid documentId, Guid tenantId)
        {
            var document = await _context.InsuranceDocuments
                .FirstOrDefaultAsync(d => d.Id == documentId && d.TenantId == tenantId && d.DeletedAt == null)
                ?? throw new KeyNotFoundException("Document not found");

            document.DeletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            _logger.LogInformation("Deleted insurance document {DocumentId}", documentId);
        }

        // TPA Communication
        public async Task<List<TPACommunicationDto>> GetTPACommunicationsAsync(Guid preAuthId, Guid tenantId)
        {
            var communications = await _context.TPACommunicationLogs
                .Where(c => c.PreAuthId == preAuthId && c.TenantId == tenantId)
                .OrderByDescending(c => c.CommunicationDate)
                .ToListAsync();
            return communications.Select(ToCommunicationDto).ToList();
        }

        public async Task<TPACommunicationDto> LogCommunicationAsync(LogTPACommunicationRequest request, Guid tenantId, Guid loggedByUserId)
        {
            var communication = new TPACommunicationLog
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PreAuthId = request.PreAuthId,
                CommunicationDate = DateTime.UtcNow,
                CommunicationType = request.CommunicationType,
                Direction = request.Direction,
                HospitalContactUserId = loggedByUserId,
                TPAContactName = request.TPAContactName,
                TPAContactPhone = request.TPAContactPhone,
                TPAContactEmail = request.TPAContactEmail,
                Subject = request.Subject,
                Message = request.Message,
                RequiresResponse = request.RequiresResponse,
                AttachmentsUrls = request.AttachmentsUrls,
                FollowUpRequired = request.FollowUpRequired,
                FollowUpDate = request.FollowUpDate,
                CreatedAt = DateTime.UtcNow
            };

            _context.TPACommunicationLogs.Add(communication);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Logged TPA communication {CommunicationId} for pre-auth {PreAuthId}", communication.Id, request.PreAuthId);
            return ToCommunicationDto(communication);
        }

        public async Task<TPACommunicationDto> RecordResponseAsync(Guid communicationId, string responseText, Guid tenantId)
        {
            var communication = await _context.TPACommunicationLogs
                .FirstOrDefaultAsync(c => c.Id == communicationId && c.TenantId == tenantId)
                ?? throw new KeyNotFoundException("Communication log not found");

            communication.ResponseReceived = true;
            communication.ResponseDate = DateTime.UtcNow;
            communication.ResponseText = responseText;

            await _context.SaveChangesAsync();
            _logger.LogInformation("Recorded TPA response for communication {CommunicationId}", communicationId);
            return ToCommunicationDto(communication);
        }

        // Helper methods
        private InsurancePreAuthDto ToPreAuthDto(InsurancePreAuthorization preAuth) => new InsurancePreAuthDto
        {
            Id = preAuth.Id,
            SessionId = preAuth.SessionId,
            PatientId = preAuth.PatientId,
            PreAuthNumber = preAuth.PreAuthNumber,
            InsuranceType = preAuth.InsuranceType,
            InsuranceProvider = preAuth.InsuranceProvider,
            TPAName = preAuth.TPAName,
            PolicyNumber = preAuth.PolicyNumber,
            PolicyHolderName = preAuth.PolicyHolderName,
            SurgeryType = preAuth.SurgeryType,
            PlannedProcedure = preAuth.PlannedProcedure,
            DiagnosisCode = preAuth.DiagnosisCode,
            ProcedureCode = preAuth.ProcedureCode,
            EyeOperated = preAuth.EyeOperated,
            RequestedAmount = preAuth.RequestedAmount,
            ApprovedAmount = preAuth.ApprovedAmount,
            CopayAmount = preAuth.CopayAmount,
            DeductibleAmount = preAuth.DeductibleAmount,
            PatientPayable = preAuth.PatientPayable,
            PackageId = preAuth.PackageId,
            ItemizedBreakdown = preAuth.ItemizedBreakdown,
            Status = preAuth.Status,
            SubmittedToTPAAt = preAuth.SubmittedToTPAAt,
            ExpectedApprovalDate = preAuth.ExpectedApprovalDate,
            ActualApprovalDate = preAuth.ActualApprovalDate,
            TPAApprovalNumber = preAuth.TPAApprovalNumber,
            TPAApprovalLetterUrl = preAuth.TPAApprovalLetterUrl,
            TPAResponseNotes = preAuth.TPAResponseNotes,
            TPADenialReason = preAuth.TPADenialReason,
            QueriesRaised = preAuth.QueriesRaised,
            QueryResponses = preAuth.QueryResponses,
            ValidFrom = preAuth.ValidFrom,
            ValidUntil = preAuth.ValidUntil
        };

        private ApprovalWorkflowDto ToWorkflowDto(InsuranceApprovalWorkflow workflow) => new ApprovalWorkflowDto
        {
            Id = workflow.Id,
            PreAuthId = workflow.PreAuthId,
            StageName = workflow.StageName,
            StageSequence = workflow.StageSequence,
            ApproverUserId = workflow.ApproverUserId,
            ApproverRole = workflow.ApproverRole,
            ActionTaken = workflow.ActionTaken,
            ActionTimestamp = workflow.ActionTimestamp,
            Comments = workflow.Comments,
            DocumentsUploaded = workflow.DocumentsUploaded,
            IsCurrentStage = workflow.IsCurrentStage,
            Completed = workflow.Completed
        };

        private InsuranceDocumentDto ToDocumentDto(InsuranceDocument document) => new InsuranceDocumentDto
        {
            Id = document.Id,
            PreAuthId = document.PreAuthId,
            DocumentType = document.DocumentType,
            DocumentName = document.DocumentName,
            FileUrl = document.FileUrl,
            FileSizeBytes = document.FileSizeBytes,
            MimeType = document.MimeType,
            UploadedAt = document.UploadedAt,
            IsVerified = document.IsVerified,
            Notes = document.Notes
        };

        private TPACommunicationDto ToCommunicationDto(TPACommunicationLog communication) => new TPACommunicationDto
        {
            Id = communication.Id,
            PreAuthId = communication.PreAuthId,
            CommunicationDate = communication.CommunicationDate,
            CommunicationType = communication.CommunicationType,
            Direction = communication.Direction,
            TPAContactName = communication.TPAContactName,
            TPAContactPhone = communication.TPAContactPhone,
            TPAContactEmail = communication.TPAContactEmail,
            Subject = communication.Subject,
            Message = communication.Message,
            RequiresResponse = communication.RequiresResponse,
            ResponseReceived = communication.ResponseReceived,
            ResponseDate = communication.ResponseDate,
            ResponseText = communication.ResponseText,
            AttachmentsUrls = communication.AttachmentsUrls,
            FollowUpRequired = communication.FollowUpRequired,
            FollowUpDate = communication.FollowUpDate
        };

        // ── CCMS Support ─────────────────────────────────────────────────────────

        public async Task<List<SessionSummaryDto>> GetSessionSummariesBatchAsync(
            List<Guid> sessionIds, Guid tenantId)
        {
            // Pull sessions from counselling_sessions table (through the shared AppDbContext)
            var sessions = await _context.CounselingSession
                .Where(s => sessionIds.Contains(s.Id) && s.TenantId == tenantId && s.DeletedAt == null)
                .Select(s => new
                {
                    s.Id,
                    s.CounselorId,
                    PatientType = s.PatientType,
                    Procedure   = s.RecommendedSurgery,
                    s.CreatedAt,
                })
                .ToListAsync();

            return sessions.Select(s => new SessionSummaryDto(
                SessionId:     s.Id,
                PatientName:   null,  // resolved client-side or joined separately
                PatientMobile: null,
                ProcedureName: s.Procedure,
                CounsellorName: null,
                PaymentType:   s.PatientType,
                CounselledAt:  s.CreatedAt
            )).ToList();
        }

        public async Task<UnderwritingProfileDto?> GetUnderwritingProfileAsync(
            Guid patientId, Guid tenantId)
        {
            var patient = await _context.Patients
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == patientId && p.TenantId == tenantId && p.DeletedAt == null);

            if (patient is null) return null;

            var conditions = new List<UnderwritingConditionDto>();

            if (!string.IsNullOrWhiteSpace(patient.ChronicConditions))
            {
                try
                {
                    // ChronicConditions is stored as a JSON array of strings or a comma-separated string
                    List<string>? parsed = null;
                    try { parsed = System.Text.Json.JsonSerializer.Deserialize<List<string>>(patient.ChronicConditions); }
                    catch { parsed = patient.ChronicConditions.Split(',').Select(s => s.Trim()).ToList(); }

                    if (parsed != null)
                        conditions.AddRange(parsed
                            .Where(c => !string.IsNullOrWhiteSpace(c))
                            .Distinct()
                            .Select(c => new UnderwritingConditionDto(
                                ConditionName: c, Icd10Code: null,
                                Severity: "moderate", IsPreExisting: true, Notes: null)));
                }
                catch { /* ignore malformed */ }
            }

            return new UnderwritingProfileDto(
                PatientId:   patientId,
                Conditions:  conditions,
                Notes:       patient.FamilyMedicalHistory,
                LastUpdated: patient.UpdatedAt
            );
        }

        // ── Chronic conditions CRUD ───────────────────────────────────────────────

        public async Task<ChronicConditionsDto> GetChronicConditionsAsync(
            Guid patientId, Guid tenantId)
        {
            var patient = await _context.Patients.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == patientId && p.TenantId == tenantId && p.DeletedAt == null);

            if (patient is null)
                return new ChronicConditionsDto(patientId, new List<UnderwritingConditionDto>(), null, null);

            var conditions = ParseChronicConditions(patient.ChronicConditions);
            return new ChronicConditionsDto(
                PatientId:   patientId,
                Conditions:  conditions,
                Notes:       patient.FamilyMedicalHistory,
                LastUpdated: patient.UpdatedAt);
        }

        public async Task UpsertChronicConditionsAsync(
            Guid patientId, Guid tenantId, UpsertChronicConditionsRequest request)
        {
            var patient = await _context.Patients
                .FirstOrDefaultAsync(p => p.Id == patientId && p.TenantId == tenantId && p.DeletedAt == null);

            if (patient is null) return;

            // Serialize conditions list back to JSON array of condition names
            var names = request.Conditions
                .Where(c => !string.IsNullOrWhiteSpace(c.ConditionName))
                .Select(c => c.ConditionName.Trim())
                .Distinct()
                .ToList();

            patient.ChronicConditions     = System.Text.Json.JsonSerializer.Serialize(names);
            if (request.Notes is not null)
                patient.FamilyMedicalHistory = request.Notes;
            patient.UpdatedAt             = DateTime.UtcNow;

            await _context.SaveChangesAsync();
        }

        // ── patient_insurance sync from CCMS ─────────────────────────────────────

        public async Task SyncPatientInsuranceFromCcmsAsync(
            Guid patientId, PatientInsuranceSyncRequest request)
        {
            // Upsert the primary policy row in patient_insurance (best-effort, CCMS is SoR)
            var existing = await _context.PatientInsurances
                .Where(pi => pi.PatientId == patientId && pi.PolicyType == "primary" && pi.DeletedAt == null)
                .OrderByDescending(pi => pi.CreatedAt)
                .FirstOrDefaultAsync();

            if (existing is not null)
            {
                existing.PolicyNumber      = request.PolicyNumber;
                existing.ProviderName      = request.ProviderName;
                existing.SubscriberName    = request.InsuredName;
                existing.SubscriberRelation = request.Relationship ?? existing.SubscriberRelation;
                existing.ContactPhone      = request.ContactPhone;
                existing.StartDate         = DateTime.TryParse(request.StartDate, out var sd) ? sd : existing.StartDate;
                existing.EndDate           = DateTime.TryParse(request.EndDate,   out var ed) ? ed : existing.EndDate;
                existing.UpdatedAt         = DateTime.UtcNow;
                existing.Status            = "active";
            }
            else
            {
                _context.PatientInsurances.Add(new AuthService.Models.Domain.PatientInsurance
                {
                    Id              = Guid.NewGuid(),
                    TenantId        = patientId,   // set when caller supplies tenantId (best-effort)
                    PatientId       = patientId,
                    PolicyNumber    = request.PolicyNumber,
                    ProviderName    = request.ProviderName,
                    SubscriberName  = request.InsuredName,
                    SubscriberRelation = request.Relationship ?? "self",
                    ContactPhone    = request.ContactPhone,
                    PolicyType      = "primary",
                    StartDate       = DateTime.TryParse(request.StartDate, out var sd2) ? sd2 : null,
                    EndDate         = DateTime.TryParse(request.EndDate,   out var ed2) ? ed2 : null,
                    Status          = "active",
                    PreAuthRequired = true,
                    CreatedAt       = DateTime.UtcNow,
                    UpdatedAt       = DateTime.UtcNow,
                });
            }

            await _context.SaveChangesAsync();
        }

        // ── Private helpers ──────────────────────────────────────────────────────

        private static List<UnderwritingConditionDto> ParseChronicConditions(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return new List<UnderwritingConditionDto>();
            try
            {
                List<string>? names = null;
                try { names = System.Text.Json.JsonSerializer.Deserialize<List<string>>(raw); }
                catch { names = raw.Split(',').Select(s => s.Trim()).ToList(); }

                return (names ?? new List<string>())
                    .Where(c => !string.IsNullOrWhiteSpace(c))
                    .Distinct()
                    .Select(c => new UnderwritingConditionDto(
                        ConditionName: c, Icd10Code: null,
                        Severity: "moderate", IsPreExisting: true, Notes: null))
                    .ToList();
            }
            catch { return new List<UnderwritingConditionDto>(); }
        }
    }
}
