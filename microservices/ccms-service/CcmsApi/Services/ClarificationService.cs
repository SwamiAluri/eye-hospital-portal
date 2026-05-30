using CcmsApi.Data;
using CcmsApi.Models.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Services;

/// <summary>
/// Manages the TPA clarification / query thread for a coverage authorization.
/// Each clarification item is a question raised by the TPA; the hospital
/// provides a response. Process status advances automatically.
/// </summary>
public class ClarificationService
{
    private readonly CcmsDbContext _db;
    private readonly IWorkflowEngine _workflow;
    private readonly ILogger<ClarificationService> _log;

    public ClarificationService(
        CcmsDbContext db, IWorkflowEngine workflow, ILogger<ClarificationService> log)
    {
        _db       = db;
        _workflow = workflow;
        _log      = log;
    }

    // ── List ─────────────────────────────────────────────────────────────────

    public async Task<List<CcmsClarificationItem>> GetByAuthorizationAsync(
        Guid authorizationId, CancellationToken ct = default)
        => await _db.ClarificationItems.AsNoTracking()
            .Where(c => c.AuthorizationId == authorizationId && c.DeletedAt == null)
            .OrderBy(c => c.RequestedAt)
            .ToListAsync(ct);

    // ── Add query (raised by TPA, recorded by counsellor) ─────────────────────

    public async Task<CcmsClarificationItem> AddQueryAsync(
        Guid authorizationId, Guid actorId,
        AddClarificationQueryRequest req, CancellationToken ct = default)
    {
        var auth = await _db.CoverageAuthorizations
            .FirstOrDefaultAsync(a => a.Id == authorizationId && a.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Authorization {authorizationId} not found.");

        var item = new CcmsClarificationItem
        {
            Id                   = Guid.NewGuid(),
            TenantId             = auth.TenantId,
            AuthorizationId      = authorizationId,
            ClarificationQuery   = req.Query,
            RequestedAt          = DateTime.UtcNow,
            CreatedAt            = DateTime.UtcNow,
            UpdatedAt            = DateTime.UtcNow,
            CreatedByUserId      = actorId,
            UpdatedByUserId      = actorId,
            Status               = "active"
        };

        _db.ClarificationItems.Add(item);

        // Update auth process_status to signal a query is pending
        auth.ProcessStatus          = "query_raised";
        auth.ProcessStatusUpdatedAt = DateTime.UtcNow;
        auth.UpdatedAt              = DateTime.UtcNow;
        auth.UpdatedByUserId        = actorId;

        await _db.SaveChangesAsync(ct);
        _log.LogInformation("Clarification query added for auth {AuthId}", authorizationId);
        return item;
    }

    // ── Respond to a query (hospital side) ───────────────────────────────────

    public async Task<CcmsClarificationItem> RespondAsync(
        Guid clarificationItemId, Guid actorId,
        RespondToClarificationRequest req, CancellationToken ct = default)
    {
        var item = await _db.ClarificationItems
            .FirstOrDefaultAsync(c => c.Id == clarificationItemId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Clarification item {clarificationItemId} not found.");

        if (item.RespondedAt.HasValue)
            throw new InvalidOperationException("Clarification already responded to.");

        item.ClarificationResponse = req.Response;
        item.RespondedAt           = DateTime.UtcNow;
        item.UpdatedAt             = DateTime.UtcNow;
        item.UpdatedByUserId       = actorId;
        item.RowVersion           += 1;

        // Check if all open queries for this auth are now answered
        var allItems = await _db.ClarificationItems
            .Where(c => c.AuthorizationId == item.AuthorizationId && c.DeletedAt == null)
            .ToListAsync(ct);

        var allAnswered = allItems.All(c => c.Id == clarificationItemId || c.RespondedAt.HasValue);

        var auth = await _db.CoverageAuthorizations
            .FirstOrDefaultAsync(a => a.Id == item.AuthorizationId && a.DeletedAt == null, ct);

        if (auth is not null)
        {
            auth.ProcessStatus          = allAnswered ? "query_responded" : "partial_response";
            auth.ProcessStatusUpdatedAt = DateTime.UtcNow;
            auth.UpdatedAt              = DateTime.UtcNow;
            auth.UpdatedByUserId        = actorId;

            // If all answered, fire RESUBMIT trigger (matches 108_ccms_workflow_seed.sql)
            if (allAnswered)
            {
                var coverageCase = await _db.CoverageCases
                    .FirstOrDefaultAsync(c => c.Id == auth.CoverageCase_Id && c.DeletedAt == null, ct);

                if (coverageCase?.WorkflowInstanceId.HasValue == true)
                {
                    await _workflow.FireAsync(
                        coverageCase.WorkflowInstanceId.Value,
                        "RESUBMIT", actorId, null, ct);

                    coverageCase.CurrentState    = "RESUBMITTED";
                    coverageCase.ProcessStatus   = "resubmitted";
                    coverageCase.UpdatedAt       = DateTime.UtcNow;
                    coverageCase.UpdatedByUserId = actorId;
                    coverageCase.RowVersion     += 1;
                }
            }
        }

        await _db.SaveChangesAsync(ct);
        _log.LogInformation("Clarification {ItemId} responded", clarificationItemId);
        return item;
    }
}

public record AddClarificationQueryRequest(string Query);
public record RespondToClarificationRequest(string Response);
