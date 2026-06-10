using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Counselor;
using AuthService.Models.Domain;
using AuthService.Models.MasterData;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AuthService.Services
{
    public class CounsellingPackageTemplateService : ICounsellingPackageTemplateService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<CounsellingPackageTemplateService> _logger;

        private static readonly JsonSerializerOptions JsonOpts = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        };

        public CounsellingPackageTemplateService(
            AppDbContext context,
            ILogger<CounsellingPackageTemplateService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<List<CounsellingPackageTemplateDto>> GetAllAsync(
            Guid tenantId,
            string? category = null,
            bool? isActive = null)
        {
            var query = _context.CounsellingPackageTemplates
                .AsNoTracking()
                .Where(t => t.TenantId == tenantId && t.DeletedAt == null);

            if (!string.IsNullOrWhiteSpace(category))
                query = query.Where(t => t.Category == category);

            if (isActive.HasValue)
                query = query.Where(t => t.IsActive == isActive.Value);

            var rows = await query
                .OrderBy(t => t.SortOrder)
                .ThenBy(t => t.Name)
                .ToListAsync();

            return rows.Select(MapToDto).ToList();
        }

        public async Task<CounsellingPackageTemplateDto?> GetByIdAsync(Guid tenantId, Guid id)
        {
            var row = await _context.CounsellingPackageTemplates
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == id && t.TenantId == tenantId && t.DeletedAt == null);

            return row == null ? null : MapToDto(row);
        }

        public async Task<CounsellingPackageTemplateDto?> GetByCodeAsync(Guid tenantId, string code)
        {
            var row = await _context.CounsellingPackageTemplates
                .AsNoTracking()
                .FirstOrDefaultAsync(t =>
                    t.TenantId == tenantId &&
                    t.Code == code &&
                    t.DeletedAt == null);

            return row == null ? null : MapToDto(row);
        }

        public async Task<CounsellingPackageTemplateDto?> GetByLegacyMasterCodeAsync(Guid tenantId, string legacyCode)
        {
            var row = await _context.CounsellingPackageTemplates
                .AsNoTracking()
                .FirstOrDefaultAsync(t =>
                    t.TenantId == tenantId &&
                    t.LegacyMasterCode == legacyCode &&
                    t.DeletedAt == null);

            return row == null ? null : MapToDto(row);
        }

        public async Task<CounsellingPackageTemplateDto> CreateAsync(
            Guid tenantId,
            CreateCounsellingPackageTemplateRequest request,
            Guid currentUserId)
        {
            var exists = await _context.CounsellingPackageTemplates
                .AnyAsync(t => t.TenantId == tenantId && t.Code == request.Code && t.DeletedAt == null);

            if (exists)
                throw new InvalidOperationException($"Package code '{request.Code}' already exists.");

            if (request.IsDefault)
                await ClearDefaultFlagAsync(tenantId, request.Category);

            var entity = new CounsellingPackageTemplate
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Code = request.Code.Trim(),
                Name = request.Name.Trim(),
                Description = request.Description,
                Category = request.Category,
                PackageAmount = request.PackageAmount,
                Currency = string.IsNullOrWhiteSpace(request.Currency) ? "INR" : request.Currency,
                ProcedureVariantId = request.ProcedureVariantId,
                DefaultEye = NormalizeEye(request.DefaultEye),
                VariantSubOption = request.VariantSubOption,
                IolId = request.IolId,
                InvestigationIdsJson = SerializeInvestigationIds(request.InvestigationIds),
                MaxDiscountPercent = ClampDiscountPercent(request.MaxDiscountPercent),
                LegacyMasterCode = request.LegacyMasterCode,
                IsDefault = request.IsDefault,
                SortOrder = request.SortOrder,
                IsActive = request.IsActive,
                CreatedAt = DateTime.UtcNow,
                CreatedByUserId = currentUserId,
            };

            _context.CounsellingPackageTemplates.Add(entity);
            await _context.SaveChangesAsync();

            return MapToDto(entity);
        }

        public async Task<CounsellingPackageTemplateDto?> UpdateAsync(
            Guid tenantId,
            Guid id,
            UpdateCounsellingPackageTemplateRequest request,
            Guid currentUserId)
        {
            var entity = await _context.CounsellingPackageTemplates
                .FirstOrDefaultAsync(t => t.Id == id && t.TenantId == tenantId && t.DeletedAt == null);

            if (entity == null)
                return null;

            if (request.IsDefault == true)
                await ClearDefaultFlagAsync(tenantId, request.Category ?? entity.Category, excludeId: id);

            if (request.Name != null) entity.Name = request.Name.Trim();
            if (request.Description != null) entity.Description = request.Description;
            if (request.Category != null) entity.Category = request.Category;
            if (request.PackageAmount.HasValue) entity.PackageAmount = request.PackageAmount.Value;
            if (request.ProcedureVariantId.HasValue) entity.ProcedureVariantId = request.ProcedureVariantId;
            if (request.DefaultEye != null) entity.DefaultEye = NormalizeEye(request.DefaultEye);
            if (request.VariantSubOption != null) entity.VariantSubOption = request.VariantSubOption;
            if (request.IolId.HasValue) entity.IolId = request.IolId;
            if (request.InvestigationIds != null) entity.InvestigationIdsJson = SerializeInvestigationIds(request.InvestigationIds);
            if (request.MaxDiscountPercent.HasValue) entity.MaxDiscountPercent = ClampDiscountPercent(request.MaxDiscountPercent.Value);
            if (request.LegacyMasterCode != null) entity.LegacyMasterCode = request.LegacyMasterCode;
            if (request.IsDefault.HasValue) entity.IsDefault = request.IsDefault.Value;
            if (request.SortOrder.HasValue) entity.SortOrder = request.SortOrder.Value;
            if (request.IsActive.HasValue) entity.IsActive = request.IsActive.Value;

            entity.UpdatedAt = DateTime.UtcNow;
            entity.UpdatedByUserId = currentUserId;

            await _context.SaveChangesAsync();
            return MapToDto(entity);
        }

        public async Task<bool> DeleteAsync(Guid tenantId, Guid id, Guid currentUserId)
        {
            var entity = await _context.CounsellingPackageTemplates
                .FirstOrDefaultAsync(t => t.Id == id && t.TenantId == tenantId && t.DeletedAt == null);

            if (entity == null)
                return false;

            entity.DeletedAt = DateTime.UtcNow;
            entity.IsActive = false;
            entity.UpdatedAt = DateTime.UtcNow;
            entity.UpdatedByUserId = currentUserId;

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<CounsellingSettingsDto> GetSettingsAsync(Guid tenantId)
        {
            return await ReadSettingsAsync(tenantId);
        }

        public async Task<CounsellingSettingsDto> UpdateSettingsAsync(
            Guid tenantId,
            UpdateCounsellingSettingsRequest request,
            Guid currentUserId)
        {
            var metadata = JsonSerializer.Serialize(new
            {
                percent = ClampDiscountPercent(request.MaxDiscountPercent),
                flatCap = request.MaxDiscountFlat,
            }, JsonOpts);

            var row = await _context.MasterValues
                .FirstOrDefaultAsync(m =>
                    m.TenantId == tenantId &&
                    m.EntityType == "counsellor.settings" &&
                    m.Code == "max_discount_percent" &&
                    m.DeletedAt == null);

            if (row == null)
            {
                row = new MasterValue
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    GroupKey = "counsellor",
                    EntityType = "counsellor.settings",
                    Code = "max_discount_percent",
                    Label = "Maximum Discount (%)",
                    Metadata = metadata,
                    SortOrder = 1,
                    IsActive = true,
                    IsSystemLocked = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    CreatedByUserId = currentUserId,
                    UpdatedByUserId = currentUserId,
                };
                _context.MasterValues.Add(row);
            }
            else
            {
                row.Metadata = metadata;
                row.UpdatedAt = DateTime.UtcNow;
                row.UpdatedByUserId = currentUserId;
            }

            await _context.SaveChangesAsync();
            return await ReadSettingsAsync(tenantId);
        }

        private async Task<CounsellingSettingsDto> ReadSettingsAsync(Guid tenantId)
        {
            const decimal defaultPercent = 50m;

            try
            {
                var row = await _context.MasterValues
                    .AsNoTracking()
                    .Where(m =>
                        m.TenantId == tenantId &&
                        m.EntityType == "counsellor.settings" &&
                        m.Code == "max_discount_percent" &&
                        m.DeletedAt == null &&
                        m.IsActive)
                    .Select(m => m.Metadata)
                    .FirstOrDefaultAsync();

                if (string.IsNullOrWhiteSpace(row))
                    return new CounsellingSettingsDto { MaxDiscountPercent = defaultPercent };

                using var doc = JsonDocument.Parse(row);
                var root = doc.RootElement;

                decimal percent = defaultPercent;
                if (root.TryGetProperty("percent", out var p) && p.TryGetDecimal(out var pd))
                    percent = pd;

                decimal? flatCap = null;
                if (root.TryGetProperty("flatCap", out var f) && f.ValueKind == JsonValueKind.Number && f.TryGetDecimal(out var fd))
                    flatCap = fd;

                return new CounsellingSettingsDto
                {
                    MaxDiscountPercent = ClampDiscountPercent(percent),
                    MaxDiscountFlat = flatCap,
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to load counsellor settings for tenant {TenantId}; using defaults.", tenantId);
                return new CounsellingSettingsDto { MaxDiscountPercent = defaultPercent };
            }
        }

        private async Task ClearDefaultFlagAsync(Guid tenantId, string? category, Guid? excludeId = null)
        {
            var query = _context.CounsellingPackageTemplates
                .Where(t => t.TenantId == tenantId && t.IsDefault && t.DeletedAt == null);

            if (!string.IsNullOrWhiteSpace(category))
                query = query.Where(t => t.Category == category);

            if (excludeId.HasValue)
                query = query.Where(t => t.Id != excludeId.Value);

            var rows = await query.ToListAsync();
            foreach (var row in rows)
                row.IsDefault = false;
        }

        private static CounsellingPackageTemplateDto MapToDto(CounsellingPackageTemplate entity) =>
            new()
            {
                Id = entity.Id,
                TenantId = entity.TenantId,
                Code = entity.Code,
                Name = entity.Name,
                Description = entity.Description,
                Category = entity.Category,
                PackageAmount = entity.PackageAmount,
                Currency = entity.Currency,
                ProcedureVariantId = entity.ProcedureVariantId,
                DefaultEye = entity.DefaultEye,
                VariantSubOption = entity.VariantSubOption,
                IolId = entity.IolId,
                InvestigationIds = DeserializeInvestigationIds(entity.InvestigationIdsJson),
                MaxDiscountPercent = entity.MaxDiscountPercent,
                LegacyMasterCode = entity.LegacyMasterCode,
                IsDefault = entity.IsDefault,
                SortOrder = entity.SortOrder,
                IsActive = entity.IsActive,
                CreatedAt = entity.CreatedAt,
                UpdatedAt = entity.UpdatedAt,
            };

        private static string SerializeInvestigationIds(List<string>? ids)
        {
            var list = (ids ?? new List<string>())
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Select(id => id.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            return JsonSerializer.Serialize(list, JsonOpts);
        }

        private static List<string> DeserializeInvestigationIds(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
                return new List<string>();

            try
            {
                return JsonSerializer.Deserialize<List<string>>(json, JsonOpts) ?? new List<string>();
            }
            catch
            {
                return new List<string>();
            }
        }

        private static string NormalizeEye(string? eye)
        {
            var e = (eye ?? "RE").Trim().ToUpperInvariant();
            return e switch
            {
                "LE" => "LE",
                "BE" or "BOTH" => "BE",
                _ => "RE",
            };
        }

        private static decimal ClampDiscountPercent(decimal percent) =>
            Math.Clamp(percent, 0m, 100m);
    }
}
