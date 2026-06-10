using AuthService.DTOs.Queue;

namespace AuthService.Services.Interfaces;

public interface IVisitStationDisplayAdapter
{
    Task<List<QueueDisplayRoomSlideDto>> GetDoctorSlidesAsync(Guid tenantId, Guid branchId);
    Task<List<QueueDisplayRoomSlideDto>> GetImagingSlidesAsync(Guid tenantId, Guid branchId);
    Task<List<QueueDisplayRoomSlideDto>> GetBillingRegistrationSlidesAsync(Guid tenantId, Guid branchId);
}
