using CcmsApi.Data;
using CcmsApi.Models.Domain;
using CcmsApi.Models.Dtos;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace CcmsApi.Services;

/// <summary>
/// Core service for CCMS coverage case lifecycle management.
/// Creates cases, manages eligibility, policy capture, and state queries.
/// </summary>
public class CoverageCaseService
{
    private readonly CcmsDbContext _db;
    private readonly IWorkflowEngine _workflow;
    private readonly FinancialYearService _fyService;
    private readonly AuthServiceClient _authClient;
    private readonly ILogger<CoverageCaseService> _log;

    public CoverageCaseService(
        CcmsDbContext db,
        IWorkflowEngine workflow,
        FinancialYearService fyService,
        AuthServiceClient authClient,
        ILogger<CoverageCaseService> log)
    {
        _db       = db;
        _workflow = workflow;
        _fyService = fyService;
        _authClient = authClient;
        _log      = log;
    }

    private async Task NotifyAuthSessionAsync(CcmsCoverageCase coverageCase, string eventType)
    {
        if (!coverageCase.SessionId.HasValue || coverageCase.SessionId.Value == Guid.Empty)
            return;

        try
        {
            await _authClient.NotifyCcmsSessionAsync(
                coverageCase.TenantId,
                coverageCase.SessionId.Value,
                coverageCase.Id,
                coverageCase.CaseNumber,
                eventType,
                coverageCase.CurrentState);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Auth notify failed for case {CaseId} event {Event}", coverageCase.Id, eventType);
        }
    }

    /// <summary>
    /// Fire-and-forget for non-critical state broadcasts. Create/draft must await so Auth
    /// bumps CounselingSession.Version before the counsellor UI continues Save Draft.
    /// </summary>
    private void NotifyAuthSessionFireAndForget(CcmsCoverageCase coverageCase, string eventType)
    {
        if (!coverageCase.SessionId.HasValue || coverageCase.SessionId.Value == Guid.Empty)
            return;

        var tenantId = coverageCase.TenantId;
        var sessionId = coverageCase.SessionId.Value;
        var caseId = coverageCase.Id;
        var caseNumber = coverageCase.CaseNumber;
        var state = coverageCase.CurrentState;

        _ = Task.Run(async () =>
        {
            try
            {
                await _authClient.NotifyCcmsSessionAsync(
                    tenantId, sessionId, caseId, caseNumber, eventType, state);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Auth notify failed for case {CaseId} event {Event}", caseId, eventType);
            }
        });
    }

    // ── Create Coverage Case ─────────────────────────────────────────────────

    public async Task<CcmsCoverageCase> CreateAsync(
        Guid tenantId, Guid actorUserId, CreateCoverageCaseRequest req, CancellationToken ct = default)
    {
        // ── Idempotency guard ────────────────────────────────────────────────────
        // If a case already exists for this session (counsellor clicked the tab before or
        // after saving), return it instead of creating a duplicate.  This makes the
        // endpoint safe to call multiple times with the same sessionId.
        var sessionId = req.SessionId ?? req.CounselingSessionId;
        if (sessionId.HasValue && sessionId.Value != Guid.Empty)
        {
            var existing = await GetBySessionIdAsync(sessionId.Value, ct);
            if (existing is not null)
            {
                _log.LogInformation(
                    "Coverage case {Num} already exists for session {Session} — returning existing",
                    existing.CaseNumber, sessionId.Value);
                return existing;
            }
        }

        // Resolve financial year
        var fyId = req.FinancialYearId
            ?? await _fyService.GetCurrentFinancialYearIdAsync(tenantId, actorUserId, ct);

        var fy = await _fyService.GetByIdAsync(fyId, ct)
            ?? throw new InvalidOperationException("Financial year not found.");

        // Generate case number atomically via DB function
        var caseNumber = await GenerateCaseNumberAsync(tenantId, fyId, fy.YearCode, ct);

        // Pre-generate the case ID so the workflow instance references it from the start,
        // avoiding the fragile post-creation entityId fix-up.
        var caseId = Guid.NewGuid();

        var instance = await _workflow.StartAsync(
            tenantId, caseId, "coverage_case", actorUserId, ct);

        var coverageCase = new CcmsCoverageCase
        {
            Id                  = caseId,
            TenantId            = tenantId,
            CaseNumber          = caseNumber,
            PatientId           = req.PatientId,
            PatientName         = req.PatientName,
            SessionId           = req.SessionId ?? req.CounselingSessionId,
            JourneyId           = req.JourneyId,
            FinancialYearId     = fyId,
            BranchId            = req.BranchId,
            DoctorId            = req.DoctorId,
            PayerType           = req.PayerType,
            PaymentType         = req.PaymentType,
            InsuranceProviderId = req.InsuranceProviderId,
            TpaProviderId       = req.TpaProviderId,
            GovernmentSchemeId  = req.GovernmentSchemeId,
            CoveragePackageId   = req.CoveragePackageId,
            WorkflowInstanceId  = instance.Id,
            CurrentState        = "DRAFT",
            CreatedAt           = DateTime.UtcNow,
            UpdatedAt           = DateTime.UtcNow,
            CreatedByUserId     = actorUserId,
            UpdatedByUserId     = actorUserId,
            Status              = "active",
            LegacyPreauthId     = req.LegacyPreauthId,
            SessionPreauthId    = req.SessionPreauthId,
            InsurerName         = req.InsurerName,
        };

        if (!string.IsNullOrWhiteSpace(req.CounsellorDraftJson))
        {
            coverageCase.CounsellorDraftJson = req.CounsellorDraftJson;
            coverageCase.IsDraft = true;
            coverageCase.DraftSavedAt = DateTime.UtcNow;
        }
        else if (!string.IsNullOrWhiteSpace(req.InsurerName) || req.EstimatedAmount is > 0)
        {
            coverageCase.CounsellorDraftJson = System.Text.Json.JsonSerializer.Serialize(new
            {
                insurerName = req.InsurerName,
                insuranceCompany = req.InsurerName,
                estimatedAmount = req.EstimatedAmount,
                finalPayableAmount = req.EstimatedAmount,
                paymentType = req.PaymentType,
                insuranceProviderId = req.InsuranceProviderId,
            });
            coverageCase.IsDraft = true;
            coverageCase.DraftSavedAt = DateTime.UtcNow;
        }

        // Shrink TOCTOU window: another request may have created a case while we prepared this one.
        if (sessionId.HasValue && sessionId.Value != Guid.Empty)
        {
            var raced = await GetBySessionIdAsync(sessionId.Value, ct);
            if (raced is not null)
            {
                _log.LogInformation(
                    "Coverage case {Num} won the create race for session {Session} — returning existing",
                    raced.CaseNumber, sessionId.Value);
                return raced;
            }
        }

        _db.CoverageCases.Add(coverageCase);
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex)
        {
            if (sessionId.HasValue && sessionId.Value != Guid.Empty)
            {
                var existingAfterRace = await GetBySessionIdAsync(sessionId.Value, ct);
                if (existingAfterRace is not null)
                {
                    _log.LogWarning(ex,
                        "Create raced for session {Session} — returning existing {Num}",
                        sessionId.Value, existingAfterRace.CaseNumber);
                    return existingAfterRace;
                }
            }
            throw;
        }

