using AuthService.Authorization;
using AuthService.DTOs;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Security.Claims;
using System.Threading.Tasks;

namespace AuthService.Controllers
{
    /// <summary>
    /// Controller for diabetic retinopathy screening and DR grading
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class RetinopathyScreeningController : ControllerBase
    {
        private readonly IRetinopathyScreeningService _screeningService;

        public RetinopathyScreeningController(IRetinopathyScreeningService screeningService)
        {
            _screeningService = screeningService;
        }

        /// <summary>
        /// Get all retinopathy screenings with pagination and filters
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50,
            [FromQuery] string? search = null,
            [FromQuery] string? drGrade = null,
            [FromQuery] Guid? patientId = null,
            [FromQuery] Guid? branchId = null)
        {
            try
            {
                var result = await _screeningService.GetAllAsync(page, pageSize, search, drGrade, patientId, branchId);
                return Ok(new { data = result.Data, total = result.Total, page, pageSize });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error retrieving retinopathy screenings", error = ex.Message });
            }
        }

        /// <summary>
        /// Get a specific retinopathy screening by ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            try
            {
                var screening = await _screeningService.GetByIdAsync(id);
                if (screening == null)
                    return NotFound(new { message = "Retinopathy screening not found" });

                return Ok(screening);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error retrieving retinopathy screening", error = ex.Message });
            }
        }

        /// <summary>
        /// Patient 360 retinopathy screening context. Distinct from the operational patient list.
        /// </summary>
        [HttpGet("patients/{patientId:guid}/patient-360")]
        [RequirePermission("CLINICAL:SCREENING:VIEW")]
        public async Task<IActionResult> GetPatient360(Guid patientId, [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 20)
        {
            try
            {
                var tenantIdClaim = User.FindFirst("TenantId")?.Value;
                if (string.IsNullOrEmpty(tenantIdClaim) || !Guid.TryParse(tenantIdClaim, out var tenantId) || tenantId == Guid.Empty)
                    throw new UnauthorizedAccessException("Tenant ID not found in token");

                var page = await _screeningService.ListPatient360Async(tenantId, patientId, pageNumber, pageSize);
                return Ok(page);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Get all retinopathy screenings for a specific patient
        /// </summary>
        [HttpGet("patient/{patientId}")]
        public async Task<IActionResult> GetByPatient(Guid patientId)
        {
            try
            {
                var screenings = await _screeningService.GetByPatientAsync(patientId);
                return Ok(screenings);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error retrieving patient screenings", error = ex.Message });
            }
        }

        /// <summary>
        /// Get retinopathy screening statistics
        /// </summary>
        [HttpGet("statistics")]
        public async Task<IActionResult> GetStatistics([FromQuery] Guid? branchId = null)
        {
            try
            {
                var stats = await _screeningService.GetStatisticsAsync(branchId);
                return Ok(stats);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error retrieving statistics", error = ex.Message });
            }
        }

        /// <summary>
        /// Create a new retinopathy screening
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] RetinopathyScreeningDto dto)
        {
            try
            {
                var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? Guid.Empty.ToString());
                var screening = await _screeningService.CreateAsync(dto, userId);
                return CreatedAtAction(nameof(GetById), new { id = screening.Id }, screening);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error creating retinopathy screening", error = ex.Message });
            }
        }

        /// <summary>
        /// Update an existing retinopathy screening
        /// </summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] RetinopathyScreeningDto dto)
        {
            try
            {
                var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? Guid.Empty.ToString());
                var screening = await _screeningService.UpdateAsync(id, dto, userId);
                return Ok(screening);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error updating retinopathy screening", error = ex.Message });
            }
        }

        /// <summary>
        /// Delete a retinopathy screening (soft delete)
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            try
            {
                var result = await _screeningService.DeleteAsync(id);
                if (!result)
                    return NotFound(new { message = "Retinopathy screening not found" });

                return Ok(new { message = "Retinopathy screening deleted successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error deleting retinopathy screening", error = ex.Message });
            }
        }

        /// <summary>
        /// Search retinopathy screenings by patient name or code
        /// </summary>
        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string q)
        {
            try
            {
                var screenings = await _screeningService.SearchAsync(q);
                return Ok(screenings);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error searching retinopathy screenings", error = ex.Message });
            }
        }
    }
}
