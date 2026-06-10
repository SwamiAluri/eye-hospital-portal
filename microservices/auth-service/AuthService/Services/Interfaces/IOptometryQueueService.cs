using AuthService.DTOs.Queue;
using AuthService.DTOs.Visit;
using AuthService.Services.Interfaces;

namespace AuthService.Services.Interfaces;
public interface IOptometryQueueService
{
    Task<List<OptometryQueuePatientDto>> GetQueueAsync(Guid tenantId, Guid branchId, bool includeCompletedToday = true);
    Task<OptometryQueueStatsDto> GetStatsAsync(Guid tenantId, Guid branchId);
    Task<OptometryQueuePatientDto?> CallNextAsync(Guid tenantId, Guid branchId, Guid optometristUserId, string roomCode, string? optometristName);
    Task<OptometryQueuePatientDto?> StartAsync(Guid visitId, Guid tenantId, Guid optometristUserId, string? roomCode);
    Task<OptometryQueuePatientDto?> CompleteAsync(Guid visitId, Guid tenantId, Guid userId, OptometryCompleteRequestDto? request = null);
    Task<OptometryQueuePatientDto?> SkipAsync(Guid visitId, Guid tenantId, Guid userId, string reason);
    Task<OptometryQueuePatientDto?> ReferAsync(Guid visitId, Guid tenantId, Guid userId, string reason);
    Task<List<VisitJourneyEventDto>> GetJourneyAsync(Guid visitId, Guid tenantId);
    Task RecordStationEventAsync(
        Guid tenantId,
        Guid branchId,
        Guid visitId,
        Guid patientId,
        string station,
        string eventType,
        Guid? userId,
        string? reasonCode = null,
        string? reasonNotes = null,
        string? roomCode = null,
        Guid? assignedToUserId = null,
        Guid? queueItemId = null);
    Task<int> GetNextPassNumberAsync(Guid visitId, string station);
    Task<QueueDisplayData?> GetDisplayDataAsync(Guid tenantId, Guid branchId, Guid? departmentId = null);
    Task<List<QueueDisplayRoomSlideDto>> GetRoomSlidesAsync(Guid tenantId, Guid branchId, Guid? departmentId = null);
    Task<List<OptometryPatientSearchRowDto>> SearchPatientsAsync(Guid tenantId, Guid branchId, string query, int limit = 20);
    Task EnsureQueueItemForVisitAsync(Guid visitId, Guid tenantId, Guid userId);
}
