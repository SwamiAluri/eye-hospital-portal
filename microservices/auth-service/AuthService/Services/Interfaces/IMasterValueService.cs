using AuthService.Models.MasterData;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace AuthService.Services.Interfaces
{
    /// <summary>
    /// Service for managing the generic master.master_value table.
    /// Handles all 53 entity types across 12 groups.
    /// </summary>
    public interface IMasterValueService
    {
        /// <summary>Returns all entity type metadata grouped by group_key.</summary>
        Task<List<MasterGroupDto>> GetGroupsAsync();

        /// <summary>Returns all active values for a specific entity type with pagination.</summary>
        Task<MasterValueListResponse> GetByEntityTypeAsync(Guid tenantId, string entityType, bool includeInactive = false, int page = 1, int pageSize = 50);

        /// <summary>Returns all active values for dropdown lookups (no pagination, max 500).</summary>
        Task<MasterLookupResponse> GetLookupAsync(Guid tenantId, string entityType);

        /// <summary>Returns a single value by id.</summary>
        Task<MasterValueDto?> GetByIdAsync(Guid tenantId, Guid id);

        /// <summary>Creates a new master value. Throws if code already exists for this entity type.</summary>
        Task<MasterValueDto> CreateAsync(Guid tenantId, string entityType, CreateMasterValueRequest request, Guid createdByUserId);

        /// <summary>Updates label/description/metadata/sortOrder of an existing value.</summary>
        Task<MasterValueDto> UpdateAsync(Guid tenantId, Guid id, UpdateMasterValueRequest request, Guid updatedByUserId);

        /// <summary>Soft-enables a previously disabled value.</summary>
        Task EnableAsync(Guid tenantId, Guid id, Guid updatedByUserId);

        /// <summary>Soft-disables a value (sets is_active=false) with optional audit reason.</summary>
        Task DisableAsync(Guid tenantId, Guid id, Guid updatedByUserId, string? reason = null);

        /// <summary>
        /// Soft-deletes a value. Throws InvalidOperationException if the value is system-locked.
        /// </summary>
        Task DeleteAsync(Guid tenantId, Guid id, Guid deletedByUserId);

        /// <summary>Seeds default values for a new tenant from the built-in catalog.</summary>
        Task SeedDefaultsForTenantAsync(Guid tenantId, Guid createdByUserId);

        /// <summary>Returns aggregate stats (total/active/disabled/systemLocked) for all entity types in a group.</summary>
        Task<List<MasterEntityTypeStatsDto>> GetGroupStatsAsync(Guid tenantId, string groupKey);
    }
}
