namespace AuthService.DTOs.Billing;

public class ChargeReconciliationReportDto
{
    public DateTime FromUtc { get; set; }
    public DateTime ToUtc { get; set; }
    public DateTime GeneratedAt { get; set; }
    public List<ReconciliationBucketDto> Buckets { get; set; } = [];
    public List<ReconciliationRowDto> ImplantedNotCharged { get; set; } = [];
    public List<ReconciliationRowDto> ChargedNotImplanted { get; set; } = [];
    public List<ReconciliationRowDto> StockOutNoUsage { get; set; } = [];
    public List<ReconciliationRowDto> PackageConsumableOverlap { get; set; } = [];
    public List<ReconciliationRowDto> UnmappedItems { get; set; } = [];
}

public class ReconciliationBucketDto
{
    public int Number { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public int Count { get; set; }
    public decimal Value { get; set; }
}

public class ReconciliationRowDto
{
    public Guid? JourneyId { get; set; }
    public Guid? BillId { get; set; }
    public string? BillNumber { get; set; }
    public Guid? PatientId { get; set; }
    public string? PatientName { get; set; }
    public Guid? ItemId { get; set; }
    public string ItemName { get; set; } = string.Empty;
    public string? SerialNumber { get; set; }
    public string? SourceType { get; set; }
    public Guid? SourceRefId { get; set; }
    public decimal Amount { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DateTime OccurredAt { get; set; }
}

public class ChargeCompletenessDto
{
    public Guid? PatientJourneyId { get; set; }
    public Guid? BillId { get; set; }
    public int ImplantsRecorded { get; set; }
    public int ImplantsCharged { get; set; }
    public int ImplantsMissingCharge { get; set; }
    public int ConsumablesPending { get; set; }
    public int ExceptionsOpen { get; set; }
    public List<string> Warnings { get; set; } = [];
}

/// <summary>
/// RPT-080. S-15 leakage in the dashboard window: implanted/issued but not posted.
/// Amounts are catalog (variant_prices), never purchase rate. Unmapped is counted separately.
/// </summary>
public class UnbilledActivityDto
{
    public int ImplantCount { get; set; }
    public decimal ImplantAmount { get; set; }
    public int ConsumableCount { get; set; }
    public decimal ConsumableAmount { get; set; }
    public int UnmappedExceptionCount { get; set; }
    public int Count => ImplantCount + ConsumableCount;
    public decimal Amount => ImplantAmount + ConsumableAmount;
}

public class JourneyChargeStatusDto
{
    public Guid JourneyId { get; set; }
    public string Status { get; set; } = "complete";
    public string Label { get; set; } = "Complete";
    public int MissingChargeCount { get; set; }
    public int UnmappedCount { get; set; }
}

public class WastageReportDto
{
    public DateTime FromUtc { get; set; }
    public DateTime ToUtc { get; set; }
    public decimal UsageTotalCost { get; set; }
    public decimal LedgerTotalCost { get; set; }
    public decimal Delta { get; set; }
    public List<WastageLineDto> Lines { get; set; } = [];
    public List<WastageGroupDto> ByReason { get; set; } = [];
    public List<WastageGroupDto> BySurgeon { get; set; } = [];
    public List<WastageGroupDto> ByItem { get; set; } = [];
    public List<WastageGroupDto> ByMonth { get; set; } = [];
}

public class WastageLineDto
{
    public DateTime OccurredAt { get; set; }
    public Guid? JourneyId { get; set; }
    public Guid? PatientId { get; set; }
    public Guid? SurgeonUserId { get; set; }
    public string? SurgeonName { get; set; }
    public Guid? ItemId { get; set; }
    public string ItemName { get; set; } = string.Empty;
    public string? SerialNumber { get; set; }
    public string UsageStatus { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public decimal Cost { get; set; }
    public bool HasLedgerMatch { get; set; }
}

public class WastageGroupDto
{
    public string Key { get; set; } = string.Empty;
    public int Count { get; set; }
    public decimal Cost { get; set; }
}
