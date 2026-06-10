using AuthService.Models.Domain;

namespace AuthService.Services.Interfaces;

public interface IExaminationDraftService
{
    Task<ExaminationDraft?> GetDraftAsync(
        Guid patientId,
        Guid doctorId,
        Guid tenantId,
        Guid? visitId = null);
    Task<ExaminationDraft> SaveDraftAsync(ExaminationDraft draft);
    Task<bool> DeleteDraftAsync(Guid draftId, Guid tenantId);
    Task<List<ExaminationDraft>> ListDraftsAsync(Guid doctorId, Guid tenantId);
    Task<int> CleanupExpiredDraftsAsync();
}

public interface IDoctorQueueService
{
    Task<List<QueueItem>> GetDoctorQueueAsync(Guid tenantId, string? date = null);
    Task<object> GetDoctorStatsAsync(Guid doctorId, Guid tenantId);
    Task<QueueItem?> CallNextPatientAsync(Guid doctorId, Guid tenantId);
    Task<QueueItem?> StartConsultationAsync(Guid queueItemId, Guid doctorId, Guid tenantId);
    Task<QueueItem?> CompleteConsultationAsync(Guid queueItemId, Guid tenantId);
    Task<QueueItem?> SkipPatientAsync(Guid queueItemId, string reason, Guid tenantId);
    Task<QueueItem?> ReferToSpecialistAsync(Guid queueItemId, Guid specialistId, string notes, Guid tenantId);
    Task<QueueItem?> ReferToImagingAsync(Guid queueItemId, string investigationType, Guid tenantId);
    Task<QueueItem?> ReferToCounselorAsync(Guid queueItemId, string reason, Guid tenantId);
}

public interface IOptometryService
{
    Task<object?> GetLatestOptometryDataAsync(Guid patientId, Guid tenantId);
}
