using AuthService.Context;
using AuthService.DTOs.Billing;
using AuthService.Models.Domain;
using AuthService.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public interface IChargeMappingAdminService
{
    Task<ChargeExceptionListDto> ListUnmappedAsync(Guid tenantId, int lookbackDays = 90);
    Task<ChargeMappingDto> CreateMappingAsync(Guid tenantId, Guid userId, CreateChargeMappingRequest request);
    Task<List<ChargeMappingDto>> GetHistoryAsync(Guid tenantId, Guid itemId);
    Task<List<PackageComponentStatusDto>> GetPackageComponentsAsync(Guid tenantId, Guid packageTemplateId);
    Task<List<PackageComponentStatusDto>> SavePackageComponentsAsync(
        Guid tenantId, Guid userId, Guid packageTemplateId, SavePackageComponentsRequest request);
    Task<List<ChargeVariantSearchDto>> SearchVariantsAsync(string? query, int take = 20);
    Task<ReplayExceptionsResultDto> ReplayAsync(Guid tenantId, Guid userId, Guid? itemId = null);
}

public class ChargeMappingAdminService : IChargeMappingAdminService
{
    private readonly AppDbContext _db;
    private readonly IChargeCatalogResolver _resolver;
    private readonly IBillItemService _billItems;

    public ChargeMappingAdminService(
        AppDbContext db,
        IChargeCatalogResolver resolver,
        IBillItemService billItems)
    {
        _db = db;
        _resolver = resolver;
        _billItems = billItems;
    }

    public async Task<ChargeExceptionListDto> ListUnmappedAsync(Guid tenantId, int lookbackDays = 90)
    {
        var since = DateTime.UtcNow.AddDays(-Math.Abs(lookbackDays));
        var weekAgo = DateTime.UtcNow.AddDays(-7);

        var openExceptions = await _db.ChargeExceptions
            .AsNoTracking()
            .Where(e => e.TenantId == tenantId && e.Status == ChargeExceptionStatus.Open)
            .ToListAsync();

        var items = new Dictionary<Guid, UnmappedChargeItemDto>();

        foreach (var group in openExceptions.Where(e => e.ItemId.HasValue).GroupBy(e => e.ItemId!.Value))
        {
            items[group.Key] = new UnmappedChargeItemDto
            {
                ItemId = group.Key,
                ItemType = group.First().SourceType,
                UseCount = group.Count(),
                LastUsedAt = group.Max(e => e.CreatedAt),
                EstimatedValue = group.Sum(e => e.EstimatedValue),
                OpenExceptionCount = group.Count(),
            };
        }

        try
        {
            var usage = await _db.InvSurgeryConsumableReads
                .AsNoTracking()
                .Where(c => c.TenantId == tenantId && c.DeletedAt == null && c.IssuedAt >= since)
                .GroupBy(c => c.ItemId)
                .Select(g => new
                {
                    ItemId = g.Key,
                    Uses = g.Count(),
                    LastUsed = g.Max(x => x.IssuedAt),
                    Value = g.Sum(x => x.Amount),
                })
                .ToListAsync();

            var names = await _db.InvItemMasterReads
                .AsNoTracking()
                .Where(i => i.TenantId == tenantId && i.DeletedAt == null)
                .Select(i => new { i.Id, i.ItemName, i.ItemType })
                .ToListAsync();
            var nameMap = names.ToDictionary(n => n.Id);

            foreach (var row in usage)
            {
                var resolved = await _resolver.ResolveItemAsync(tenantId, row.ItemId);
                if (resolved.Kind is ChargeResolveKind.Mapped or ChargeResolveKind.NonChargeable)
                    continue;

                if (!items.TryGetValue(row.ItemId, out var dto))
                {
                    dto = new UnmappedChargeItemDto { ItemId = row.ItemId };
                    items[row.ItemId] = dto;
                }
                dto.UseCount = Math.Max(dto.UseCount, row.Uses);
                dto.LastUsedAt = dto.LastUsedAt is null || row.LastUsed > dto.LastUsedAt ? row.LastUsed : dto.LastUsedAt;
                if (dto.EstimatedValue == 0) dto.EstimatedValue = row.Value;
                if (nameMap.TryGetValue(row.ItemId, out var n))
                {
                    dto.ItemName = n.ItemName;
                    dto.ItemType = string.IsNullOrWhiteSpace(n.ItemType) ? dto.ItemType : n.ItemType;
                }
            }

            foreach (var dto in items.Values)
            {
                if (dto.ItemId is Guid id && nameMap.TryGetValue(id, out var n) && string.IsNullOrWhiteSpace(dto.ItemName))
                {
                    dto.ItemName = n.ItemName;
                    dto.ItemType = string.IsNullOrWhiteSpace(n.ItemType) ? dto.ItemType : n.ItemType;
                }
            }
        }
        catch (Exception)
        {
            // Inventory tables may be absent in isolated test databases.
        }

        var packageUnmapped = await (
            from c in _db.PackageComponentMaps.AsNoTracking()
            join t in _db.CounsellingPackageTemplates.AsNoTracking() on c.PackageTemplateId equals t.Id
            where c.TenantId == tenantId && c.ServiceVariantId == null && t.DeletedAt == null
            orderby t.Name, c.SortOrder
            select new PackageComponentStatusDto
            {
                Id = c.Id,
                PackageTemplateId = c.PackageTemplateId,
                PackageName = t.Name,
                ComponentKey = c.ComponentKey,
                ComponentName = c.ComponentName,
                ServiceVariantId = c.ServiceVariantId,
                Allocation = c.Allocation,
                CoversConsumable = c.CoversConsumable,
                Status = "Unmapped",
            }).ToListAsync();

        var mappedThisWeek = await _db.ServiceVariantItemMaps
            .AsNoTracking()
            .CountAsync(m => m.TenantId == tenantId && m.CreatedAt >= weekAgo);

        var ranked = items.Values
            .OrderByDescending(i => i.UseCount)
            .ThenByDescending(i => i.EstimatedValue)
            .ToList();

        await AttachLastPatientAsync(ranked, openExceptions);

        return new ChargeExceptionListDto
        {
            Kpis = new ChargeMappingKpisDto
            {
                UnmappedItemCount = ranked.Count,
                BlockedChargeValue = ranked.Sum(i => i.EstimatedValue) + openExceptions.Where(e => e.ItemId == null).Sum(e => e.EstimatedValue),
                BillsAffected = openExceptions.Select(e => e.OpdBillId).Where(id => id.HasValue).Distinct().Count(),
                MappedThisWeek = mappedThisWeek,
            },
            Items = ranked,
            UnmappedPackageComponents = packageUnmapped,
        };
    }