        _log.LogInformation("Coverage case {Num} created for patient {Patient}",
            caseNumber, req.PatientId);

        await NotifyAuthSessionAsync(coverageCase, "CCMS_CASE_CREATED");
        return coverageCase;
    }

    // ── Query ────────────────────────────────────────────────────────────────

    public async Task<CoverageCaseDetailDto?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var coverageCase = await _db.CoverageCases.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id && c.DeletedAt == null, ct);
        if (coverageCase is null) return null;

        if (string.IsNullOrWhiteSpace(coverageCase.PatientName))
            coverageCase.PatientName = TryPatientNameFromDraft(coverageCase.CounsellorDraftJson);

        return ToDetailDto(coverageCase);
    }

    // ── DTO mappers ──────────────────────────────────────────────────────────

    internal static CoverageCaseSummaryDto ToSummaryDto(CcmsCoverageCase c) => new(
        c.Id, c.CaseNumber, c.PatientId, c.PatientName,
        c.SessionId, c.CurrentState, c.PayerType, c.PaymentType,
        c.InsuranceProviderId, c.TpaProviderId, c.PreAuthNumber,
        c.ApprovedAmount, c.IsDraft, c.CreatedAt, c.UpdatedAt,
        InsurerName:            c.InsurerName,
        EstimatedAmount:        TryParseDraftEstimate(c.CounsellorDraftJson),
        PatientPayableAmount:   c.ApprovedAmount > 0
                                    ? c.ApprovedAmount   // copay deducted server-side when full DTO available
                                    : (decimal?)null);

    internal static CoverageCaseDetailDto ToDetailDto(CcmsCoverageCase c) => new(
        c.Id, c.CaseNumber, c.PatientId, c.PatientName,
        c.SessionId, c.JourneyId, c.FinancialYearId, c.BranchId, c.DoctorId,
        c.CurrentState, c.PayerType, c.PaymentType,
        c.InsuranceProviderId, c.TpaProviderId, c.GovernmentSchemeId, c.CoveragePackageId,
        c.WorkflowInstanceId, c.ApprovedAmount, c.RoomClassApproved, c.PreAuthNumber,
        c.PreAuthExpiry, c.IsDraft, c.DraftSavedAt, c.CreatedAt, c.UpdatedAt,
        CounsellorDraftJson:    c.CounsellorDraftJson,
        InsurerName:            c.InsurerName,
        ProcessStatus:          c.ProcessStatus,
        ServiceTaxApplicable:   c.ServiceTaxApplicable,
        ServiceTaxPercent:      c.ServiceTaxPercent,
        ServiceTaxAmount:       c.ServiceTaxAmount,
        EntityStatus:           c.Status);

    private static string? TryPatientNameFromDraft(string? draftJson)
    {
        if (string.IsNullOrWhiteSpace(draftJson)) return null;
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(draftJson);
            if (doc.RootElement.TryGetProperty("insuredName", out var ins) && ins.ValueKind == System.Text.Json.JsonValueKind.String)
            {
                var name = ins.GetString();
                if (!string.IsNullOrWhiteSpace(name)) return name.Trim();
            }
            if (doc.RootElement.TryGetProperty("InsuredName", out var ins2) && ins2.ValueKind == System.Text.Json.JsonValueKind.String)
            {
                var name = ins2.GetString();
                if (!string.IsNullOrWhiteSpace(name)) return name.Trim();
            }
        }
        catch { /* ignore malformed draft */ }
        return null;
    }

    internal static decimal? TryParseDraftEstimate(string? draftJson)
    {
        if (string.IsNullOrWhiteSpace(draftJson)) return null;
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(draftJson);
            foreach (var key in new[] {
                "finalPayableAmount", "FinalPayableAmount",
                "estimatedAmount", "EstimatedAmount",
                "sessionPackageRate", "SessionPackageRate",
                "rate", "Rate",
            })
            {
                if (doc.RootElement.TryGetProperty(key, out var val))
                {
                    if (val.ValueKind == System.Text.Json.JsonValueKind.Number && val.TryGetDecimal(out var amount) && amount > 0)
                        return amount;
                }
            }
        }
        catch { /* ignore malformed draft */ }
        return null;
    }

    /// <summary>
    /// Resolves the coverage case for a counselling session.
    /// When duplicates exist (historical race), prefer the case that has active documents,
    /// otherwise the most recently created non-deleted case.
    /// </summary>
    public async Task<CcmsCoverageCase?> GetBySessionIdAsync(Guid sessionId, CancellationToken ct = default)
    {
        var cases = await _db.CoverageCases.AsNoTracking()
            .Where(c => c.SessionId == sessionId && c.DeletedAt == null)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(ct);

        if (cases.Count == 0) return null;
        if (cases.Count == 1) return cases[0];

        var caseIds = cases.Select(c => c.Id).ToList();
        var caseIdsWithDocs = await _db.Documents.AsNoTracking()
            .Where(d => caseIds.Contains(d.CoverageCase_Id) && d.DeletedAt == null)
            .Select(d => d.CoverageCase_Id)
            .Distinct()
            .ToListAsync(ct);

        var withDocs = cases.FirstOrDefault(c => caseIdsWithDocs.Contains(c.Id));
        if (withDocs is not null)
        {
            _log.LogWarning(
                "Session {Session} has {Count} coverage cases; preferring {Num} (has documents)",
                sessionId, cases.Count, withDocs.CaseNumber);
            return withDocs;
        }

        _log.LogWarning(
            "Session {Session} has {Count} coverage cases; preferring latest {Num}",
            sessionId, cases.Count, cases[0].CaseNumber);
        return cases[0];
    }

    public async Task<List<CcmsCoverageCase>> GetBySessionIdsAsync(
        List<Guid> sessionIds, CancellationToken ct = default)
        => await _db.CoverageCases.AsNoTracking()
            .Where(c => sessionIds.Contains(c.SessionId!.Value) && c.DeletedAt == null)
            .ToListAsync(ct);

    public async Task<CcmsCoverageCase?> GetByJourneyIdAsync(Guid journeyId, CancellationToken ct = default)
        => await _db.CoverageCases.AsNoTracking()
            .FirstOrDefaultAsync(c => c.JourneyId == journeyId && c.DeletedAt == null, ct);

    public async Task<PagedResult<CoverageCaseSummaryDto>> ListAsync(
        Guid tenantId,
        string? state = null,
        string? payerType = null,
        Guid? insuranceProviderId = null,
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default,
        string? search = null)
    {
        var q = _db.CoverageCases.AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null);

        if (!string.IsNullOrEmpty(state))
            q = q.Where(c => c.CurrentState == state);
        if (!string.IsNullOrEmpty(payerType))
            q = q.Where(c => c.PayerType == payerType);
        if (insuranceProviderId.HasValue)
            q = q.Where(c => c.InsuranceProviderId == insuranceProviderId.Value);

        // Server-side search: case number, patient name, insurer name, payer type
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            q = q.Where(c =>
                c.CaseNumber.ToLower().Contains(term) ||
                (c.PatientName != null && c.PatientName.ToLower().Contains(term)) ||
                (c.InsurerName != null && c.InsurerName.ToLower().Contains(term)) ||
                c.PayerType.ToLower().Contains(term));
        }

        var total = await q.CountAsync(ct);
        var items = await q
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<CoverageCaseSummaryDto>(
            items.Select(ToSummaryDto).ToList(), total, page, pageSize);
    }

    /// <summary>
    /// Patient-id collection for one tenant. Same tenant and soft-delete scope as <see cref="ListAsync"/>.
    /// Coverage-case queries do not filter <c>branch_id</c>.
    /// </summary>
    public async Task<PagedResult<CoverageCaseSummaryDto>> ListByPatientIdAsync(
        Guid tenantId,
        Guid patientId,
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default)
    {
        var (pageNumber, size) = CcmsPatientListPaging.Normalize(page, pageSize);
        var q = _db.CoverageCases.AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.PatientId == patientId && c.DeletedAt == null);

        var total = await q.CountAsync(ct);
        var items = await q
            .OrderByDescending(c => c.CreatedAt)
            .ThenByDescending(c => c.Id)
            .Skip((pageNumber - 1) * size)
            .Take(size)
            .ToListAsync(ct);
        page = pageNumber;
        pageSize = size;

        return new PagedResult<CoverageCaseSummaryDto>(
            items.Select(ToSummaryDto).ToList(), total, page, pageSize);
    }

    // ── Update state ─────────────────────────────────────────────────────────

    public async Task SyncStateFromWorkflowAsync(
        Guid coverageCaseId, Guid actorUserId, CancellationToken ct = default)
    {
        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == coverageCaseId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {coverageCaseId} not found.");

        if (!coverageCase.WorkflowInstanceId.HasValue) return;

        var stateCode = await _workflow.GetCurrentStateCodeAsync(
            coverageCase.WorkflowInstanceId.Value, ct);

        coverageCase.CurrentState   = stateCode;
        coverageCase.UpdatedAt      = DateTime.UtcNow;
        coverageCase.UpdatedByUserId = actorUserId;
        coverageCase.RowVersion     += 1;

        await _db.SaveChangesAsync(ct);

        NotifyAuthSessionFireAndForget(coverageCase, "CCMS_STATE_CHANGED");
    }

    // ── Patch draft (counsellor saves progress) ──────────────────────────────

    public async Task<CcmsCoverageCase> PatchDraftAsync(
        Guid id, Guid actorUserId, PatchCoverageCaseRequest req, CancellationToken ct = default)
    {
        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == id && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {id} not found.");

        // Persist counsellor-captured fields as camelCase JSON so the frontend
        // parseCounsellorDraft() can restore them without a case-mapping step.
        coverageCase.CounsellorDraftJson = BuildCounsellorDraftJson(req);
        coverageCase.IsDraft      = req.IsDraft ?? true;
        coverageCase.DraftSavedAt = DateTime.UtcNow;

        // Also write to native DB columns where they exist, so CCMS team sees the data immediately
        if (!string.IsNullOrWhiteSpace(req.FinancialYearId))
        {
            var fyId = await _fyService.ResolveFinancialYearIdAsync(
                coverageCase.TenantId, req.FinancialYearId, actorUserId, ct);
            if (fyId.HasValue)
                coverageCase.FinancialYearId = fyId;
        }

        if (!string.IsNullOrWhiteSpace(req.InsuranceProviderId) &&
            Guid.TryParse(req.InsuranceProviderId, out var provGuid))
            coverageCase.InsuranceProviderId = provGuid;

        // Persist payment type when counsellor updates it
        if (!string.IsNullOrWhiteSpace(req.PaymentType))
            coverageCase.PaymentType = req.PaymentType;

        if (!string.IsNullOrWhiteSpace(req.InsuredName))
            coverageCase.PatientName = req.InsuredName.Trim();

        // Keep the denormalized InsurerName column in sync so CCMS list search works
        if (!string.IsNullOrWhiteSpace(req.InsurerName))
            coverageCase.InsurerName = req.InsurerName.Trim();

        // NOTE: EstimatedAmount from the counsellor draft is intentionally NOT written to
        // ApprovedAmount. ApprovedAmount is only set by RecordTpaResponse once TPA actually
        // approves the case. Storing the estimate there causes the CCMS UI to show
        // "Approved ₹X" while the case is still in ELIGIBILITY_PENDING state.

        coverageCase.UpdatedAt       = DateTime.UtcNow;
        coverageCase.UpdatedByUserId = actorUserId;
        coverageCase.RowVersion     += 1;

        // ── Auto-upsert visit policy from counsellor draft (case-scoped) ─────────
        // Prefer matching active policyNumber (CreateAsync uniqueness contract).
        // Only insert when no active same-number row exists.
        if (!string.IsNullOrWhiteSpace(req.PolicyNumber))
        {
            Guid? visitProviderId = null;
            if (!string.IsNullOrWhiteSpace(req.InsuranceProviderId) &&
                Guid.TryParse(req.InsuranceProviderId, out var visitProvGuid))
                visitProviderId = visitProvGuid;

            var normalizedPolicyNumber = req.PolicyNumber.Trim().ToLowerInvariant();

            // CASE A: active row with same normalized policy number → update/reuse (no insert).
            var matchingByNumber = await _db.VisitInsurancePolicies
                .Where(p => p.CoverageCase_Id == coverageCase.Id && p.DeletedAt == null)
                .ToListAsync(ct);
            var existingByNumber = matchingByNumber
                .FirstOrDefault(p =>
                    p.PolicyNumber != null &&
                    p.PolicyNumber.Trim().ToLowerInvariant() == normalizedPolicyNumber);

            if (existingByNumber is not null)
            {
                existingByNumber.PolicyNumber         = req.PolicyNumber.Trim();
                existingByNumber.MembershipNumber     = req.MembershipNumber?.Trim() ?? existingByNumber.MembershipNumber;
                existingByNumber.InsuredName          = req.InsuredName?.Trim()      ?? existingByNumber.InsuredName;
                existingByNumber.RelationshipToInsured = req.RelationshipToInsured?.ToLower() ?? existingByNumber.RelationshipToInsured;
                existingByNumber.AccommodationClass   = req.RoomClassEntitlement?.ToLower()  ?? existingByNumber.AccommodationClass;
                if (visitProviderId.HasValue)
                    existingByNumber.InsuranceProviderId = visitProviderId;
                // Reuse matching row as primary when the visit has no other active primary.
                if (!matchingByNumber.Any(p => p.IsPrimary && p.Id != existingByNumber.Id))
                    existingByNumber.IsPrimary = true;
                existingByNumber.UpdatedAt            = DateTime.UtcNow;
                existingByNumber.UpdatedByUserId      = actorUserId;
            }
            else
            {
                var existingPrimary = matchingByNumber
                    .FirstOrDefault(p => p.IsPrimary);

                if (existingPrimary is null)
                {
                    // CASE C / D: no matching number and no active primary → create primary.
                    // Soft-deleted same-number rows are ignored above (DeletedAt == null filter).
                    _db.VisitInsurancePolicies.Add(new CcmsApi.Models.Domain.CcmsVisitInsurancePolicy
                    {
                        Id                   = Guid.NewGuid(),
                        TenantId             = coverageCase.TenantId,
                        SessionId            = coverageCase.SessionId,
                        CoverageCase_Id      = coverageCase.Id,
                        PolicyNumber         = req.PolicyNumber.Trim(),
                        MembershipNumber     = req.MembershipNumber?.Trim(),
                        InsuredName          = req.InsuredName?.Trim(),
                        InsuranceProviderId  = visitProviderId,
                        RelationshipToInsured = req.RelationshipToInsured?.ToLower(),
                        AccommodationClass   = req.RoomClassEntitlement?.ToLower(),
                        IsPrimary            = true,
                        SortOrder            = 1,
                        CreatedByUserId      = actorUserId,
                        UpdatedByUserId      = actorUserId,
                    });
                }
                else
                {
                    // CASE B / E: different number with existing primary → update primary (prior behavior).
                    existingPrimary.PolicyNumber         = req.PolicyNumber.Trim();
                    existingPrimary.MembershipNumber     = req.MembershipNumber?.Trim() ?? existingPrimary.MembershipNumber;
                    existingPrimary.InsuredName          = req.InsuredName?.Trim()      ?? existingPrimary.InsuredName;
                    existingPrimary.RelationshipToInsured = req.RelationshipToInsured?.ToLower() ?? existingPrimary.RelationshipToInsured;
                    existingPrimary.AccommodationClass   = req.RoomClassEntitlement?.ToLower()  ?? existingPrimary.AccommodationClass;
                    if (visitProviderId.HasValue)
                        existingPrimary.InsuranceProviderId = visitProviderId;
                    existingPrimary.UpdatedAt            = DateTime.UtcNow;
                    existingPrimary.UpdatedByUserId      = actorUserId;
                }
            }
        }

        await _db.SaveChangesAsync(ct);
        _log.LogInformation("Draft saved for coverage case {Id} by user {UserId}", id, actorUserId);

        await NotifyAuthSessionAsync(coverageCase, "CCMS_DRAFT_SAVED");
        return coverageCase;
    }

    // ── Remind CCMS team (lightweight note, no state change) ─────────────────

    public async Task AddRemindNoteAsync(
        Guid id, Guid actorUserId, string? notes, CancellationToken ct = default)
    {
        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == id && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {id} not found.");

        if (!coverageCase.WorkflowInstanceId.HasValue)
            throw new InvalidOperationException("Coverage case has no associated workflow instance.");

        var instance = await _db.WorkflowInstances
            .FirstOrDefaultAsync(w => w.Id == coverageCase.WorkflowInstanceId.Value, ct)
            ?? throw new InvalidOperationException("Workflow instance not found.");

        // Insert a history note with a "REMIND" trigger event — does not change state
        var historyEntry = new CcmsWorkflowHistory
        {
            WorkflowInstanceId = instance.Id,
            FromStateId        = instance.CurrentStateId,
            ToStateId          = instance.CurrentStateId, // same state — no transition
            TriggerEvent       = "COUNSELLOR_REMIND",
            ActorUserId        = actorUserId,
            Notes              = notes ?? "Counsellor sent a reminder to the CCMS team.",
            TransitionedAt     = DateTime.UtcNow,
            MetaJson           = System.Text.Json.JsonSerializer.Serialize(new {
                type       = "remind",
                caseNumber = coverageCase.CaseNumber,
                state      = coverageCase.CurrentState,
            }),
        };
        _db.WorkflowHistories.Add(historyEntry);

        coverageCase.UpdatedAt       = DateTime.UtcNow;
        coverageCase.UpdatedByUserId = actorUserId;
        await _db.SaveChangesAsync(ct);

        _log.LogInformation(
            "Remind note added for coverage case {Id} (state={State}) by user {UserId}",
            id, coverageCase.CurrentState, actorUserId);
    }

    /// <summary>
    /// Builds counsellor draft JSON from PATCH scalars, merging extended fields from the client payload.
    /// </summary>
    private static string BuildCounsellorDraftJson(PatchCoverageCaseRequest req)
    {
        var serializeOpts = new JsonSerializerOptions
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        };

        var draft = new Dictionary<string, object?>
        {
            ["insurerName"]              = req.InsurerName,
            ["policyNumber"]             = req.PolicyNumber,
            ["membershipNumber"]         = req.MembershipNumber,
            ["insuredName"]              = req.InsuredName,
            ["relationshipToInsured"]    = req.RelationshipToInsured,
            ["sumInsured"]               = req.SumInsured,
            ["coPay"]                    = req.CoPay,
            ["policyExpiry"]             = req.PolicyExpiry,
            ["urgencyLevel"]             = req.UrgencyLevel,
            ["coverageNotes"]            = req.CoverageNotes,
            ["clinicalNotes"]            = req.ClinicalNotes,
            ["tpaContactPerson"]         = req.TpaContactPerson,
            ["tpaContactEmail"]          = req.TpaContactEmail,
            ["tpaContactPhone"]          = req.TpaContactPhone,
            ["surgeryDate"]              = req.SurgeryDate,
            ["diagnosisCode"]            = req.DiagnosisCode,
            ["procedureCode"]            = req.ProcedureCode,
            ["estimatedAmount"]          = req.EstimatedAmount,
            ["estimatedSurgery"]         = req.EstimatedSurgery,
            ["estimatedRoom"]            = req.EstimatedRoom,
            ["estimatedMedicines"]       = req.EstimatedMedicines,
            ["estimatedLab"]             = req.EstimatedLab,
            ["estimatedOther"]           = req.EstimatedOther,
            ["paymentType"]              = req.PaymentType,
            ["roomClassEntitlement"]     = req.RoomClassEntitlement,
            ["networkHospitalConfirmed"] = req.NetworkHospitalConfirmed,
            ["insuranceProviderId"]      = req.InsuranceProviderId,
        };

        if (!string.IsNullOrWhiteSpace(req.FinancialYearId) &&
            !Guid.TryParse(req.FinancialYearId, out _))
            draft["financialYear"] = req.FinancialYearId;

        if (!string.IsNullOrWhiteSpace(req.CounsellorDraftJson))
        {
            try
            {
                var client = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(
                    req.CounsellorDraftJson);
                if (client is not null)
                {
                    foreach (var key in new[]
                    {
                        "financialYear",
                        "insuranceProviderId",
                        "estimateLineItems",
                        "surgeryProcedureLabel",
                        "manualCovered",
                        "serviceTaxApplicable",
                        "serviceTaxPercent",
                        "estimateSyncSources",
                    })
                    {
                        if (client.TryGetValue(key, out var val) && val.ValueKind != JsonValueKind.Null)
                            draft[key] = JsonSerializer.Deserialize<object>(val.GetRawText());
                    }
                }
            }
            catch
            {
                // Ignore malformed client draft — server scalars still persist.
            }
        }

        return JsonSerializer.Serialize(draft, serializeOpts);
    }

    // ── Admission validation (canonical decision policy — Phase 1) ────────────

    public async Task<AdmissionValidationResult> ValidateAdmissionAsync(
        Guid tenantId,
        Guid? journeyId,
        Guid? sessionId,
        bool emergencyFcApplied = false,
        CancellationToken ct = default)
    {
        CcmsCoverageCase? coverageCase = null;
        if (journeyId.HasValue)
            coverageCase = await GetByJourneyIdAsync(journeyId.Value, ct);
        if (coverageCase is null && sessionId.HasValue)
            coverageCase = await GetBySessionIdAsync(sessionId.Value, ct);

        var decision = AdmissionCoverageDecisionPolicy.Decide(coverageCase, emergencyFcApplied);
        if (coverageCase is null)
            return decision;

        CcmsCoverageAuthorization? auth = await _db.CoverageAuthorizations.AsNoTracking()
            .Where(a => a.CoverageCase_Id == coverageCase.Id && a.DeletedAt == null)
            .OrderByDescending(a => a.UpdatedAt)
            .FirstOrDefaultAsync(ct);

        CcmsBillingSummary? bill = await _db.BillingSummaries.AsNoTracking()
            .Where(b => b.CoverageCase_Id == coverageCase.Id && b.DeletedAt == null)
            .OrderByDescending(b => b.CreatedAt)
            .FirstOrDefaultAsync(ct);

        var (payer, patient) = CoverageShareProjection.From(coverageCase, auth, bill);
        var projection = await _db.CollectionProjections.AsNoTracking()
            .FirstOrDefaultAsync(p => p.CoverageCaseId == coverageCase.Id && p.DeletedAt == null, ct);
        var obligation = projection is { PatientObligationAmount: > 0 }
            ? projection.PatientObligationAmount
            : patient;
        return decision with
        {
            PayerShareAmount = payer,
            PatientShareAmount = patient,
            CoverageStatus = CoverageStatusClassifier.Classify(coverageCase.CurrentState),
            CollectedAmount = projection?.NetCollected ?? 0,
            PatientObligationAmount = obligation,
        };
    }

    /// <summary>
    /// Links JourneyId onto a coverage case for IP lifecycle integration.
    /// Prefer session match when JourneyId is not yet set; never overwrites a different JourneyId.
    /// </summary>
    public async Task<CcmsCoverageCase?> LinkJourneyIdAsync(
        Guid journeyId,
        Guid? sessionId,
        Guid actorUserId,
        CancellationToken ct = default)
    {
        var byJourney = await GetByJourneyIdAsync(journeyId, ct);
        if (byJourney is not null)
            return byJourney;

        CcmsCoverageCase? coverageCase = null;
        if (sessionId.HasValue)
            coverageCase = await GetBySessionIdAsync(sessionId.Value, ct);

        if (coverageCase is null)
            return null;

        if (coverageCase.JourneyId.HasValue && coverageCase.JourneyId.Value != journeyId)
        {
            _log.LogWarning(
                "Refusing JourneyId link: case {CaseId} already linked to {Existing}, requested {Requested}",
                coverageCase.Id, coverageCase.JourneyId, journeyId);
            return coverageCase;
        }

        coverageCase.JourneyId = journeyId;
        coverageCase.UpdatedAt = DateTime.UtcNow;
        coverageCase.UpdatedByUserId = actorUserId;
        await _db.SaveChangesAsync(ct);
        _log.LogInformation("Linked JourneyId {JourneyId} to coverage case {CaseId}", journeyId, coverageCase.Id);
        return coverageCase;
    }

    /// <summary>
    /// Marks Emergency Financial Clearance on the coverage case so subsequent
    /// validate-admission decisions reflect the audited IP exception.
    /// </summary>
    public async Task<CcmsCoverageCase?> ApplyEmergencyFcAsync(
        Guid tenantId,
        Guid? journeyId,
        Guid? sessionId,
        string reason,
        Guid actorUserId,
        CancellationToken ct = default)
    {
        CcmsCoverageCase? coverageCase = null;
        if (journeyId.HasValue)
            coverageCase = await _db.CoverageCases
                .FirstOrDefaultAsync(c => c.JourneyId == journeyId && c.DeletedAt == null, ct);
        if (coverageCase is null && sessionId.HasValue)
            coverageCase = await _db.CoverageCases
                .FirstOrDefaultAsync(c => c.SessionId == sessionId && c.DeletedAt == null, ct);
        if (coverageCase is null || coverageCase.TenantId != tenantId)
            return null;

        coverageCase.EmergencyFcApplied = true;
        coverageCase.UpdatedAt = DateTime.UtcNow;
        coverageCase.UpdatedByUserId = actorUserId;
        // Persist reason in counsellor draft JSON when no dedicated column exists.
        try
        {
            var draft = string.IsNullOrWhiteSpace(coverageCase.CounsellorDraftJson)
                ? new Dictionary<string, object?>()
                : System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object?>>(
                      coverageCase.CounsellorDraftJson!)
                  ?? new Dictionary<string, object?>();
            draft["emergencyFcReason"] = reason;
            draft["emergencyFcAppliedAt"] = DateTime.UtcNow.ToString("O");
            draft["emergencyFcAppliedBy"] = actorUserId.ToString();
            coverageCase.CounsellorDraftJson = System.Text.Json.JsonSerializer.Serialize(draft);
        }
        catch
        {
            // Non-fatal — flag is still set.
        }

        await _db.SaveChangesAsync(ct);
        return coverageCase;
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private async Task<string> GenerateCaseNumberAsync(
        Guid tenantId, Guid fyId, string yearCode, CancellationToken ct)
    {
        // Use raw ADO.NET — EF Core wraps SqlQueryRaw in a subquery which breaks
        // INSERT...RETURNING (PostgreSQL doesn't allow DML in a derived table).
        var conn = _db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open)
            await conn.OpenAsync(ct);

        // Ensure the sequence tracking table exists.
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText =
                """
                CREATE TABLE IF NOT EXISTS ccms_case_number_sequences (
                    tenant_id           UUID   NOT NULL,
                    financial_year_id   UUID   NOT NULL,
                    last_sequence       BIGINT NOT NULL DEFAULT 0,
                    PRIMARY KEY (tenant_id, financial_year_id)
                )
                """;
            await cmd.ExecuteNonQueryAsync(ct);
        }

        // Atomic upsert — returns the new sequence value.
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText =
                """
                INSERT INTO ccms_case_number_sequences (tenant_id, financial_year_id, last_sequence)
                VALUES (@tid, @fid, 1)
                ON CONFLICT (tenant_id, financial_year_id)
                DO UPDATE SET last_sequence = ccms_case_number_sequences.last_sequence + 1
                RETURNING last_sequence
                """;

            var p1 = cmd.CreateParameter(); p1.ParameterName = "tid"; p1.Value = tenantId; cmd.Parameters.Add(p1);
            var p2 = cmd.CreateParameter(); p2.ParameterName = "fid"; p2.Value = fyId;     cmd.Parameters.Add(p2);

            var seq = (long)(await cmd.ExecuteScalarAsync(ct))!;
            return $"CCMS-{yearCode}-{seq:D6}";
        }
    }
}

