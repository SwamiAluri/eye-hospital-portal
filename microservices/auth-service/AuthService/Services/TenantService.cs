using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public class TenantService : ITenantService
{
    private readonly AppDbContext _context;
    private readonly IMasterValueService _masterValueService;
    private readonly IServiceCatalogMasterSyncService _catalogMasterSyncService;
    private readonly ILogger<TenantService> _logger;

    public TenantService(
        AppDbContext context,
        IMasterValueService masterValueService,
        IServiceCatalogMasterSyncService catalogMasterSyncService,
        ILogger<TenantService> logger)
    {
        _context = context;
        _masterValueService = masterValueService;
        _catalogMasterSyncService = catalogMasterSyncService;
        _logger = logger;
    }

    public async Task<Tenant?> GetTenantByIdAsync(Guid id)
    {
        return await _context.Tenants
            .FirstOrDefaultAsync(t => t.Id == id);
    }

    public async Task<Tenant> CreateTenantAsync(Tenant tenant)
    {
        if (tenant.Id == Guid.Empty)
        {
            tenant.Id = Guid.NewGuid();
        }

        _context.Tenants.Add(tenant);
        await _context.SaveChangesAsync();

        try
        {
            await _masterValueService.SeedDefaultsForTenantAsync(tenant.Id, Guid.Empty);
            _logger.LogInformation("Seeded default master values for new tenant {TenantId}", tenant.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to seed master values for new tenant {TenantId}", tenant.Id);
        }

        try
        {
            await _catalogMasterSyncService.SyncTenantAsync(tenant.Id, Guid.Empty);
            _logger.LogInformation("Synced service catalog to master data for new tenant {TenantId}", tenant.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to sync service catalog for new tenant {TenantId}", tenant.Id);
        }

        return tenant;
    }

    public async Task<IEnumerable<Tenant>> GetAllTenantsAsync()
    {
        return await _context.Tenants.ToListAsync();
    }

    public async Task<bool> DeleteTenantAsync(Guid id)
    {
        var tenant = await _context.Tenants.FindAsync(id);
        if (tenant == null)
        {
            return false;
        }

        _context.Tenants.Remove(tenant);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<Tenant?> UpdateTenantAsync(Tenant tenant)
    {
        var existingTenant = await _context.Tenants.FindAsync(tenant.Id);
        if (existingTenant == null)
        {
            return null;
        }

        // Manually update each property to ensure EF tracks the changes
        existingTenant.Name = tenant.Name;
        existingTenant.TenantCode = tenant.TenantCode;
        existingTenant.TenantType = tenant.TenantType;
        existingTenant.Status = tenant.Status;
        existingTenant.SubscriptionTier = tenant.SubscriptionTier;
        existingTenant.Email = tenant.Email;
        existingTenant.Phone = tenant.Phone;
        existingTenant.PrimaryRegion = tenant.PrimaryRegion;
        existingTenant.DefaultCurrency = tenant.DefaultCurrency;
        existingTenant.MaxBranches = tenant.MaxBranches;
        existingTenant.MaxUsers = tenant.MaxUsers;
        existingTenant.HipaaCompliant = tenant.HipaaCompliant;
        existingTenant.NabhAccredited = tenant.NabhAccredited;
        existingTenant.GdprCompliant = tenant.GdprCompliant;
        existingTenant.DpaCompliant = tenant.DpaCompliant;
        existingTenant.Address = tenant.Address;
        existingTenant.City = tenant.City;
        existingTenant.State = tenant.State;
        existingTenant.Country = tenant.Country;
        existingTenant.Pincode = tenant.Pincode;
        existingTenant.UpdatedAt = tenant.UpdatedAt;
        existingTenant.IsActive = tenant.IsActive;
        
        await _context.SaveChangesAsync();
        
        return existingTenant;
    }

    public async Task<Tenant?> GetTenantByCodeAsync(string code)
    {
        return await _context.Tenants.FirstOrDefaultAsync(t => t.TenantCode == code);
    }

    public async Task<Tenant?> GetTenantByDomainAsync(string domain)
    {
        return await _context.Tenants.FirstOrDefaultAsync(t => t.Name != null && t.Name.Contains(domain));
    }

    public async Task<bool> UpdateTenantStatusAsync(Guid tenantId, string status)
    {
        var tenant = await _context.Tenants.FindAsync(tenantId);
        if (tenant == null) return false;
        tenant.Status = status;
        tenant.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> UpdateSubscriptionAsync(Guid tenantId, string tier, int maxBranches, int maxUsers)
    {
        var tenant = await _context.Tenants.FindAsync(tenantId);
        if (tenant == null) return false;
        tenant.SubscriptionTier = tier;
        tenant.MaxBranches = maxBranches;
        tenant.MaxUsers = maxUsers;
        tenant.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> UpdateComplianceAsync(Guid tenantId, bool hipaa, bool nabh, bool gdpr, bool dpa)
    {
        var tenant = await _context.Tenants.FindAsync(tenantId);
        if (tenant == null) return false;
        tenant.HipaaCompliant = hipaa;
        tenant.NabhAccredited = nabh;
        tenant.GdprCompliant = gdpr;
        tenant.DpaCompliant = dpa;
        tenant.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<IEnumerable<Tenant>> SearchTenantsAsync(string searchTerm)
    {
        return await _context.Tenants
            .Where(t => (t.Name != null && t.Name.Contains(searchTerm)) || 
                       (t.TenantCode != null && t.TenantCode.Contains(searchTerm)))
            .ToListAsync();
    }

    public async Task<object> GetUsageAsync(Guid tenantId)
    {
        return new { TenantId = tenantId, Message = "Usage data not implemented" };
    }

    public async Task<object> GetStatisticsAsync(Guid tenantId)
    {
        return new { TenantId = tenantId, Message = "Statistics not implemented" };
    }

    public async Task<object> CheckLimitsAsync(Guid tenantId)
    {
        return new { TenantId = tenantId, Message = "Limit checking not implemented" };
    }

    public async Task<int> GetOrganizationCountAsync(Guid tenantId)
    {
        return await _context.Organizations.CountAsync(o => o.TenantId == tenantId);
    }

    public async Task<int> GetBranchCountAsync(Guid tenantId)
    {
        return await _context.Branches.CountAsync(b => b.TenantId == tenantId);
    }

    public async Task<Dictionary<string, string>> GetAllTenantCodesForDebugAsync()
    {
        var tenants = await _context.Tenants.ToListAsync();
        return tenants.ToDictionary(t => t.Id.ToString(), t => t.TenantCode ?? "NO_CODE");
    }

    public async Task<List<object>> GetAllTenantsForLoginAsync()
    {
        var tenants = await _context.Tenants
            .Where(t => t.Status == "Active")
            .Select(t => new
            {
                id = t.Id.ToString(),
                name = t.Name,
                tenantCode = t.TenantCode
            })
            .ToListAsync();
        return tenants.Cast<object>().ToList();
    }
}