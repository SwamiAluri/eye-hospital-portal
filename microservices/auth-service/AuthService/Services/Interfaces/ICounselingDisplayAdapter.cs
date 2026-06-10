using AuthService.DTOs.Queue;

namespace AuthService.Services.Interfaces;

public interface ICounselingDisplayAdapter
{
    Task<List<QueueDisplayRoomSlideDto>> GetRoomSlidesAsync(Guid tenantId, Guid branchId);
}