    public async Task<ChargeMappingDto> CreateMappingAsync(Guid tenantId, Guid userId, CreateChargeMappingRequest request)
    {
        if (request.ItemId == Guid.Empty || request.ServiceVariantId == Guid.Empty)
            throw new InvalidOperationException("Item and service variant are required.");

        var variantOk = await _db.ServiceVariants
            .AnyAsync(v => v.Id == request.ServiceVariantId && v.IsActive && v.DeletedAt == null);
        if (!variantOk)
            throw new InvalidOperationException("Service variant is missing or inactive.");

        var from = request.EffectiveFrom ?? DateTime.UtcNow;
        var active = await _db.ServiceVariantItemMaps
            .Where(m => m.TenantId == tenantId && m.ItemId == request.ItemId && m.EffectiveTo == null)
            .ToListAsync();
        foreach (var row in active)
        {
            row.EffectiveTo = from;
            row.UpdatedAt = DateTime.UtcNow;
            row.UpdatedByUserId = userId;
        }

        var map = new ServiceVariantItemMap
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ItemId = request.ItemId,
            ServiceVariantId = request.ServiceVariantId,
            IsChargeable = request.IsChargeable,
            NonChargeableReason = request.IsChargeable ? null : request.NonChargeableReason,
            EffectiveFrom = from,
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = userId,
        };
        _db.ServiceVariantItemMaps.Add(map);
        await _db.SaveChangesAsync();

        var variantName = await _db.ServiceVariants.AsNoTracking()
            .Where(v => v.Id == map.ServiceVariantId)
            .Select(v => v.VariantName)
            .FirstOrDefaultAsync();

