using System.Text.Json;
using System.Text.Json.Nodes;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.MasterData;
using AuthService.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AuthService.Services;

/// <summary>
/// Option B: Service Catalog is the write-source for surgery variants and IOL rows;
/// this service upserts matching <c>clinical.surgery_type</c> / <c>clinical.iol_catalog</c>
/// master values per tenant. Catalog deactivation disables linked master rows.
/// </summary>
public class ServiceCatalogMasterSyncService : IServiceCatalogMasterSyncService
{
    private const string SurgeryEntity = "clinical.surgery_type";
    private const string IolEntity = "clinical.iol_catalog";
    private const string ClinicalGroup = "clinical";

    private readonly AppDbContext _context;
    private readonly ILogger<ServiceCatalogMasterSyncService> _logger;

    public ServiceCatalogMasterSyncService(AppDbContext context, ILogger<ServiceCatalogMasterSyncService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<ServiceCatalogSyncResult> SyncAllTenantsAsync(Guid actorUserId, CancellationToken ct = default)
    {
        var tenantIds = await _context.Tenants
            .Where(t => t.IsActive)
            .Select(t => t.Id)
            .ToListAsync(ct);

        var aggregate = new ServiceCatalogSyncResult();
        foreach (var tenantId in tenantIds)
        {
            var one = await SyncTenantAsync(tenantId, actorUserId, ct);
            aggregate.TenantsProcessed++;
            aggregate.SurgeryTypesUpserted += one.SurgeryTypesUpserted;
            aggregate.IolCatalogUpserted += one.IolCatalogUpserted;
            aggregate.Deactivated += one.Deactivated;
        }

        return aggregate;
    }

    public async Task<ServiceCatalogSyncResult> SyncTenantAsync(Guid tenantId, Guid actorUserId, CancellationToken ct = default)
    {
        await _context.Database.ExecuteSqlRawAsync(
            $"SELECT set_config('app.current_tenant_id', '{tenantId}', false)", ct);

        var variants = await _context.ServiceVariants
            .AsNoTracking()
            .Include(v => v.CatalogService)
                .ThenInclude(s => s!.Category)
            .Where(v => v.DeletedAt == null)
            .ToListAsync(ct);

        var iols = await _context.IolMasters
            .AsNoTracking()
            .Where(i => i.DeletedAt == null)
            .ToListAsync(ct);

        var existingSurgery = await _context.MasterValues
            .Where(v => v.TenantId == tenantId && v.EntityType == SurgeryEntity && v.DeletedAt == null)
            .ToListAsync(ct);

        var existingIol = await _context.MasterValues
            .Where(v => v.TenantId == tenantId && v.EntityType == IolEntity && v.DeletedAt == null)
            .ToListAsync(ct);

        var result = new ServiceCatalogSyncResult { TenantsProcessed = 1 };
        var activeVariantIds = new HashSet<string>();
        var activeIolIds = new HashSet<string>();

        foreach (var variant in variants)
        {
            var service = variant.CatalogService;
            var category = service?.Category;
            var catalogActive = variant.IsActive
                && (service?.IsActive ?? false)
                && (category?.IsActive ?? false)
                && variant.Status.Equals("active", StringComparison.OrdinalIgnoreCase);

            var catalogVariantId = variant.Id.ToString();
            activeVariantIds.Add(catalogVariantId);

            var code = NormalizeCode(variant.VariantCode, variant.Id, "SV");
            var metadata = JsonSerializer.Serialize(new
            {
                syncedFromCatalog = true,
                catalogVariantId,
                catalogServiceId = variant.CatalogServiceId.ToString(),
                catalogServiceCode = service?.ServiceCode,
                categoryCode = category?.Code,
                categoryName = category?.Name,
                priceType = variant.PriceType,
                hasIolOptions = variant.HasIolOptions,
                catalogActive,
            });

            var existing = FindByCatalogId(existingSurgery, "catalogVariantId", catalogVariantId)
                ?? existingSurgery.FirstOrDefault(v =>
                    v.Code.Equals(code, StringComparison.OrdinalIgnoreCase));

            if (existing is null)
            {
                _context.MasterValues.Add(new MasterValue
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    GroupKey = ClinicalGroup,
                    EntityType = SurgeryEntity,
                    Code = code,
                    Label = variant.VariantName.Trim(),
                    Metadata = metadata,
                    SortOrder = variant.DisplayOrder,
                    IsActive = catalogActive,
                    IsSystemLocked = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    CreatedByUserId = actorUserId == Guid.Empty ? null : actorUserId,
                    UpdatedByUserId = actorUserId == Guid.Empty ? null : actorUserId,
                });
                result.SurgeryTypesUpserted++;
            }
            else
            {
                existing.Metadata = metadata;
                existing.SortOrder = variant.DisplayOrder;
                ApplyCatalogActiveState(existing, catalogActive);
                existing.IsSystemLocked = true;
                existing.UpdatedAt = DateTime.UtcNow;
                existing.UpdatedByUserId = actorUserId == Guid.Empty ? existing.UpdatedByUserId : actorUserId;
                result.SurgeryTypesUpserted++;
            }
        }

        foreach (var iol in iols)
        {
            var catalogActive = iol.IsActive
                && iol.Status.Equals("active", StringComparison.OrdinalIgnoreCase);
            var catalogIolId = iol.Id.ToString();
            activeIolIds.Add(catalogIolId);

            var code = NormalizeCode(iol.ProductCode, iol.Id, "IOL");
            var metadata = JsonSerializer.Serialize(new
            {
                syncedFromCatalog = true,
                catalogIolId,
                manufacturer = iol.BrandManufacturer,
                model = iol.ModelName,
                lens_type = MapLensType(iol.IolType),
                origin = iol.Origin,
                productCode = iol.ProductCode,
                sphere_power_min = iol.PowerRangeMin,
                sphere_power_max = iol.PowerRangeMax,
                catalogActive,
            });

            var existing = FindByCatalogId(existingIol, "catalogIolId", catalogIolId)
                ?? existingIol.FirstOrDefault(v =>
                    v.Code.Equals(code, StringComparison.OrdinalIgnoreCase));

            if (existing is null)
            {
                _context.MasterValues.Add(new MasterValue
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    GroupKey = ClinicalGroup,
                    EntityType = IolEntity,
                    Code = code,
                    Label = $"{iol.BrandManufacturer} {iol.ModelName}".Trim(),
                    Metadata = metadata,
                    SortOrder = iol.DisplayOrder,
                    IsActive = catalogActive,
                    IsSystemLocked = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    CreatedByUserId = actorUserId == Guid.Empty ? null : actorUserId,
                    UpdatedByUserId = actorUserId == Guid.Empty ? null : actorUserId,
                });
                result.IolCatalogUpserted++;
            }
            else
            {
                existing.Metadata = metadata;
                existing.SortOrder = iol.DisplayOrder;
                ApplyCatalogActiveState(existing, catalogActive);
                existing.IsSystemLocked = true;
                existing.UpdatedAt = DateTime.UtcNow;
                existing.UpdatedByUserId = actorUserId == Guid.Empty ? existing.UpdatedByUserId : actorUserId;
                result.IolCatalogUpserted++;
            }
        }

