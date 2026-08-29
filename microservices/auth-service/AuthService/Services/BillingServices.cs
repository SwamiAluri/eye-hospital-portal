using AuthService.Context;
using AuthService.DTOs.Billing;
using AuthService.Models.Domain;
using AuthService.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public class ServiceCatalogService : IServiceCatalogService
{
    private readonly AppDbContext _context;

    public ServiceCatalogService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<FullCatalogResponse> GetFullCatalogAsync()
    {
        // Load category/service/variant tree WITHOUT the filtered price include to avoid
        // EF Core runtime issues when composing HasQueryFilter + filtered ThenInclude.
        var categories = await _context.ServiceCategories
            .Where(c => c.IsActive)
            .Include(c => c.Services.Where(s => s.IsActive))
                .ThenInclude(s => s.Variants.Where(v => v.IsActive))
            .OrderBy(c => c.DisplayOrder)
            .ToListAsync();

        // Collect all active variant IDs and load global prices in a single separate query.
        var variantIds = categories
            .SelectMany(c => c.Services)
            .SelectMany(s => s.Variants)
            .Select(v => v.Id)
            .ToList();

        var priceMap = (await _context.VariantPrices
            .Where(p => variantIds.Contains(p.VariantId)
                     && p.BranchId == null
                     && p.EffectiveTo == null
                     && p.IsActive
                     && p.DeletedAt == null)
            .ToListAsync())
            .GroupBy(p => p.VariantId)
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(p => p.EffectiveFrom).First().Amount);

        return new FullCatalogResponse
        {
            Categories = categories.Select(c => new ServiceCategoryDto
            {
                Id = c.Id,
                Code = c.Code,
                Name = c.Name,
                DisplayOrder = c.DisplayOrder,
                IsActive = c.IsActive,
                Services = c.Services.Select(s => new CatalogServiceDto
                {
                    Id = s.Id,
                    Code = s.ServiceCode ?? string.Empty,
                    Name = s.ServiceName,
                    IsActive = s.IsActive,
                    Variants = s.Variants
                        .OrderBy(v => v.DisplayOrder)
                        .Select(v => new ServiceVariantDto
                        {
                            Id = v.Id,
                            Code = v.VariantCode ?? string.Empty,
                            Name = v.VariantName,
                            Price = priceMap.GetValueOrDefault(v.Id, 0),
                            PriceType = v.PriceType,
                            HasIolOptions = v.HasIolOptions,
                            DisplayOrder = v.DisplayOrder,
                            IsActive = v.IsActive,
                            SubOptions = v.SubOptions
                        }).ToList()
                }).ToList()
            }).ToList()
        };
    }

    public async Task<List<ServiceCategoryDto>> GetCategoriesAsync()
    {
        var categories = await _context.ServiceCategories
            .Where(c => c.IsActive)
            .OrderBy(c => c.DisplayOrder)
            .ToListAsync();

        return categories.Select(c => new ServiceCategoryDto
        {
            Id = c.Id,
            Code = c.Code,
            Name = c.Name,
            DisplayOrder = c.DisplayOrder,
            IsActive = c.IsActive
        }).ToList();
    }

    public async Task<List<IolMasterDto>> GetVariantIolOptionsAsync(Guid variantId)
    {
        // Load mappings + IolMaster without filtered price include (same EF Core safety pattern).
        var mappings = await _context.VariantIolMappings
            .Include(m => m.IolMaster)
            .Where(m => m.VariantId == variantId && m.IolMaster.IsActive)
            .ToListAsync();

        var iolIds = mappings.Select(m => m.IolMasterId).ToList();

        var iolPriceMap = (await _context.IolPrices
            .Where(p => iolIds.Contains(p.IolMasterId)
                     && p.BranchId == null
                     && p.EffectiveTo == null
                     && p.IsActive
                     && p.DeletedAt == null)
            .ToListAsync())
            .GroupBy(p => p.IolMasterId)
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(p => p.EffectiveFrom).First().Amount);

        return mappings.Select(m => new IolMasterDto
        {
            Id = m.IolMaster.Id,
            ModelName = m.IolMaster.ModelName,
            BrandManufacturer = m.IolMaster.BrandManufacturer,
            IolType = m.IolMaster.IolType,
            Origin = m.IolMaster.Origin,
            Price = iolPriceMap.GetValueOrDefault(m.IolMaster.Id, 0),
            IsDefault = m.IsDefault
        }).ToList();
    }

    public async Task<List<BranchVariantPricingDto>> GetBranchPricingAsync(Guid branchId)
    {
        var pricings = await _context.VariantPrices
            .Where(p => p.BranchId == branchId && p.IsActive && p.EffectiveTo == null)
            .ToListAsync();

        return pricings.Select(p => new BranchVariantPricingDto
        {
            VariantId = p.VariantId,
            Amount = p.Amount,
            EffectiveFrom = p.EffectiveFrom,
            EffectiveTo = p.EffectiveTo,
            IsActive = p.IsActive
        }).ToList();
    }
}

