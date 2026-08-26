using InventoryApi.Data;
using InventoryApi.Models.DTOs;
using InventoryApi.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace InventoryApi.Services;

public interface IImplantStockService
{
    Task<ApplyImplantStockResult> ApplyAsync(
        Guid tenantId, Guid userId, ApplyImplantStockRequest req, CancellationToken ct);
}

/// <summary>
/// OT-020 inventory leg. Clinical usage is already committed in IP; this writes
/// <c>inv_stock_ledger</c> (and FEFO deduction when stock exists) so reconciliation
/// can match usage ⟷ stock ⟷ bill. Unmapped catalog items succeed without a ledger
/// rather than retrying the outbox forever.
/// </summary>
public sealed class ImplantStockService : IImplantStockService
{
    public const string Implanted = "Implanted";
    public const string OpenedUnused = "Opened_Unused";
    public const string Wasted = "Wasted";
    public const string Returned = "Returned";
    public const string Reversed = "Reversed";

    private readonly InventoryDbContext _db;
    private readonly IStockService _stock;

    public ImplantStockService(InventoryDbContext db, IStockService stock)
    {
        _db = db;
        _stock = stock;
    }

    public async Task<ApplyImplantStockResult> ApplyAsync(
        Guid tenantId, Guid userId, ApplyImplantStockRequest req, CancellationToken ct)
    {
        if (req.ImplantUsageId == Guid.Empty)
            throw new ArgumentException("implantUsageId is required.");

        var refId = req.ImplantUsageId.ToString("D");
        var existing = await _db.StockLedgers.AsNoTracking()
            .Where(l => l.TenantId == tenantId && l.DeletedAt == null && l.ReferenceId == refId)
            .OrderByDescending(l => l.CreatedAt)
            .FirstOrDefaultAsync(ct);
        if (existing is not null && !IsReversal(req.UsageStatus))
        {
            return new ApplyImplantStockResult
            {
                LedgerId = existing.Id,
                ItemId = existing.ItemId,
                StoreId = existing.StoreId,
                TransactionType = existing.TransactionType,
                Replayed = true,
            };
        }

        var item = await ResolveItemAsync(tenantId, req, ct);
        if (item is null)
        {
            return new ApplyImplantStockResult
            {
                Unmapped = true,
                Reason = "Inventory item could not be resolved from implant catalog identity.",
            };
        }

        var store = await ResolveStoreAsync(tenantId, item.Id, ct);
        if (store is null)
        {
            return new ApplyImplantStockResult
            {
                Unmapped = true,
                ItemId = item.Id,
                Reason = "No active store is available to post implant stock.",
            };
        }

        if (IsReversal(req.UsageStatus))
            return await PostReversalAsync(tenantId, userId, req, item, store, existing, refId, ct);

        var txType = IsWriteOff(req.UsageStatus)
            ? ImplantStockTxn.ImplantWaste
            : ImplantStockTxn.OtIssue;
        var remarks = IsWriteOff(req.UsageStatus)
            ? TrimToNull(req.WastageReason)
            : $"Implant {req.SerialNumber ?? req.UdiBarcode}".Trim();

        Guid? batchId = null;
        decimal unitRate = 0;
        try
        {
            var batch = await _stock.DeductFefoAsync(
                tenantId, store.Id, item.Id, 1, userId, txType, refId,
                SerialLabel(req), ct);
            batchId = batch.Id;
            unitRate = batch.PurchaseRate;
            if (!string.IsNullOrWhiteSpace(remarks))
            {
                var pending = _db.StockLedgers.Local.FirstOrDefault(l => l.ReferenceId == refId);
                if (pending is not null)
                    pending.Remarks = remarks;
            }
        }
        catch (InvalidOperationException)
        {
            unitRate = await LastPurchaseRateAsync(tenantId, item.Id, ct);
            await PostLedgerAsync(
                tenantId, store.Id, item.Id, null, txType, refId, SerialLabel(req),
                qtyIn: 0, qtyOut: 1, unitRate, userId, req.PatientName, req.PatientIpNo, remarks, ct);
            await _db.SaveChangesAsync(ct);
            var fallback = await LedgerByRefAsync(tenantId, refId, ct);
            return Result(fallback, item.Id, store.Id, txType, replayed: false);
        }

        if (batchId is null)
        {
            await PostLedgerAsync(
                tenantId, store.Id, item.Id, null, txType, refId, SerialLabel(req),
                qtyIn: 0, qtyOut: 1, unitRate, userId, req.PatientName, req.PatientIpNo, remarks, ct);
        }

        await _db.SaveChangesAsync(ct);
        var posted = await LedgerByRefAsync(tenantId, refId, ct);
        return Result(posted, item.Id, store.Id, txType, replayed: false);
    }