        foreach (var row in existingSurgery.Where(v => IsCatalogSynced(v.Metadata)))
        {
            var id = GetCatalogId(row.Metadata, "catalogVariantId");
            if (id is null || !activeVariantIds.Contains(id))
            {
                if (row.IsActive)
                {
                    row.IsActive = false;
                    row.DisabledAt = DateTime.UtcNow;
                    row.DisabledReason = "Service catalog item removed or deactivated";
                    row.UpdatedAt = DateTime.UtcNow;
                    result.Deactivated++;
                }
            }
        }

        foreach (var row in existingIol.Where(v => IsCatalogSynced(v.Metadata)))
        {
            var id = GetCatalogId(row.Metadata, "catalogIolId");
            if (id is null || !activeIolIds.Contains(id))
            {
                if (row.IsActive)
                {
                    row.IsActive = false;
                    row.DisabledAt = DateTime.UtcNow;
                    row.DisabledReason = "Service catalog item removed or deactivated";
                    row.UpdatedAt = DateTime.UtcNow;
                    result.Deactivated++;
                }
            }
        }

        await _context.SaveChangesAsync(ct);
        _logger.LogInformation(
            "Catalog→master sync for tenant {TenantId}: surgery={Surgery}, iol={Iol}, deactivated={Deactivated}",
            tenantId, result.SurgeryTypesUpserted, result.IolCatalogUpserted, result.Deactivated);

        return result;
    }

    private static MasterValue? FindByCatalogId(List<MasterValue> rows, string key, string catalogId)
    {
        return rows.FirstOrDefault(r => GetCatalogId(r.Metadata, key) == catalogId);
    }

    private static string? GetCatalogId(string metadataJson, string key)
    {
        try
        {
            var node = JsonNode.Parse(metadataJson);
            return node?[key]?.GetValue<string>();
        }
        catch
        {
            return null;
        }
    }

    private static bool IsCatalogSynced(string metadataJson)
    {
        try
        {
            var node = JsonNode.Parse(metadataJson);
            return node?["syncedFromCatalog"]?.GetValue<bool>() == true;
        }
        catch
        {
            return false;
        }
    }

    private static string NormalizeCode(string? code, Guid id, string prefix)
    {
        var normalized = (code ?? string.Empty).Trim().ToUpperInvariant();
        if (!string.IsNullOrEmpty(normalized) && normalized.Length <= 150)
            return normalized;
        return $"{prefix}_{id.ToString("N")[..8].ToUpperInvariant()}";
    }

    private static void ApplyCatalogActiveState(MasterValue row, bool catalogActive)
    {
        row.IsActive = catalogActive;
        if (catalogActive)
        {
            row.DisabledAt = null;
            row.DisabledByUserId = null;
            row.DisabledReason = null;
        }
    }

    private static string MapLensType(string iolType)
    {
        return iolType.Trim().ToLowerInvariant() switch
        {
            "monofocal" => "spheric",
            "toric" => "toric",
            "multifocal" => "multifocal",
            "edof" or "extended" => "extended",
            "aspheric" => "aspheric",
            _ => iolType.Trim().ToLowerInvariant(),
        };
    }
}
