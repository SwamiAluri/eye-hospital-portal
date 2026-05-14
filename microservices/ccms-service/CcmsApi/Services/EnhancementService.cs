using CcmsApi.Data;
using CcmsApi.Models.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Services;

public class EnhancementService
{
    private readonly CcmsDbContext _db;
    private readonly IWorkflowEngine _workflow;
    private readonly ILogger<EnhancementService> _log;

    public EnhancementService(CcmsDbContext db, IWorkflowEngine workflow, ILogger<EnhancementService> log)
    {
        _db       = db;
        _workflow = workflow;
        _log      = log;
    }

    public async Task<CcmsEnhancementRequest> CreateAsync(
        Guid coverageCaseId, Guid actorUserId,
        CreateEnhancementRequest req, CancellationToken ct = default)
    {
        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == coverageCaseId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {coverageCaseId} not found.");

        var enhancement = new CcmsEnhancementRequest
        {
            Id                  = Guid.NewGuid(),
            TenantId            = coverageCase.TenantId,
            CoverageCase_Id     = coverageCaseId,
            EnhancementType     = req.EnhancementType ?? "amount",
            RequestedAmount     = req.RequestedAmount,
            Reason              = req.Reason,
            CreatedAt           = DateTime.UtcNow,
            UpdatedAt           = DateTime.UtcNow,
            CreatedByUserId     = actorUserId,
            UpdatedByUserId     = actorUserId,
            Status              = "active"
        };

        _db.EnhancementRequests.Add(enhancement);

        _db.EnhancementEvents.Add(new CcmsEnhancementEvent
        {
            Id                    = Guid.NewGuid(),
            TenantId              = coverageCase.TenantId,
            EnhancementRequestId  = enhancement.Id,
            EventType             = "ENHANCEMENT_CREATED",
            ActorUserId           = actorUserId,
            EventAt               = DateTime.UtcNow,
            CreatedAt             = DateTime.UtcNow,
            UpdatedAt             = DateTime.UtcNow,
            CreatedByUserId       = actorUserId,
            UpdatedByUserId       = actorUserId,
            Status                = "active"
        });

        await _db.SaveChangesAsync(ct);
        _log.LogInformation("Enhancement request created for case {CaseId}", coverageCaseId);
        return enhancement;
    }

    public async Task<CcmsEnhancementRequest> DecideAsync(
        Guid enhancementId, Guid actorUserId,
        DecideEnhancementRequest req, CancellationToken ct = default)
    {
        var enhancement = await _db.EnhancementRequests
            .FirstOrDefaultAsync(e => e.Id == enhancementId && e.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Enhancement {enhancementId} not found.");

        enhancement.ApprovedAmount = req.ApprovedAmount;
        enhancement.DecidedAt      = DateTime.UtcNow;
        enhancement.DecisionBy     = actorUserId;
        enhancement.UpdatedAt      = DateTime.UtcNow;
        enhancement.UpdatedByUserId = actorUserId;
        enhancement.RowVersion     += 1;
        enhancement.Status          = req.Approved ? "approved" : "rejected";

        _db.EnhancementEvents.Add(new CcmsEnhancementEvent
        {
            Id                    = Guid.NewGuid(),
            TenantId              = enhancement.TenantId,
            EnhancementRequestId = enhancementId,
            EventType             = req.Approved ? "ENHANCEMENT_APPROVED" : "ENHANCEMENT_REJECTED",
            ActorUserId           = actorUserId,
            EventAt               = DateTime.UtcNow,
            CreatedAt             = DateTime.UtcNow,
            UpdatedAt             = DateTime.UtcNow,
            CreatedByUserId       = actorUserId,
            UpdatedByUserId       = actorUserId,
            Status                = "active"
        });

        await _db.SaveChangesAsync(ct);
        return enhancement;
    }

    public async Task<List<CcmsEnhancementRequest>> GetByCaseIdAsync(
        Guid coverageCaseId, CancellationToken ct = default)
        => await _db.EnhancementRequests.AsNoTracking()
            .Where(e => e.CoverageCase_Id == coverageCaseId && e.DeletedAt == null)
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync(ct);
}

public record CreateEnhancementRequest(
    string?  EnhancementType,
    decimal  RequestedAmount,
    string?  Reason
);
public record DecideEnhancementRequest(
    bool    Approved,
    decimal ApprovedAmount
);
