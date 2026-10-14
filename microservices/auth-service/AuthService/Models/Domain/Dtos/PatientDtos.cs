using System;
using System.ComponentModel.DataAnnotations;

namespace AuthService.Models.Domain.Dtos;

public class CreatePatientRequest
{
    // Extended Demographics (Phase 6)
    [StringLength(10)]
    public string? Title { get; set; } // Dr, Mr, Ms, Mrs, Master, Miss

    [Required]
    [StringLength(100)]
    public string FirstName { get; set; } = null!;

    [StringLength(100)]
    public string? MiddleName { get; set; }

    [Required]
    [StringLength(100)]
    public string LastName { get; set; } = null!;

    [Required]
    public DateTime DateOfBirth { get; set; }

    [StringLength(100)]
    public string? Nationality { get; set; }

    [StringLength(200)]
    public string? Occupation { get; set; }

    [StringLength(50)]
    public string? MaritalStatus { get; set; } // Single, Married, Divorced, Widowed, Separated

    [StringLength(100)]
    public string? Religion { get; set; }

    [StringLength(50)]
    public string? LanguagePreference { get; set; }

    [Required]
    [StringLength(20)]
    public string Gender { get; set; } = null!;

    [StringLength(20)]
    public string? ContactNumber { get; set; }

    [EmailAddress]
    [StringLength(255)]
    public string? Email { get; set; }

    [StringLength(500)]
    public string? Address { get; set; }

    // Structured Address Fields (Phase 5)
    [StringLength(200)]
    public string? AddressLine1 { get; set; }

    [StringLength(200)]
    public string? AddressLine2 { get; set; }

    [StringLength(100)]
    public string? Country { get; set; }

    [StringLength(100)]
    public string? District { get; set; }

    [StringLength(200)]
    public string? Landmark { get; set; }

    [StringLength(20)]
    public string? PinCode { get; set; }

    [StringLength(10)]
    public string? BloodGroup { get; set; }

    public string? Allergies { get; set; }

    // Enhanced Medical History (Phase 4)
    public string? ChronicConditions { get; set; }

    public string? CurrentMedications { get; set; }

    public string? PastSurgeries { get; set; }

    public string? FamilyMedicalHistory { get; set; }

    public string? KnownAllergiesDetails { get; set; }

    public string? ImmunizationRecords { get; set; }

    [StringLength(100)]
    public string? DisabilityStatus { get; set; }

    public string? SpecialNeeds { get; set; }

    // Additional Medical/Lifestyle Fields (Phase 8)
    [StringLength(100)]
    public string? ExerciseHabits { get; set; }

    [StringLength(100)]
    public string? DietType { get; set; }

    [StringLength(50)]
    public string? SmokingStatus { get; set; } // Never, Former, Current - Light, Current - Heavy

    [StringLength(50)]
    public string? AlcoholUse { get; set; } // None, Occasional, Moderate, Heavy

    public string? LifestyleNotes { get; set; }

    // Emergency Contact Information
    [StringLength(200)]
    public string? EmergencyContactName { get; set; }

    [StringLength(20)]
    public string? EmergencyContactPhone { get; set; }

    [StringLength(100)]
    public string? EmergencyContactRelationship { get; set; }

    [EmailAddress]
    [StringLength(255)]
    public string? EmergencyContactEmail { get; set; }

    [StringLength(500)]
    public string? EmergencyContactAddress { get; set; }

    // Insurance Information
    [StringLength(200)]
    public string? InsuranceProvider { get; set; }

    [StringLength(100)]
    public string? InsurancePolicyNumber { get; set; }

    [StringLength(100)]
    public string? InsuranceGroupNumber { get; set; }

    public DateTime? InsuranceValidFrom { get; set; }

    public DateTime? InsuranceValidTo { get; set; }

    [StringLength(50)]
    public string? InsuranceStatus { get; set; }

    // Identity Documents
    [StringLength(50)]
    public string? HealthId { get; set; }

    [StringLength(12)]
    [RegularExpression(@"^\d{12}$", ErrorMessage = "Aadhaar must be 12 digits")]
    public string? AadhaarNumber { get; set; }

    [StringLength(50)]
    public string? NationalId { get; set; }

    [StringLength(50)]
    public string? PassportNumber { get; set; }

    [StringLength(50)]
    public string? DrivingLicense { get; set; }

    [StringLength(50)]
    public string? IdProofType { get; set; }

