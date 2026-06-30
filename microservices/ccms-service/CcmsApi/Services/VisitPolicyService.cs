using CcmsApi.Data;
using CcmsApi.Models.Domain;
using CcmsApi.Models.Dtos;
using Microsoft.EntityFrameworkCore;

namespace CcmsApi.Services;

/// <summary>
/// CRUD + set-primary operations for ccms_visit_insurance_policies.
/// Each session / coverage case can hold multiple policies;
/// exactly one may be flagged is_primary.
/// </summary>
public class VisitPolicyService
{
    private readonly CcmsDbContext _db;

    public VisitPolicyService(CcmsDbContext db) => _db = db;

    // ── Mapping ───────────────────────────────────────────────────────────────
    internal static VisitPolicyDto ToDto(CcmsVisitInsurancePolicy p) => new(
        p.Id, p.SessionId, p.CoverageCase_Id,
        p.PolicyNumber, p.CardNumber, p.MembershipNumber,
        p.InsuranceProviderId, p.TpaProviderId,
        p.InsuredName, p.RelationshipToInsured,
        p.CompanyName, p.Occupation, p.Designation, p.EmployeeId,
        p.VideNumber, p.ContactNumber,
        p.DoctorName, p.DoctorRegNumber, p.DoctorQualification, p.DoctorContact,
        p.AccommodationClass, p.TpaCoordinatorName,
        p.IsPrimary, p.SortOrder, p.UnderwritingSnapshotJson,
        p.ServiceTaxApplicable,
        p.CreatedAt, p.UpdatedAt);

    // ── Queries ──────────────────────────────────────────────────────────────

    public async Task<List<VisitPolicyDto>> GetByCaseAsync(
        Guid caseId, CancellationToken ct = default)
        => (await _db.VisitInsurancePolicies.AsNoTracking()
            .Where(p => p.CoverageCase_Id == caseId && p.DeletedAt == null)
            .OrderBy(p => p.SortOrder).ThenBy(p => p.CreatedAt)
            .ToListAsync(ct))
            .Select(ToDto)
            .ToList();

    public async Task<List<VisitPolicyDto>> GetBySessionAsync(
        Guid sessionId, CancellationToken ct = default)
        => (await _db.VisitInsurancePolicies.AsNoTracking()
            .Where(p => p.SessionId == sessionId && p.DeletedAt == null)
            .OrderBy(p => p.SortOrder).ThenBy(p => p.CreatedAt)
            .ToListAsync(ct))
            .Select(ToDto)
            .ToList();

