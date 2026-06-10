using System;
using System.ComponentModel.DataAnnotations;

namespace AuthService.Models.Domain.Dtos;

/// <summary>
/// Request DTO for saving or updating examination draft
/// </summary>
public class SaveExaminationDraftRequest
{
    [Required]
    public Guid PatientId { get; set; }

    [Required]
    public Guid DoctorId { get; set; }

    /// <summary>When set, draft is scoped to this visit (optometry exam).</summary>
    public Guid? VisitId { get; set; }

    [Required]
    public string Data { get; set; } = "{}"; // JSON string with all form data (visualAcuityData, iopData, etc.)

    public DateTime? ExpiresAt { get; set; } // Optional - defaults to 24 hours if not provided
}

/// <summary>
/// Response DTO for examination draft
/// </summary>
public class ExaminationDraftResponse
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public Guid DoctorId { get; set; }
    public Guid? VisitId { get; set; }
    public Guid TenantId { get; set; }
    public string Data { get; set; } = "{}";
    public int CompletionPercentage { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
}

/// <summary>
/// Response DTO for expired drafts cleanup operation
/// </summary>
public class CleanupExpiredDraftsResponse
{
    public int DeletedCount { get; set; }
    public DateTime CleanupTime { get; set; }
    public string Message { get; set; } = string.Empty;
}