    // Guardian Information (for minors and legally incapacitated patients)
    [StringLength(100)]
    public string? GuardianName { get; set; }

    [StringLength(50)]
    public string? GuardianRelationship { get; set; }

    [StringLength(20)]
    public string? GuardianPhone { get; set; }

    [StringLength(100)]
    [EmailAddress(ErrorMessage = "Invalid guardian email format")]
    public string? GuardianEmail { get; set; }

    public string? GuardianAddress { get; set; }

    [StringLength(100)]
    public string? GuardianIdProof { get; set; }

    // Patient Photo (Phase 7) - Note: Photo upload handled separately via multipart/form-data
    [StringLength(500)]
    public string? PhotoUrl { get; set; }

    [StringLength(500)]
    public string? PhotoThumbnailUrl { get; set; }

    /// <summary>Optional. When omitted, server resolves the caller's effective authorized branch.</summary>
    public Guid? BranchId { get; set; }
}

public class UpdatePatientRequest : CreatePatientRequest
{
    [Required]
    public Guid Id { get; set; }
}

public class PatientResponse
{
    public Guid Id { get; set; }
    public string MedicalRecordNumber { get; set; } = null!;

    // Extended Demographics (Phase 6)
    public string? Title { get; set; }
    public string FirstName { get; set; } = null!;
    public string? MiddleName { get; set; }
    public string LastName { get; set; } = null!;
    public DateTime DateOfBirth { get; set; }
    public string? Nationality { get; set; }
    public string? Occupation { get; set; }
    public string? MaritalStatus { get; set; }
    public string? Religion { get; set; }
    public string? LanguagePreference { get; set; }

    public string Gender { get; set; } = null!;
    public string? ContactNumber { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }

    // Structured Address Fields (Phase 5)
    public string? AddressLine1 { get; set; }
    public string? AddressLine2 { get; set; }
    public string? Country { get; set; }
    public string? District { get; set; }
    public string? Landmark { get; set; }
    public string? PinCode { get; set; }

    public string? BloodGroup { get; set; }
    public string? Allergies { get; set; }

    // Enhanced Medical History (Phase 4)
    public string? ChronicConditions { get; set; }
    public string? CurrentMedications { get; set; }
    public string? PastSurgeries { get; set; }
    public string? FamilyMedicalHistory { get; set; }
    public string? KnownAllergiesDetails { get; set; }
    public string? ImmunizationRecords { get; set; }
    public string? DisabilityStatus { get; set; }
    public string? SpecialNeeds { get; set; }

    // Additional Medical/Lifestyle Fields (Phase 8)
    public string? ExerciseHabits { get; set; }
    public string? DietType { get; set; }
    public string? SmokingStatus { get; set; }
    public string? AlcoholUse { get; set; }
    public string? LifestyleNotes { get; set; }

    // Patient Photo (Phase 7)
    public string? PhotoUrl { get; set; }
    public string? PhotoThumbnailUrl { get; set; }
    public DateTime? PhotoUploadedAt { get; set; }

    // Emergency Contact Information
    public string? EmergencyContactName { get; set; }
    public string? EmergencyContactPhone { get; set; }
    public string? EmergencyContactRelationship { get; set; }
    public string? EmergencyContactEmail { get; set; }
    public string? EmergencyContactAddress { get; set; }

    // Insurance Information
    public string? InsuranceProvider { get; set; }
    public string? InsurancePolicyNumber { get; set; }
    public string? InsuranceGroupNumber { get; set; }
    public DateTime? InsuranceValidFrom { get; set; }
    public DateTime? InsuranceValidTo { get; set; }
    public string? InsuranceStatus { get; set; }

    // Identity Documents
    public string? HealthId { get; set; }
    public string? AadhaarNumber { get; set; }
    public string? NationalId { get; set; }
    public string? PassportNumber { get; set; }
    public string? DrivingLicense { get; set; }
    public string? IdProofType { get; set; }

    // Guardian Information (for minors and legally incapacitated patients)
    public string? GuardianName { get; set; }
    public string? GuardianRelationship { get; set; }
    public string? GuardianPhone { get; set; }
    public string? GuardianEmail { get; set; }
    public string? GuardianAddress { get; set; }
    public string? GuardianIdProof { get; set; }

    // Audit Fields
    public string Status { get; set; } = "Active";    public Guid? BranchId { get; set; }    public Guid? CreatedByUserId { get; set; }
    public Guid? UpdatedByUserId { get; set; }
    public DateTime? DeceasedDate { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
