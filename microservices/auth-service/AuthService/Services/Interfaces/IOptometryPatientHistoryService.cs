using AuthService.DTOs.Optometry;

namespace AuthService.Services.Interfaces;

public interface IOptometryPatientHistoryService
{
    Task<OptometryPatientHistoryResponse> GetHistoryAsync(
        Guid patientId,
        Guid tenantId,
        Guid? excludeVisitId = null,
        Guid? excludeSameDayAsVisitId = null,
        int limit = 10);

    Task<OptometryLatestPriorResponse> GetLatestPriorAsync(
        Guid patientId,
        Guid tenantId,
        Guid? excludeVisitId = null,
        Guid? excludeSameDayAsVisitId = null);

    Task<OptometryVisitExamRecordDto?> GetVisitExamAsync(
        Guid visitId,
        Guid tenantId);

    Task ArchiveVisitExamAsync(
        Guid visitId,
        Guid tenantId,
        Guid patientId,
        Guid userId,
        object? snapshot = null);
}
