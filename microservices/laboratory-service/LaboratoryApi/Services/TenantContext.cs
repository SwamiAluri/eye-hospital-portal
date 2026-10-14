namespace LaboratoryApi.Services;

/// <summary>
/// Scoped tenant for the current invocation. Set by JwtService; read by TenantCommandInterceptor.
/// </summary>
public class TenantContext
{
    public Guid? TenantId { get; private set; }

    public void Set(Guid tenantId) => TenantId = tenantId;
}
