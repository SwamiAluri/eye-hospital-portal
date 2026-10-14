using System.ComponentModel.DataAnnotations;

namespace AuthService.Models.Domain.Dtos
{
    /// <summary>
    /// Request DTO for checking duplicate patients before creation/update
    /// </summary>
    public class DuplicateCheckRequest
    {
        [Required(ErrorMessage = "First name is required")]
        [StringLength(100, ErrorMessage = "First name cannot exceed 100 characters")]
        public string FirstName { get; set; } = null!;
        
        [Required(ErrorMessage = "Last name is required")]
        [StringLength(100, ErrorMessage = "Last name cannot exceed 100 characters")]
        public string LastName { get; set; } = null!;
        
        public DateTime? DateOfBirth { get; set; }

        /// <summary>When checking duplicates on an existing profile, exclude this patient id.</summary>
        public Guid? ExcludePatientId { get; set; }
        
        [Phone(ErrorMessage = "Invalid phone number format")]
        [StringLength(20, ErrorMessage = "Contact number cannot exceed 20 characters")]
        public string? ContactNumber { get; set; }
        
        [EmailAddress(ErrorMessage = "Invalid email format")]
        [StringLength(100, ErrorMessage = "Email cannot exceed 100 characters")]
        public string? Email { get; set; }
    }

    /// <summary>
    /// Response DTO containing duplicate check results
    /// </summary>
    public class DuplicateCheckResult
    {
        /// <summary>
        /// True if any duplicates found with confidence >= 80%
        /// </summary>
        public bool IsDuplicate { get; set; }
        
        /// <summary>
        /// Human-readable message about duplicate status
        /// </summary>
        public string Message { get; set; } = "";
        
        /// <summary>
        /// List of potential duplicate matches with confidence scores
        /// </summary>
        public List<PatientDuplicateMatch> Matches { get; set; } = new();
    }

    /// <summary>
    /// Represents a potential duplicate patient match
    /// </summary>
    public class PatientDuplicateMatch
    {
        /// <summary>
        /// Patient ID of the potential duplicate
        /// </summary>
        public Guid Id { get; set; }
        
        /// <summary>
        /// Medical Record Number of existing patient
        /// </summary>
        public string MedicalRecordNumber { get; set; } = "";
        
        /// <summary>
        /// First name of existing patient
        /// </summary>
        public string FirstName { get; set; } = "";
        
        /// <summary>
        /// Last name of existing patient
        /// </summary>
        public string LastName { get; set; } = "";
        
        /// <summary>
        /// Date of birth of existing patient
        /// </summary>
        public DateTime DateOfBirth { get; set; }
        
        /// <summary>
        /// Contact number of existing patient
        /// </summary>
        public string? ContactNumber { get; set; }
        
        /// <summary>
        /// Email of existing patient
        /// </summary>
        public string? Email { get; set; }
        
        /// <summary>
        /// Type of match detected (ExactNameDOB, PhoneMatch, EmailMatch, FuzzyNameDOB)
        /// </summary>
        public string MatchType { get; set; } = "";
        
        /// <summary>
        /// Confidence score (0.0 - 1.0). Higher = more likely to be duplicate.
        /// ExactNameDOB: 1.0 (hard-block band, >= 0.95)
        /// PhoneMatch: 0.90 (DUP-C3A.1 — normalized phone; soft band, not unconditional hard-block)
        /// EmailMatch: 0.90 (soft band)
        /// FuzzyNameDOB: 0.80-0.99 (similarity; hard-block only if >= 0.95)
        /// Create hard-block remains any MatchConfidence >= 0.95 on POST /api/patients.
        /// </summary>
        public decimal MatchConfidence { get; set; }
        
        /// <summary>
        /// Description of what's different between the new patient and this match
        /// Example: "Phone: '1234567890' vs '0987654321', Email: 'john@example.com' vs 'jon@example.com'"
        /// </summary>
        public string DifferenceReason { get; set; } = "";
    }
}
