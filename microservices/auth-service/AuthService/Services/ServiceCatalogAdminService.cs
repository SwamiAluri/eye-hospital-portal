using AuthService.Context;
using AuthService.DTOs.Billing;
using AuthService.Models.Domain;
using AuthService.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public class ServiceCatalogAdminService : IServiceCatalogAdminService
{
    private static readonly HashSet<string> ValidPriceTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "PER_EYE", "BOTH_EYES", "FIXED",
    };

    private readonly AppDbContext _context;

    public ServiceCatalogAdminService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<FullCatalogResponse> GetAdminCatalogAsync(bool includeInactive = false)
    {
        IQueryable<ServiceCategory> query = _context.ServiceCategories
            .Where(c => c.DeletedAt == null);

        if (!includeInactive)
            query = query.Where(c => c.IsActive);

        var categories = await query
            .Include(c => c.Services.Where(s => s.DeletedAt == null && (includeInactive || s.IsActive)))
                .ThenInclude(s => s.Variants.Where(v => v.DeletedAt == null && (includeInactive || v.IsActive)))
            .OrderBy(c => c.DisplayOrder)
            .ToListAsync();

        var variantIds = categories
            .SelectMany(c => c.Services)
            .SelectMany(s => s.Variants)
            .Select(v => v.Id)
            .ToList();

        var priceMap = await LoadGlobalPriceMapAsync(variantIds);

        return new FullCatalogResponse
        {
            Categories = categories.Select(c => MapCategory(c, priceMap)).ToList(),
        };
    }

    public async Task<ServiceCategoryDto> CreateCategoryAsync(CreateServiceCategoryRequest request, Guid userId)
    {
        var code = NormalizeCode(request.Code);
        await EnsureCategoryCodeAvailableAsync(code);

        var now = DateTime.UtcNow;
        var entity = new ServiceCategory
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = request.Name.Trim(),
            Description = request.Description,
            DisplayOrder = request.DisplayOrder,
            IsActive = request.IsActive,
            CreatedAt = now,
            UpdatedAt = now,
            CreatedByUserId = userId == Guid.Empty ? null : userId,
            UpdatedByUserId = userId == Guid.Empty ? null : userId,
            Status = "active",
        };

        _context.ServiceCategories.Add(entity);
        await _context.SaveChangesAsync();

        return MapCategory(entity, new Dictionary<Guid, decimal>());
    }

    public async Task<ServiceCategoryDto> UpdateCategoryAsync(
        Guid categoryId,
        UpdateServiceCategoryRequest request,
        Guid userId)
    {
        var entity = await FindCategoryAsync(categoryId);

        if (!string.IsNullOrWhiteSpace(request.Code))
        {
            var code = NormalizeCode(request.Code);
            if (!string.Equals(entity.Code, code, StringComparison.Ordinal))
                await EnsureCategoryCodeAvailableAsync(code, categoryId);
            entity.Code = code;
        }

        if (!string.IsNullOrWhiteSpace(request.Name))
            entity.Name = request.Name.Trim();

        if (request.Description != null)
            entity.Description = request.Description;

        if (request.DisplayOrder.HasValue)
            entity.DisplayOrder = request.DisplayOrder.Value;

        if (request.IsActive.HasValue)
            entity.IsActive = request.IsActive.Value;

        entity.UpdatedAt = DateTime.UtcNow;
        entity.UpdatedByUserId = userId == Guid.Empty ? null : userId;

        await _context.SaveChangesAsync();

        var priceMap = await LoadGlobalPriceMapAsync(
            entity.Services.Where(s => s.DeletedAt == null).SelectMany(s => s.Variants).Select(v => v.Id));

        return MapCategory(entity, priceMap);
    }

    public async Task DeleteCategoryAsync(Guid categoryId, Guid userId)
    {
        var entity = await _context.ServiceCategories
            .Include(c => c.Services.Where(s => s.DeletedAt == null))
                .ThenInclude(s => s.Variants.Where(v => v.DeletedAt == null))
            .FirstOrDefaultAsync(c => c.Id == categoryId && c.DeletedAt == null)
            ?? throw new KeyNotFoundException("Category not found.");

        var now = DateTime.UtcNow;
        SoftDeleteCategoryTree(entity, now, userId);
        await _context.SaveChangesAsync();
    }

    public async Task<CatalogServiceDto> CreateServiceAsync(
        Guid categoryId,
        CreateCatalogServiceRequest request,
        Guid userId)
    {
        _ = await FindCategoryAsync(categoryId);

        var now = DateTime.UtcNow;
        var entity = new CatalogService
        {
            Id = Guid.NewGuid(),
            CategoryId = categoryId,
            ServiceName = request.Name.Trim(),
            ServiceCode = string.IsNullOrWhiteSpace(request.Code) ? null : NormalizeCode(request.Code),
            Description = request.Description,
            DisplayOrder = request.DisplayOrder,
            IsActive = request.IsActive,
            CreatedAt = now,
            UpdatedAt = now,
            CreatedByUserId = userId == Guid.Empty ? null : userId,
            UpdatedByUserId = userId == Guid.Empty ? null : userId,
            Status = "active",
        };

        _context.CatalogServices.Add(entity);
        await _context.SaveChangesAsync();

        return MapService(entity, new Dictionary<Guid, decimal>());
    }

    public async Task<CatalogServiceDto> UpdateServiceAsync(
        Guid serviceId,
        UpdateCatalogServiceRequest request,
        Guid userId)
    {
        var entity = await FindServiceAsync(serviceId);

        if (!string.IsNullOrWhiteSpace(request.Name))
            entity.ServiceName = request.Name.Trim();

        if (request.Code != null)
            entity.ServiceCode = string.IsNullOrWhiteSpace(request.Code) ? null : NormalizeCode(request.Code);

        if (request.Description != null)
            entity.Description = request.Description;

        if (request.DisplayOrder.HasValue)
            entity.DisplayOrder = request.DisplayOrder.Value;

        if (request.IsActive.HasValue)
            entity.IsActive = request.IsActive.Value;

        entity.UpdatedAt = DateTime.UtcNow;
        entity.UpdatedByUserId = userId == Guid.Empty ? null : userId;

        await _context.SaveChangesAsync();

        var priceMap = await LoadGlobalPriceMapAsync(
            entity.Variants.Where(v => v.DeletedAt == null).Select(v => v.Id));

        return MapService(entity, priceMap);
    }

    public async Task DeleteServiceAsync(Guid serviceId, Guid userId)
    {
        var entity = await _context.CatalogServices
            .Include(s => s.Variants.Where(v => v.DeletedAt == null))
            .FirstOrDefaultAsync(s => s.Id == serviceId && s.DeletedAt == null)
            ?? throw new KeyNotFoundException("Catalog service not found.");

        var now = DateTime.UtcNow;
        SoftDeleteServiceTree(entity, now, userId);
        await _context.SaveChangesAsync();
    }

    public async Task<ServiceVariantDto> CreateVariantAsync(
        Guid serviceId,
        CreateServiceVariantRequest request,
        Guid userId)
    {
        _ = await FindServiceAsync(serviceId);
        var priceType = NormalizePriceType(request.PriceType);

        if (!string.IsNullOrWhiteSpace(request.Code))
            await EnsureVariantCodeAvailableAsync(NormalizeCode(request.Code));

        var now = DateTime.UtcNow;
        var variantId = Guid.NewGuid();
        var variant = new ServiceVariant
        {
            Id = variantId,
            CatalogServiceId = serviceId,
            VariantName = request.Name.Trim(),
            VariantCode = string.IsNullOrWhiteSpace(request.Code) ? null : NormalizeCode(request.Code),
            PriceType = priceType,
            HasIolOptions = request.HasIolOptions,
            Description = request.Description,
            DisplayOrder = request.DisplayOrder,
            IsActive = request.IsActive,
            SubOptions = request.SubOptions,
            CreatedAt = now,
            UpdatedAt = now,
            CreatedByUserId = userId == Guid.Empty ? null : userId,
            UpdatedByUserId = userId == Guid.Empty ? null : userId,
            Status = "active",
        };

        var price = new VariantPrice
        {
            Id = Guid.NewGuid(),
            VariantId = variantId,
            BranchId = null,
            Amount = request.Price,
            EffectiveFrom = DateOnly.FromDateTime(now),
            EffectiveTo = null,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now,
            CreatedByUserId = userId == Guid.Empty ? null : userId,
            UpdatedByUserId = userId == Guid.Empty ? null : userId,
            Status = "active",
        };

        _context.ServiceVariants.Add(variant);
        _context.VariantPrices.Add(price);
        await _context.SaveChangesAsync();

        return MapVariant(variant, request.Price);
    }

    public async Task<ServiceVariantDto> UpdateVariantAsync(
        Guid variantId,
        UpdateServiceVariantRequest request,
        Guid userId)
    {
        var entity = await FindVariantAsync(variantId);

        if (!string.IsNullOrWhiteSpace(request.Name))
            entity.VariantName = request.Name.Trim();

        if (request.Code != null)
        {
            var code = string.IsNullOrWhiteSpace(request.Code) ? null : NormalizeCode(request.Code);
            if (code != null && !string.Equals(entity.VariantCode, code, StringComparison.Ordinal))
                await EnsureVariantCodeAvailableAsync(code, variantId);
            entity.VariantCode = code;
        }

        if (!string.IsNullOrWhiteSpace(request.PriceType))
            entity.PriceType = NormalizePriceType(request.PriceType);

        if (request.HasIolOptions.HasValue)
            entity.HasIolOptions = request.HasIolOptions.Value;

        if (request.Description != null)
            entity.Description = request.Description;

        if (request.DisplayOrder.HasValue)
            entity.DisplayOrder = request.DisplayOrder.Value;

        if (request.IsActive.HasValue)
            entity.IsActive = request.IsActive.Value;

        if (request.SubOptions != null)
            entity.SubOptions = request.SubOptions;

        entity.UpdatedAt = DateTime.UtcNow;
        entity.UpdatedByUserId = userId == Guid.Empty ? null : userId;

        if (request.Price.HasValue)
            await UpsertGlobalVariantPriceAsync(entity.Id, request.Price.Value, userId);

        await _context.SaveChangesAsync();

        var amount = request.Price ?? await GetGlobalPriceAsync(entity.Id);
        return MapVariant(entity, amount);
    }

    public async Task DeleteVariantAsync(Guid variantId, Guid userId)
    {
        var entity = await FindVariantAsync(variantId);
        var now = DateTime.UtcNow;

        entity.IsActive = false;
        entity.DeletedAt = now;
        entity.UpdatedAt = now;
        entity.UpdatedByUserId = userId == Guid.Empty ? null : userId;
        entity.Status = "deleted";

        await _context.SaveChangesAsync();
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private async Task<ServiceCategory> FindCategoryAsync(Guid categoryId)
    {
        return await _context.ServiceCategories
            .Include(c => c.Services.Where(s => s.DeletedAt == null))
                .ThenInclude(s => s.Variants.Where(v => v.DeletedAt == null))
            .FirstOrDefaultAsync(c => c.Id == categoryId && c.DeletedAt == null)
            ?? throw new KeyNotFoundException("Category not found.");
    }

    private async Task<CatalogService> FindServiceAsync(Guid serviceId)
    {
        return await _context.CatalogServices
            .Include(s => s.Variants.Where(v => v.DeletedAt == null))
            .FirstOrDefaultAsync(s => s.Id == serviceId && s.DeletedAt == null)
            ?? throw new KeyNotFoundException("Catalog service not found.");
    }

    private async Task<ServiceVariant> FindVariantAsync(Guid variantId)
    {
        return await _context.ServiceVariants
            .FirstOrDefaultAsync(v => v.Id == variantId && v.DeletedAt == null)
            ?? throw new KeyNotFoundException("Service variant not found.");
    }

    private async Task EnsureCategoryCodeAvailableAsync(string code, Guid? excludeId = null)
    {
        var exists = await _context.ServiceCategories.AnyAsync(c =>
            c.Code == code && c.DeletedAt == null && (!excludeId.HasValue || c.Id != excludeId.Value));
        if (exists)
            throw new InvalidOperationException($"Category code '{code}' already exists.");
    }

    private async Task EnsureVariantCodeAvailableAsync(string code, Guid? excludeId = null)
    {
        var exists = await _context.ServiceVariants.AnyAsync(v =>
            v.VariantCode == code && v.DeletedAt == null && (!excludeId.HasValue || v.Id != excludeId.Value));
        if (exists)
            throw new InvalidOperationException($"Variant code '{code}' already exists.");
    }

    private static string NormalizeCode(string code) => code.Trim().ToUpperInvariant();

    private static string NormalizePriceType(string priceType)
    {
        var normalized = priceType.Trim().ToUpperInvariant();
        if (!ValidPriceTypes.Contains(normalized))
            throw new ArgumentException($"Invalid priceType '{priceType}'. Use PER_EYE, BOTH_EYES, or FIXED.");
        return normalized;
    }

    private async Task<Dictionary<Guid, decimal>> LoadGlobalPriceMapAsync(IEnumerable<Guid> variantIds)
    {
        var ids = variantIds.Distinct().ToList();
        if (ids.Count == 0)
            return new Dictionary<Guid, decimal>();

        return (await _context.VariantPrices
            .Where(p => ids.Contains(p.VariantId)
                     && p.BranchId == null
                     && p.EffectiveTo == null
                     && p.IsActive
                     && p.DeletedAt == null)
            .ToListAsync())
            .GroupBy(p => p.VariantId)
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(p => p.EffectiveFrom).First().Amount);
    }

    private async Task<decimal> GetGlobalPriceAsync(Guid variantId)
    {
        var map = await LoadGlobalPriceMapAsync(new[] { variantId });
        return map.GetValueOrDefault(variantId, 0);
    }

    private async Task UpsertGlobalVariantPriceAsync(Guid variantId, decimal amount, Guid userId)
    {
        var now = DateTime.UtcNow;
        var active = await _context.VariantPrices
            .Where(p => p.VariantId == variantId
                     && p.BranchId == null
                     && p.EffectiveTo == null
                     && p.IsActive
                     && p.DeletedAt == null)
            .OrderByDescending(p => p.EffectiveFrom)
            .FirstOrDefaultAsync();

        if (active != null && active.Amount == amount)
            return;

        if (active != null)
        {
            active.EffectiveTo = DateOnly.FromDateTime(now);
            active.UpdatedAt = now;
            active.UpdatedByUserId = userId == Guid.Empty ? null : userId;
        }

        _context.VariantPrices.Add(new VariantPrice
        {
            Id = Guid.NewGuid(),
            VariantId = variantId,
            BranchId = null,
            Amount = amount,
            EffectiveFrom = DateOnly.FromDateTime(now),
            EffectiveTo = null,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now,
            CreatedByUserId = userId == Guid.Empty ? null : userId,
            UpdatedByUserId = userId == Guid.Empty ? null : userId,
            Status = "active",
        });
    }

    private static void SoftDeleteCategoryTree(ServiceCategory category, DateTime now, Guid userId)
    {
        category.IsActive = false;
        category.DeletedAt = now;
        category.UpdatedAt = now;
        category.UpdatedByUserId = userId == Guid.Empty ? null : userId;
        category.Status = "deleted";

        foreach (var service in category.Services)
            SoftDeleteServiceTree(service, now, userId);
    }

    private static void SoftDeleteServiceTree(CatalogService service, DateTime now, Guid userId)
    {
        service.IsActive = false;
        service.DeletedAt = now;
        service.UpdatedAt = now;
        service.UpdatedByUserId = userId == Guid.Empty ? null : userId;
        service.Status = "deleted";

        foreach (var variant in service.Variants)
        {
            variant.IsActive = false;
            variant.DeletedAt = now;
            variant.UpdatedAt = now;
            variant.UpdatedByUserId = userId == Guid.Empty ? null : userId;
            variant.Status = "deleted";
        }
    }

    private static ServiceCategoryDto MapCategory(ServiceCategory c, IReadOnlyDictionary<Guid, decimal> priceMap) =>
        new()
        {
            Id = c.Id,
            Code = c.Code,
            Name = c.Name,
            DisplayOrder = c.DisplayOrder,
            IsActive = c.IsActive,
            Services = c.Services
                .OrderBy(s => s.DisplayOrder)
                .Select(s => MapService(s, priceMap))
                .ToList(),
        };

    private static CatalogServiceDto MapService(CatalogService s, IReadOnlyDictionary<Guid, decimal> priceMap) =>
        new()
        {
            Id = s.Id,
            Code = s.ServiceCode ?? string.Empty,
            Name = s.ServiceName,
            IsActive = s.IsActive,
            Variants = s.Variants
                .OrderBy(v => v.DisplayOrder)
                .Select(v => MapVariant(v, priceMap.GetValueOrDefault(v.Id, 0)))
                .ToList(),
        };

    private static ServiceVariantDto MapVariant(ServiceVariant v, decimal price) =>
        new()
        {
            Id = v.Id,
            Code = v.VariantCode ?? string.Empty,
            Name = v.VariantName,
            Price = price,
            PriceType = v.PriceType,
            HasIolOptions = v.HasIolOptions,
            DisplayOrder = v.DisplayOrder,
            IsActive = v.IsActive,
            SubOptions = v.SubOptions,
        };

    // ── IOL master ───────────────────────────────────────────────────────────

    public async Task<List<IolMasterAdminDto>> GetIolCatalogAsync(bool includeInactive = false)
    {
        var query = _context.IolMasters.Where(i => i.DeletedAt == null);
        if (!includeInactive)
            query = query.Where(i => i.IsActive);

        var iols = await query.OrderBy(i => i.DisplayOrder).ThenBy(i => i.ModelName).ToListAsync();
        var priceMap = await LoadGlobalIolPriceMapAsync(iols.Select(i => i.Id));
        return iols.Select(i => MapIol(i, priceMap.GetValueOrDefault(i.Id, 0))).ToList();
    }

    public async Task<IolMasterAdminDto> CreateIolAsync(CreateIolMasterRequest request, Guid userId)
    {
        var now = DateTime.UtcNow;
        var iolId = Guid.NewGuid();
        var iol = new IolMaster
        {
            Id = iolId,
            ModelName = request.ModelName.Trim(),
            BrandManufacturer = request.BrandManufacturer.Trim(),
            IolType = request.IolType.Trim(),
            Origin = request.Origin.Trim(),
            ProductCode = request.ProductCode,
            DisplayOrder = request.DisplayOrder,
            IsActive = request.IsActive,
            CreatedAt = now,
            UpdatedAt = now,
            CreatedByUserId = userId == Guid.Empty ? null : userId,
            UpdatedByUserId = userId == Guid.Empty ? null : userId,
            Status = "active",
        };

        var price = new IolPrice
        {
            Id = Guid.NewGuid(),
            IolMasterId = iolId,
            BranchId = null,
            Amount = request.Price,
            EffectiveFrom = DateOnly.FromDateTime(now),
            EffectiveTo = null,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now,
            CreatedByUserId = userId == Guid.Empty ? null : userId,
            UpdatedByUserId = userId == Guid.Empty ? null : userId,
            Status = "active",
        };

        _context.IolMasters.Add(iol);
        _context.IolPrices.Add(price);
        await _context.SaveChangesAsync();
        return MapIol(iol, request.Price);
    }

    public async Task<IolMasterAdminDto> UpdateIolAsync(Guid iolId, UpdateIolMasterRequest request, Guid userId)
    {
        var iol = await _context.IolMasters
            .FirstOrDefaultAsync(i => i.Id == iolId && i.DeletedAt == null)
            ?? throw new KeyNotFoundException("IOL not found.");

        if (!string.IsNullOrWhiteSpace(request.ModelName))
            iol.ModelName = request.ModelName.Trim();
        if (!string.IsNullOrWhiteSpace(request.BrandManufacturer))
            iol.BrandManufacturer = request.BrandManufacturer.Trim();
        if (!string.IsNullOrWhiteSpace(request.IolType))
            iol.IolType = request.IolType.Trim();
        if (!string.IsNullOrWhiteSpace(request.Origin))
            iol.Origin = request.Origin.Trim();
        if (request.ProductCode != null)
            iol.ProductCode = request.ProductCode;
        if (request.DisplayOrder.HasValue)
            iol.DisplayOrder = request.DisplayOrder.Value;
        if (request.IsActive.HasValue)
            iol.IsActive = request.IsActive.Value;

        iol.UpdatedAt = DateTime.UtcNow;
        iol.UpdatedByUserId = userId == Guid.Empty ? null : userId;

        if (request.Price.HasValue)
            await UpsertGlobalIolPriceAsync(iolId, request.Price.Value, userId);

        await _context.SaveChangesAsync();
        var amount = request.Price ?? await GetGlobalIolPriceAsync(iolId);
        return MapIol(iol, amount);
    }

    public async Task DeleteIolAsync(Guid iolId, Guid userId)
    {
        var iol = await _context.IolMasters
            .FirstOrDefaultAsync(i => i.Id == iolId && i.DeletedAt == null)
            ?? throw new KeyNotFoundException("IOL not found.");

        var now = DateTime.UtcNow;
        iol.IsActive = false;
        iol.DeletedAt = now;
        iol.UpdatedAt = now;
        iol.UpdatedByUserId = userId == Guid.Empty ? null : userId;
        iol.Status = "deleted";

        var mappings = await _context.VariantIolMappings
            .Where(m => m.IolMasterId == iolId && m.DeletedAt == null)
            .ToListAsync();
        foreach (var m in mappings)
        {
            m.DeletedAt = now;
            m.UpdatedAt = now;
            m.UpdatedByUserId = userId == Guid.Empty ? null : userId;
            m.Status = "deleted";
        }

        await _context.SaveChangesAsync();
    }

    public async Task<List<VariantIolMappingAdminDto>> GetVariantIolMappingsAsync(Guid variantId)
    {
        _ = await FindVariantAsync(variantId);
        return await LoadVariantIolMappingsAsync(variantId);
    }

    public async Task<List<VariantIolMappingAdminDto>> SetVariantIolMappingsAsync(
        Guid variantId,
        SetVariantIolMappingsRequest request,
        Guid userId)
    {
        var variant = await FindVariantAsync(variantId);
        variant.HasIolOptions = true;

        var links = request.Links ?? new List<VariantIolLinkRequest>();
        if (links.Count > 0 && !links.Any(l => l.IsDefault))
            links[0].IsDefault = true;

        if (links.Count(l => l.IsDefault) > 1)
            throw new ArgumentException("Only one IOL mapping can be marked as default.");

        var iolIds = links.Select(l => l.IolMasterId).Distinct().ToList();
        var validCount = await _context.IolMasters
            .CountAsync(i => iolIds.Contains(i.Id) && i.DeletedAt == null && i.IsActive);
        if (validCount != iolIds.Count)
            throw new KeyNotFoundException("One or more IOL master rows were not found.");

        var now = DateTime.UtcNow;
        var existing = await _context.VariantIolMappings
            .Where(m => m.VariantId == variantId && m.DeletedAt == null)
            .ToListAsync();

        foreach (var m in existing.Where(m => !iolIds.Contains(m.IolMasterId)))
        {
            m.DeletedAt = now;
            m.UpdatedAt = now;
            m.UpdatedByUserId = userId == Guid.Empty ? null : userId;
            m.Status = "deleted";
        }

        foreach (var link in links)
        {
            var row = existing.FirstOrDefault(m => m.IolMasterId == link.IolMasterId);
            if (row != null)
            {
                row.IsDefault = link.IsDefault;
                row.DeletedAt = null;
                row.Status = "active";
                row.UpdatedAt = now;
                row.UpdatedByUserId = userId == Guid.Empty ? null : userId;
            }
            else
            {
                _context.VariantIolMappings.Add(new VariantIolMapping
                {
                    Id = Guid.NewGuid(),
                    VariantId = variantId,
                    IolMasterId = link.IolMasterId,
                    IsDefault = link.IsDefault,
                    CreatedAt = now,
                    UpdatedAt = now,
                    CreatedByUserId = userId == Guid.Empty ? null : userId,
                    UpdatedByUserId = userId == Guid.Empty ? null : userId,
                    Status = "active",
                });
            }
        }

        await _context.SaveChangesAsync();
        return await LoadVariantIolMappingsAsync(variantId);
    }

    // ── Branch pricing ─────────────────────────────────────────────────────────

    public async Task<List<BranchPricingRowDto>> GetBranchPricingRowsAsync(Guid branchId)
    {
        var categories = await _context.ServiceCategories
            .Where(c => c.DeletedAt == null && c.IsActive)
            .Include(c => c.Services.Where(s => s.DeletedAt == null && s.IsActive))
                .ThenInclude(s => s.Variants.Where(v => v.DeletedAt == null && v.IsActive))
            .OrderBy(c => c.DisplayOrder)
            .ToListAsync();

        var variants = categories
            .SelectMany(c => c.Services.SelectMany(s => s.Variants.Select(v => (c.Code, v))))
            .ToList();

        var variantIds = variants.Select(x => x.v.Id).ToList();
        var globalMap = await LoadGlobalPriceMapAsync(variantIds);

        var branchMap = (await _context.VariantPrices
            .Where(p => p.BranchId == branchId
                     && variantIds.Contains(p.VariantId)
                     && p.EffectiveTo == null
                     && p.IsActive
                     && p.DeletedAt == null)
            .ToListAsync())
            .GroupBy(p => p.VariantId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(p => p.EffectiveFrom).First().Amount);

        return variants.Select(x => new BranchPricingRowDto
        {
            VariantId = x.v.Id,
            VariantCode = x.v.VariantCode ?? string.Empty,
            VariantName = x.v.VariantName,
            CategoryCode = x.Code,
            GlobalAmount = globalMap.GetValueOrDefault(x.v.Id, 0),
            BranchAmount = branchMap.GetValueOrDefault(x.v.Id),
        }).ToList();
    }

    public async Task<BranchVariantPricingDto> UpsertBranchVariantPriceAsync(
        Guid branchId,
        UpsertBranchVariantPriceRequest request,
        Guid userId)
    {
        _ = await FindVariantAsync(request.VariantId);
        var now = DateTime.UtcNow;

        var active = await _context.VariantPrices
            .Where(p => p.VariantId == request.VariantId
                     && p.BranchId == branchId
                     && p.EffectiveTo == null
                     && p.IsActive
                     && p.DeletedAt == null)
            .OrderByDescending(p => p.EffectiveFrom)
            .FirstOrDefaultAsync();

        if (active != null && active.Amount == request.Amount)
        {
            return new BranchVariantPricingDto
            {
                VariantId = request.VariantId,
                Amount = active.Amount,
                EffectiveFrom = active.EffectiveFrom,
                EffectiveTo = active.EffectiveTo,
                IsActive = active.IsActive,
            };
        }

        if (active != null)
        {
            active.EffectiveTo = DateOnly.FromDateTime(now);
            active.UpdatedAt = now;
            active.UpdatedByUserId = userId == Guid.Empty ? null : userId;
        }

        var created = new VariantPrice
        {
            Id = Guid.NewGuid(),
            VariantId = request.VariantId,
            BranchId = branchId,
            Amount = request.Amount,
            EffectiveFrom = DateOnly.FromDateTime(now),
            EffectiveTo = null,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now,
            CreatedByUserId = userId == Guid.Empty ? null : userId,
            UpdatedByUserId = userId == Guid.Empty ? null : userId,
            Status = "active",
        };
        _context.VariantPrices.Add(created);
        await _context.SaveChangesAsync();

        return new BranchVariantPricingDto
        {
            VariantId = request.VariantId,
            Amount = created.Amount,
            EffectiveFrom = created.EffectiveFrom,
            EffectiveTo = created.EffectiveTo,
            IsActive = created.IsActive,
        };
    }

    public async Task RemoveBranchVariantPriceAsync(Guid branchId, Guid variantId, Guid userId)
    {
        var now = DateTime.UtcNow;
        var active = await _context.VariantPrices
            .Where(p => p.VariantId == variantId
                     && p.BranchId == branchId
                     && p.EffectiveTo == null
                     && p.IsActive
                     && p.DeletedAt == null)
            .ToListAsync();

        if (active.Count == 0)
            throw new KeyNotFoundException("Branch price override not found.");

        foreach (var row in active)
        {
            row.EffectiveTo = DateOnly.FromDateTime(now);
            row.UpdatedAt = now;
            row.UpdatedByUserId = userId == Guid.Empty ? null : userId;
        }

        await _context.SaveChangesAsync();
    }

    private async Task<List<VariantIolMappingAdminDto>> LoadVariantIolMappingsAsync(Guid variantId)
    {
        var mappings = await _context.VariantIolMappings
            .Include(m => m.IolMaster)
            .Where(m => m.VariantId == variantId && m.DeletedAt == null && m.IolMaster.DeletedAt == null)
            .OrderByDescending(m => m.IsDefault)
            .ThenBy(m => m.IolMaster.DisplayOrder)
            .ToListAsync();

        var priceMap = await LoadGlobalIolPriceMapAsync(mappings.Select(m => m.IolMasterId));

        return mappings.Select(m => new VariantIolMappingAdminDto
        {
            MappingId = m.Id,
            IolMasterId = m.IolMasterId,
            ModelName = m.IolMaster.ModelName,
            BrandManufacturer = m.IolMaster.BrandManufacturer,
            Price = priceMap.GetValueOrDefault(m.IolMasterId, 0),
            IsDefault = m.IsDefault,
        }).ToList();
    }

    private async Task<Dictionary<Guid, decimal>> LoadGlobalIolPriceMapAsync(IEnumerable<Guid> iolIds)
    {
        var ids = iolIds.Distinct().ToList();
        if (ids.Count == 0)
            return new Dictionary<Guid, decimal>();

        return (await _context.IolPrices
            .Where(p => ids.Contains(p.IolMasterId)
                     && p.BranchId == null
                     && p.EffectiveTo == null
                     && p.IsActive
                     && p.DeletedAt == null)
            .ToListAsync())
            .GroupBy(p => p.IolMasterId)
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(p => p.EffectiveFrom).First().Amount);
    }

    private async Task<decimal> GetGlobalIolPriceAsync(Guid iolId)
    {
        var map = await LoadGlobalIolPriceMapAsync(new[] { iolId });
        return map.GetValueOrDefault(iolId, 0);
    }

    private async Task UpsertGlobalIolPriceAsync(Guid iolId, decimal amount, Guid userId)
    {
        var now = DateTime.UtcNow;
        var active = await _context.IolPrices
            .Where(p => p.IolMasterId == iolId
                     && p.BranchId == null
                     && p.EffectiveTo == null
                     && p.IsActive
                     && p.DeletedAt == null)
            .OrderByDescending(p => p.EffectiveFrom)
            .FirstOrDefaultAsync();

        if (active != null && active.Amount == amount)
            return;

        if (active != null)
        {
            active.EffectiveTo = DateOnly.FromDateTime(now);
            active.UpdatedAt = now;
            active.UpdatedByUserId = userId == Guid.Empty ? null : userId;
        }

        _context.IolPrices.Add(new IolPrice
        {
            Id = Guid.NewGuid(),
            IolMasterId = iolId,
            BranchId = null,
            Amount = amount,
            EffectiveFrom = DateOnly.FromDateTime(now),
            EffectiveTo = null,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now,
            CreatedByUserId = userId == Guid.Empty ? null : userId,
            UpdatedByUserId = userId == Guid.Empty ? null : userId,
            Status = "active",
        });
    }

    private static IolMasterAdminDto MapIol(IolMaster i, decimal price) =>
        new()
        {
            Id = i.Id,
            ModelName = i.ModelName,
            BrandManufacturer = i.BrandManufacturer,
            IolType = i.IolType,
            Origin = i.Origin,
            ProductCode = i.ProductCode,
            DisplayOrder = i.DisplayOrder,
            IsActive = i.IsActive,
            Price = price,
        };
}
