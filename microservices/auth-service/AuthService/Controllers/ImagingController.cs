using AuthService.Authorization;
using AuthService.Models.Domain.Dtos;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

/// <summary>
/// Controller for managing imaging orders across all imaging types
/// (OCT, Visual Field, FFA, Fundus Photography, etc.)
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ImagingController : ControllerBase
{
    private readonly IImagingService _imagingService;
    private readonly IImagingExportService _exportService;
    private readonly IPatient360ImagingFilesService _patient360Images;
    private readonly ILogger<ImagingController> _logger;

    public ImagingController(
        IImagingService imagingService,
        IImagingExportService exportService,
        IPatient360ImagingFilesService patient360Images,
        ILogger<ImagingController> logger)
    {
        _imagingService = imagingService;
        _exportService = exportService;
        _patient360Images = patient360Images;
        _logger = logger;
    }

    /// <summary>
    /// Create a new imaging order
    /// </summary>
    /// <param name="request">Imaging order details</param>
    /// <returns>Created imaging order</returns>
    [HttpPost("order")]
    [RequirePermission("examination.create")]
    public async Task<ActionResult<ImagingOrderResponse>> CreateOrder([FromBody] CreateImagingOrderRequest request)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized("Tenant ID not found");

        var userId = User.FindFirst("sub")?.Value;
        if (string.IsNullOrEmpty(userId)) return Unauthorized("User ID not found");

        // Allow caller to specify ordering doctor (e.g. counselor ordering on behalf of referring doctor)
        var effectiveOrderingDoctorId = request.OrderingDoctorId ?? Guid.Parse(userId);

        try
        {
            _logger.LogInformation(
                "Creating imaging order for patient {PatientId} by user {UserId}", 
                request.PatientId, 
                userId);

            var order = await _imagingService.CreateOrderAsync(
                request, 
                effectiveOrderingDoctorId, 
                Guid.Parse(tenantId));

            return CreatedAtAction(
                nameof(GetOrderById), 
                new { id = order.Id }, 
                order);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating imaging order for patient {PatientId}", request.PatientId);
            return StatusCode(500, new { message = "Failed to create imaging order", error = ex.Message });
        }
    }

    /// <summary>
    /// Get all imaging orders for a patient
    /// </summary>
    /// <param name="patientId">Patient ID</param>
    /// <returns>List of imaging orders</returns>
    [HttpGet("patient/{patientId}")]
    [RequirePermission("examination.view")]
    public async Task<ActionResult<List<ImagingOrderResponse>>> GetPatientOrders(Guid patientId)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized("Tenant ID not found");

        try
        {
            var orders = await _imagingService.GetPatientOrdersAsync(patientId, Guid.Parse(tenantId));
            return Ok(orders);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving imaging orders for patient {PatientId}", patientId);
            return StatusCode(500, new { message = "Failed to retrieve imaging orders", error = ex.Message });
        }
    }

    /// <summary>
    /// Patient 360 imaging file metadata. Does not return storage locations or file bytes.
    /// </summary>
    [HttpGet("patient/{patientId:guid}/patient-360/images")]
    [RequirePermission("examination.view")]
    public async Task<IActionResult> GetPatient360Images(
        Guid patientId,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 20)
    {
        var tenantRaw = User.FindFirst("TenantId")?.Value ?? User.FindFirst("tenant_id")?.Value;
        if (!Guid.TryParse(tenantRaw, out var tenantId) || tenantId == Guid.Empty)
            return Unauthorized(new { message = "Tenant ID not found" });

        var page = await _patient360Images.ListAsync(tenantId, patientId, pageNumber, pageSize);
        return Ok(page);
    }

    /// <summary>
    /// Get all imaging orders for a counseling session
    /// </summary>
    [HttpGet("session/{sessionId}")]
    [RequirePermission("examination.view")]
    public async Task<ActionResult<List<ImagingOrderResponse>>> GetSessionOrders(Guid sessionId)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized("Tenant ID not found");

        try
        {
            var orders = await _imagingService.GetSessionOrdersAsync(sessionId, Guid.Parse(tenantId));
            return Ok(orders);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving imaging orders for session {SessionId}", sessionId);
            return StatusCode(500, new { message = "Failed to retrieve session imaging orders", error = ex.Message });
        }
    }

    /// <summary>
    /// Get imaging order by ID
    /// </summary>
    /// <param name="id">Order ID</param>
    /// <returns>Imaging order details</returns>
    [HttpGet("{id}")]
    [RequirePermission("examination.view")]
    public async Task<ActionResult<ImagingOrderResponse>> GetOrderById(Guid id)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized("Tenant ID not found");

        try
        {
            var order = await _imagingService.GetOrderByIdAsync(id, Guid.Parse(tenantId));
            
            if (order == null)
            {
                return NotFound(new { message = "Imaging order not found" });
            }

            return Ok(order);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving imaging order {OrderId}", id);
            return StatusCode(500, new { message = "Failed to retrieve imaging order", error = ex.Message });
        }
    }

    /// <summary>
    /// Update imaging order status (for technicians/radiologists)
    /// </summary>
    /// <param name="id">Order ID</param>
    /// <param name="request">Status update details</param>
    /// <returns>Updated imaging order</returns>
    [HttpPatch("{id}/status")]
    [RequirePermission("examination.update")]
    public async Task<ActionResult<ImagingOrderResponse>> UpdateOrderStatus(
        Guid id, 
        [FromBody] UpdateImagingOrderStatusRequest request)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized("Tenant ID not found");

        var userId = User.FindFirst("sub")?.Value;
        if (string.IsNullOrEmpty(userId)) return Unauthorized("User ID not found");

        try
        {
            var order = await _imagingService.UpdateOrderStatusAsync(
                id, 
                request, 
                Guid.Parse(tenantId), 
                Guid.Parse(userId));

            if (order == null)
            {
                return NotFound(new { message = "Imaging order not found" });
            }

            return Ok(order);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating imaging order {OrderId} status", id);
            return StatusCode(500, new { message = "Failed to update imaging order status", error = ex.Message });
        }
    }

    /// <summary>
    /// Get imaging orders by status
    /// </summary>
    /// <param name="status">Order status (Pending, In-Progress, Completed, Reviewed)</param>
    /// <returns>List of imaging orders</returns>
    [HttpGet("status/{status}")]
    [RequirePermission("examination.view")]
    public async Task<ActionResult<List<ImagingOrderResponse>>> GetOrdersByStatus(string status)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized("Tenant ID not found");

        try
        {
            var orders = await _imagingService.GetOrdersByStatusAsync(status, Guid.Parse(tenantId));
            return Ok(orders);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving imaging orders by status {Status}", status);
            return StatusCode(500, new { message = "Failed to retrieve imaging orders", error = ex.Message });
        }
    }

    // Phase 7: Image Upload Endpoints

    /// <summary>
    /// Upload images for an imaging order
    /// </summary>
    /// <param name="orderId">Imaging order ID</param>
    /// <param name="files">Image files to upload</param>
    /// <param name="modality">Imaging modality (fundus, oct, visual_field, etc.)</param>
    /// <returns>List of uploaded images</returns>
    [HttpPost("{orderId}/upload")]
    [RequirePermission("imaging.upload")]
    [RequestSizeLimit(52428800)] // 50MB max per request
    public async Task<ActionResult<List<ImageUploadResponse>>> UploadImages(
        Guid orderId,
        [FromForm] List<IFormFile> files,
        [FromForm] string modality)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized("Tenant ID not found");

        var userId = User.FindFirst("sub")?.Value;
        if (string.IsNullOrEmpty(userId)) return Unauthorized("User ID not found");

        if (files == null || files.Count == 0)
            return BadRequest(new { message = "No files provided" });

        if (files.Count > 20)
            return BadRequest(new { message = "Maximum 20 files allowed per upload" });

        try
        {
            _logger.LogInformation(
                "Uploading {FileCount} images for order {OrderId} by user {UserId}",
                files.Count, orderId, userId);

            var uploadedImages = await _imagingService.UploadImagesAsync(
                orderId,
                files,
                modality,
                Guid.Parse(userId),
                Guid.Parse(tenantId));

            return Ok(uploadedImages);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading images for order {OrderId}", orderId);
            return StatusCode(500, new { message = "Failed to upload images", error = ex.Message });
        }
    }

    /// <summary>
    /// Get all images for an imaging order
    /// </summary>
    /// <param name="orderId">Imaging order ID</param>
    /// <returns>List of images with thumbnails</returns>
    [HttpGet("{orderId}/images")]
    [RequirePermission("examination.view")]
    public async Task<ActionResult<List<ImagingImageResponse>>> GetOrderImages(Guid orderId)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized("Tenant ID not found");

        try
        {
            var images = await _imagingService.GetOrderImagesAsync(orderId, Guid.Parse(tenantId));
            return Ok(images);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving images for order {OrderId}", orderId);
            return StatusCode(500, new { message = "Failed to retrieve images", error = ex.Message });
        }
    }

    // Phase 7: Annotation Endpoints

    /// <summary>
    /// Create annotation on an image
    /// </summary>
    /// <param name="imageId">Image ID</param>
    /// <param name="request">Annotation details</param>
    /// <returns>Created annotation</returns>
    [HttpPost("images/{imageId}/annotations")]
    [RequirePermission("imaging.annotate")]
    public async Task<ActionResult<ImagingAnnotationResponse>> CreateAnnotation(
        Guid imageId,
        [FromBody] CreateAnnotationRequest request)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized("Tenant ID not found");

        var userId = User.FindFirst("sub")?.Value;
        if (string.IsNullOrEmpty(userId)) return Unauthorized("User ID not found");

        try
        {
            var annotation = await _imagingService.CreateAnnotationAsync(
                imageId,
                request,
                Guid.Parse(userId),
                Guid.Parse(tenantId));

            return CreatedAtAction(
                nameof(GetImageAnnotations),
                new { imageId },
                annotation);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating annotation for image {ImageId}", imageId);
            return StatusCode(500, new { message = "Failed to create annotation", error = ex.Message });
        }
    }

    /// <summary>
    /// Get all annotations for an image
    /// </summary>
    /// <param name="imageId">Image ID</param>
    /// <returns>List of annotations</returns>
    [HttpGet("images/{imageId}/annotations")]
    [RequirePermission("examination.view")]
    public async Task<ActionResult<List<ImagingAnnotationResponse>>> GetImageAnnotations(Guid imageId)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized("Tenant ID not found");

        try
        {
            var annotations = await _imagingService.GetImageAnnotationsAsync(imageId, Guid.Parse(tenantId));
            return Ok(annotations);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving annotations for image {ImageId}", imageId);
            return StatusCode(500, new { message = "Failed to retrieve annotations", error = ex.Message });
        }
    }

    /// <summary>
    /// Update an annotation
    /// </summary>
    /// <param name="annotationId">Annotation ID</param>
    /// <param name="request">Updated annotation details</param>
    /// <returns>Updated annotation</returns>
    [HttpPut("annotations/{annotationId}")]
    [RequirePermission("imaging.annotate")]
    public async Task<ActionResult<ImagingAnnotationResponse>> UpdateAnnotation(
        Guid annotationId,
        [FromBody] UpdateAnnotationRequest request)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized("Tenant ID not found");

        var userId = User.FindFirst("sub")?.Value;
        if (string.IsNullOrEmpty(userId)) return Unauthorized("User ID not found");

        try
        {
            var annotation = await _imagingService.UpdateAnnotationAsync(
                annotationId,
                request,
                Guid.Parse(userId),
                Guid.Parse(tenantId));

            if (annotation == null)
                return NotFound(new { message = "Annotation not found" });

            return Ok(annotation);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating annotation {AnnotationId}", annotationId);
            return StatusCode(500, new { message = "Failed to update annotation", error = ex.Message });
        }
    }

    /// <summary>
    /// Delete an annotation (soft delete)
    /// </summary>
    /// <param name="annotationId">Annotation ID</param>
    /// <returns>No content</returns>
    [HttpDelete("annotations/{annotationId}")]
    [RequirePermission("imaging.annotate")]
    public async Task<ActionResult> DeleteAnnotation(Guid annotationId)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized("Tenant ID not found");

        var userId = User.FindFirst("sub")?.Value;
        if (string.IsNullOrEmpty(userId)) return Unauthorized("User ID not found");

        try
        {
            var result = await _imagingService.DeleteAnnotationAsync(
                annotationId,
                Guid.Parse(userId),
                Guid.Parse(tenantId));

            if (!result)
                return NotFound(new { message = "Annotation not found" });

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting annotation {AnnotationId}", annotationId);
            return StatusCode(500, new { message = "Failed to delete annotation", error = ex.Message });
        }
    }

    // Phase 7: Comparison Endpoints

    /// <summary>
    /// Create image comparison for progression tracking
    /// </summary>
    /// <param name="request">Comparison details</param>
    /// <returns>Created comparison</returns>
    [HttpPost("compare")]
    [RequirePermission("examination.update")]
    public async Task<ActionResult<ImagingComparisonResponse>> CreateComparison(
        [FromBody] CreateComparisonRequest request)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized("Tenant ID not found");

        var userId = User.FindFirst("sub")?.Value;
        if (string.IsNullOrEmpty(userId)) return Unauthorized("User ID not found");

        if (request.BaselineImageId == request.FollowupImageId)
            return BadRequest(new { message = "Cannot compare image to itself" });

        try
        {
            var comparison = await _imagingService.CreateComparisonAsync(
                request,
                Guid.Parse(userId),
                Guid.Parse(tenantId));

            return CreatedAtAction(
                nameof(GetPatientComparisons),
                new { patientId = request.PatientId },
                comparison);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating comparison for patient {PatientId}", request.PatientId);
            return StatusCode(500, new { message = "Failed to create comparison", error = ex.Message });
        }
    }

    /// <summary>
    /// Get all comparisons for a patient
    /// </summary>
    /// <param name="patientId">Patient ID</param>
    /// <returns>List of comparisons ordered by date</returns>
    [HttpGet("patients/{patientId}/comparisons")]
    [RequirePermission("examination.view")]
    public async Task<ActionResult<List<ImagingComparisonResponse>>> GetPatientComparisons(Guid patientId)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized("Tenant ID not found");

        try
        {
            var comparisons = await _imagingService.GetPatientComparisonsAsync(patientId, Guid.Parse(tenantId));
            return Ok(comparisons);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving comparisons for patient {PatientId}", patientId);
            return StatusCode(500, new { message = "Failed to retrieve comparisons", error = ex.Message });
        }
    }

    #region Export & PDF Generation (Phase 6)

    /// <summary>
    /// Generate PDF report for an imaging order
    /// </summary>
    /// <param name="orderId">Imaging order ID</param>
    /// <param name="options">Export options</param>
    /// <returns>PDF report URL</returns>
    [HttpPost("orders/{orderId}/export/pdf")]
    [RequirePermission("examination.view")]
    public async Task<ActionResult<ImagingReportResponse>> ExportOrderToPdf(
        Guid orderId,
        [FromBody] ExportOptions? options = null)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized("Tenant ID not found");

        var userId = User.FindFirst("sub")?.Value;
        if (string.IsNullOrEmpty(userId)) return Unauthorized("User ID not found");

        try
        {
            _logger.LogInformation("Generating PDF report for order {OrderId}", orderId);

            var exportOptions = options ?? new ExportOptions();
            var report = await _exportService.GenerateImagingReportAsync(
                orderId,
                exportOptions,
                Guid.Parse(userId),
                Guid.Parse(tenantId));

            return Ok(report);
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning(ex, "Order {OrderId} not found for PDF export", orderId);
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating PDF report for order {OrderId}", orderId);
            return StatusCode(500, new { message = "Failed to generate PDF report", error = ex.Message });
        }
    }

    /// <summary>
    /// Generate PDF report for an imaging comparison
    /// </summary>
    /// <param name="comparisonId">Imaging comparison ID</param>
    /// <param name="options">Export options</param>
    /// <returns>PDF report URL</returns>
    [HttpPost("comparisons/{comparisonId}/export/pdf")]
    [RequirePermission("examination.view")]
    public async Task<ActionResult<ImagingReportResponse>> ExportComparisonToPdf(
        Guid comparisonId,
        [FromBody] ExportOptions? options = null)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized("Tenant ID not found");

        var userId = User.FindFirst("sub")?.Value;
        if (string.IsNullOrEmpty(userId)) return Unauthorized("User ID not found");

        try
        {
            _logger.LogInformation("Generating PDF comparison report for {ComparisonId}", comparisonId);

            var exportOptions = options ?? new ExportOptions();
            var report = await _exportService.GenerateComparisonReportAsync(
                comparisonId,
                exportOptions,
                Guid.Parse(userId),
                Guid.Parse(tenantId));

            return Ok(report);
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning(ex, "Comparison {ComparisonId} not found for PDF export", comparisonId);
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating PDF comparison report for {ComparisonId}", comparisonId);
            return StatusCode(500, new { message = "Failed to generate comparison report", error = ex.Message });
        }
    }

    #endregion
}

