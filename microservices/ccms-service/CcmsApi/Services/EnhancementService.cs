using System.Text.Json;
using CcmsApi.Data;
using CcmsApi.Models.Domain;
using CcmsApi.Models.Dtos;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Services;

/// <summary>
/// Phase 4 Workstream C — coverage enhancement requests when approved coverage
/// is less than an updated estimate / finalized eligible charges.
/// Does not assume payer approval: draft → SubmitToTpa → Decide (or audited hospital override).
/// </summary>
public class EnhancementService
{
    private readonly CcmsDbContext _db;
    private readonly IWorkflowEngine _workflow;
    private readonly AuthServiceClient _authClient;
    private readonly CoverageAllocationEngine _allocation;
    private readonly ILogger<EnhancementService> _log;

    public EnhancementService(
        CcmsDbContext db,
        IWorkflowEngine workflow,
        AuthServiceClient authClient,
        CoverageAllocationEngine allocation,
        ILogger<EnhancementService> log)
    {
        _db = db;
        _workflow = workflow;
        _authClient = authClient;
        _allocation = allocation;
        _log = log;
    }

    internal static EnhancementRequestDto ToDto(CcmsEnhancementRequest e) => new(
        e.Id, e.CoverageCase_Id, e.EnhancementType,
        e.RequestedAmount, e.ApprovedAmount, e.Reason,
        e.Status, e.SubmittedAt, e.DecidedAt, e.DecisionBy,
        e.CreatedAt, e.UpdatedAt);

    /// <summary>
    /// Pure gap evaluation — frontend/backend share the same rule for display.
    /// </summary>
    public static EnhancementGapEvaluation EvaluateGap(
        decimal approvedCoverageAmount,
        decimal eligibleAmount,
        bool hasOpenEnhancement)
    {
        var gap = eligibleAmount - approvedCoverageAmount;
        var needs = gap > 0.01m;
        var recommendation = !needs
            ? "none"
            : hasOpenEnhancement
                ? "await_open_enhancement"
                : "request_enhancement";
        return new EnhancementGapEvaluation(
            NeedsEnhancement: needs,
            GapAmount: needs ? gap : 0m,
            ApprovedCoverageAmount: approvedCoverageAmount,
            EligibleAmount: eligibleAmount,
            HasOpenEnhancement: hasOpenEnhancement,
            Recommendation: recommendation);
    }

    public async Task<EnhancementGapEvaluation> EvaluateGapForCaseAsync(
        Guid coverageCaseId,
        decimal eligibleAmount,
        CancellationToken ct = default)
    {
        var coverageCase = await _db.CoverageCases.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == coverageCaseId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {coverageCaseId} not found.");

        var hasOpen = await _db.EnhancementRequests.AsNoTracking()
            .AnyAsync(e => e.CoverageCase_Id == coverageCaseId
                           && e.DeletedAt == null
                           && (e.Status == "active" || e.Status == "submitted"), ct);

        return EvaluateGap(coverageCase.ApprovedAmount, eligibleAmount, hasOpen);
    }

