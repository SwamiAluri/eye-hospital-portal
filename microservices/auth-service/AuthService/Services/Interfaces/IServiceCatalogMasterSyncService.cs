namespace AuthService.Services.Interfaces;

public class ServiceCatalogSyncResult
{
    public int TenantsProcessed { get; set; }
    public int SurgeryTypesUpserted { get; set; }
    public int IolCatalogUpserted { get; set; }
    public int Deactivated { get; set; }
}

public interface IServiceCatalogMasterSyncService
{
    Task<ServiceCatalogSyncResult> SyncAllTenantsAsync(Guid actorUserId, CancellationToken ct = default);
    Task<ServiceCatalogSyncResult> SyncTenantAsync(Guid tenantId, Guid actorUserId, CancellationToken ct = default);
}