    private async Task<ApplyImplantStockResult> PostReversalAsync(
        Guid tenantId, Guid userId, ApplyImplantStockRequest req,
        ItemMaster item, StoreMaster store, StockLedger? original, string refId, CancellationToken ct)
    {
        var reversalRef = $"rev:{refId}";
        var already = await _db.StockLedgers.AsNoTracking()
            .FirstOrDefaultAsync(l => l.TenantId == tenantId && l.DeletedAt == null
                                      && l.ReferenceId == reversalRef, ct);
        if (already is not null)
            return Result(already, item.Id, store.Id, already.TransactionType, replayed: true);

        var source = original ?? await LedgerByRefAsync(tenantId, refId, ct);
        var qty = source is { QuantityOut: > 0 } ? source.QuantityOut : 1;
        var rate = source?.UnitRate ?? 0;
        var batchId = source?.StockBatchId;

        if (batchId is Guid bid)
        {
            var batch = await _db.StockBatches.FirstOrDefaultAsync(b => b.Id == bid, ct);
            if (batch is not null)
            {
                batch.QuantityAvailable += qty;
                batch.UpdatedAt = DateTime.UtcNow;
                batch.UpdatedByUserId = userId;
            }
        }

        await PostLedgerAsync(
            tenantId, store.Id, item.Id, batchId, ImplantStockTxn.ImplantReturn, reversalRef,
            SerialLabel(req), qtyIn: qty, qtyOut: 0, rate, userId,
            req.PatientName, req.PatientIpNo, TrimToNull(req.WastageReason), ct);
        await _db.SaveChangesAsync(ct);
        var posted = await LedgerByRefAsync(tenantId, reversalRef, ct);
        return Result(posted, item.Id, store.Id, ImplantStockTxn.ImplantReturn, replayed: false);
    }

    private async Task<ItemMaster?> ResolveItemAsync(
        Guid tenantId, ApplyImplantStockRequest req, CancellationToken ct)
    {
        var items = _db.Items.Where(i => i.TenantId == tenantId && i.DeletedAt == null);
        if (req.ItemId is Guid id && id != Guid.Empty)
        {
            var byId = await items.FirstOrDefaultAsync(i => i.Id == id, ct);
            if (byId is not null) return byId;
        }

        var catalog = TrimToNull(req.CatalogRef);
        var brand = TrimToNull(req.Brand);
        var model = TrimToNull(req.Model);

        if (catalog is not null)
        {
            var byCatalog = await items.FirstOrDefaultAsync(i =>
                i.ItemName == catalog || i.GenericName == catalog, ct);
            if (byCatalog is not null) return byCatalog;
        }

        if (brand is not null && model is not null)
        {
            var byBrand = await items.FirstOrDefaultAsync(i =>
                i.Brand == brand && (i.ItemName == model || i.GenericName == model), ct);
            if (byBrand is not null) return byBrand;
        }

        var serial = TrimToNull(req.SerialNumber) ?? TrimToNull(req.UdiBarcode);
        if (serial is not null)
        {
            var batch = await _db.StockBatches.AsNoTracking()
                .Where(b => b.TenantId == tenantId && b.DeletedAt == null
                            && (b.Barcode == serial || b.BatchNumber == serial))
                .OrderByDescending(b => b.CreatedAt)
                .FirstOrDefaultAsync(ct);
            if (batch is not null)
                return await items.FirstOrDefaultAsync(i => i.Id == batch.ItemId, ct);
        }

        return null;
    }

    private async Task<StoreMaster?> ResolveStoreAsync(Guid tenantId, Guid itemId, CancellationToken ct)
    {
        var stocked = await _db.StockBatches.AsNoTracking()
            .Where(b => b.TenantId == tenantId && b.ItemId == itemId
                        && b.DeletedAt == null && b.IsActive && b.QuantityAvailable > 0)
            .OrderByDescending(b => b.IsConsignment)
            .ThenBy(b => b.ExpiryDate ?? DateTime.MaxValue)
            .Select(b => b.StoreId)
            .FirstOrDefaultAsync(ct);
        if (stocked != Guid.Empty)
        {
            var fromStock = await _db.Stores.FirstOrDefaultAsync(
                s => s.Id == stocked && s.DeletedAt == null, ct);
            if (fromStock is not null) return fromStock;
        }

        var ot = await _db.Stores.FirstOrDefaultAsync(s =>
            s.TenantId == tenantId && s.DeletedAt == null && s.IsActive
            && s.StoreType == "OT", ct);
        if (ot is not null) return ot;

        return await _db.Stores.FirstOrDefaultAsync(s =>
            s.TenantId == tenantId && s.DeletedAt == null && s.IsActive, ct);
    }

