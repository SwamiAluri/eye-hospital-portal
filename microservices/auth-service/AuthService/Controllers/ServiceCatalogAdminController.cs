using AuthService.Authorization;
using AuthService.DTOs.Billing;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

/// <summary>
/// S2 — Service Catalog admin CRUD (global catalog, not tenant-scoped).
/// Permission: <c>master_data.view</c> (read) / <c>master_data.manage</c> (write).
/// </summary>
[ApiController]
[Route("api/servicecatalog/admin")]
[Authorize]
public class ServiceCatalogAdminController : ControllerBase
{
    private readonly IServiceCatalogAdminService _adminService;
    private readonly ILogger<ServiceCatalogAdminController> _logger;

    public ServiceCatalogAdminController(
        IServiceCatalogAdminService adminService,
        ILogger<ServiceCatalogAdminController> logger)
    {
        _adminService = adminService;
        _logger = logger;
    }

    private Guid CurrentUserId =>
        Guid.TryParse(User.FindFirst("sub")?.Value ?? User.FindFirst("nameid")?.Value, out var uid)
            ? uid
            : Guid.Empty;

    /// <summary>Full catalog for admin UI (optionally includes inactive rows).</summary>
    [HttpGet("full")]
    [RequirePermission("master_data.view")]
    public async Task<ActionResult<FullCatalogResponse>> GetAdminFull([FromQuery] bool includeInactive = true)
    {
        try
        {
            var catalog = await _adminService.GetAdminCatalogAsync(includeInactive);
            return Ok(catalog);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving admin service catalog");
            return StatusCode(500, new { error = "Failed to retrieve admin catalog" });
        }
    }

    [HttpPost("categories")]
    [RequirePermission("master_data.manage")]
    public async Task<ActionResult<ServiceCategoryDto>> CreateCategory([FromBody] CreateServiceCategoryRequest request)
    {
        try
        {
            var created = await _adminService.CreateCategoryAsync(request, CurrentUserId);
            return CreatedAtAction(nameof(GetAdminFull), new { includeInactive = true }, created);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating service category");
            return StatusCode(500, new { error = "Failed to create category" });
        }
    }