// ── Supporting types ─────────────────────────────────────────────────────────

public record CreateCoverageCaseRequest(
    Guid    PatientId,
    string? PatientName,
    Guid?   SessionId,
    /// <summary>Alias for SessionId — accepted when the frontend sends counselingSessionId.</summary>
    Guid?   CounselingSessionId,
    Guid?   JourneyId,
    Guid?   FinancialYearId,
    Guid?   BranchId,
    Guid?   DoctorId,
    string  PayerType,
    string? PaymentType,
    Guid?   InsuranceProviderId,
    Guid?   TpaProviderId,
    Guid?   GovernmentSchemeId,
    Guid?   CoveragePackageId,
    Guid?   LegacyPreauthId,
    Guid?   SessionPreauthId,
    string? InsurerName = null,
    decimal? EstimatedAmount = null,
    string? CounsellorDraftJson = null
);

/// <summary>Payload for PATCH /ccms/coverage-cases/{id} — all fields optional.</summary>
public record PatchCoverageCaseRequest(
    string?  InsurerName,
    string?  InsuranceProviderId,   // free-text name OR uuid string — stored in draft JSON
    string?  PolicyNumber,
    string?  MembershipNumber,
    string?  InsuredName,
    string?  RelationshipToInsured,
    decimal? SumInsured,
    decimal? CoPay,
    string?  RoomClassEntitlement,
    bool?    NetworkHospitalConfirmed,
    string?  PolicyExpiry,
    string?  FinancialYearId,
    string?  CoverageNotes,
    string?  SurgeryDate,
    string?  DiagnosisCode,
    string?  ProcedureCode,
    string?  UrgencyLevel,
    decimal? EstimatedSurgery,
    decimal? EstimatedRoom,
    decimal? EstimatedMedicines,
    decimal? EstimatedLab,
    decimal? EstimatedOther,
    decimal? EstimatedAmount,
    string?  TpaContactPerson,
    string?  TpaContactEmail,
    string?  TpaContactPhone,
    string?  ClinicalNotes,
    string?  PaymentType,
    bool?    IsDraft,
    string?  CounsellorDraftJson
);

