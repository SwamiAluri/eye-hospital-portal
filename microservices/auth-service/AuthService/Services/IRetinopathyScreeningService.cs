using AuthService.DTOs;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace AuthService.Services
{
    public interface IRetinopathyScreeningService
    {
        Task<(List<RetinopathyScreeningDto> Data, int Total)> GetAllAsync(int page, int pageSize, string? search, string? drGrade, Guid? patientId, Guid? branchId);
        Task<RetinopathyScreeningDto?> GetByIdAsync(Guid id);
        Task<List<RetinopathyScreeningDto>> GetByPatientAsync(Guid patientId);
        Task<Patient360RetinopathyPageDto> ListPatient360Async(Guid tenantId, Guid patientId, int page, int pageSize);
        Task<RetinopathyStatisticsDto> GetStatisticsAsync(Guid? branchId);
        Task<RetinopathyScreeningDto> CreateAsync(RetinopathyScreeningDto dto, Guid userId);
        Task<RetinopathyScreeningDto> UpdateAsync(Guid id, RetinopathyScreeningDto dto, Guid userId);
        Task<bool> DeleteAsync(Guid id);
        Task<List<RetinopathyScreeningDto>> SearchAsync(string query);
    }
}