public class BillItemService : IBillItemService
{
    private readonly AppDbContext _context;
    private readonly ILogger<BillItemService> _logger;

    public BillItemService(AppDbContext context, ILogger<BillItemService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<List<BillItemDto>> GetBillItemsAsync(Guid billId, Guid tenantId)
    {
        var items = await _context.Set<OpdBillItem>()
            .Where(i => i.OpdBillId == billId && i.TenantId == tenantId && i.DeletedAt == null)
            .OrderBy(i => i.CreatedAt)
            .ToListAsync();

        return items.Select(MapToDto).ToList();
    }

    public async Task<BillItemDto?> GetBillItemByIdAsync(Guid id, Guid tenantId)
    {
        var item = await _context.Set<OpdBillItem>()
            .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId && i.DeletedAt == null);

        return item != null ? MapToDto(item) : null;
    }

    public async Task<BillItemDto> AddBillItemAsync(AddBillItemRequest request, Guid tenantId, Guid userId)
    {
        var staged = await StageBillItemAsync(request, tenantId, userId);
        if (!staged.Created) return staged.Item;

        var idempotencyKey = string.IsNullOrWhiteSpace(request.IdempotencyKey)
            ? null
            : request.IdempotencyKey.Trim();

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException) when (idempotencyKey is not null)
        {
            var replay = await FindByIdempotencyKeyAsync(tenantId, idempotencyKey);
            if (replay != null) return MapToDto(replay);
            throw;
        }

        // Cashier Add item must move OpdBill header totals (ChargeItems uses ApplyItemisedGrossAsync).
        // Increment gross by the new line so OPD consultation headers are not replaced by item-sum.
        var bill = await _context.OpdBills
            .FirstOrDefaultAsync(b => b.Id == request.OpdBillId && b.TenantId == tenantId && b.DeletedAt == null);
        if (bill != null)
        {
            bill.GrossAmount = Math.Max(0, bill.GrossAmount) + staged.Item.TotalAmount;
            await ProjectBillFromPaymentLedgerAsync(bill, userId);
            await _context.SaveChangesAsync();
        }

