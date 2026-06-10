using AuthService.Authorization;
using AuthService.Models.MasterData;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace AuthService.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/master-values")]
    public class MasterValuesController : ControllerBase
    {
        private readonly IMasterValueService _service;
        private readonly IMasterDataValidationService _validation;
        private readonly ILogger<MasterValuesController> _logger;

        public MasterValuesController(
            IMasterValueService service,
            IMasterDataValidationService validation,
            ILogger<MasterValuesController> logger)
        {
            _service = service;
            _validation = validation;
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

        // GET /api/master-values/lookup/{entityType}
        // Lightweight active-only list for module dropdowns (all clinical/front-desk roles).
        [HttpGet("lookup/{entityType}")]
        [RequirePermission("master_data.lookup")]
        public async Task<IActionResult> GetLookup(string entityType)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId == Guid.Empty)
                    return BadRequest(new { message = "Tenant ID is required." });

                var result = await _service.GetLookupAsync(tenantId, entityType);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting master lookup for entity type {EntityType}", entityType);
                return StatusCode(500, new { message = "Failed to retrieve master lookup values." });
            }
        }

        // GET /api/master-values/groups
        [HttpGet("groups")]
        [RequirePermission("master_data.view")]
        public async Task<IActionResult> GetGroups()
        {
            try
            {
                var groups = await _service.GetGroupsAsync();
                return Ok(groups);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting master data groups");
                return StatusCode(500, new { message = "Failed to retrieve master data groups." });
            }
        }

        // GET /api/master-values/{entityType}
        [HttpGet("{entityType}")]
        [RequirePermission("master_data.view")]
        public async Task<IActionResult> GetByEntityType(
            string entityType,
            [FromQuery] bool includeInactive = false,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId == Guid.Empty)
                    return BadRequest(new { message = "Tenant ID is required." });

                var result = await _service.GetByEntityTypeAsync(tenantId, entityType, includeInactive, page, pageSize);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting master values for entity type {EntityType}", entityType);
                return StatusCode(500, new { message = "Failed to retrieve master values." });
            }
        }

        // GET /api/master-values/{entityType}/{id}
        [HttpGet("{entityType}/{id:guid}")]
        [RequirePermission("master_data.view")]
        public async Task<IActionResult> GetById(string entityType, Guid id)
        {
            try
            {
                var tenantId = CurrentTenantId;
                var result = await _service.GetByIdAsync(tenantId, id);
                return result == null ? NotFound() : Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting master value {Id}", id);
                return StatusCode(500, new { message = "Failed to retrieve master value." });
            }
        }

        // POST /api/master-values/{entityType}
        [HttpPost("{entityType}")]
        [RequirePermission("master_data.create")]
        public async Task<IActionResult> Create(string entityType, [FromBody] CreateMasterValueRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId == Guid.Empty)
                    return BadRequest(new { message = "Tenant ID is required." });

                var result = await _service.CreateAsync(tenantId, entityType, request, CurrentUserId);
                return CreatedAtAction(nameof(GetById),
                    new { entityType, id = result.Id },
                    result);
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating master value for {EntityType}", entityType);
                return StatusCode(500, new { message = "Failed to create master value." });
            }
        }

        // PUT /api/master-values/{entityType}/{id}
        [HttpPut("{entityType}/{id:guid}")]
        [RequirePermission("master_data.update")]
        public async Task<IActionResult> Update(string entityType, Guid id, [FromBody] UpdateMasterValueRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                var tenantId = CurrentTenantId;
                var result = await _service.UpdateAsync(tenantId, id, request, CurrentUserId);
                return Ok(result);
            }
            catch (KeyNotFoundException)
            {
                return NotFound();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating master value {Id}", id);
                return StatusCode(500, new { message = "Failed to update master value." });
            }
        }

        // POST /api/master-values/{entityType}/{id}/enable
        [HttpPost("{entityType}/{id:guid}/enable")]
        [RequirePermission("master_data.update")]
        public async Task<IActionResult> Enable(string entityType, Guid id)
        {
            try
            {
                await _service.EnableAsync(CurrentTenantId, id, CurrentUserId);
                return Ok(new { message = "Value enabled." });
            }
            catch (KeyNotFoundException)
            {
                return NotFound();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error enabling master value {Id}", id);
                return StatusCode(500, new { message = "Failed to enable master value." });
            }
        }

        // POST /api/master-values/{entityType}/{id}/disable
        [HttpPost("{entityType}/{id:guid}/disable")]
        [RequirePermission("master_data.update")]
        public async Task<IActionResult> Disable(string entityType, Guid id, [FromBody] DisableMasterValueRequest? request = null)
        {
            try
            {
                await _service.DisableAsync(CurrentTenantId, id, CurrentUserId, request?.Reason);
                return Ok(new { message = "Value disabled." });
            }
            catch (KeyNotFoundException)
            {
                return NotFound();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error disabling master value {Id}", id);
                return StatusCode(500, new { message = "Failed to disable master value." });
            }
        }

        // DELETE /api/master-values/{entityType}/{id}
        [HttpDelete("{entityType}/{id:guid}")]
        [RequirePermission("master_data.delete")]
        public async Task<IActionResult> Delete(string entityType, Guid id)
        {
            try
            {
                // Look up label for a meaningful conflict message
                var list = await _service.GetByEntityTypeAsync(CurrentTenantId, entityType, includeInactive: true, page: 1, pageSize: 500);
                var label = list.Items.FirstOrDefault(x => x.Id == id)?.Label ?? id.ToString();

                var blockReason = await _validation.CanDeleteAsync(CurrentTenantId, id, entityType, label);
                if (blockReason is not null)
                {
                    return Conflict(new
                    {
                        message = blockReason.Message,
                        reason = blockReason.Reason,
                        usageCount = blockReason.UsageCount
                    });
                }

                await _service.DeleteAsync(CurrentTenantId, id, CurrentUserId);
                return NoContent();
            }
            catch (KeyNotFoundException)
            {
                return NotFound();
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting master value {Id}", id);
                return StatusCode(500, new { message = "Failed to delete master value." });
            }
        }

        // POST /api/master-values/seed-defaults
        [HttpPost("seed-defaults")]
        [RequirePermission("master_data.manage")]
        public async Task<IActionResult> SeedDefaults()
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId == Guid.Empty)
                    return BadRequest(new { message = "Tenant ID is required." });

                await _service.SeedDefaultsForTenantAsync(tenantId, CurrentUserId);
                return Ok(new { message = "Default master values seeded successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error seeding default master values");
                return StatusCode(500, new { message = "Failed to seed default master values." });
            }
        }

        // GET /api/master-values/stats/{groupKey}
        [HttpGet("stats/{groupKey}")]
        [RequirePermission("master_data.view")]
        public async Task<IActionResult> GetGroupStats(string groupKey)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId == Guid.Empty)
                    return BadRequest(new { message = "Tenant ID is required." });

                var stats = await _service.GetGroupStatsAsync(tenantId, groupKey);
                return Ok(stats);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting stats for group {GroupKey}", groupKey);
                return StatusCode(500, new { message = "Failed to retrieve group stats." });
            }
        }
    }
}
