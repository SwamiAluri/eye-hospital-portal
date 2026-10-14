using AuthService.DTOs;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace AuthService.Services
{
    public interface IBiometryService
    {
        Task<(List<BiometryRecordDto> Data, int Total)> GetAllAsync(int page, int pageSize, string? search, string? eye, Guid? patientId, Guid? branchId);
        Task<BiometryRecordDto?> GetByIdAsync(Guid id);
        Task<List<BiometryRecordDto>> GetByPatientAsync(Guid patientId);
        Task<Patient360BiometryPageDto> ListPatient360Async(Guid tenantId, Guid patientId, int page, int pageSize);
        Task<BiometryStatisticsDto> GetStatisticsAsync(Guid? branchId);
        Task<BiometryRecordDto> CreateAsync(BiometryRecordDto dto, Guid userId);
        Task<BiometryRecordDto> UpdateAsync(Guid id, BiometryRecordDto dto, Guid userId);
        Task<bool> DeleteAsync(Guid id);
        Task<List<BiometryIOLCalculationResultDto>> CalculateAllFormulasAsync(IOLCalculationRequestDto request);
        Task<BiometryIOLCalculationResultDto> CalculateIOLAsync(string formula, IOLCalculationRequestDto request);
        Task<List<BiometryRecordDto>> SearchAsync(string query);
    }
}