    public async Task<EnhancementRequestDto> CreateAsync(
        Guid coverageCaseId, Guid actorUserId,
        CreateEnhancementRequest req, CancellationToken ct = default)
    {
        if (req.RequestedAmount <= 0)
            throw new ArgumentException("RequestedAmount must be greater than zero.");

        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == coverageCaseId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {coverageCaseId} not found.");

        var hasOpen = await _db.EnhancementRequests
            .AnyAsync(e => e.CoverageCase_Id == coverageCaseId
                           && e.DeletedAt == null
                           && (e.Status == "active" || e.Status == "submitted"), ct);
        if (hasOpen)
            throw new InvalidOperationException(
                "An open enhancement already exists for this coverage case. Submit/decide it before creating another.");

        var originalApproved = coverageCase.ApprovedAmount;
        var source = string.IsNullOrWhiteSpace(req.Source) ? "manual" : req.Source!.Trim();
        var contextJson = JsonSerializer.Serialize(new
        {
            originalApprovedAmount = originalApproved,
            source,
        });

        var enhancement = new CcmsEnhancementRequest
        {
            Id                  = Guid.NewGuid(),
            TenantId            = coverageCase.TenantId,
            CoverageCase_Id     = coverageCaseId,
            EnhancementType     = string.IsNullOrWhiteSpace(req.EnhancementType) ? "amount" : req.EnhancementType!,
            RequestedAmount     = req.RequestedAmount,
            Reason              = req.Reason,
            ReasonJson          = contextJson,
            // SubmittedAt is set when sent to TPA — not at draft create.
            CreatedAt           = DateTime.UtcNow,
            UpdatedAt           = DateTime.UtcNow,
            CreatedByUserId     = actorUserId,
            UpdatedByUserId     = actorUserId,
            Status              = "active",
        };

        _db.EnhancementRequests.Add(enhancement);
        _db.EnhancementEvents.Add(new CcmsEnhancementEvent
        {
            Id                   = Guid.NewGuid(),
            TenantId             = coverageCase.TenantId,
            EnhancementRequestId = enhancement.Id,
            EventType            = "COVERAGE_ENHANCEMENT_REQUIRED",
            EventPayloadJson     = contextJson,
            ActorUserId          = actorUserId,
            EventAt              = DateTime.UtcNow,
            CreatedAt            = DateTime.UtcNow,
            UpdatedAt            = DateTime.UtcNow,
            CreatedByUserId      = actorUserId,
            UpdatedByUserId      = actorUserId,
            Status               = "active",
        });
        _db.EnhancementEvents.Add(new CcmsEnhancementEvent
        {
            Id                   = Guid.NewGuid(),
            TenantId             = coverageCase.TenantId,
            EnhancementRequestId = enhancement.Id,
            EventType            = "ENHANCEMENT_CREATED",
            EventPayloadJson     = contextJson,
            ActorUserId          = actorUserId,
            EventAt              = DateTime.UtcNow,
            CreatedAt            = DateTime.UtcNow,
            UpdatedAt            = DateTime.UtcNow,
            CreatedByUserId      = actorUserId,
            UpdatedByUserId      = actorUserId,
            Status               = "active",
        });

        // Best-effort workflow hint — never block creation if transition is unavailable.
        if (coverageCase.WorkflowInstanceId.HasValue)
        {
            try
            {
                await _workflow.FireAsync(
                    coverageCase.WorkflowInstanceId.Value,
                    "REQUEST_ENHANCEMENT",
                    actorUserId,
                    req.Reason ?? $"Enhancement requested: {req.RequestedAmount}",
                    ct);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex,
                    "REQUEST_ENHANCEMENT workflow fire failed for case {CaseId} (non-fatal)",
                    coverageCaseId);
            }
        }

        await _db.SaveChangesAsync(ct);
        _log.LogInformation(
            "Enhancement {EnhancementId} created for case {CaseId} (originalApproved={Original}, requested={Requested})",
            enhancement.Id, coverageCaseId, originalApproved, req.RequestedAmount);

        await _authClient.NotifyDepartmentAsync(
            coverageCase.TenantId,
            coverageCase.BranchId,
            "CCMS",
            "ccms.enhancement.required",
            "Enhancement required",
            $"Case {coverageCase.CaseNumber}: {req.Reason}");
        await _authClient.NotifyDepartmentAsync(
            coverageCase.TenantId,
            coverageCase.BranchId,
            "WARD",
            "ccms.enhancement.required",
            "Enhancement required",
            $"Case {coverageCase.CaseNumber} · Journey {coverageCase.JourneyId}");

