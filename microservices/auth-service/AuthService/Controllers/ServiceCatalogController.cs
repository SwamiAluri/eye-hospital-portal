using AuthService.Authorization;
using AuthService.DTOs.Billing;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

[ApiController]
[Route("api/[controller]")]
[AllowAnonymous] // Global catalog reads — no tenant context needed
public class ServiceCatalogController : ControllerBase
{
    private readonly IServiceCatalogService _serviceCatalogService;
    private readonly IServiceCatalogMasterSyncService _catalogMasterSyncService;
    private readonly ILogger<ServiceCatalogController> _logger;

    public ServiceCatalogController(
        IServiceCatalogService serviceCatalogService,
        IServiceCatalogMasterSyncService catalogMasterSyncService,
        ILogger<ServiceCatalogController> logger)
    {
        _serviceCatalogService = serviceCatalogService;
        _catalogMasterSyncService = catalogMasterSyncService;
        _logger = logger;
    }

    private Guid CurrentTenantId =>
        HttpContext.Items.TryGetValue("TenantId", out var t) && t is Guid g
            ? g
            : Guid.Parse(Request.Headers["X-Tenant-ID"].FirstOrDefault() ?? Guid.Empty.ToString());

    private Guid CurrentUserId =>
        Guid.TryParse(User.FindFirst("sub")?.Value ?? User.FindFirst("nameid")?.Value, out var uid)
            ? uid
            : Guid.Empty;

    /// <summary>Full catalog tree: categories → services → variants</summary>
    [HttpGet("full")]
    public async Task<ActionResult<FullCatalogResponse>> GetFull()
    {
        try
        {
            var catalog = await _serviceCatalogService.GetFullCatalogAsync();
            return Ok(catalog);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving full service catalog");
            return StatusCode(500, new { error = "Failed to retrieve catalog" });
        }
    }

    /// <summary>Flat list of active categories</summary>
    [HttpGet("categories")]
    public async Task<ActionResult<List<ServiceCategoryDto>>> GetCategories()
    {
        try
        {
            var cats = await _serviceCatalogService.GetCategoriesAsync();
            return Ok(cats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving categories");
            return StatusCode(500, new { error = "Failed to retrieve categories" });
        }
    }

    /// <summary>IOL options available for a given service variant</summary>
    [HttpGet("variants/{variantId}/iol")]
    public async Task<ActionResult<List<IolMasterDto>>> GetVariantIolOptions(Guid variantId)
    {
        try
        {
            var iolOptions = await _serviceCatalogService.GetVariantIolOptionsAsync(variantId);
            return Ok(iolOptions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving IOL options for variant {VariantId}", variantId);
            return StatusCode(500, new { error = "Failed to retrieve IOL options" });
        }
    }

    /// <summary>
    /// Upsert <c>clinical.surgery_type</c> and <c>clinical.iol_catalog</c> master rows
    /// from the global service catalog for the current tenant.
    /// </summary>
    [HttpPost("sync-master")]
    [Authorize]
    [RequirePermission("master_data.manage")]
    public async Task<ActionResult<ServiceCatalogSyncResult>> SyncMaster()
    {
        try
        {
            var tenantId = CurrentTenantId;
            if (tenantId == Guid.Empty)
                return BadRequest(new { error = "Tenant context is required." });

            var result = await _catalogMasterSyncService.SyncTenantAsync(tenantId, CurrentUserId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing service catalog to master data");
            return StatusCode(500, new { error = "Failed to sync catalog to master data" });
        }
    }

    /// <summary>Branch-specific price overrides for variants</summary>
    [HttpGet("branch/{branchId}/pricing")]
    [Authorize]
    public async Task<ActionResult<List<BranchVariantPricingDto>>> GetBranchPricing(Guid branchId)
    {
        try
        {
            var pricing = await _serviceCatalogService.GetBranchPricingAsync(branchId);
            return Ok(pricing);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving branch pricing for branch {BranchId}", branchId);
            return StatusCode(500, new { error = "Failed to retrieve branch pricing" });
        }
    }
}