    public async Task<VisitPolicyDto?> GetByIdAsync(
        Guid id, CancellationToken ct = default)
    {
        var p = await _db.VisitInsurancePolicies.AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == id && e.DeletedAt == null, ct);
        return p is null ? null : ToDto(p);
    }

    // ── Create ───────────────────────────────────────────────────────────────

    public async Task<VisitPolicyDto> CreateAsync(
        CcmsVisitInsurancePolicy policy, Guid actorId, CancellationToken ct = default)
    {
        if (policy.SessionId is null && policy.CoverageCase_Id is null)
            throw new ArgumentException("Either SessionId or CoverageCase_Id must be set.");

        policy.Id              = Guid.NewGuid();
        policy.CreatedAt       = DateTime.UtcNow;
        policy.UpdatedAt       = DateTime.UtcNow;
        policy.CreatedByUserId = actorId;
        policy.UpdatedByUserId = actorId;

        if (!string.IsNullOrWhiteSpace(policy.PolicyNumber))
        {
            var normalized = policy.PolicyNumber.Trim().ToLowerInvariant();
            var ownerCaseId = policy.CoverageCase_Id;
            var ownerSessionId = policy.SessionId;

            var isDuplicate = await _db.VisitInsurancePolicies.AnyAsync(p =>
                p.DeletedAt == null
                && p.PolicyNumber != null
                && p.PolicyNumber.ToLower() == normalized
                && (ownerCaseId.HasValue
                    ? p.CoverageCase_Id == ownerCaseId
                    : ownerSessionId.HasValue && p.SessionId == ownerSessionId),
                ct);

            if (isDuplicate)
                throw new InvalidOperationException(
                    $"A policy with number '{policy.PolicyNumber}' already exists for this visit.");
        }

        // If this is marked primary, clear existing primary flag for the same owner.
        if (policy.IsPrimary)
            await ClearPrimaryFlagAsync(policy.SessionId, policy.CoverageCase_Id, null, ct);

        _db.VisitInsurancePolicies.Add(policy);
        await _db.SaveChangesAsync(ct);
        return ToDto(policy);
    }

    // ── Update ───────────────────────────────────────────────────────────────

    public async Task<VisitPolicyDto> UpdateAsync(
        Guid id, CcmsVisitInsurancePolicy patch, Guid actorId, CancellationToken ct = default)
    {
        var existing = await _db.VisitInsurancePolicies
            .FirstOrDefaultAsync(p => p.Id == id && p.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Visit policy {id} not found.");

        // Patching scalar fields
        existing.PolicyNumber              = patch.PolicyNumber;
        existing.CardNumber                = patch.CardNumber;
        existing.MembershipNumber          = patch.MembershipNumber;
        existing.InsuranceProviderId       = patch.InsuranceProviderId;
        existing.TpaProviderId             = patch.TpaProviderId;
        existing.InsuredName               = patch.InsuredName;
        existing.RelationshipToInsured     = patch.RelationshipToInsured;
        existing.Occupation                = patch.Occupation;
        existing.Designation               = patch.Designation;
        existing.CompanyName               = patch.CompanyName;
        existing.EmployeeId                = patch.EmployeeId;
        existing.VideNumber                = patch.VideNumber;
        existing.ContactNumber             = patch.ContactNumber;
        existing.DoctorName                = patch.DoctorName;
        existing.DoctorRegNumber           = patch.DoctorRegNumber;
        existing.DoctorQualification       = patch.DoctorQualification;
        existing.DoctorContact             = patch.DoctorContact;
        existing.AccommodationClass        = patch.AccommodationClass;
        existing.DetailsText               = patch.DetailsText;
        existing.TpaCoordinatorName        = patch.TpaCoordinatorName;
        existing.SortOrder                 = patch.SortOrder;
        existing.UnderwritingSnapshotJson  = patch.UnderwritingSnapshotJson;
        existing.ServiceTaxApplicable      = patch.ServiceTaxApplicable;
        existing.UpdatedAt                 = DateTime.UtcNow;
        existing.UpdatedByUserId           = actorId;
        existing.RowVersion               += 1;

        if (patch.IsPrimary && !existing.IsPrimary)
        {
            await ClearPrimaryFlagAsync(existing.SessionId, existing.CoverageCase_Id, id, ct);
            existing.IsPrimary = true;
        }
        else if (!patch.IsPrimary)
        {
            existing.IsPrimary = false;
        }

        await _db.SaveChangesAsync(ct);
        return ToDto(existing);
    }

    // ── Set Primary ──────────────────────────────────────────────────────────

    public async Task<VisitPolicyDto> SetPrimaryAsync(
        Guid id, Guid actorId, CancellationToken ct = default)
    {
        var policy = await _db.VisitInsurancePolicies
            .FirstOrDefaultAsync(p => p.Id == id && p.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Visit policy {id} not found.");

        await ClearPrimaryFlagAsync(policy.SessionId, policy.CoverageCase_Id, id, ct);

        policy.IsPrimary         = true;
        policy.UpdatedAt         = DateTime.UtcNow;
        policy.UpdatedByUserId   = actorId;
        policy.RowVersion       += 1;

        await _db.SaveChangesAsync(ct);
        return ToDto(policy);
    }

    // ── Delete ───────────────────────────────────────────────────────────────

    public async Task DeleteAsync(Guid id, Guid actorId, CancellationToken ct = default)
    {
        var policy = await _db.VisitInsurancePolicies
            .FirstOrDefaultAsync(p => p.Id == id && p.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Visit policy {id} not found.");

        policy.DeletedAt       = DateTime.UtcNow;
        policy.Status          = "deleted";
        policy.UpdatedAt       = DateTime.UtcNow;
        policy.UpdatedByUserId = actorId;
        await _db.SaveChangesAsync(ct);
    }

    // ── Case lookup helpers ───────────────────────────────────────────────────

    /// <summary>
    /// Returns the patient_id from the coverage case — used for optional
    /// fire-and-forget patient_insurance sync to auth-service.
    /// </summary>
    public async Task<Guid?> GetPatientIdByCaseIdAsync(
        Guid caseId, CancellationToken ct = default)
        => (await _db.CoverageCases.AsNoTracking()
                .Where(c => c.Id == caseId && c.DeletedAt == null)
                .Select(c => (Guid?)c.PatientId)
                .FirstOrDefaultAsync(ct));

    // ── Helpers ──────────────────────────────────────────────────────────────

    private async Task ClearPrimaryFlagAsync(
        Guid? sessionId, Guid? caseId, Guid? excludeId, CancellationToken ct)
    {
        var q = _db.VisitInsurancePolicies
            .Where(p => p.IsPrimary && p.DeletedAt == null);

        if (sessionId.HasValue)
            q = q.Where(p => p.SessionId == sessionId.Value);
        else if (caseId.HasValue)
            q = q.Where(p => p.CoverageCase_Id == caseId.Value);

        if (excludeId.HasValue)
            q = q.Where(p => p.Id != excludeId.Value);

        var rows = await q.ToListAsync(ct);
        foreach (var r in rows)
        {
            r.IsPrimary  = false;
            r.UpdatedAt  = DateTime.UtcNow;
        }
    }
}
