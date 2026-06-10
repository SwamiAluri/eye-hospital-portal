using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using AuthService.Models.Counselor;

namespace AuthService.Services
{
    public interface ICounsellingPackageTemplateService
    {
        Task<List<CounsellingPackageTemplateDto>> GetAllAsync(
            Guid tenantId,
            string? category = null,
            bool? isActive = null);

        Task<CounsellingPackageTemplateDto?> GetByIdAsync(Guid tenantId, Guid id);

        Task<CounsellingPackageTemplateDto?> GetByCodeAsync(Guid tenantId, string code);

        Task<CounsellingPackageTemplateDto?> GetByLegacyMasterCodeAsync(Guid tenantId, string legacyCode);

        Task<CounsellingPackageTemplateDto> CreateAsync(
            Guid tenantId,
            CreateCounsellingPackageTemplateRequest request,
            Guid currentUserId);

        Task<CounsellingPackageTemplateDto?> UpdateAsync(
            Guid tenantId,
            Guid id,
            UpdateCounsellingPackageTemplateRequest request,
            Guid currentUserId);

        Task<bool> DeleteAsync(Guid tenantId, Guid id, Guid currentUserId);

        Task<CounsellingSettingsDto> GetSettingsAsync(Guid tenantId);

        Task<CounsellingSettingsDto> UpdateSettingsAsync(
            Guid tenantId,
            UpdateCounsellingSettingsRequest request,
            Guid currentUserId);
    }
}
