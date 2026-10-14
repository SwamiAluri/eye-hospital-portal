using System;
using System.ComponentModel.DataAnnotations;

namespace AuthService.Models.Domain.Dtos;

public class CreateImagingOrderRequest
{
    [Required]
    public Guid PatientId { get; set; }

    public Guid? ExaminationId { get; set; }

    /// <summary>Optional: links this imaging order to a specific counseling session.</summary>
    public Guid? SessionId { get; set; }

    /// <summary>Optional: overrides the ordering doctor (defaults to current user).</summary>
    public Guid? OrderingDoctorId { get; set; }

    [Required]
    [StringLength(100)]
    public string ImagingType { get; set; } = null!;

    [StringLength(20)]
    public string? Laterality { get; set; }

    [StringLength(20)]
    public string Urgency { get; set; } = "Routine";

    [StringLength(1000)]
    public string? ClinicalIndication { get; set; }

    public string? Notes { get; set; }
}

public class ImagingOrderResponse
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public string PatientName { get; set; } = null!;
    public Guid? ExaminationId { get; set; }
    public Guid? SessionId { get; set; }
    public string ImagingType { get; set; } = null!;
    public string? Laterality { get; set; }
    public string Urgency { get; set; } = null!;
    public string? ClinicalIndication { get; set; }
    public Guid OrderingDoctorId { get; set; }
    public string OrderingDoctorName { get; set; } = null!;
    public string Status { get; set; } = null!;
    public DateTime OrderedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public Guid? ReviewedByUserId { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ResultSummary { get; set; }
    public string? DicomStudyId { get; set; }
    public string? ImageStoragePath { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class UpdateImagingOrderStatusRequest
{
    [Required]
    [StringLength(50)]
    public string Status { get; set; } = null!;

    public DateTime? CompletedAt { get; set; }

    public string? ResultSummary { get; set; }

    public string? DicomStudyId { get; set; }

    public string? ImageStoragePath { get; set; }
}

// Phase 7: Imaging Images DTOs
public class ImageUploadResponse
{
    public Guid Id { get; set; }
    public Guid ImagingOrderId { get; set; }
    public string ImageUrl { get; set; } = null!;
    public string? ThumbnailUrl { get; set; }
    public string FileName { get; set; } = null!;
    public long FileSize { get; set; }
    public string ContentType { get; set; } = null!;
    public int? Width { get; set; }
    public int? Height { get; set; }
    public string Modality { get; set; } = null!;
    public DateTime UploadedAt { get; set; }
}

public class ImagingImageResponse
{
    public Guid Id { get; set; }
    public Guid ImagingOrderId { get; set; }
    public string ImageUrl { get; set; } = null!;
    public string? ThumbnailUrl { get; set; }
    public string FileName { get; set; } = null!;
    public long FileSize { get; set; }
    public string ContentType { get; set; } = null!;
    public int? Width { get; set; }
    public int? Height { get; set; }
    public string Modality { get; set; } = null!;
    public string? DicomMetadata { get; set; }
    public Guid UploadedByUserId { get; set; }
    public string? UploadedByUserName { get; set; }
    public DateTime UploadedAt { get; set; }
    public List<ImagingAnnotationResponse>? Annotations { get; set; }
}

// Phase 7: Annotation DTOs
public class CreateAnnotationRequest
{
    [Required]
    [StringLength(50)]
    public string AnnotationType { get; set; } = null!; // length, angle, roi_rectangle, etc.

    [StringLength(100)]
    public string? ToolName { get; set; }

    [Required]
    public string Coordinates { get; set; } = null!; // JSON string

    public decimal? MeasurementValue { get; set; }

    [StringLength(20)]
    public string? MeasurementUnit { get; set; }

    public string? TextContent { get; set; }

    [StringLength(7)]
    public string? Color { get; set; } = "#00FF00";

    public int? LineWidth { get; set; } = 2;

    public int? FontSize { get; set; } = 14;

    public string? AnnotationMetadata { get; set; }
}

public class UpdateAnnotationRequest
{
    [StringLength(50)]
    public string? AnnotationType { get; set; }

    public string? Coordinates { get; set; }

    public decimal? MeasurementValue { get; set; }

    [StringLength(20)]
    public string? MeasurementUnit { get; set; }

    public string? TextContent { get; set; }

    [StringLength(7)]
    public string? Color { get; set; }

    public int? LineWidth { get; set; }

    public int? FontSize { get; set; }
}

public class ImagingAnnotationResponse
{
    public Guid Id { get; set; }
    public Guid ImagingImageId { get; set; }
    public string AnnotationType { get; set; } = null!;
    public string? ToolName { get; set; }
    public string Coordinates { get; set; } = null!;
    public decimal? MeasurementValue { get; set; }
    public string? MeasurementUnit { get; set; }
    public string? TextContent { get; set; }
    public string Color { get; set; } = "#00FF00";
    public int LineWidth { get; set; } = 2;
    public int FontSize { get; set; } = 14;
    public string? AnnotationMetadata { get; set; }
    public Guid CreatedByUserId { get; set; }
    public string? CreatedByUserName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

// Phase 7: Comparison DTOs
public class CreateComparisonRequest
{
    [Required]
    public Guid PatientId { get; set; }

    [Required]
    public Guid BaselineImageId { get; set; }

    [Required]
    public Guid FollowupImageId { get; set; }

    [StringLength(50)]
    public string ComparisonType { get; set; } = "progression";

    public string? Findings { get; set; }

    public decimal? ChangePercentage { get; set; }

    [StringLength(50)]
    public string? ClinicalSignificance { get; set; }

    public string? QuantitativeMetrics { get; set; } // JSON string
}

public class ImagingComparisonResponse
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public string PatientName { get; set; } = null!;
    public Guid BaselineImageId { get; set; }
    public Guid FollowupImageId { get; set; }
    public string ComparisonType { get; set; } = null!;
    public int? TimeIntervalDays { get; set; }
    public string? Findings { get; set; }
    public decimal? ChangePercentage { get; set; }
    public string? ClinicalSignificance { get; set; }
    public string? QuantitativeMetrics { get; set; }
    public Guid ReviewedByUserId { get; set; }
    public string? ReviewedByUserName { get; set; }
    public DateTime ReviewedAt { get; set; }
    public ImagingImageResponse? BaselineImage { get; set; }
    public ImagingImageResponse? FollowupImage { get; set; }
}

/// <summary>
/// Patient 360 imaging file metadata. Storage locations and file bytes are not part of this contract.
/// </summary>
public class Patient360ImagingFileDto
{
    public Guid Id { get; set; }
    public string FileName { get; set; } = null!;
    public string Modality { get; set; } = null!;
    public long FileSize { get; set; }
    public string ContentType { get; set; } = null!;
    public DateTime UploadedAt { get; set; }
}

public class Patient360ImagingFilePageDto
{
    public List<Patient360ImagingFileDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
}
