namespace AuthService.Models.Domain.Dtos;

public class PatientLookupRowDto
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
    public bool IsFavorite { get; set; }
    public DateTime? LastVisitAt { get; set; }
    public List<string> CareProgramCodes { get; set; } = new();
    public string? ReasonForVisit { get; set; }
    public DateTime? ScheduledAt { get; set; }
    public string ClinicalAcuity { get; set; } = "low";
    public string? QueuePriority { get; set; }
    public List<PatientActiveEngagementDto> ActiveEngagements { get; set; } = new();
    public string? AssignedProviderName { get; set; }
    public string? AssignedProviderRole { get; set; }
    public Guid? PrimaryOpenVisitId { get; set; }
    public int? WaitingMinutes { get; set; }
    public string? CurrentStation { get; set; }
    public string? RoomNumber { get; set; }
    public PatientIpAdmissionDto? IpAdmission { get; set; }
}

public class PatientActiveEngagementDto
{
    public string Type { get; set; } = "";
    public string Label { get; set; } = "";
    public string? Status { get; set; }
    public string? Priority { get; set; }
}

public class PatientLookupPageDto
{
    public List<PatientLookupRowDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
}

public class PatientLookupStatsDto
{
    public int All { get; set; }
    public int Current { get; set; }
    public int New { get; set; }
    public int Discharged { get; set; }
    public int HighPriority { get; set; }
}

public class PatientSuggestRowDto
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string Mrn { get; set; } = "";
    /// <summary>UHID / Health ID when distinct from MRN — Waiting List displays this preferentially.</summary>
    public string? HealthId { get; set; }
    public DateTime DateOfBirth { get; set; }
    public string Gender { get; set; } = "";
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? PhotoThumbnailUrl { get; set; }
}

public class PatientLookupQuery
{
    public Guid BranchId { get; set; }
    public Guid TenantId { get; set; }
    public Guid UserId { get; set; }
    public string? Q { get; set; }
    public string Tab { get; set; } = "all";
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 25;
    public string SortBy { get; set; } = "name";
    public string SortDir { get; set; } = "asc";
    public bool FavoritesOnly { get; set; }
    public bool AssignedToMe { get; set; }
    public List<string> EngagementTypes { get; set; } = new();
    public List<string> ProgramCodes { get; set; } = new();
    public List<string> PatientTypes { get; set; } = new();
    public string? Gender { get; set; }
    public string? Mrn { get; set; }
    public string? Phone { get; set; }
    public DateTime? DobFrom { get; set; }
    public DateTime? DobTo { get; set; }
    public DateTime? AppointmentFrom { get; set; }
    public DateTime? AppointmentTo { get; set; }
    public string? Name { get; set; }
    public string? Diagnosis { get; set; }
    public Guid? ProviderId { get; set; }
    public Guid? DepartmentId { get; set; }
    public string? WardName { get; set; }
    public DateTime? AdmissionFrom { get; set; }
    public DateTime? AdmissionTo { get; set; }
}
