using CcmsApi.Data;
using CcmsApi.Models.Domain;
using CcmsApi.Models.Dtos;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Services;

/// <summary>
/// Pre-authorization lifecycle: generate, send, receive approval/rejection.
/// </summary>
public class PreAuthorizationService
{
    private readonly CcmsDbContext _db;
    private readonly IWorkflowEngine _workflow;
    private readonly ClarificationService _clarification;
    private readonly AuthServiceClient _authClient;
    private readonly ILogger<PreAuthorizationService> _log;

    public PreAuthorizationService(
        CcmsDbContext db,
        IWorkflowEngine workflow,
        ClarificationService clarification,
        AuthServiceClient authClient,
        ILogger<PreAuthorizationService> log)
    {
        _db            = db;
        _workflow      = workflow;
        _clarification = clarification;
        _authClient    = authClient;
        _log           = log;
    }

    // ── Mapping ───────────────────────────────────────────────────────────────
    internal static AuthorizationSummaryDto ToDto(CcmsCoverageAuthorization a)
    {
        var requested = a.RequestedAmount > 0 ? a.RequestedAmount : a.EstimatedTotalCost;
        var estimated = a.EstimatedTotalCost > 0 ? a.EstimatedTotalCost : requested;
        return new(
            a.Id, a.CoverageCase_Id, a.AuthorizationType,
            a.PreAuthNumber, requested, a.ApprovedAmount,
            a.RoomClassRequested, a.RoomClassApproved,
            a.ValidFrom, a.ValidTo, a.SubmittedAt, a.ReceivedAt,
            a.TpaReferenceNumber, a.RejectionReason, a.CreatedAt,
            a.Status, a.ProcessStatus,
            a.ClinicalSummary, a.TreatingDoctorName, a.TreatingDoctorReg,
            a.AdmissionDate, a.ExpectedDischargeDate, a.LengthOfStayDays,
            a.RoomTypeRequested,
            estimated, a.CopayAmount, a.DeductibleAmount,
            a.ServiceTaxAmount, a.NetPayableByInsurer, a.NetPayableByPatient);
    }

    // ── Generate Pre-Auth ────────────────────────────────────────────────────

    public async Task<AuthorizationSummaryDto> GeneratePreAuthAsync(
        Guid coverageCaseId, Guid actorUserId,
        GeneratePreAuthRequest req, CancellationToken ct = default)
    {
        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == coverageCaseId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {coverageCaseId} not found.");

        var hasPrimaryPolicy = await _db.VisitInsurancePolicies
            .AnyAsync(p => p.CoverageCase_Id == coverageCaseId && p.IsPrimary && p.DeletedAt == null, ct);
        if (!hasPrimaryPolicy)
            throw new InvalidOperationException(
                "Cannot generate pre-auth: capture a primary visit policy first (Counsellor Coverage tab or visit policies).");

        var requestedAmount = req.RequestedAmount > 0
            ? req.RequestedAmount
            : req.EstimatedTotalCost;
        var estimatedTotal = req.EstimatedTotalCost > 0 ? req.EstimatedTotalCost : requestedAmount;

        var auth = new CcmsCoverageAuthorization
        {
            Id                       = Guid.NewGuid(),
            TenantId                 = coverageCase.TenantId,
            CoverageCase_Id          = coverageCaseId,
            AuthorizationType        = "preauth",
            RequestedAmount          = requestedAmount,
            RoomClassRequested       = req.RoomClassRequested,
            RoomTypeRequested        = req.RoomTypeRequested ?? req.RoomClassRequested,
            DiagnosisJson            = req.DiagnosisJson,
            ProceduresJson           = req.ProceduresJson,
            ClinicalSummary          = req.ClinicalSummary,
            TreatingDoctorName       = req.TreatingDoctorName,
            TreatingDoctorReg        = req.TreatingDoctorReg,
            AdmissionDate            = req.AdmissionDate,
            ExpectedDischargeDate    = req.ExpectedDischargeDate,
            LengthOfStayDays         = req.LengthOfStayDays,
            EstimatedTotalCost       = estimatedTotal,
            CopayAmount              = req.CopayAmount,
            DeductibleAmount         = req.DeductibleAmount,
            ServiceTaxAmount         = req.ServiceTaxAmount,
            NetPayableByInsurer       = req.NetPayableByInsurer > 0 ? req.NetPayableByInsurer : estimatedTotal,
            NetPayableByPatient       = req.NetPayableByPatient,
            ProcessStatus            = "pending",
            ProcessStatusUpdatedAt   = DateTime.UtcNow,
            LegacyPreauthId          = coverageCase.LegacyPreauthId,
            SessionPreauthId         = coverageCase.SessionPreauthId,
            CreatedAt                = DateTime.UtcNow,
            UpdatedAt                = DateTime.UtcNow,
            CreatedByUserId          = actorUserId,
            UpdatedByUserId          = actorUserId,
            Status                   = "active"
        };

        _db.CoverageAuthorizations.Add(auth);

        // Transition workflow
        if (coverageCase.WorkflowInstanceId.HasValue)
        {
            await _workflow.FireAsync(
                coverageCase.WorkflowInstanceId.Value,
                "GENERATE_PREAUTH", actorUserId,
                "Pre-auth generated", ct);
        }

        // Update case state
        coverageCase.CurrentState    = "PREAUTH_GENERATED";
        coverageCase.UpdatedAt       = DateTime.UtcNow;
        coverageCase.UpdatedByUserId = actorUserId;
        coverageCase.RowVersion      += 1;

        await _db.SaveChangesAsync(ct);
        _log.LogInformation("Pre-auth generated for case {CaseId}", coverageCaseId);
        return ToDto(auth);
    }