public record PagedResult<T>(
    List<T> Items,
    int     Total,
    int     Page,
    int     PageSize
);

public record AdmissionValidationResult(
    bool    Allowed,
    string  WarningLevel,    // "none" | "info" | "warning" | "blocked"
    string? WarningMessage,
    string? BlockReason,
    Guid?   CaseId,
    decimal ApprovedAmount,
    string? RoomClassApproved,
    DateTime? ValidUntil,
    string? PreAuthNumber,
    bool    RequiresEmergencyFcOverride,
    /// <summary>ALLOW | WARN | BLOCK — distinct from WarningLevel display tone.</summary>
    string  Decision = AdmissionCoverageDecisionPolicy.DecisionAllow,
    string? CoverageState = null,
    bool    IsEmergencyFinancialClearance = false,
    string? PaymentType = null,
    DateTime? LastUpdatedAt = null,
    decimal PayerShareAmount = 0,
    decimal PatientShareAmount = 0,
    string? CoverageStatus = null,
    decimal CollectedAmount = 0,
    decimal PatientObligationAmount = 0
)
{
    public static AdmissionValidationResult Allow(
        string? message = null,
        CcmsCoverageCase? c = null,
        string decision = AdmissionCoverageDecisionPolicy.DecisionAllow) =>
        new(true, message is null ? "none" : "info", message, null,
            c?.Id, c?.ApprovedAmount ?? 0, c?.RoomClassApproved,
            c?.PreAuthExpiry, c?.PreAuthNumber, false,
            decision, c?.CurrentState, false, c?.PaymentType, c?.UpdatedAt,
            CoverageStatus: CoverageStatusClassifier.Classify(c?.CurrentState));

    public static AdmissionValidationResult Warn(
        string msg,
        CcmsCoverageCase? c = null,
        string decision = AdmissionCoverageDecisionPolicy.DecisionWarn,
        bool isEmergencyFc = false) =>
        new(true, "warning", msg, null,
            c?.Id, c?.ApprovedAmount ?? 0, c?.RoomClassApproved,
            c?.PreAuthExpiry, c?.PreAuthNumber, isEmergencyFc,
            decision, c?.CurrentState, isEmergencyFc, c?.PaymentType, c?.UpdatedAt,
            CoverageStatus: CoverageStatusClassifier.Classify(c?.CurrentState));

    public static AdmissionValidationResult Block(string reason, CcmsCoverageCase? c = null) =>
        new(false, "blocked", null, reason,
            c?.Id, c?.ApprovedAmount ?? 0, c?.RoomClassApproved,
            c?.PreAuthExpiry, c?.PreAuthNumber, true,
            AdmissionCoverageDecisionPolicy.DecisionBlock,
            c?.CurrentState, false, c?.PaymentType, c?.UpdatedAt,
            CoverageStatus: CoverageStatusClassifier.Classify(c?.CurrentState));
}

// EF raw SQL helper
public static class DbContextExtensions
{
    public static IQueryable<CcmsWorkflowInstance> CoveragesCases(this CcmsDbContext db)
        => db.WorkflowInstances;
}
