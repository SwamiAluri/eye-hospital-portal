using CcmsApi.Data;
using CcmsApi.Models.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

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
    private readonly ILogger<CoverageCaseService> _log;

    public CoverageCaseService(
        CcmsDbContext db,
        IWorkflowEngine workflow,
        FinancialYearService fyService,
        ILogger<CoverageCaseService> log)
    {
        _db       = db;
        _workflow = workflow;
        _fyService = fyService;
        _log      = log;
    }

    // ── Create Coverage Case ─────────────────────────────────────────────────

    public async Task<CcmsCoverageCase> CreateAsync(
        Guid tenantId, Guid actorUserId, CreateCoverageCaseRequest req, CancellationToken ct = default)
    {
        // Resolve financial year
        var fyId = req.FinancialYearId
            ?? await _fyService.GetCurrentFinancialYearIdAsync(tenantId, actorUserId, ct);

        var fy = await _fyService.GetByIdAsync(fyId, ct)
            ?? throw new InvalidOperationException("Financial year not found.");

        // Generate case number atomically via DB function
        var caseNumber = await GenerateCaseNumberAsync(tenantId, fyId, fy.YearCode, ct);

        // Start workflow instance
        var instance = await _workflow.StartAsync(
            tenantId, Guid.NewGuid(), "coverage_case", actorUserId, ct);

        var coverageCase = new CcmsCoverageCase
        {
            Id                  = Guid.NewGuid(),
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
            SessionPreauthId    = req.SessionPreauthId
        };

        // Update workflow instance entity ID now that we have the case ID
        instance.EntityId = coverageCase.Id;
        _db.WorkflowInstances.Update(instance);

        _db.CoverageCases.Add(coverageCase);
        await _db.SaveChangesAsync(ct);

        _log.LogInformation("Coverage case {Num} created for patient {Patient}",
            caseNumber, req.PatientId);
        return coverageCase;
    }

    // ── Query ────────────────────────────────────────────────────────────────

    public async Task<CcmsCoverageCase?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _db.CoverageCases.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id && c.DeletedAt == null, ct);

    public async Task<CcmsCoverageCase?> GetBySessionIdAsync(Guid sessionId, CancellationToken ct = default)
        => await _db.CoverageCases.AsNoTracking()
            .FirstOrDefaultAsync(c => c.SessionId == sessionId && c.DeletedAt == null, ct);

    public async Task<List<CcmsCoverageCase>> GetBySessionIdsAsync(
        List<Guid> sessionIds, CancellationToken ct = default)
        => await _db.CoverageCases.AsNoTracking()
            .Where(c => sessionIds.Contains(c.SessionId!.Value) && c.DeletedAt == null)
            .ToListAsync(ct);

    public async Task<CcmsCoverageCase?> GetByJourneyIdAsync(Guid journeyId, CancellationToken ct = default)
        => await _db.CoverageCases.AsNoTracking()
            .FirstOrDefaultAsync(c => c.JourneyId == journeyId && c.DeletedAt == null, ct);

    public async Task<PagedResult<CcmsCoverageCase>> ListAsync(
        Guid tenantId,
        string? state = null,
        string? payerType = null,
        Guid? insuranceProviderId = null,
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default)
    {
        var q = _db.CoverageCases.AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null);

        if (!string.IsNullOrEmpty(state))
            q = q.Where(c => c.CurrentState == state);
        if (!string.IsNullOrEmpty(payerType))
            q = q.Where(c => c.PayerType == payerType);
        if (insuranceProviderId.HasValue)
            q = q.Where(c => c.InsuranceProviderId == insuranceProviderId.Value);

        var total = await q.CountAsync(ct);
        var items = await q
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<CcmsCoverageCase>(items, total, page, pageSize);
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
    }

    // ── Admission validation (9-case matrix) ─────────────────────────────────

    public async Task<AdmissionValidationResult> ValidateAdmissionAsync(
        Guid tenantId, Guid? journeyId, Guid? sessionId, CancellationToken ct = default)
    {
        // No CCMS case → allow
        CcmsCoverageCase? coverageCase = null;
        if (journeyId.HasValue)
            coverageCase = await GetByJourneyIdAsync(journeyId.Value, ct);
        if (coverageCase is null && sessionId.HasValue)
            coverageCase = await GetBySessionIdAsync(sessionId.Value, ct);

        if (coverageCase is null)
            return AdmissionValidationResult.Allow("No coverage case found. Proceeding normally.");

        var state = coverageCase.CurrentState;
        var emergencyFc = coverageCase.EmergencyFcApplied;
        var preAuthSent = state is "PREAUTH_SENT" or "WAITING_APPROVAL" or "APPROVED"
            or "PARTIAL_APPROVAL" or "ADMISSION_READY" or "ADMITTED"
            or "CLARIFICATION_REQUIRED" or "RESUBMITTED";

        return state switch
        {
            "APPROVED"             => AdmissionValidationResult.Allow(null, coverageCase),
            "PARTIAL_APPROVAL"     => AdmissionValidationResult.Warn("Partial approval. Patient share applicable.", coverageCase),
            "WAITING_APPROVAL" when emergencyFc
                                   => AdmissionValidationResult.Warn("Emergency FC applied. Pre-auth pending.", coverageCase),
            "WAITING_APPROVAL" when preAuthSent
                                   => AdmissionValidationResult.Warn("Pre-auth sent; awaiting TPA response.", coverageCase),
            "WAITING_APPROVAL"     => AdmissionValidationResult.Block("Pre-auth not yet sent to TPA. Cannot admit."),
            "PREAUTH_GENERATED" when emergencyFc
                                   => AdmissionValidationResult.Warn("Emergency FC applied. Pre-auth generated but not sent.", coverageCase),
            "PREAUTH_GENERATED"    => AdmissionValidationResult.Block("Pre-auth generated but not sent to TPA."),
            "CLARIFICATION_REQUIRED"
                                   => AdmissionValidationResult.Warn("TPA requested clarification.", coverageCase),
            "RESUBMITTED"          => AdmissionValidationResult.Warn("Pre-auth resubmitted. Awaiting TPA decision.", coverageCase),
            "REJECTED"             => AdmissionValidationResult.Block("TPA rejected pre-auth. Cannot admit under insurance."),
            "EXPIRED"              => AdmissionValidationResult.Block("Pre-auth has expired. Renewal required."),
            "CANCELLED" or "ABORTED"
                                   => AdmissionValidationResult.Block("Coverage case was cancelled/aborted."),
            "DRAFT" or "ELIGIBILITY_PENDING" or "ELIGIBILITY_VERIFIED" or "POLICY_CAPTURED" or "AUTHORIZATION_REQUIRED"
                                   => AdmissionValidationResult.Allow("Pre-auth process not yet started. Informational.", coverageCase),
            _                      => AdmissionValidationResult.Allow($"State: {state}. Proceeding.", coverageCase)
        };
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
    Guid?   SessionPreauthId
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
    bool    RequiresEmergencyFcOverride
)
{
    public static AdmissionValidationResult Allow(string? message = null, CcmsCoverageCase? c = null) =>
        new(true, message is null ? "none" : "info", message, null,
            c?.Id, c?.ApprovedAmount ?? 0, c?.RoomClassApproved,
            c?.PreAuthExpiry, c?.PreAuthNumber, false);

    public static AdmissionValidationResult Warn(string msg, CcmsCoverageCase? c = null) =>
        new(true, "warning", msg, null,
            c?.Id, c?.ApprovedAmount ?? 0, c?.RoomClassApproved,
            c?.PreAuthExpiry, c?.PreAuthNumber, false);

    public static AdmissionValidationResult Block(string reason) =>
        new(false, "blocked", null, reason, null, 0, null, null, null, true);
}

// EF raw SQL helper
public static class DbContextExtensions
{
    public static IQueryable<CcmsWorkflowInstance> CoveragesCases(this CcmsDbContext db)
        => db.WorkflowInstances;
}
