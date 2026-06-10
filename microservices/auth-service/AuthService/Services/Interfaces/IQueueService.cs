using AuthService.Models.Domain;

namespace AuthService.Services.Interfaces
{
    public interface IQueueService
    {
        Task<Dictionary<string, object>> GetAllQueuesAsync(Guid branchId);
        Task<QueueDisplayData?> GetQueueDisplayDataAsync(Guid? branchId, Guid? departmentId, string queueType);
        Task<QueueItem?> CallPatientAsync(Guid queueItemId, string? roomNumber, string? doctorName);
        Task<bool> MarkAbsentAsync(Guid queueItemId);
        Task<QueueItem?> TransferQueueAsync(Guid queueItemId, string newQueueType);
    }

    public class QueueDisplayData
    {
        public string CurrentToken { get; set; } = string.Empty;
        public string? CurrentPatientName { get; set; }
        public string? CurrentGender { get; set; }
        public string? CurrentAgeCategory { get; set; }
        public string? CurrentUrgency { get; set; }
        public bool CurrentIsReturnVisit { get; set; }
        public int CurrentPassNumber { get; set; } = 1;
        public string? CurrentReasonLabel { get; set; }
        public List<string> NextTokens { get; set; } = new();
        public List<QueueDisplayPatientEntry> NextPatients { get; set; } = new();
        public string DoctorName { get; set; } = string.Empty;
        public string RoomNumber { get; set; } = string.Empty;
        public string DepartmentName { get; set; } = string.Empty;
        public string QueueType { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; }
    }

    public class QueueDisplayPatientEntry
    {
        public Guid? VisitId { get; set; }
        public Guid? PatientId { get; set; }
        public string TokenNumber { get; set; } = string.Empty;
        public string PatientName { get; set; } = string.Empty;
        public string Gender { get; set; } = string.Empty;
        public string AgeCategory { get; set; } = "Adult";
        public string Urgency { get; set; } = "Routine";
        public bool IsReturnVisit { get; set; }
        public int PassNumber { get; set; } = 1;
        public string? ReasonLabel { get; set; }
    }
}
