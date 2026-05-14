using CcmsApi.Data;
using CcmsApi.Models.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Services;

/// <summary>
/// Records TPA approval/rejection/clarification events (append-only pattern).
/// </summary>
public class ApprovalEventService
{
    private readonly CcmsDbContext _db;
    private readonly IWorkflowEngine _workflow;
    private readonly ILogger<ApprovalEventService> _log;

    public ApprovalEventService(CcmsDbContext db, IWorkflowEngine workflow, ILogger<ApprovalEventService> log)
    {
        _db       = db;
        _workflow = workflow;
        _log      = log;
    }

    public async Task<CcmsApprovalEvent> RecordApprovalAsync(
        Guid coverageCaseId, Guid? authorizationId, Guid actorUserId,
        RecordApprovalRequest req, CancellationToken ct = default)
    {
        var coverageCase = await RequireCaseAsync(coverageCaseId, ct);

        var evt = NewEvent(coverageCase, authorizationId, actorUserId, "TPA_APPROVED", "APPROVED");
        evt.ApprovedAmount       = req.ApprovedAmount;
        evt.TpaReferenceNumber   = req.TpaReferenceNumber;
        evt.ResponsePayloadJson  = req.PayloadJson;
        _db.ApprovalEvents.Add(evt);

        if (coverageCase.WorkflowInstanceId.HasValue)
            await _workflow.FireAsync(coverageCase.WorkflowInstanceId.Value, "RECEIVE_APPROVAL", actorUserId, null, ct);

        coverageCase.CurrentState = "APPROVED";
        coverageCase.ApprovedAmount = req.ApprovedAmount;
        coverageCase.PreAuthNumber = req.PreAuthNumber;
        PatchCase(coverageCase, actorUserId);
        await _db.SaveChangesAsync(ct);
        return evt;
    }

    public async Task<CcmsApprovalEvent> RecordRejectionAsync(
        Guid coverageCaseId, Guid? authorizationId, Guid actorUserId,
        RecordRejectionRequest req, CancellationToken ct = default)
    {
        var coverageCase = await RequireCaseAsync(coverageCaseId, ct);

        var evt = NewEvent(coverageCase, authorizationId, actorUserId, "TPA_REJECTED", "REJECTED");
        evt.RejectionReason      = req.RejectionReason;
        evt.TpaReferenceNumber   = req.TpaReferenceNumber;
        _db.ApprovalEvents.Add(evt);

        if (coverageCase.WorkflowInstanceId.HasValue)
            await _workflow.FireAsync(coverageCase.WorkflowInstanceId.Value, "RECEIVE_REJECTION", actorUserId, req.RejectionReason, ct);

        coverageCase.CurrentState = "REJECTED";
        PatchCase(coverageCase, actorUserId);
        await _db.SaveChangesAsync(ct);
        return evt;
    }

    public async Task<CcmsApprovalEvent> RecordClarificationAsync(
        Guid coverageCaseId, Guid? authorizationId, Guid actorUserId,
        RecordClarificationRequest req, CancellationToken ct = default)
    {
        var coverageCase = await RequireCaseAsync(coverageCaseId, ct);

        var evt = NewEvent(coverageCase, authorizationId, actorUserId, "TPA_CLARIFICATION_REQUESTED", "CLARIFICATION");
        evt.ResponsePayloadJson  = req.QueryJson;
        _db.ApprovalEvents.Add(evt);

        // Also create a clarification item for tracking
        if (authorizationId.HasValue)
        {
            _db.ClarificationItems.Add(new CcmsClarificationItem
            {
                Id                   = Guid.NewGuid(),
                TenantId             = coverageCase.TenantId,
                AuthorizationId      = authorizationId.Value,
                ClarificationQuery   = req.Query,
                RequestedAt          = DateTime.UtcNow,
                CreatedAt            = DateTime.UtcNow,
                UpdatedAt            = DateTime.UtcNow,
                CreatedByUserId      = actorUserId,
                UpdatedByUserId      = actorUserId,
                Status               = "active"
            });
        }

        if (coverageCase.WorkflowInstanceId.HasValue)
            await _workflow.FireAsync(coverageCase.WorkflowInstanceId.Value, "REQUEST_CLARIFICATION", actorUserId, req.Query, ct);

        coverageCase.CurrentState = "CLARIFICATION_REQUIRED";
        PatchCase(coverageCase, actorUserId);
        await _db.SaveChangesAsync(ct);
        return evt;
    }

    public async Task<List<CcmsApprovalEvent>> GetEventsByCaseIdAsync(
        Guid coverageCaseId, CancellationToken ct = default)
        => await _db.ApprovalEvents.AsNoTracking()
            .Where(e => e.CoverageCase_Id == coverageCaseId)
            .OrderByDescending(e => e.RecordedAt)
            .ToListAsync(ct);

    // ── Helpers ──────────────────────────────────────────────────────────────

    private async Task<CcmsCoverageCase> RequireCaseAsync(Guid id, CancellationToken ct)
        => await _db.CoverageCases.FirstOrDefaultAsync(c => c.Id == id && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {id} not found.");

    private static CcmsApprovalEvent NewEvent(
        CcmsCoverageCase cc, Guid? authId, Guid userId, string eventType, string approvalStatus)
        => new()
        {
            Id               = Guid.NewGuid(),
            TenantId         = cc.TenantId,
            CoverageCase_Id  = cc.Id,
            AuthorizationId  = authId,
            EventType        = eventType,
            EventSource      = "manual",
            ApprovalStatus   = approvalStatus,
            RecordedByUserId = userId,
            RecordedAt       = DateTime.UtcNow,
            CreatedAt        = DateTime.UtcNow,
            CreatedByUserId  = userId,
            Status           = "active"
        };

    private static void PatchCase(CcmsCoverageCase cc, Guid userId)
    {
        cc.UpdatedAt       = DateTime.UtcNow;
        cc.UpdatedByUserId = userId;
        cc.RowVersion      += 1;
    }
}

public record RecordApprovalRequest(
    decimal  ApprovedAmount,
    string?  PreAuthNumber,
    string?  TpaReferenceNumber,
    string?  PayloadJson
);
public record RecordRejectionRequest(
    string  RejectionReason,
    string? TpaReferenceNumber
);
public record RecordClarificationRequest(
    string  Query,
    string? QueryJson
);
