using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AuthService.Models.Domain;

/// <summary>
/// Read-only projection of CCMS coverage cases (owned by ccms-service).
/// Used so the IP billing dashboard can split payer type and claim-open
/// without treating PatientJourney as financial truth. No Auth migrations.
/// </summary>
[Table("ccms_coverage_cases")]
public class CcmsCoverageCaseReadOnly
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("journey_id")]
    public Guid? JourneyId { get; set; }

    [Column("patient_id")]
    public Guid PatientId { get; set; }

    [Column("branch_id")]
    public Guid? BranchId { get; set; }

    [Column("payer_type")]
    public string PayerType { get; set; } = "";

    [Column("insurance_provider_id")]
    public Guid? InsuranceProviderId { get; set; }

    [Column("current_state")]
    public string CurrentState { get; set; } = "";

    [Column("approved_amount")]
    public decimal ApprovedAmount { get; set; }

    [Column("deleted_at")]
    public DateTime? DeletedAt { get; set; }
}
