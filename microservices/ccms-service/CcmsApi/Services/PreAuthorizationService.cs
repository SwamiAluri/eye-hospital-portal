using CcmsApi.Data;
using CcmsApi.Models.Domain;
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
    private readonly ILogger<PreAuthorizationService> _log;

    public PreAuthorizationService(
        CcmsDbContext db,
        IWorkflowEngine workflow,
        ILogger<PreAuthorizationService> log)
    {
        _db       = db;
        _workflow = workflow;
        _log      = log;
    }

    // ── Generate Pre-Auth ────────────────────────────────────────────────────

    public async Task<CcmsCoverageAuthorization> GeneratePreAuthAsync(
        Guid coverageCaseId, Guid actorUserId,
        GeneratePreAuthRequest req, CancellationToken ct = default)
    {
        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == coverageCaseId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {coverageCaseId} not found.");

        var auth = new CcmsCoverageAuthorization
        {
            Id                 = Guid.NewGuid(),
            TenantId           = coverageCase.TenantId,
            CoverageCase_Id    = coverageCaseId,
            AuthorizationType  = "preauth",
            RequestedAmount    = req.RequestedAmount,
            RoomClassRequested = req.RoomClassRequested,
            DiagnosisJson      = req.DiagnosisJson,
            ProceduresJson     = req.ProceduresJson,
            LegacyPreauthId    = coverageCase.LegacyPreauthId,
            SessionPreauthId   = coverageCase.SessionPreauthId,
            CreatedAt          = DateTime.UtcNow,
            UpdatedAt          = DateTime.UtcNow,
            CreatedByUserId    = actorUserId,
            UpdatedByUserId    = actorUserId,
            Status             = "active"
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
        return auth;
    }

    // ── Mark as Sent ─────────────────────────────────────────────────────────

    public async Task<CcmsCoverageAuthorization> MarkSentAsync(
        Guid authorizationId, Guid actorUserId,
        string? tpaReferenceNumber = null, CancellationToken ct = default)
    {
        var auth = await _db.CoverageAuthorizations
            .FirstOrDefaultAsync(a => a.Id == authorizationId && a.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Authorization {authorizationId} not found.");

        auth.SubmittedAt        = DateTime.UtcNow;
        auth.TpaReferenceNumber = tpaReferenceNumber;
        auth.UpdatedAt          = DateTime.UtcNow;
        auth.UpdatedByUserId    = actorUserId;
        auth.RowVersion         += 1;

        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == auth.CoverageCase_Id && c.DeletedAt == null, ct);

        if (coverageCase is not null && coverageCase.WorkflowInstanceId.HasValue)
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
        return auth;
    }

    // ── Record TPA Response ──────────────────────────────────────────────────

    public async Task<CcmsCoverageAuthorization> RecordTpaResponseAsync(
        Guid authorizationId, Guid actorUserId,
        RecordTpaResponseRequest req, CancellationToken ct = default)
    {
        var auth = await _db.CoverageAuthorizations
            .FirstOrDefaultAsync(a => a.Id == authorizationId && a.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Authorization {authorizationId} not found.");

        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == auth.CoverageCase_Id && c.DeletedAt == null, ct)
            ?? throw new InvalidOperationException("Coverage case not found.");

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
        _log.LogInformation("TPA response recorded for auth {AuthId}: {Decision}", authorizationId, req.Decision);
        return auth;
    }

    // ── Get Authorizations for a Case ────────────────────────────────────────

    public async Task<List<CcmsCoverageAuthorization>> GetByCaseIdAsync(
        Guid coverageCaseId, CancellationToken ct = default)
        => await _db.CoverageAuthorizations.AsNoTracking()
            .Where(a => a.CoverageCase_Id == coverageCaseId && a.DeletedAt == null)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync(ct);

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
    decimal  RequestedAmount,
    string?  RoomClassRequested,
    string?  DiagnosisJson,
    string?  ProceduresJson
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
    string?  EventSource
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