    // ── Mark as Sent ─────────────────────────────────────────────────────────

    public async Task<AuthorizationSummaryDto> MarkSentAsync(
        Guid authorizationId, Guid actorUserId,
        string? tpaReferenceNumber = null, CancellationToken ct = default)
    {
        var auth = await _db.CoverageAuthorizations
            .FirstOrDefaultAsync(a => a.Id == authorizationId && a.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Authorization {authorizationId} not found.");

        var alreadySubmitted = auth.SubmittedAt.HasValue;

        CcmsCoverageCase? coverageCase = null;
        if (!alreadySubmitted)
        {
            coverageCase = await _db.CoverageCases
                .FirstOrDefaultAsync(c => c.Id == auth.CoverageCase_Id && c.DeletedAt == null, ct)
                ?? throw new KeyNotFoundException($"Coverage case {auth.CoverageCase_Id} not found.");

            await EnsureRequiredPreAuthDocumentsAsync(coverageCase, ct);

            auth.SubmittedAt = DateTime.UtcNow;
        }

        if (!string.IsNullOrWhiteSpace(tpaReferenceNumber))
        {
            auth.TpaReferenceNumber = tpaReferenceNumber;
        }

        auth.UpdatedAt          = DateTime.UtcNow;
        auth.UpdatedByUserId    = actorUserId;
        auth.RowVersion         += 1;

        if (!alreadySubmitted && coverageCase is not null && coverageCase.WorkflowInstanceId.HasValue)
        {
            await _workflow.FireAsync(
                coverageCase.WorkflowInstanceId.Value,
                "SEND_PREAUTH", actorUserId, null, ct);

            // Then auto-transition to WAITING_APPROVAL
            await _workflow.FireAsync(
                coverageCase.WorkflowInstanceId.Value,
                "WAIT_RESPONSE", actorUserId, null, ct);

            coverageCase.CurrentState    = "WAITING_APPROVAL";
            coverageCase.UpdatedAt       = DateTime.UtcNow;
            coverageCase.UpdatedByUserId = actorUserId;
            coverageCase.RowVersion      += 1;
        }

        await _db.SaveChangesAsync(ct);
        return ToDto(auth);
    }

    internal async Task EnsureRequiredPreAuthDocumentsAsync(
        CcmsCoverageCase coverageCase, CancellationToken ct)
    {
        var requirements = await _db.DocumentRequirements
            .AsNoTracking()
            .Where(d => d.TenantId == coverageCase.TenantId && d.DeletedAt == null && d.IsRequired)
            .ToListAsync(ct);

        var applicable = PreAuthDocumentGate.ApplicablePreAuthRequirements(requirements, coverageCase);
        if (applicable.Count == 0)
            return;

        var documents = await _db.Documents
            .AsNoTracking()
            .Where(d => d.CoverageCase_Id == coverageCase.Id && d.DeletedAt == null)
            .ToListAsync(ct);

        var missing = PreAuthDocumentGate.MissingRequired(applicable, documents);
        if (missing.Count > 0)
            throw new InvalidOperationException(PreAuthDocumentGate.FormatBlockMessage(missing));
    }

    // ── Record TPA Response ──────────────────────────────────────────────────

    public async Task<AuthorizationSummaryDto> RecordTpaResponseAsync(
        Guid authorizationId, Guid actorUserId,
        RecordTpaResponseRequest req, CancellationToken ct = default)
    {
        var auth = await _db.CoverageAuthorizations
            .FirstOrDefaultAsync(a => a.Id == authorizationId && a.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Authorization {authorizationId} not found.");

        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == auth.CoverageCase_Id && c.DeletedAt == null, ct)
            ?? throw new InvalidOperationException("Coverage case not found.");

        if (auth.ReceivedAt.HasValue && !req.ForceAmend)
            throw new InvalidOperationException(
                "TPA response was already recorded for this authorization. Use Record Response only once, or contact an administrator to amend.");

        auth.ReceivedAt          = DateTime.UtcNow;
        auth.TpaReferenceNumber  = req.TpaReferenceNumber ?? auth.TpaReferenceNumber;
        auth.RejectionReason     = req.RejectionReason;
        auth.UpdatedAt           = DateTime.UtcNow;
        auth.UpdatedByUserId     = actorUserId;
        auth.RowVersion          += 1;

        // Map decision to workflow event
        string triggerEvent;
        string newState;
        switch (req.Decision.ToUpperInvariant())
        {
            case "APPROVED":
                auth.ApprovedAmount   = req.ApprovedAmount;
                auth.RoomClassApproved = req.RoomClassApproved;
                auth.ValidFrom        = req.ValidFrom ?? DateTime.UtcNow;
                auth.ValidTo          = req.ValidTo ?? DateTime.UtcNow.AddDays(30);
                auth.PreAuthNumber    = req.PreAuthNumber;
                triggerEvent          = "RECEIVE_APPROVAL";
                newState              = "APPROVED";
                // Update case
                coverageCase.ApprovedAmount   = req.ApprovedAmount;
                coverageCase.RoomClassApproved = req.RoomClassApproved;
                coverageCase.PreAuthNumber    = req.PreAuthNumber;
                coverageCase.PreAuthExpiry    = req.ValidTo ?? DateTime.UtcNow.AddDays(30);
                break;

            case "PARTIAL":
                auth.ApprovedAmount   = req.ApprovedAmount;
                auth.RoomClassApproved = req.RoomClassApproved;
                auth.ValidFrom        = req.ValidFrom ?? DateTime.UtcNow;
                auth.ValidTo          = req.ValidTo ?? DateTime.UtcNow.AddDays(30);
                auth.PreAuthNumber    = req.PreAuthNumber;
                triggerEvent          = "RECEIVE_PARTIAL";
                newState              = "PARTIAL_APPROVAL";
                coverageCase.ApprovedAmount   = req.ApprovedAmount;
                coverageCase.RoomClassApproved = req.RoomClassApproved;
                coverageCase.PreAuthNumber    = req.PreAuthNumber;
                coverageCase.PreAuthExpiry    = req.ValidTo ?? DateTime.UtcNow.AddDays(30);
                break;

            case "REJECTED":
                triggerEvent = "RECEIVE_REJECTION";
                newState     = "REJECTED";
                break;

            case "CLARIFICATION":
                triggerEvent = "REQUEST_CLARIFICATION";
                newState     = "CLARIFICATION_REQUIRED";
                break;

            default:
                throw new ArgumentException($"Unknown decision: {req.Decision}");
        }

        // Record approval event (append-only)
        var approvalEvent = new CcmsApprovalEvent
        {
            Id                  = Guid.NewGuid(),
            TenantId            = coverageCase.TenantId,
            CoverageCase_Id     = coverageCase.Id,
            AuthorizationId     = auth.Id,
            EventType           = $"TPA_RESPONSE_{req.Decision.ToUpperInvariant()}",
            EventSource         = req.EventSource ?? "manual",
            ApprovalStatus      = req.Decision.ToUpperInvariant(),
            ApprovedAmount      = req.ApprovedAmount,
            RejectionReason     = req.RejectionReason,
            TpaReferenceNumber  = req.TpaReferenceNumber,
            RecordedByUserId    = actorUserId,
            RecordedAt          = DateTime.UtcNow,
            CreatedAt           = DateTime.UtcNow,
            CreatedByUserId     = actorUserId,
            Status              = "active"
        };
        _db.ApprovalEvents.Add(approvalEvent);

        // Fire workflow transition
        if (coverageCase.WorkflowInstanceId.HasValue)
        {
            await _workflow.FireAsync(
                coverageCase.WorkflowInstanceId.Value,
                triggerEvent, actorUserId,
                $"TPA decision: {req.Decision}", ct);
        }

        coverageCase.CurrentState    = newState;
        coverageCase.UpdatedAt       = DateTime.UtcNow;
        coverageCase.UpdatedByUserId = actorUserId;
        coverageCase.RowVersion      += 1;

        await _db.SaveChangesAsync(ct);

        var decision = req.Decision.ToUpperInvariant();
        if (decision is "APPROVED" or "PARTIAL" or "REJECTED")
        {
            var type = decision switch
            {
                "APPROVED" => "ccms.preauth.approved",
                "PARTIAL"  => "ccms.preauth.partially_approved",
                _          => "ccms.preauth.rejected",
            };
            var msg = decision switch
            {
                "APPROVED" => "Pre-authorization approved",
                "PARTIAL"  => "Pre-authorization partially approved",
                _          => "Pre-authorization rejected",
            };
            await _authClient.NotifyDepartmentAsync(
                coverageCase.TenantId,
                coverageCase.BranchId,
                "CCMS",
                type,
                msg,
                $"Case {coverageCase.CaseNumber} · Auth {authorizationId:N} · Amount {req.ApprovedAmount}");
            await _authClient.NotifyDepartmentAsync(
                coverageCase.TenantId,
                coverageCase.BranchId,
                "WARD",
                type,
                msg,
                $"Case {coverageCase.CaseNumber} · Journey {coverageCase.JourneyId}");
        }
        else if (decision is "CLARIFICATION" || decision.Contains("DOCUMENT", StringComparison.OrdinalIgnoreCase))
        {
            await _authClient.NotifyDepartmentAsync(
                coverageCase.TenantId,
                coverageCase.BranchId,
                "CCMS",
                "ccms.preauth.additional_docs_required",
                "Additional documents required",
                $"Case {coverageCase.CaseNumber} · Auth {authorizationId:N}");
            await _authClient.NotifyDepartmentAsync(
                coverageCase.TenantId,
                coverageCase.BranchId,
                "COUNSELLING",
                "ccms.preauth.additional_docs_required",
                "Additional documents required",
                $"Case {coverageCase.CaseNumber} · Session {coverageCase.SessionId}");
        }

        if (req.Decision.Equals("CLARIFICATION", StringComparison.OrdinalIgnoreCase))
        {
            var queryText = req.ClarificationQuery ?? req.RejectionReason;
            if (!string.IsNullOrWhiteSpace(queryText))
            {
                await _clarification.AddQueryAsync(
                    authorizationId, actorUserId,
                    new AddClarificationQueryRequest(queryText.Trim()), ct);
            }
        }

        _log.LogInformation("TPA response recorded for auth {AuthId}: {Decision}", authorizationId, req.Decision);
        return ToDto(auth);
    }

    // ── Get Authorizations for a Case ────────────────────────────────────────

    public async Task<List<AuthorizationSummaryDto>> GetByCaseIdAsync(
        Guid coverageCaseId, CancellationToken ct = default)
        => (await _db.CoverageAuthorizations.AsNoTracking()
            .Where(a => a.CoverageCase_Id == coverageCaseId && a.DeletedAt == null)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync(ct))
            .Select(ToDto)
            .ToList();

    /// <summary>
    /// Patient-id authorization collection. Tenant and soft-delete follow the coverage-case
    /// patient read: JWT tenant on both the case and the authorization. No branch predicate.
    /// </summary>
    public async Task<PagedResult<AuthorizationSummaryDto>> ListByPatientIdAsync(
        Guid tenantId, Guid patientId, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var (pageNumber, size) = CcmsPatientListPaging.Normalize(page, pageSize);
        var filtered =
            from authorization in _db.CoverageAuthorizations.AsNoTracking()
            join coverageCase in _db.CoverageCases.AsNoTracking()
                on authorization.CoverageCase_Id equals coverageCase.Id
            where authorization.TenantId == tenantId
               && coverageCase.TenantId == tenantId
               && coverageCase.PatientId == patientId
               && authorization.DeletedAt == null
               && coverageCase.DeletedAt == null
            select authorization;

        var total = await filtered.CountAsync(ct);
        var rows = await filtered
            .OrderByDescending(authorization => authorization.CreatedAt)
            .ThenByDescending(authorization => authorization.Id)
            .Skip((pageNumber - 1) * size)
            .Take(size)
            .ToListAsync(ct);

        return new PagedResult<AuthorizationSummaryDto>(
            rows.Select(ToDto).ToList(), total, pageNumber, size);
    }

    // ── Update process_status ────────────────────────────────────────────────

    public async Task<AuthorizationSummaryDto> UpdateProcessStatusAsync(
        Guid authorizationId, Guid actorUserId, string processStatus,
        CancellationToken ct = default)
    {
        var auth = await _db.CoverageAuthorizations
            .FirstOrDefaultAsync(a => a.Id == authorizationId && a.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Authorization {authorizationId} not found.");

        auth.ProcessStatus          = processStatus;
        auth.ProcessStatusUpdatedAt = DateTime.UtcNow;
        auth.UpdatedAt              = DateTime.UtcNow;
        auth.UpdatedByUserId        = actorUserId;
        auth.RowVersion            += 1;

        // Mirror to the coverage case for quick filtering
        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == auth.CoverageCase_Id && c.DeletedAt == null, ct);
        if (coverageCase is not null)
        {
            coverageCase.ProcessStatus          = processStatus;
            coverageCase.ProcessStatusUpdatedAt = DateTime.UtcNow;
            coverageCase.UpdatedAt              = DateTime.UtcNow;
            coverageCase.UpdatedByUserId        = actorUserId;
        }

        await _db.SaveChangesAsync(ct);
        return ToDto(auth);
    }

    // ── Authorization Queue (pending TPA response) ────────────────────────────

    public async Task<List<AuthQueueItem>> GetQueueAsync(CancellationToken ct = default)
    {
        var auths = await _db.CoverageAuthorizations
            .AsNoTracking()
            .Where(a => a.DeletedAt == null && a.ReceivedAt == null)
            .OrderBy(a => a.CreatedAt)
            .Take(200)
            .ToListAsync(ct);

        var caseIds = auths.Select(a => a.CoverageCase_Id).Distinct().ToList();
        var casesById = await _db.CoverageCases
            .AsNoTracking()
            .Where(c => caseIds.Contains(c.Id) && c.DeletedAt == null)
            .ToDictionaryAsync(c => c.Id, ct);

        var now = DateTime.UtcNow;
        return auths.Select(a =>
        {
            casesById.TryGetValue(a.CoverageCase_Id, out var c);
            return new AuthQueueItem(
                PreAuthId:       a.Id,
                CaseId:          a.CoverageCase_Id,
                CaseNumber:      c?.CaseNumber ?? "–",
                PatientId:       c?.PatientId ?? Guid.Empty,
                Status:          a.Status,
                RequestedAmount: a.RequestedAmount,
                AgeInHours:      (int)(now - a.CreatedAt).TotalHours
            );
        }).ToList();
    }
}

// ── Request DTOs ─────────────────────────────────────────────────────────────

public record GeneratePreAuthRequest(
    decimal   RequestedAmount,
    string?   RoomClassRequested   = null,
    string?   RoomTypeRequested    = null,
    string?   DiagnosisJson        = null,
    string?   ProceduresJson       = null,
    // Migration 124: clinical
    string?   ClinicalSummary      = null,
    string?   TreatingDoctorName   = null,
    string?   TreatingDoctorReg    = null,
    DateOnly? AdmissionDate        = null,
    DateOnly? ExpectedDischargeDate = null,
    int?      LengthOfStayDays     = null,
    // Migration 124: financial
    decimal   EstimatedTotalCost   = 0,
    decimal   CopayAmount          = 0,
    decimal   DeductibleAmount     = 0,
    decimal   ServiceTaxAmount     = 0,
    decimal   NetPayableByInsurer   = 0,
    decimal   NetPayableByPatient   = 0
);

public record RecordTpaResponseRequest(
    string   Decision,           // APPROVED|PARTIAL|REJECTED|CLARIFICATION
    decimal  ApprovedAmount,
    string?  RoomClassApproved,
    string?  PreAuthNumber,
    DateTime? ValidFrom,
    DateTime? ValidTo,
    string?  TpaReferenceNumber,
    string?  RejectionReason,
    string?  EventSource,
    string?  ClarificationQuery = null,
    bool     ForceAmend         = false
);

public record AuthQueueItem(
    Guid    PreAuthId,
    Guid    CaseId,
    string  CaseNumber,
    Guid    PatientId,
    string  Status,
    decimal RequestedAmount,
    int     AgeInHours
);
