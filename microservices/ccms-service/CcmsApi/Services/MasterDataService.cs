using CcmsApi.Data;
using CcmsApi.Models.Domain;
using Microsoft.EntityFrameworkCore;

namespace CcmsApi.Services;

/// <summary>
/// CRUD operations for CCMS master data:
/// insurance providers, TPA providers, government schemes, coverage packages.
/// </summary>
public class MasterDataService
{
    private readonly CcmsDbContext _db;

    public MasterDataService(CcmsDbContext db) => _db = db;

    // ── Insurance Providers ──────────────────────────────────────────────────

    public async Task<List<CcmsInsuranceProvider>> ListInsuranceProvidersAsync(
        Guid tenantId, CancellationToken ct = default)
        => await _db.InsuranceProviders.AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null)
            .OrderBy(p => p.ProviderName)
            .ToListAsync(ct);

    public async Task<CcmsInsuranceProvider?> GetInsuranceProviderAsync(
        Guid id, CancellationToken ct = default)
        => await _db.InsuranceProviders.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id && p.DeletedAt == null, ct);

    public async Task<CcmsInsuranceProvider> CreateInsuranceProviderAsync(
        CcmsInsuranceProvider provider, CancellationToken ct = default)
    {
        var category = string.IsNullOrWhiteSpace(provider.PayerCategory)
            ? "insurance"
            : provider.PayerCategory.Trim().ToLowerInvariant();

        if (category == "insurance")
        {
            if (string.IsNullOrWhiteSpace(provider.ProviderCode))
                throw new ArgumentException("Provider code is required for insurance payers.");

            provider.ProviderCode = provider.ProviderCode.Trim().ToUpperInvariant();

            if (string.IsNullOrWhiteSpace(provider.ProviderName))
                throw new ArgumentException("Provider name is required.");

            var duplicate = await _db.InsuranceProviders
                .AnyAsync(p => p.TenantId == provider.TenantId
                    && p.ProviderCode == provider.ProviderCode
                    && p.DeletedAt == null, ct);
            if (duplicate)
                throw new InvalidOperationException(
                    $"A payer with code '{provider.ProviderCode}' already exists for this tenant.");
        }

        provider.PayerCategory = category;
        provider.Id        = Guid.NewGuid();
        provider.CreatedAt = DateTime.UtcNow;
        provider.UpdatedAt = DateTime.UtcNow;
        _db.InsuranceProviders.Add(provider);
        await _db.SaveChangesAsync(ct);
        return provider;
    }

    public async Task<CcmsInsuranceProvider> UpdateInsuranceProviderAsync(
        CcmsInsuranceProvider patch, CancellationToken ct = default)
    {
        var existing = await _db.InsuranceProviders
            .FirstOrDefaultAsync(p => p.Id == patch.Id && p.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Insurance provider {patch.Id} not found.");

        var category = string.IsNullOrWhiteSpace(existing.PayerCategory)
            ? "insurance"
            : existing.PayerCategory.Trim().ToLowerInvariant();

        // Insurance identity (name/code) is owned by Master Data — only sync via migration/seed.
        if (category == "other_debtor")
        {
            existing.ProviderName = patch.ProviderName;
            existing.ProviderCode = patch.ProviderCode;
        }

        existing.LicenseNumber             = patch.LicenseNumber;
        existing.ContactEmail              = patch.ContactEmail;
        existing.ContactPhone              = patch.ContactPhone;
        existing.PortalUrl                 = patch.PortalUrl;
        existing.ApiEndpoint               = patch.ApiEndpoint;
        existing.ClaimSubmissionMode       = patch.ClaimSubmissionMode;
        existing.PreAuthRequired           = patch.PreAuthRequired;
        existing.AddressJson               = patch.AddressJson;
        // Migration 123 fields
        existing.PayerCategory             = patch.PayerCategory;
        existing.DebtorSubtype             = patch.DebtorSubtype;
        existing.CreditLimit               = patch.CreditLimit;
        existing.ExportCode                = patch.ExportCode;
        existing.HospitalIdentifier        = patch.HospitalIdentifier;
        existing.ServiceTaxApplicable      = patch.ServiceTaxApplicable;
        existing.DefaultServiceTaxPercent  = patch.DefaultServiceTaxPercent;
        existing.TdsMandatory              = patch.TdsMandatory;
        existing.ValidFrom                 = patch.ValidFrom;
        existing.ValidTo                   = patch.ValidTo;
        existing.FormatCode                = patch.FormatCode;
        // Audit
        existing.UpdatedAt                 = DateTime.UtcNow;
        existing.UpdatedByUserId           = patch.UpdatedByUserId;
        existing.RowVersion               += 1;

        await _db.SaveChangesAsync(ct);
        return existing;
    }

    public async Task SoftDeleteInsuranceProviderAsync(
        Guid id, Guid actorId, CancellationToken ct = default)
    {
        var p = await _db.InsuranceProviders.FindAsync(new object[] { id }, ct)
            ?? throw new KeyNotFoundException($"Insurance provider {id} not found.");
        p.DeletedAt       = DateTime.UtcNow;
        p.Status          = "deleted";
        p.UpdatedByUserId = actorId;
        p.UpdatedAt       = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    // ── TPA Providers ────────────────────────────────────────────────────────

    public async Task<List<CcmsTpaProvider>> ListTpaProvidersAsync(
        Guid tenantId, Guid? insuranceProviderId = null, CancellationToken ct = default)
    {
        var q = _db.TpaProviders.AsNoTracking()
            .Where(t => t.TenantId == tenantId && t.DeletedAt == null);
        if (insuranceProviderId.HasValue)
            q = q.Where(t => t.InsuranceProviderId == insuranceProviderId.Value);
        return await q.OrderBy(t => t.TpaName).ToListAsync(ct);
    }

    public async Task<CcmsTpaProvider?> GetTpaProviderAsync(
        Guid id, CancellationToken ct = default)
        => await _db.TpaProviders.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id && t.DeletedAt == null, ct);

    public async Task<CcmsTpaProvider> CreateTpaProviderAsync(
        CcmsTpaProvider tpa, CancellationToken ct = default)
    {
        tpa.Id        = Guid.NewGuid();
        tpa.CreatedAt = DateTime.UtcNow;
        tpa.UpdatedAt = DateTime.UtcNow;
        _db.TpaProviders.Add(tpa);
        await _db.SaveChangesAsync(ct);
        return tpa;
    }

    public async Task<CcmsTpaProvider> UpdateTpaProviderAsync(
        CcmsTpaProvider tpa, CancellationToken ct = default)
    {
        tpa.UpdatedAt  = DateTime.UtcNow;
        tpa.RowVersion += 1;
        _db.TpaProviders.Update(tpa);
        await _db.SaveChangesAsync(ct);
        return tpa;
    }

    public async Task SoftDeleteTpaProviderAsync(
        Guid id, Guid actorId, CancellationToken ct = default)
    {
        var t = await _db.TpaProviders.FindAsync(new object[] { id }, ct)
            ?? throw new KeyNotFoundException($"TPA provider {id} not found.");
        t.DeletedAt       = DateTime.UtcNow;
        t.Status          = "deleted";
        t.UpdatedByUserId = actorId;
        t.UpdatedAt       = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    // ── Government Schemes ───────────────────────────────────────────────────

    public async Task<List<CcmsGovernmentScheme>> ListGovernmentSchemesAsync(
        Guid tenantId, CancellationToken ct = default)
        => await _db.GovernmentSchemes.AsNoTracking()
            .Where(g => g.TenantId == tenantId && g.DeletedAt == null)
            .OrderBy(g => g.SchemeName)
            .ToListAsync(ct);

    public async Task<CcmsGovernmentScheme?> GetGovernmentSchemeAsync(
        Guid id, CancellationToken ct = default)
        => await _db.GovernmentSchemes.AsNoTracking()
            .FirstOrDefaultAsync(g => g.Id == id && g.DeletedAt == null, ct);

    public async Task<CcmsGovernmentScheme> CreateGovernmentSchemeAsync(
        CcmsGovernmentScheme scheme, CancellationToken ct = default)
    {
        scheme.Id        = Guid.NewGuid();
        scheme.CreatedAt = DateTime.UtcNow;
        scheme.UpdatedAt = DateTime.UtcNow;
        _db.GovernmentSchemes.Add(scheme);
        await _db.SaveChangesAsync(ct);
        return scheme;
    }

    public async Task<CcmsGovernmentScheme> UpdateGovernmentSchemeAsync(
        CcmsGovernmentScheme scheme, CancellationToken ct = default)
    {
        scheme.UpdatedAt  = DateTime.UtcNow;
        scheme.RowVersion += 1;
        _db.GovernmentSchemes.Update(scheme);
        await _db.SaveChangesAsync(ct);
        return scheme;
    }

    // ── Coverage Packages ────────────────────────────────────────────────────

    public async Task<List<CcmsCoveragePackage>> ListCoveragePackagesAsync(
        Guid tenantId,
        Guid? insuranceProviderId = null,
        Guid? tpaProviderId = null,
        Guid? governmentSchemeId = null,
        CancellationToken ct = default)
    {
        var q = _db.CoveragePackages.AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null);
        if (insuranceProviderId.HasValue)
            q = q.Where(p => p.InsuranceProviderId == insuranceProviderId.Value);
        if (tpaProviderId.HasValue)
            q = q.Where(p => p.TpaProviderId == tpaProviderId.Value);
        if (governmentSchemeId.HasValue)
            q = q.Where(p => p.GovernmentSchemeId == governmentSchemeId.Value);
        return await q.OrderBy(p => p.PackageName).ToListAsync(ct);
    }

    public async Task<CcmsCoveragePackage?> GetCoveragePackageAsync(
        Guid id, CancellationToken ct = default)
        => await _db.CoveragePackages.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id && p.DeletedAt == null, ct);

    public async Task<CcmsCoveragePackage> CreateCoveragePackageAsync(
        CcmsCoveragePackage pkg, CancellationToken ct = default)
    {
        pkg.Id        = Guid.NewGuid();
        pkg.CreatedAt = DateTime.UtcNow;
        pkg.UpdatedAt = DateTime.UtcNow;
        _db.CoveragePackages.Add(pkg);
        await _db.SaveChangesAsync(ct);
        return pkg;
    }

    public async Task<CcmsCoveragePackage> UpdateCoveragePackageAsync(
        CcmsCoveragePackage pkg, CancellationToken ct = default)
    {
        pkg.UpdatedAt  = DateTime.UtcNow;
        pkg.RowVersion += 1;
        _db.CoveragePackages.Update(pkg);
        await _db.SaveChangesAsync(ct);
        return pkg;
    }

    // ── Document Requirements ────────────────────────────────────────────────

    public async Task<List<CcmsDocumentRequirement>> ListDocumentRequirementsAsync(
        Guid tenantId, string? payerType, string? stage, CancellationToken ct = default)
    {
        var q = _db.DocumentRequirements.AsNoTracking()
            .Where(d => d.TenantId == tenantId && d.DeletedAt == null);
        if (!string.IsNullOrEmpty(stage))
            q = q.Where(d => d.AppliesAt == stage);
        return await q.OrderBy(d => d.DocumentName).ToListAsync(ct);
    }

    public async Task<CcmsDocumentRequirement> CreateDocumentRequirementAsync(
        CcmsDocumentRequirement dr, CancellationToken ct = default)
    {
        dr.Id        = Guid.NewGuid();
        dr.CreatedAt = DateTime.UtcNow;
        dr.UpdatedAt = DateTime.UtcNow;
        _db.DocumentRequirements.Add(dr);
        await _db.SaveChangesAsync(ct);
        return dr;
    }
}