        _logger.LogInformation("Bill item added: {ServiceCode} to bill {BillId}", staged.Item.ServiceCode, request.OpdBillId);
        return staged.Item;
    }

    public async Task<StagedBillItem> StageBillItemAsync(AddBillItemRequest request, Guid tenantId, Guid userId)
    {
        // Day 5: Check if bill is locked before adding items
        var bill = await _context.OpdBills
            .Where(b => b.Id == request.OpdBillId && b.TenantId == tenantId && b.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (bill == null)
        {
            throw new InvalidOperationException("Bill not found.");
        }

        if (bill.IsFinalized)
        {
            throw new InvalidOperationException("Bill is finalized and cannot be modified");
        }

        if (string.Equals(bill.Status, "cancelled", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Cannot add items to a cancelled bill.");
        }

        if (bill.IsLocked)
        {
            throw new InvalidOperationException($"Cannot add items to locked bill {bill.BillNumber}. Bill must be unlocked by an administrator.");
        }

        var idempotencyKey = string.IsNullOrWhiteSpace(request.IdempotencyKey)
            ? null
            : request.IdempotencyKey.Trim();

        if (idempotencyKey is not null)
        {
            var existing = await FindByIdempotencyKeyAsync(tenantId, idempotencyKey);
            if (existing != null) return new StagedBillItem(MapToDto(existing), Created: false);
        }

        var sourceType = BillChargeSource.Normalize(request.SourceType);

        ServiceVariant? variant = null;
        if (request.ServiceVariantId.HasValue)
        {
            variant = await FindVariantAsync(v => v.Id == request.ServiceVariantId.Value && v.IsActive);
        }
        else if (!string.IsNullOrEmpty(request.ServiceCode))
        {
            variant = await FindVariantAsync(v => v.VariantCode == request.ServiceCode && v.IsActive);
        }

        Guid? variantId;
        string serviceCode;
        string serviceName;
        string serviceCategory;
        decimal unitPrice;

        if (variant != null)
        {
            var globalPrice = await _context.VariantPrices
                .Where(p => p.VariantId == variant.Id
                         && p.BranchId == null
                         && p.PayerId == null
                         && p.EffectiveTo == null
                         && p.IsActive)
                .OrderByDescending(p => p.EffectiveFrom)
                .Select(p => p.Amount)
                .FirstOrDefaultAsync();

            variantId = variant.Id;
            serviceCode = variant.VariantCode ?? string.Empty;
            serviceName = variant.VariantName;
            serviceCategory = variant.CatalogService?.Category?.Code ?? string.Empty;
            unitPrice = request.UnitPriceOverride ?? globalPrice;
        }
        else
        {
            var named = !string.IsNullOrWhiteSpace(request.ServiceName);
            var priced = request.UnitPriceOverride.HasValue;
            var packageDiscount = sourceType == BillChargeSource.PackageDiscount && named;
            if (!((named && priced) || packageDiscount))
            {
                throw new InvalidOperationException("Service not found in catalog.");
            }

            variantId = null;
            serviceCode = string.IsNullOrWhiteSpace(request.ServiceCode) ? sourceType : request.ServiceCode.Trim();
            serviceName = request.ServiceName!.Trim();
            serviceCategory = sourceType;
            unitPrice = request.UnitPriceOverride ?? 0m;
        }

        var quantity = request.Quantity < 1 ? 1 : request.Quantity;
        var subtotal = unitPrice * quantity;
        var discountAmount = subtotal * (request.DiscountPercentage / 100);
        var taxableAmount = subtotal - discountAmount;
        var taxAmount = 0m;
        var totalAmount = taxableAmount + taxAmount;

        var item = new OpdBillItem
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            OpdBillId = request.OpdBillId,
            ServiceVariantId = variantId,
            ServiceCode = serviceCode,
            ServiceName = serviceName,
            ServiceCategory = serviceCategory,
            Description = null,
            Quantity = quantity,
            UnitPrice = unitPrice,
            Subtotal = subtotal,
            DiscountAmount = discountAmount,
            DiscountPercentage = request.DiscountPercentage,
            DiscountReason = request.DiscountReason,
            TaxAmount = taxAmount,
            TaxPercentage = 0,
            TotalAmount = totalAmount,
            Status = "pending",
            Notes = request.Notes,
            SourceType = sourceType,
            SourceRefId = request.SourceRefId,
            IdempotencyKey = idempotencyKey,
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = userId
        };

        _context.Set<OpdBillItem>().Add(item);
        bill.UpdatedAt = DateTime.UtcNow;
        bill.UpdatedByUserId = userId;

        return new StagedBillItem(MapToDto(item), Created: true);
    }

    /// <summary>
    /// Required CatalogService Include is an inner join. A variant whose parent row is missing
    /// must still post at the catalog price rather than disappear.
    /// </summary>
    private async Task<ServiceVariant?> FindVariantAsync(System.Linq.Expressions.Expression<Func<ServiceVariant, bool>> predicate)
    {
        var withCatalog = await _context.ServiceVariants
            .Include(v => v.CatalogService)
                .ThenInclude(s => s.Category)
            .FirstOrDefaultAsync(predicate);
        if (withCatalog != null) return withCatalog;
        return await _context.ServiceVariants.FirstOrDefaultAsync(predicate);
    }

    private Task<OpdBillItem?> FindByIdempotencyKeyAsync(Guid tenantId, string idempotencyKey)
        => _context.Set<OpdBillItem>()
            .FirstOrDefaultAsync(i =>
                i.TenantId == tenantId
                && i.IdempotencyKey == idempotencyKey
                && i.DeletedAt == null);

    public async Task<BillItemDto> UpdateBillItemAsync(Guid id, UpdateBillItemRequest request, Guid tenantId, Guid userId)
    {
        var item = await _context.Set<OpdBillItem>()
            .Include(i => i.ServiceVariant)
            .Include(i => i.OpdBill)
            .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId && i.DeletedAt == null);

        if (item == null)
        {
            throw new InvalidOperationException("Bill item not found.");
        }

        if (item.OpdBill is null)
        {
            throw new InvalidOperationException("Bill item not found.");
        }

        if (item.OpdBill.IsFinalized)
        {
            throw new InvalidOperationException("Bill is finalized and cannot be modified");
        }

        if (item.OpdBill.IsLocked)
        {
            throw new InvalidOperationException($"Cannot update items on locked bill {item.OpdBill.BillNumber}. Bill must be unlocked by an administrator.");
        }

        var previousTotal = item.TotalAmount;

        // Recalculate amounts
        var unitPrice = request.UnitPriceOverride ?? item.UnitPrice;
        var subtotal = unitPrice * request.Quantity;
        var discountAmount = subtotal * (request.DiscountPercentage / 100);
        var taxableAmount = subtotal - discountAmount;
        var taxAmount = 0m; // No tax in V2 catalog
        var totalAmount = taxableAmount + taxAmount;

        item.Quantity = request.Quantity;
        item.UnitPrice = unitPrice;
        item.Subtotal = subtotal;
        item.DiscountAmount = discountAmount;
        item.DiscountPercentage = request.DiscountPercentage;
        item.DiscountReason = request.DiscountReason;
        item.TaxAmount = taxAmount;
        item.TotalAmount = totalAmount;
        item.Status = request.Status;
        item.Notes = request.Notes;
        item.UpdatedAt = DateTime.UtcNow;
        item.UpdatedByUserId = userId;

        AdjustGross(item.OpdBill, totalAmount - previousTotal);
        await ProjectBillFromPaymentLedgerAsync(item.OpdBill, userId);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Bill item updated: {ItemId}", id);

        return MapToDto(item);
    }

    public async Task<bool> DeleteBillItemAsync(Guid id, Guid tenantId, Guid userId)
    {
        var item = await _context.Set<OpdBillItem>()
            .Include(i => i.OpdBill)
            .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId && i.DeletedAt == null);

        if (item == null) return false;

        if (item.OpdBill is null)
            return false;

        if (item.OpdBill.IsFinalized)
        {
            throw new InvalidOperationException("Bill is finalized and cannot be modified");
        }

        if (item.OpdBill.IsLocked)
        {
            throw new InvalidOperationException($"Cannot delete items from locked bill {item.OpdBill.BillNumber}. Bill must be unlocked by an administrator.");
        }

        item.DeletedAt = DateTime.UtcNow;
        item.UpdatedByUserId = userId;
        AdjustGross(item.OpdBill, -item.TotalAmount);
        await ProjectBillFromPaymentLedgerAsync(item.OpdBill, userId);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Bill item deleted: {ItemId}", id);

        return true;
    }

    public async Task<BillSummaryDto> GetBillSummaryAsync(Guid billId, Guid tenantId)
    {
        var bill = await _context.Set<OpdBill>()
            .FirstOrDefaultAsync(b => b.Id == billId && b.TenantId == tenantId);

        if (bill == null)
        {
            throw new InvalidOperationException("Bill not found.");
        }

        var items = await GetBillItemsAsync(billId, tenantId);

        return new BillSummaryDto
        {
            BillId = billId,
            BillNumber = bill.BillNumber,
            TotalItems = items.Count,
            Subtotal = items.Sum(i => i.Subtotal),
            TotalDiscount = items.Sum(i => i.DiscountAmount),
            TotalTax = items.Sum(i => i.TaxAmount),
            NetAmount = items.Sum(i => i.TotalAmount),
            Items = items
        };
    }

    public async Task<BillSummaryDto> RecalculateBillAsync(Guid billId, Guid tenantId)
    {
        var summary = await GetBillSummaryAsync(billId, tenantId);

        // Update the main bill totals
        var bill = await _context.Set<OpdBill>()
            .FirstOrDefaultAsync(b => b.Id == billId && b.TenantId == tenantId);

        if (bill != null)
        {
            var items = await _context.Set<OpdBillItem>()
                .Where(i => i.OpdBillId == billId && i.TenantId == tenantId && i.DeletedAt == null)
                .ToListAsync();
            var itemTotal = items.Sum(i => i.TotalAmount);
            var exploded = items.Any(i =>
                i.SourceType == BillChargeSource.Package || i.SourceType == BillChargeSource.PackageDiscount);
            bill.GrossAmount = exploded ? itemTotal : Math.Max(0, bill.AdditionalCharges) + itemTotal;
            await ProjectBillFromPaymentLedgerAsync(bill, bill.UpdatedByUserId ?? bill.CreatedByUserId);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Bill recalculated: {BillId} - Net Amount: {NetAmount}", billId, bill.NetAmount);
            return await GetBillSummaryAsync(billId, tenantId);
        }

        return summary;
    }

    private static void AdjustGross(OpdBill bill, decimal delta)
        => bill.GrossAmount = Math.Max(0, bill.GrossAmount + delta);

    private async Task ProjectBillFromPaymentLedgerAsync(OpdBill bill, Guid userId)
    {
        var lines = await _context.OpdBillPayments
            .Where(p => p.OpdBillId == bill.Id)
            .Select(p => new OpdBillLedgerCalculator.Line(
                string.IsNullOrWhiteSpace(p.PaymentKind) ? OpdBillLedgerCalculator.Payment : p.PaymentKind,
                p.Amount,
                p.Status))
            .ToListAsync();

        var snap = OpdBillLedgerCalculator.Compute(
            bill.GrossAmount,
            bill.TaxAmount,
            bill.InsuranceClaimAmount,
            bill.IsFinalized,
            lines);

        bill.DiscountAmount = snap.DiscountTotal;
        bill.NetAmount = snap.BilledAmount;
        bill.AmountPaid = snap.Collected;
        bill.BalanceDue = snap.BalanceDue;
        if (bill.Status is not ("cancelled" or "credit_approved"))
            bill.Status = snap.DerivedStatus;
        bill.UpdatedAt = DateTime.UtcNow;
        bill.UpdatedByUserId = userId;
    }

    private static BillItemDto MapToDto(OpdBillItem item)
    {
        return new BillItemDto
        {
            Id = item.Id,
            OpdBillId = item.OpdBillId,
            ServiceVariantId = item.ServiceVariantId,
            Quantity = item.Quantity,
            UnitPrice = item.UnitPrice,
            Subtotal = item.Subtotal,
            DiscountAmount = item.DiscountAmount,
            DiscountPercentage = item.DiscountPercentage,
            DiscountReason = item.DiscountReason,
            TaxAmount = item.TaxAmount,
            TaxPercentage = item.TaxPercentage,
            TotalAmount = item.TotalAmount,
            PerformedByUserId = item.PerformedByUserId,
            PerformedAt = item.PerformedAt,
            Status = item.Status,
            Notes = item.Notes,
            ServiceCode = item.ServiceCode,
            ServiceName = item.ServiceName,
            SourceType = string.IsNullOrWhiteSpace(item.SourceType) ? BillChargeSource.Manual : item.SourceType,
            SourceRefId = item.SourceRefId,
            IdempotencyKey = item.IdempotencyKey
        };
    }
}