    [HttpPut("categories/{categoryId:guid}")]
    [RequirePermission("master_data.manage")]
    public async Task<ActionResult<ServiceCategoryDto>> UpdateCategory(
        Guid categoryId,
        [FromBody] UpdateServiceCategoryRequest request)
    {
        try
        {
            var updated = await _adminService.UpdateCategoryAsync(categoryId, request, CurrentUserId);
            return Ok(updated);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Category not found" });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating service category {CategoryId}", categoryId);
            return StatusCode(500, new { error = "Failed to update category" });
        }
    }

    [HttpDelete("categories/{categoryId:guid}")]
    [RequirePermission("master_data.manage")]
    public async Task<IActionResult> DeleteCategory(Guid categoryId)
    {
        try
        {
            await _adminService.DeleteCategoryAsync(categoryId, CurrentUserId);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Category not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting service category {CategoryId}", categoryId);
            return StatusCode(500, new { error = "Failed to delete category" });
        }
    }

    [HttpPost("categories/{categoryId:guid}/services")]
    [RequirePermission("master_data.manage")]
    public async Task<ActionResult<CatalogServiceDto>> CreateService(
        Guid categoryId,
        [FromBody] CreateCatalogServiceRequest request)
    {
        try
        {
            var created = await _adminService.CreateServiceAsync(categoryId, request, CurrentUserId);
            return Created($"/api/servicecatalog/admin/full", created);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Category not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating catalog service under category {CategoryId}", categoryId);
            return StatusCode(500, new { error = "Failed to create service" });
        }
    }

    [HttpPut("services/{serviceId:guid}")]
    [RequirePermission("master_data.manage")]
    public async Task<ActionResult<CatalogServiceDto>> UpdateService(
        Guid serviceId,
        [FromBody] UpdateCatalogServiceRequest request)
    {
        try
        {
            var updated = await _adminService.UpdateServiceAsync(serviceId, request, CurrentUserId);
            return Ok(updated);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Service not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating catalog service {ServiceId}", serviceId);
            return StatusCode(500, new { error = "Failed to update service" });
        }
    }

    [HttpDelete("services/{serviceId:guid}")]
    [RequirePermission("master_data.manage")]
    public async Task<IActionResult> DeleteService(Guid serviceId)
    {
        try
        {
            await _adminService.DeleteServiceAsync(serviceId, CurrentUserId);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Service not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting catalog service {ServiceId}", serviceId);
            return StatusCode(500, new { error = "Failed to delete service" });
        }
    }

    [HttpPost("services/{serviceId:guid}/variants")]
    [RequirePermission("master_data.manage")]
    public async Task<ActionResult<ServiceVariantDto>> CreateVariant(
        Guid serviceId,
        [FromBody] CreateServiceVariantRequest request)
    {
        try
        {
            var created = await _adminService.CreateVariantAsync(serviceId, request, CurrentUserId);
            return Created($"/api/servicecatalog/admin/full", created);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Service not found" });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating variant under service {ServiceId}", serviceId);
            return StatusCode(500, new { error = "Failed to create variant" });
        }
    }

    [HttpPut("variants/{variantId:guid}")]
    [RequirePermission("master_data.manage")]
    public async Task<ActionResult<ServiceVariantDto>> UpdateVariant(
        Guid variantId,
        [FromBody] UpdateServiceVariantRequest request)
    {
        try
        {
            var updated = await _adminService.UpdateVariantAsync(variantId, request, CurrentUserId);
            return Ok(updated);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Variant not found" });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating variant {VariantId}", variantId);
            return StatusCode(500, new { error = "Failed to update variant" });
        }
    }

    [HttpDelete("variants/{variantId:guid}")]
    [RequirePermission("master_data.manage")]
    public async Task<IActionResult> DeleteVariant(Guid variantId)
    {
        try
        {
            await _adminService.DeleteVariantAsync(variantId, CurrentUserId);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Variant not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting variant {VariantId}", variantId);
            return StatusCode(500, new { error = "Failed to delete variant" });
        }
    }

    // ── IOL master ────────────────────────────────────────────────────────────

    [HttpGet("iol")]
    [RequirePermission("master_data.view")]
    public async Task<ActionResult<List<IolMasterAdminDto>>> GetIolCatalog([FromQuery] bool includeInactive = true)
    {
        try
        {
            return Ok(await _adminService.GetIolCatalogAsync(includeInactive));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving IOL catalog");
            return StatusCode(500, new { error = "Failed to retrieve IOL catalog" });
        }
    }

    [HttpPost("iol")]
    [RequirePermission("master_data.manage")]
    public async Task<ActionResult<IolMasterAdminDto>> CreateIol([FromBody] CreateIolMasterRequest request)
    {
        try
        {
            var created = await _adminService.CreateIolAsync(request, CurrentUserId);
            return Created($"/api/servicecatalog/admin/iol", created);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating IOL");
            return StatusCode(500, new { error = "Failed to create IOL" });
        }
    }

    [HttpPut("iol/{iolId:guid}")]
    [RequirePermission("master_data.manage")]
    public async Task<ActionResult<IolMasterAdminDto>> UpdateIol(Guid iolId, [FromBody] UpdateIolMasterRequest request)
    {
        try
        {
            return Ok(await _adminService.UpdateIolAsync(iolId, request, CurrentUserId));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "IOL not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating IOL {IolId}", iolId);
            return StatusCode(500, new { error = "Failed to update IOL" });
        }
    }

    [HttpDelete("iol/{iolId:guid}")]
    [RequirePermission("master_data.manage")]
    public async Task<IActionResult> DeleteIol(Guid iolId)
    {
        try
        {
            await _adminService.DeleteIolAsync(iolId, CurrentUserId);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "IOL not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting IOL {IolId}", iolId);
            return StatusCode(500, new { error = "Failed to delete IOL" });
        }
    }

    [HttpGet("variants/{variantId:guid}/iol-mappings")]
    [RequirePermission("master_data.view")]
    public async Task<ActionResult<List<VariantIolMappingAdminDto>>> GetVariantIolMappings(Guid variantId)
    {
        try
        {
            return Ok(await _adminService.GetVariantIolMappingsAsync(variantId));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Variant not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving IOL mappings for variant {VariantId}", variantId);
            return StatusCode(500, new { error = "Failed to retrieve IOL mappings" });
        }
    }

    [HttpPut("variants/{variantId:guid}/iol-mappings")]
    [RequirePermission("master_data.manage")]
    public async Task<ActionResult<List<VariantIolMappingAdminDto>>> SetVariantIolMappings(
        Guid variantId,
        [FromBody] SetVariantIolMappingsRequest request)
    {
        try
        {
            return Ok(await _adminService.SetVariantIolMappingsAsync(variantId, request, CurrentUserId));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving IOL mappings for variant {VariantId}", variantId);
            return StatusCode(500, new { error = "Failed to save IOL mappings" });
        }
    }

    // ── Branch pricing ────────────────────────────────────────────────────────

    [HttpGet("branch/{branchId:guid}/pricing-rows")]
    [RequirePermission("master_data.view")]
    public async Task<ActionResult<List<BranchPricingRowDto>>> GetBranchPricingRows(Guid branchId)
    {
        try
        {
            return Ok(await _adminService.GetBranchPricingRowsAsync(branchId));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving branch pricing rows for {BranchId}", branchId);
            return StatusCode(500, new { error = "Failed to retrieve branch pricing" });
        }
    }

    [HttpPut("branch/{branchId:guid}/pricing")]
    [RequirePermission("master_data.manage")]
    public async Task<ActionResult<BranchVariantPricingDto>> UpsertBranchPrice(
        Guid branchId,
        [FromBody] UpsertBranchVariantPriceRequest request)
    {
        try
        {
            return Ok(await _adminService.UpsertBranchVariantPriceAsync(branchId, request, CurrentUserId));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error upserting branch price for {BranchId}", branchId);
            return StatusCode(500, new { error = "Failed to save branch price" });
        }
    }

    [HttpDelete("branch/{branchId:guid}/pricing/{variantId:guid}")]
    [RequirePermission("master_data.manage")]
    public async Task<IActionResult> RemoveBranchPrice(Guid branchId, Guid variantId)
    {
        try
        {
            await _adminService.RemoveBranchVariantPriceAsync(branchId, variantId, CurrentUserId);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Branch price override not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing branch price for {BranchId}/{VariantId}", branchId, variantId);
            return StatusCode(500, new { error = "Failed to remove branch price" });
        }
    }

    // ── Payer (insurer/corporate) tariffs ─────────────────────────────────────

    [HttpGet("payer/{payerId:guid}/pricing-rows")]
    [RequirePermission("master_data.view")]
    public async Task<ActionResult<List<PayerPricingRowDto>>> GetPayerPricingRows(Guid payerId)
    {
        try
        {
            return Ok(await _adminService.GetPayerPricingRowsAsync(payerId));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving payer pricing rows for {PayerId}", payerId);
            return StatusCode(500, new { error = "Failed to retrieve payer tariffs" });
        }
    }

    [HttpPut("payer/{payerId:guid}/pricing")]
    [RequirePermission("master_data.manage")]
    public async Task<ActionResult<BranchVariantPricingDto>> UpsertPayerPrice(
        Guid payerId,
        [FromBody] UpsertBranchVariantPriceRequest request)
    {
        try
        {
            return Ok(await _adminService.UpsertPayerVariantPriceAsync(payerId, request, CurrentUserId));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error upserting payer tariff for {PayerId}", payerId);
            return StatusCode(500, new { error = "Failed to save payer tariff" });
        }
    }

    [HttpDelete("payer/{payerId:guid}/pricing/{variantId:guid}")]
    [RequirePermission("master_data.manage")]
    public async Task<IActionResult> RemovePayerPrice(Guid payerId, Guid variantId)
    {
        try
        {
            await _adminService.RemovePayerVariantPriceAsync(payerId, variantId, CurrentUserId);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Payer tariff override not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing payer tariff for {PayerId}/{VariantId}", payerId, variantId);
            return StatusCode(500, new { error = "Failed to remove payer tariff" });
        }
    }
}
