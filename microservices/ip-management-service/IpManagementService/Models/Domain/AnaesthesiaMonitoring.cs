namespace IpManagementService.Models.Domain;

/// <summary>Form 5 — Anaesthesia monitoring sheet.</summary>
public class AnaesthesiaMonitoring
{
    public Guid      Id                       { get; set; }
    public Guid      TenantId                 { get; set; }
    public Guid      PatientJourneyId         { get; set; }

    public int?      PreOpPulse               { get; set; }
    public string?   PreOpBp                  { get; set; }
    public int?      PreOpSpo2                { get; set; }
    public bool      PreOpConsentConfirmed    { get; set; }
    public DateTime? PreOpReviewAt            { get; set; }

    public string    MonitoringReadings       { get; set; } = "[]";

    public int?      DischargePr              { get; set; }
    public string?   DischargeBp              { get; set; }
    public bool?     GeneralConditionNormal   { get; set; }
    public string?   DischargeRemarks         { get; set; }
    public Guid?     DischargeClearedBy       { get; set; }
    public DateTime? DischargeClearedAt       { get; set; }

    public DateTime  CreatedAt                { get; set; }
    public DateTime  UpdatedAt                { get; set; }
    public DateTime? DeletedAt                { get; set; }
    public string    Status                   { get; set; } = "active";
}
