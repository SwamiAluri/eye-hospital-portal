using AuthService.Authorization;
using AuthService.DTOs;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace AuthService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class BiometryController : ControllerBase
    {
        private readonly IBiometryService _biometryService;

        public BiometryController(IBiometryService biometryService)
        {
            _biometryService = biometryService;
        }

        private Guid GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return userIdClaim != null ? Guid.Parse(userIdClaim) : Guid.Empty;
        }

        private Guid RequireTenantId()
        {
            var tenantIdClaim = User.FindFirst("TenantId")?.Value;
            if (string.IsNullOrEmpty(tenantIdClaim) || !Guid.TryParse(tenantIdClaim, out var tenantId) || tenantId == Guid.Empty)
                throw new UnauthorizedAccessException("Tenant ID not found in token");
            return tenantId;
        }

        /// <summary>
        /// Get all biometry records with filtering and pagination
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50,
            [FromQuery] string? search = null,
            [FromQuery] string? eye = null,
            [FromQuery] Guid? patientId = null,
            [FromQuery] Guid? branchId = null)
        {
            try
            {
                var result = await _biometryService.GetAllAsync(page, pageSize, search, eye, patientId, branchId);
                return Ok(new { data = result.Data, total = result.Total });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error retrieving biometry records", error = ex.Message });
            }
        }

        /// <summary>
        /// Get biometry record by ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            try
            {
                var record = await _biometryService.GetByIdAsync(id);
                if (record == null)
                    return NotFound(new { message = "Biometry record not found" });

                return Ok(record);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error retrieving biometry record", error = ex.Message });
            }
        }

        /// <summary>
        /// Patient 360 biometry context. Distinct from the operational patient list.
        /// </summary>
        [HttpGet("patients/{patientId:guid}/patient-360")]
        [RequirePermission("CLINICAL:BIOMETRY:VIEW")]
        public async Task<IActionResult> GetPatient360(Guid patientId, [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 20)
        {
            try
            {
                var page = await _biometryService.ListPatient360Async(RequireTenantId(), patientId, pageNumber, pageSize);
                return Ok(page);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Get biometry records for a specific patient
        /// </summary>
        [HttpGet("patient/{patientId}")]
        public async Task<IActionResult> GetByPatient(Guid patientId)
        {
            try
            {
                var records = await _biometryService.GetByPatientAsync(patientId);
                return Ok(records);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error retrieving patient biometry records", error = ex.Message });
            }
        }

        /// <summary>
        /// Get biometry statistics
        /// </summary>
        [HttpGet("statistics")]
        public async Task<IActionResult> GetStatistics([FromQuery] Guid? branchId = null)
        {
            try
            {
                var stats = await _biometryService.GetStatisticsAsync(branchId);
                return Ok(stats);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error retrieving statistics", error = ex.Message });
            }
        }

        /// <summary>
        /// Create new biometry record
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] BiometryRecordDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                var record = await _biometryService.CreateAsync(dto, userId);
                return CreatedAtAction(nameof(GetById), new { id = record.Id }, record);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error creating biometry record", error = ex.Message });
            }
        }

        /// <summary>
        /// Update biometry record
        /// </summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] BiometryRecordDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                var record = await _biometryService.UpdateAsync(id, dto, userId);
                return Ok(record);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error updating biometry record", error = ex.Message });
            }
        }

        /// <summary>
        /// Delete biometry record (soft delete)
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            try
            {
                var result = await _biometryService.DeleteAsync(id);
                if (!result)
                    return NotFound(new { message = "Biometry record not found" });

                return Ok(new { message = "Biometry record deleted successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error deleting biometry record", error = ex.Message });
            }
        }

        /// <summary>
        /// Calculate IOL power using all formulas
        /// </summary>
        [HttpPost("calculate-iol/all")]
        public async Task<IActionResult> CalculateAllFormulas([FromBody] IOLCalculationRequestDto request)
        {
            try
            {
                var results = await _biometryService.CalculateAllFormulasAsync(request);
                return Ok(results);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error calculating IOL power", error = ex.Message });
            }
        }

        /// <summary>
        /// Calculate IOL power using specific formula
        /// </summary>
        [HttpPost("calculate-iol/{formula}")]
        public async Task<IActionResult> CalculateIOL(string formula, [FromBody] IOLCalculationRequestDto request)
        {
            try
            {
                var result = await _biometryService.CalculateIOLAsync(formula, request);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error calculating IOL power", error = ex.Message });
            }
        }

        /// <summary>
        /// Search biometry records
        /// </summary>
        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string q)
        {
            try
            {
                var records = await _biometryService.SearchAsync(q);
                return Ok(records);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error searching biometry records", error = ex.Message });
            }
        }
    }
}
