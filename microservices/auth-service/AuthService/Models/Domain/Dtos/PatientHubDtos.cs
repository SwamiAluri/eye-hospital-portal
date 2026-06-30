namespace AuthService.Models.Domain.Dtos;

public class PatientIpAdmissionDto
{
    public bool IsAdmitted { get; set; }
    public DateTime? AdmittedAt { get; set; }
    public string? WardName { get; set; }
    public string? ClinicalState { get; set; }
    public string? ProcedureName { get; set; }
}

public class PatientRecentViewDto
{
    public Guid PatientId { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string Mrn { get; set; } = "";
    public string? PhotoThumbnailUrl { get; set; }
    public DateTime ViewedAt { get; set; }
}

public class PhiAccessRequestDto
{
    public string Context { get; set; } = "preview";
}

public class PatientSummaryDto
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string Mrn { get; set; } = "";
    public DateTime DateOfBirth { get; set; }
    public string Gender { get; set; } = "";
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? PhotoThumbnailUrl { get; set; }
    public string? BloodGroup { get; set; }
    public string? Allergies { get; set; }
    public string? EmergencyContactName { get; set; }
    public string? EmergencyContactPhone { get; set; }
    public string? EmergencyContactRelationship { get; set; }
    public string? InsuranceProvider { get; set; }
    public string? InsurancePolicyNumber { get; set; }
    public string ClinicalAcuity { get; set; } = "low";
    public List<PatientActiveEngagementDto> ActiveEngagements { get; set; } = new();
    public List<string> CareProgramCodes { get; set; } = new();
    public string? ReasonForVisit { get; set; }
    public DateTime? ScheduledAt { get; set; }
    public Guid? AssignedVisitId { get; set; }
    public string? AssignedProviderName { get; set; }
    public string? AssignedProviderRole { get; set; }
    public string? CurrentStation { get; set; }
    public PatientLatestVitalsDto? LatestVitals { get; set; }
    public PatientDataQualityDto DataQuality { get; set; } = new();
    public PatientIpAdmissionDto? IpAdmission { get; set; }
}

public class PatientLatestVitalsDto
{
    public DateTime? RecordedAt { get; set; }
    public int? BloodPressureSystolic { get; set; }
    public int? BloodPressureDiastolic { get; set; }
    public int? HeartRate { get; set; }
    public decimal? Temperature { get; set; }
    public int? OxygenSaturation { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? HeightCm { get; set; }
    public string? VisualAcuityOd { get; set; }
    public string? VisualAcuityOs { get; set; }
    public decimal? IopOd { get; set; }
    public decimal? IopOs { get; set; }
    public bool IsStale { get; set; }
}

public class PatientDataQualityDto
{
    public bool IsIncomplete { get; set; }
    public List<string> Issues { get; set; } = new();
    public bool HasStaleVitals { get; set; }
    public int? VitalsStaleDays { get; set; }
}

public class PatientRecentVisitDto
{
    public Guid Id { get; set; }
    public DateTime? CheckedInAt { get; set; }
    public string Status { get; set; } = "";
    public string? VisitType { get; set; }
    public string? CurrentStation { get; set; }
    public string? TokenNumber { get; set; }
}

public class PatientVitalsStalenessDto
{
    public bool HasVitals { get; set; }
    public bool IsStale { get; set; }
    public DateTime? LastRecordedAt { get; set; }
    public int? DaysSinceLast { get; set; }
    public int StaleThresholdDays { get; set; } = 30;
}

public class RecordVitalsRequest
{
    public int? BloodPressureSystolic { get; set; }
    public int? BloodPressureDiastolic { get; set; }
    public int? HeartRate { get; set; }
    public decimal? Temperature { get; set; }
    public string? TemperatureUnit { get; set; }
    public int? RespiratoryRate { get; set; }
    public int? OxygenSaturation { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? HeightCm { get; set; }
    public string? Notes { get; set; }
    public Guid? EncounterId { get; set; }
}

public class VitalsHistoryRowDto
{
    public Guid Id { get; set; }
    public DateTime MeasuredAt { get; set; }
    public int? BloodPressureSystolic { get; set; }
    public int? BloodPressureDiastolic { get; set; }
    public int? HeartRate { get; set; }
    public decimal? Temperature { get; set; }
    public int? OxygenSaturation { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? HeightCm { get; set; }
    public decimal? Bmi { get; set; }
    public string? Notes { get; set; }
}
