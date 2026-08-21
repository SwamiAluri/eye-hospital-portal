using AuthService.Models.Domain;

namespace AuthService.Services;

public interface ITenantService
{
    Task<Tenant?> GetTenantByIdAsync(Guid id);
    Task<Tenant?> GetTenantByCodeAsync(string code);
    Task<Tenant?> GetTenantByDomainAsync(string domain);
    Task<Tenant> CreateTenantAsync(Tenant tenant);
    Task<Tenant?> UpdateTenantAsync(Tenant tenant);
    Task<bool> UpdateTenantStatusAsync(Guid tenantId, string status);
    Task<bool> UpdateSubscriptionAsync(Guid tenantId, string tier, int maxBranches, int maxUsers);
    Task<bool> UpdateComplianceAsync(Guid tenantId, bool hipaa, bool nabh, bool gdpr, bool dpa);
    Task<IEnumerable<Tenant>> GetAllTenantsAsync();
    Task<IEnumerable<Tenant>> SearchTenantsAsync(string searchTerm);
    Task<bool> DeleteTenantAsync(Guid id);
    Task<object> GetUsageAsync(Guid tenantId);
    Task<object> GetStatisticsAsync(Guid tenantId);
    Task<object> CheckLimitsAsync(Guid tenantId);
    Task<int> GetOrganizationCountAsync(Guid tenantId);
    Task<int> GetBranchCountAsync(Guid tenantId);
    Task<Dictionary<string, string>> GetAllTenantCodesForDebugAsync();
    Task EnsureDefaultLoginTenantAsync();
    Task<List<object>> GetAllTenantsForLoginAsync();
}