    private async Task<decimal> LastPurchaseRateAsync(Guid tenantId, Guid itemId, CancellationToken ct)
    {
        var last = await _db.StockLedgers.AsNoTracking()
            .Where(l => l.TenantId == tenantId && l.ItemId == itemId && l.DeletedAt == null && l.UnitRate > 0)
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => (decimal?)l.UnitRate)
            .FirstOrDefaultAsync(ct);
        if (last.HasValue) return last.Value;

        return await _db.StockBatches.AsNoTracking()
            .Where(b => b.TenantId == tenantId && b.ItemId == itemId && b.DeletedAt == null)
            .OrderByDescending(b => b.CreatedAt)
            .Select(b => (decimal?)b.PurchaseRate)
            .FirstOrDefaultAsync(ct) ?? 0;
    }

    private async Task PostLedgerAsync(
        Guid tenantId, Guid storeId, Guid itemId, Guid? batchId,
        string txType, string refId, string refNumber,
        decimal qtyIn, decimal qtyOut, decimal unitRate, Guid userId,
        string? patientName, string? patientIpNo, string? remarks, CancellationToken ct)
    {
        var lastLedger = await _db.StockLedgers
            .Where(l => l.TenantId == tenantId && l.StoreId == storeId && l.ItemId == itemId)
            .OrderByDescending(l => l.CreatedAt)
            .FirstOrDefaultAsync(ct);
        var balance = (lastLedger?.BalanceQuantity ?? 0) + qtyIn - qtyOut;
        var now = DateTime.UtcNow;
        _db.StockLedgers.Add(new StockLedger
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            StoreId = storeId,
            ItemId = itemId,
            StockBatchId = batchId,
            TransactionType = txType,
            ReferenceId = refId,
            ReferenceNumber = refNumber,
            QuantityIn = qtyIn,
            QuantityOut = qtyOut,
            BalanceQuantity = balance,
            UnitRate = unitRate,
            TotalValue = Math.Round((qtyIn + qtyOut) * unitRate, 2),
            Remarks = remarks,
            PatientName = TrimToNull(patientName),
            PatientIpNo = TrimToNull(patientIpNo),
            TransactionDate = DateTime.SpecifyKind(now.Date, DateTimeKind.Utc),
            CreatedAt = now,
            UpdatedAt = now,
            CreatedByUserId = userId,
            UpdatedByUserId = userId,
            Status = "active",
        });
    }

    private Task<StockLedger?> LedgerByRefAsync(Guid tenantId, string refId, CancellationToken ct)
        => _db.StockLedgers.AsNoTracking()
            .Where(l => l.TenantId == tenantId && l.DeletedAt == null && l.ReferenceId == refId)
            .OrderByDescending(l => l.CreatedAt)
            .FirstOrDefaultAsync(ct);

    private static ApplyImplantStockResult Result(
        StockLedger? row, Guid itemId, Guid storeId, string? txType, bool replayed)
        => new()
        {
            LedgerId = row?.Id,
            ItemId = itemId,
            StoreId = storeId,
            TransactionType = row?.TransactionType ?? txType,
            Replayed = replayed,
        };

    private static bool IsWriteOff(string? status)
        => string.Equals(status, OpenedUnused, StringComparison.OrdinalIgnoreCase)
           || string.Equals(status, Wasted, StringComparison.OrdinalIgnoreCase);

    private static bool IsReversal(string? status)
        => string.Equals(status, Reversed, StringComparison.OrdinalIgnoreCase)
           || string.Equals(status, Returned, StringComparison.OrdinalIgnoreCase);

    private static string SerialLabel(ApplyImplantStockRequest req)
        => TrimToNull(req.SerialNumber) ?? TrimToNull(req.UdiBarcode) ?? req.ImplantUsageId.ToString("N")[..8];

    private static string? TrimToNull(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
