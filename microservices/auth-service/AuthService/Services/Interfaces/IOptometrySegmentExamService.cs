using AuthService.DTOs.Optometry;

namespace AuthService.Services.Interfaces;

public interface IOptometrySegmentExamService
{
    Task<IReadOnlyList<OptometrySegmentExamDto>> GetByVisitAsync(Guid visitId, Guid tenantId);
    Task<OptometrySegmentExamDto?> GetSegmentAsync(Guid visitId, string segmentKey, Guid tenantId);
    Task<OptometrySegmentExamDto> UpsertSegmentAsync(
        Guid visitId,
        string segmentKey,
        Guid tenantId,
        Guid patientId,
        Guid userId,
        object data);
}