        return ToDto(enhancement);
    }

    /// <summary>
    /// Guided auto-draft from bill/estimate gap. Idempotent when an open enhancement exists.
    /// Does not assume payer approval.
    /// </summary>
    public async Task<EnhancementRequestDto?> SuggestFromEligibleAmountAsync(
        Guid coverageCaseId,
        decimal eligibleAmount,
        Guid actorUserId,
        string source,
        CancellationToken ct = default)
    {
        var gap = await EvaluateGapForCaseAsync(coverageCaseId, eligibleAmount, ct);
        if (!gap.NeedsEnhancement || gap.HasOpenEnhancement)
            return null;

        return await CreateAsync(
            coverageCaseId,
            actorUserId,
            new CreateEnhancementRequest(
                EnhancementType: "amount",
                RequestedAmount: gap.GapAmount,
                Reason: $"Coverage gap detected ({source}): eligible {eligibleAmount:0.##} > approved {gap.ApprovedCoverageAmount:0.##}",
                Source: source),
            ct);
    }

    /// <summary>
    /// Mark enhancement as sent to payer/TPA. Does not update coverage projection.
    /// </summary>
    public async Task<EnhancementRequestDto> SubmitToTpaAsync(
        Guid enhancementId,
        Guid actorUserId,
        SubmitEnhancementRequest req,
        CancellationToken ct = default)
    {
        var enhancement = await _db.EnhancementRequests
            .FirstOrDefaultAsync(e => e.Id == enhancementId && e.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Enhancement {enhancementId} not found.");

        if (enhancement.Status != "active")
            throw new InvalidOperationException(
                $"Enhancement must be in active (draft) status to submit to TPA (current: {enhancement.Status}).");

        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == enhancement.CoverageCase_Id && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {enhancement.CoverageCase_Id} not found.");

        enhancement.Status = "submitted";
        enhancement.SubmittedAt = DateTime.UtcNow;
        enhancement.UpdatedAt = DateTime.UtcNow;
        enhancement.UpdatedByUserId = actorUserId;
        enhancement.RowVersion += 1;

        var payload = JsonSerializer.Serialize(new
        {
            tpaReferenceNumber = req.TpaReferenceNumber,
            notes = req.Notes,
            requestedAmount = enhancement.RequestedAmount,
        });

        _db.EnhancementEvents.Add(new CcmsEnhancementEvent
        {
            Id                   = Guid.NewGuid(),
            TenantId             = enhancement.TenantId,
            EnhancementRequestId = enhancementId,
            EventType            = "ENHANCEMENT_SENT_TO_TPA",
            EventPayloadJson     = payload,
            ActorUserId          = actorUserId,
            EventAt              = DateTime.UtcNow,
            CreatedAt            = DateTime.UtcNow,
            UpdatedAt            = DateTime.UtcNow,
            CreatedByUserId      = actorUserId,
            UpdatedByUserId      = actorUserId,
            Status               = "active",
        });

        await _db.SaveChangesAsync(ct);

        await _authClient.NotifyDepartmentAsync(
            coverageCase.TenantId,
            coverageCase.BranchId,
            "CCMS",
            "ccms.enhancement.submitted",
            "Enhancement sent to TPA",
            $"Case {coverageCase.CaseNumber} · Ref {req.TpaReferenceNumber ?? "n/a"} · ₹{enhancement.RequestedAmount:0}");

        return ToDto(enhancement);
    }

    public async Task<EnhancementRequestDto> DecideAsync(
        Guid enhancementId, Guid actorUserId,
        DecideEnhancementRequest req, CancellationToken ct = default)
    {
        var enhancement = await _db.EnhancementRequests
            .FirstOrDefaultAsync(e => e.Id == enhancementId && e.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Enhancement {enhancementId} not found.");

        if (enhancement.Status is "approved" or "rejected")
            throw new InvalidOperationException($"Enhancement {enhancementId} is already {enhancement.Status}.");

        // Payer path: must be submitted. Hospital override allowed only with explicit flag + audit.
        if (enhancement.Status == "active" && !req.HospitalOverride)
            throw new InvalidOperationException(
                "Submit the enhancement to TPA before recording outcome, or set HospitalOverride=true with a reason.");

        if (enhancement.Status == "active" && req.HospitalOverride
            && string.IsNullOrWhiteSpace(req.OverrideReason))
            throw new ArgumentException("HospitalOverride requires OverrideReason.");

        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == enhancement.CoverageCase_Id && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {enhancement.CoverageCase_Id} not found.");

        var originalApproved = TryReadOriginalApproved(enhancement.ReasonJson)
            ?? coverageCase.ApprovedAmount;

        enhancement.ApprovedAmount  = req.ApprovedAmount;
        enhancement.DecidedAt       = DateTime.UtcNow;
        enhancement.DecisionBy      = actorUserId;
        enhancement.UpdatedAt       = DateTime.UtcNow;
        enhancement.UpdatedByUserId = actorUserId;
        enhancement.RowVersion     += 1;
        enhancement.Status          = req.Approved ? "approved" : "rejected";

        // Preserve original authorization amount; apply additional approved amount to case projection.
        if (req.Approved)
        {
            var additional = req.ApprovedAmount < 0 ? 0 : req.ApprovedAmount;
            coverageCase.ApprovedAmount = originalApproved + additional;
            coverageCase.UpdatedAt = DateTime.UtcNow;
            coverageCase.UpdatedByUserId = actorUserId;
            coverageCase.RowVersion += 1;
        }

        var payload = JsonSerializer.Serialize(new
        {
            approved = req.Approved,
            additionalApprovedAmount = req.ApprovedAmount,
            originalApprovedAmount = originalApproved,
            newCaseApprovedAmount = coverageCase.ApprovedAmount,
            tpaReferenceNumber = req.TpaReferenceNumber,
            hospitalOverride = req.HospitalOverride,
            overrideReason = req.OverrideReason,
            outcomeSource = req.HospitalOverride ? "hospital_override" : "tpa_response",
        });

        _db.EnhancementEvents.Add(new CcmsEnhancementEvent
        {
            Id                   = Guid.NewGuid(),
            TenantId             = enhancement.TenantId,
            EnhancementRequestId = enhancementId,
            EventType            = req.Approved
                ? (req.HospitalOverride ? "ENHANCEMENT_APPROVED_HOSPITAL_OVERRIDE" : "ENHANCEMENT_APPROVED")
                : (req.HospitalOverride ? "ENHANCEMENT_REJECTED_HOSPITAL_OVERRIDE" : "ENHANCEMENT_REJECTED"),
            EventPayloadJson     = payload,
            ActorUserId          = actorUserId,
            EventAt              = DateTime.UtcNow,
            CreatedAt            = DateTime.UtcNow,
            UpdatedAt            = DateTime.UtcNow,
            CreatedByUserId      = actorUserId,
            UpdatedByUserId      = actorUserId,
            Status               = "active",
        });

        await _db.SaveChangesAsync(ct);
        _log.LogInformation(
            "Enhancement {EnhancementId} decided approved={Approved} override={Override}; case {CaseId} ApprovedAmount now {Amount}",
            enhancementId, req.Approved, req.HospitalOverride, coverageCase.Id, coverageCase.ApprovedAmount);

        if (req.Approved)
            await SyncAllocationAfterApprovalAsync(coverageCase, actorUserId, ct);

        return ToDto(enhancement);
    }

    /// <summary>
    /// Re-run <see cref="CoverageAllocationEngine"/> with the raised TPA limit
    /// and push that payer/patient split to Billing. Never send
    /// (ApprovedAmount, 0) — that zeroes a real copay and lets finalize lock
    /// while discharge still holds the bed.
    /// </summary>
    private async Task SyncAllocationAfterApprovalAsync(
        CcmsCoverageCase coverageCase, Guid actorUserId, CancellationToken ct)
    {
        try
        {
            var summary = await _allocation.ReallocateToCurrentApprovedLimitAsync(
                coverageCase.Id, actorUserId, ct);
            if (summary is null)
            {
                _log.LogInformation(
                    "Enhancement approved for case {CaseId}; no billing summary yet — skipping Billing allocation push. AllocateAsync will apply the engine split when the bill is allocated.",
                    coverageCase.Id);
                return;
            }

            _log.LogInformation(
                "Enhancement reallocated case {CaseId}: Ins={Ins} Pat={Pat} (not payer=ApprovedAmount/patient=0)",
                coverageCase.Id, summary.InsuranceShareAmount, summary.PatientShareAmount);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex,
                "Enhancement allocation sync failed for case {CaseId} (non-fatal; CCMS remains coverage SoT)",
                coverageCase.Id);
        }
    }

    public async Task<List<EnhancementRequestDto>> GetByCaseIdAsync(
        Guid coverageCaseId, CancellationToken ct = default)
        => (await _db.EnhancementRequests.AsNoTracking()
            .Where(e => e.CoverageCase_Id == coverageCaseId && e.DeletedAt == null)
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync(ct))
            .Select(ToDto)
            .ToList();

    /// <summary>Ops queue — list enhancements without N+1 per-case fan-out.</summary>
    public async Task<List<EnhancementListItemDto>> ListAsync(
        Guid tenantId,
        string? status = null,
        int take = 100,
        CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 500);
        var q = _db.EnhancementRequests.AsNoTracking()
            .Where(e => e.TenantId == tenantId && e.DeletedAt == null);

        if (!string.IsNullOrWhiteSpace(status) && status != "all")
        {
            var s = status switch
            {
                "pending" => "active",
                "awaiting_tpa" => "submitted",
                _ => status,
            };
            q = q.Where(e => e.Status == s);
        }

        var rows = await (
            from e in q
            join c in _db.CoverageCases.AsNoTracking() on e.CoverageCase_Id equals c.Id
            orderby e.CreatedAt descending
            select new { e, c }
        ).Take(take).ToListAsync(ct);

        return rows.Select(r => new EnhancementListItemDto(
            ToDto(r.e),
            r.c.CaseNumber,
            r.c.PatientName,
            r.c.ApprovedAmount,
            r.c.JourneyId,
            r.c.SessionId)).ToList();
    }

    private static decimal? TryReadOriginalApproved(string? reasonJson)
    {
        if (string.IsNullOrWhiteSpace(reasonJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(reasonJson);
            if (doc.RootElement.TryGetProperty("originalApprovedAmount", out var p)
                && p.TryGetDecimal(out var v))
                return v;
        }
        catch
        {
            // ignore malformed legacy ReasonJson
        }
        return null;
    }
}

public record CreateEnhancementRequest(
    string?  EnhancementType,
    decimal  RequestedAmount,
    string?  Reason,
    string?  Source = null
);

public record SubmitEnhancementRequest(
    string? TpaReferenceNumber,
    string? Notes
);

public record DecideEnhancementRequest(
    bool    Approved,
    decimal ApprovedAmount,
    string? TpaReferenceNumber = null,
    bool    HospitalOverride = false,
    string? OverrideReason = null
);

public record EnhancementGapEvaluation(
    bool    NeedsEnhancement,
    decimal GapAmount,
    decimal ApprovedCoverageAmount,
    decimal EligibleAmount,
    bool    HasOpenEnhancement,
    string  Recommendation
);

public record EnhancementListItemDto(
    EnhancementRequestDto Enhancement,
    string  CaseNumber,
    string? PatientName,
    decimal CaseApprovedAmount,
    Guid?   JourneyId,
    Guid?   SessionId
);