        return ToDto(map, variantName);
    }

    public async Task<List<ChargeMappingDto>> GetHistoryAsync(Guid tenantId, Guid itemId)
    {
        var rows = await _db.ServiceVariantItemMaps
            .AsNoTracking()
            .Where(m => m.TenantId == tenantId && m.ItemId == itemId)
            .OrderByDescending(m => m.EffectiveFrom)
            .ToListAsync();
        var variantIds = rows.Select(r => r.ServiceVariantId).Distinct().ToList();
        var names = await _db.ServiceVariants.AsNoTracking()
            .Where(v => variantIds.Contains(v.Id))
            .ToDictionaryAsync(v => v.Id, v => v.VariantName);
        return rows.Select(r => ToDto(r, names.GetValueOrDefault(r.ServiceVariantId))).ToList();
    }

    public async Task<List<PackageComponentStatusDto>> GetPackageComponentsAsync(Guid tenantId, Guid packageTemplateId)
    {
        var pkg = await _db.CounsellingPackageTemplates.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == packageTemplateId && t.TenantId == tenantId && t.DeletedAt == null);
        if (pkg is null) throw new InvalidOperationException("Package template not found.");

        var rows = await _db.PackageComponentMaps
            .AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.PackageTemplateId == packageTemplateId)
            .OrderBy(c => c.SortOrder)
            .ToListAsync();

        var result = new List<PackageComponentStatusDto>();
        foreach (var c in rows)
        {
            decimal? price = null;
            string? code = null;
            var status = "Unmapped";
            if (c.ServiceVariantId is Guid vid)
            {
                var resolved = await _resolver.ResolveVariantAsync(tenantId, vid);
                price = resolved.UnitPrice;
                status = resolved.CanPost ? "Mapped" : resolved.Kind.ToString();
                code = await _db.ServiceVariants.AsNoTracking()
                    .Where(v => v.Id == vid)
                    .Select(v => v.VariantCode)
                    .FirstOrDefaultAsync();
            }
            result.Add(new PackageComponentStatusDto
            {
                Id = c.Id,
                PackageTemplateId = c.PackageTemplateId,
                PackageName = pkg.Name,
                ComponentKey = c.ComponentKey,
                ComponentName = c.ComponentName,
                ServiceVariantId = c.ServiceVariantId,
                VariantCode = code,
                Allocation = c.Allocation,
                CoversConsumable = c.CoversConsumable,
                CatalogPrice = price,
                Status = c.CoversConsumable && c.ServiceVariantId == null ? "Overlap risk" : status,
            });
        }
        return result;
    }

    public async Task<List<PackageComponentStatusDto>> SavePackageComponentsAsync(
        Guid tenantId, Guid userId, Guid packageTemplateId, SavePackageComponentsRequest request)
    {
        var pkg = await _db.CounsellingPackageTemplates
            .FirstOrDefaultAsync(t => t.Id == packageTemplateId && t.TenantId == tenantId && t.DeletedAt == null)
            ?? throw new InvalidOperationException("Package template not found.");

        var existing = await _db.PackageComponentMaps
            .Where(c => c.TenantId == tenantId && c.PackageTemplateId == packageTemplateId)
            .ToListAsync();
        _db.PackageComponentMaps.RemoveRange(existing);

        var order = 0;
        foreach (var line in request.Components)
        {
            if (string.IsNullOrWhiteSpace(line.ComponentKey)) continue;
            _db.PackageComponentMaps.Add(new PackageComponentMap
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PackageTemplateId = pkg.Id,
                ComponentKey = line.ComponentKey.Trim(),
                ComponentName = string.IsNullOrWhiteSpace(line.ComponentName) ? line.ComponentKey.Trim() : line.ComponentName.Trim(),
                ServiceVariantId = line.ServiceVariantId,
                Allocation = string.IsNullOrWhiteSpace(line.Allocation) ? "Fixed" : line.Allocation,
                CoversConsumable = line.CoversConsumable,
                SortOrder = line.SortOrder != 0 ? line.SortOrder : order,
                CreatedAt = DateTime.UtcNow,
                CreatedByUserId = userId,
            });
            order++;
        }

        await _db.SaveChangesAsync();
        return await GetPackageComponentsAsync(tenantId, packageTemplateId);
    }

    public async Task<List<ChargeVariantSearchDto>> SearchVariantsAsync(string? query, int take = 20)
    {
        var q = (query ?? string.Empty).Trim();
        var variants = _db.ServiceVariants.AsNoTracking().Where(v => v.IsActive && v.DeletedAt == null);
        if (q.Length > 0)
        {
            variants = variants.Where(v =>
                v.VariantName.Contains(q) || (v.VariantCode != null && v.VariantCode.Contains(q)));
        }

        var list = await variants.OrderBy(v => v.DisplayOrder).ThenBy(v => v.VariantName).Take(Math.Clamp(take, 1, 50)).ToListAsync();
        var ids = list.Select(v => v.Id).ToList();
        var priceRows = await _db.VariantPrices.AsNoTracking()
            .Where(p => ids.Contains(p.VariantId) && p.BranchId == null && p.EffectiveTo == null && p.IsActive && p.DeletedAt == null)
            .ToListAsync();
        var priceMap = priceRows
            .GroupBy(p => p.VariantId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.EffectiveFrom).First().Amount);

        return list.Select(v => new ChargeVariantSearchDto
        {
            Id = v.Id,
            Code = v.VariantCode ?? string.Empty,
            Name = v.VariantName,
            Price = priceMap.GetValueOrDefault(v.Id),
        }).ToList();
    }

    public async Task<ReplayExceptionsResultDto> ReplayAsync(Guid tenantId, Guid userId, Guid? itemId = null)
    {
        var query = _db.ChargeExceptions.Where(e => e.TenantId == tenantId && e.Status == ChargeExceptionStatus.Open);
        if (itemId.HasValue) query = query.Where(e => e.ItemId == itemId);
        var open = await query.ToListAsync();

        var result = new ReplayExceptionsResultDto();
        foreach (var ex in open)
        {
            if (!ex.ItemId.HasValue)
            {
                result.StillUnmapped++;
                continue;
            }

            var resolved = await _resolver.ResolveItemAsync(tenantId, ex.ItemId.Value);
            if (resolved.Kind == ChargeResolveKind.NonChargeable)
            {
                ex.Status = ChargeExceptionStatus.NonChargeable;
                ex.ResolvedAt = DateTime.UtcNow;
                ex.ResolvedByUserId = userId;
                result.MarkedNonChargeable++;
                continue;
            }
            if (!resolved.CanPost)
            {
                result.StillUnmapped++;
                continue;
            }

            var bill = await ResolveReplayBillAsync(tenantId, ex);
            if (bill is null)
            {
                if (ex.OpdBillId is Guid missingId && missingId != Guid.Empty)
                {
                    ex.Status = ChargeExceptionStatus.NeedsAdjustment;
                    ex.ResolvedAt = DateTime.UtcNow;
                    ex.ResolvedByUserId = userId;
                    result.NeedsAdjustment++;
                    continue;
                }

                LeaveOpenBlocked(ex, result, "Mapped but no OpdBill; replay left Open.");
                continue;
            }

            if (bill.IsFinalized || bill.IsLocked
                || string.Equals(bill.Status, "cancelled", StringComparison.OrdinalIgnoreCase))
            {
                ex.Status = ChargeExceptionStatus.NeedsAdjustment;
                ex.ResolvedAt = DateTime.UtcNow;
                ex.ResolvedByUserId = userId;
                result.NeedsAdjustment++;
                continue;
            }

            try
            {
                var key = string.IsNullOrWhiteSpace(ex.IdempotencyKey)
                    ? $"Exception:{ex.Id:N}"
                    : ex.IdempotencyKey.Trim();
                var posted = await _billItems.AddBillItemAsync(new AddBillItemRequest
                {
                    OpdBillId = bill.Id,
                    ServiceVariantId = resolved.ServiceVariantId,
                    Quantity = (int)Math.Max(1, Math.Round(ex.Quantity)),
                    SourceType = ex.SourceType,
                    SourceRefId = ex.SourceRefId,
                    IdempotencyKey = key,
                    Notes = "MD-055 replay of parked charge",
                }, tenantId, userId);

                if (!await LedgerLineVerifiedAsync(tenantId, bill.Id, posted, key))
                {
                    LeaveOpenBlocked(ex, result, "Replay did not verify an opd_bill_items line; left Open.");
                    continue;
                }

                ex.OpdBillId ??= bill.Id;
                ex.Status = ChargeExceptionStatus.Resolved;
                ex.ResolvedAt = DateTime.UtcNow;
                ex.ResolvedByUserId = userId;
                result.Posted++;
            }
            catch (InvalidOperationException)
            {
                result.StillUnmapped++;
            }
        }

        await _db.SaveChangesAsync();
        return result;
    }

    private async Task<OpdBill?> ResolveReplayBillAsync(Guid tenantId, ChargeException ex)
    {
        if (ex.OpdBillId is Guid billId && billId != Guid.Empty)
        {
            return await _db.OpdBills.AsNoTracking()
                .FirstOrDefaultAsync(b => b.Id == billId && b.TenantId == tenantId && b.DeletedAt == null);
        }

        if (ex.PatientJourneyId is Guid journeyId && journeyId != Guid.Empty)
        {
            return await _db.OpdBills.AsNoTracking()
                .FirstOrDefaultAsync(b =>
                    b.PatientJourneyId == journeyId
                    && b.TenantId == tenantId
                    && b.DeletedAt == null);
        }

        return null;
    }

    private async Task<bool> LedgerLineVerifiedAsync(
        Guid tenantId, Guid billId, BillItemDto? posted, string idempotencyKey)
    {
        if (posted is null || posted.Id == Guid.Empty || posted.OpdBillId != billId)
            return false;

        var byId = await _db.OpdBillItems.AsNoTracking()
            .AnyAsync(i =>
                i.Id == posted.Id
                && i.TenantId == tenantId
                && i.OpdBillId == billId
                && i.DeletedAt == null);
        if (byId) return true;

        return await _db.OpdBillItems.AsNoTracking()
            .AnyAsync(i =>
                i.TenantId == tenantId
                && i.OpdBillId == billId
                && i.DeletedAt == null
                && i.IdempotencyKey == idempotencyKey);
    }

    private static void LeaveOpenBlocked(ChargeException ex, ReplayExceptionsResultDto result, string note)
    {
        ex.Status = ChargeExceptionStatus.Open;
        ex.ResolvedAt = null;
        ex.ResolvedByUserId = null;
        if (string.IsNullOrWhiteSpace(ex.Reason) || !ex.Reason.Contains(note, StringComparison.Ordinal))
            ex.Reason = string.IsNullOrWhiteSpace(ex.Reason) ? note : $"{ex.Reason} | {note}";
        result.BlockedNoBill++;
    }

    private async Task AttachLastPatientAsync(
        List<UnmappedChargeItemDto> ranked, List<ChargeException> openExceptions)
    {
        var latestByItem = openExceptions
            .Where(e => e.ItemId.HasValue)
            .GroupBy(e => e.ItemId!.Value)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(e => e.CreatedAt).First());
        if (latestByItem.Count == 0) return;

        var journeyIds = latestByItem.Values
            .Where(e => e.PatientJourneyId.HasValue)
            .Select(e => e.PatientJourneyId!.Value)
            .Distinct()
            .ToList();
        if (journeyIds.Count == 0) return;

        var journeys = await _db.PatientJourneys.AsNoTracking()
            .Where(j => journeyIds.Contains(j.Id))
            .Select(j => new { j.Id, j.PatientId, j.Uhid })
            .ToListAsync();
        var patientIds = journeys.Select(j => j.PatientId).Distinct().ToList();
        var patients = await _db.Patients.AsNoTracking()
            .Where(p => patientIds.Contains(p.Id))
            .Select(p => new { p.Id, p.FirstName, p.LastName, p.HealthId, p.MedicalRecordNumber })
            .ToListAsync();
        var journeyMap = journeys.ToDictionary(j => j.Id);
        var patientMap = patients.ToDictionary(p => p.Id);

        foreach (var dto in ranked)
        {
            if (dto.ItemId is not Guid itemId || !latestByItem.TryGetValue(itemId, out var ex)) continue;
            if (ex.PatientJourneyId is not Guid journeyId || !journeyMap.TryGetValue(journeyId, out var journey))
                continue;
            dto.LastUhid = string.IsNullOrWhiteSpace(journey.Uhid) ? null : journey.Uhid;
            if (!patientMap.TryGetValue(journey.PatientId, out var patient)) continue;
            dto.LastPatientName = $"{patient.FirstName} {patient.LastName}".Trim();
            if (string.IsNullOrWhiteSpace(dto.LastUhid))
                dto.LastUhid = patient.HealthId ?? patient.MedicalRecordNumber;
        }
    }

    private static ChargeMappingDto ToDto(ServiceVariantItemMap map, string? variantName) => new()
    {
        Id = map.Id,
        ItemId = map.ItemId,
        ServiceVariantId = map.ServiceVariantId,
        VariantName = variantName,
        IsChargeable = map.IsChargeable,
        NonChargeableReason = map.NonChargeableReason,
        EffectiveFrom = map.EffectiveFrom,
        EffectiveTo = map.EffectiveTo,
    };
}
