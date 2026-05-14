namespace CcmsApi.Services;

/// <summary>
/// Scoped service that holds the current request's resolved tenant ID.
/// Set by JwtService.ValidateAndExtract() at the start of every function invocation.
/// Read by TenantCommandInterceptor to apply PostgreSQL RLS context before queries.
/// </summary>
public class TenantContext
{
    public Guid? TenantId { get; private set; }

    public void Set(Guid tenantId) => TenantId = tenantId;
}
