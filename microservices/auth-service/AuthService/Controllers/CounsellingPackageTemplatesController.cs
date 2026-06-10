using System;
using System.Security.Claims;
using System.Threading.Tasks;
using AuthService.Authorization;
using AuthService.Models.Counselor;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace AuthService.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/counselling-package-templates")]
    public class CounsellingPackageTemplatesController : ControllerBase
    {
        private readonly ICounsellingPackageTemplateService _service;
        private readonly ILogger<CounsellingPackageTemplatesController> _logger;

        public CounsellingPackageTemplatesController(
            ICounsellingPackageTemplateService service,
            ILogger<CounsellingPackageTemplatesController> logger)
        {
            _service = service;
            _logger = logger;
        }

        private Guid GetTenantId()
        {
            var claim = User.FindFirst("TenantId")?.Value;
            if (string.IsNullOrEmpty(claim) || !Guid.TryParse(claim, out var tenantId))
                throw new UnauthorizedAccessException("Tenant ID not found in token");
            return tenantId;
        }

        private Guid GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(claim) || !Guid.TryParse(claim, out var userId))
                throw new UnauthorizedAccessException("User ID not found in token");
            return userId;
        }

        [HttpGet]
        [RequirePermission("package_templates.read")]
        public async Task<IActionResult> GetAll([FromQuery] string? category = null, [FromQuery] bool? isActive = true)
        {
            try
            {
                var tenantId = GetTenantId();
                var templates = await _service.GetAllAsync(tenantId, category, isActive);
                return Ok(templates);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error listing counselling package templates");
                return StatusCode(500, new { message = "Error listing templates", error = ex.Message });
            }
        }

        [HttpGet("settings")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetSettings()
        {
            try
            {
                var tenantId = GetTenantId();
                var settings = await _service.GetSettingsAsync(tenantId);
                return Ok(settings);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading counselling settings");
                return StatusCode(500, new { message = "Error loading settings", error = ex.Message });
            }
        }

        [HttpPut("settings")]
        [RequirePermission("master_data.update")]
        public async Task<IActionResult> UpdateSettings([FromBody] UpdateCounsellingSettingsRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId = GetCurrentUserId();
                var settings = await _service.UpdateSettingsAsync(tenantId, request, userId);
                return Ok(settings);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating counselling settings");
                return StatusCode(500, new { message = "Error updating settings", error = ex.Message });
            }
        }

        [HttpGet("{id:guid}")]
        [RequirePermission("package_templates.read")]
        public async Task<IActionResult> GetById(Guid id)
        {
            try
            {
                var tenantId = GetTenantId();
                var template = await _service.GetByIdAsync(tenantId, id);
                if (template == null)
                    return NotFound(new { message = "Template not found" });
                return Ok(template);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving counselling package template {Id}", id);
                return StatusCode(500, new { message = "Error retrieving template", error = ex.Message });
            }
        }

        [HttpGet("by-code/{code}")]
        [RequirePermission("package_templates.read")]
        public async Task<IActionResult> GetByCode(string code)
        {
            try
            {
                var tenantId = GetTenantId();
                var template = await _service.GetByCodeAsync(tenantId, code);
                if (template == null)
                    return NotFound(new { message = "Template not found" });
                return Ok(template);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving counselling package template by code {Code}", code);
                return StatusCode(500, new { message = "Error retrieving template", error = ex.Message });
            }
        }

        [HttpPost]
        [RequirePermission("package_templates.create")]
        public async Task<IActionResult> Create([FromBody] CreateCounsellingPackageTemplateRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId = GetCurrentUserId();
                var created = await _service.CreateAsync(tenantId, request, userId);
                return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating counselling package template");
                return StatusCode(500, new { message = "Error creating template", error = ex.Message });
            }
        }

        [HttpPut("{id:guid}")]
        [RequirePermission("package_templates.update")]
        public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCounsellingPackageTemplateRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId = GetCurrentUserId();
                var updated = await _service.UpdateAsync(tenantId, id, request, userId);
                if (updated == null)
                    return NotFound(new { message = "Template not found" });
                return Ok(updated);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating counselling package template {Id}", id);
                return StatusCode(500, new { message = "Error updating template", error = ex.Message });
            }
        }

        [HttpDelete("{id:guid}")]
        [RequirePermission("package_templates.delete")]
        public async Task<IActionResult> Delete(Guid id)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId = GetCurrentUserId();
                var deleted = await _service.DeleteAsync(tenantId, id, userId);
                if (!deleted)
                    return NotFound(new { message = "Template not found" });
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting counselling package template {Id}", id);
                return StatusCode(500, new { message = "Error deleting template", error = ex.Message });
            }
        }
    }
}
