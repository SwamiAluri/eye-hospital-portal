using InventoryApi.Data;
using InventoryApi.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace InventoryApi.Services;

/// <summary>
/// Manages stock batch creation and FEFO (First Expired First Out) deductions.
/// Called by GrnService (inwards) and PharmacyBillService/SurgeryConsumableService (outwards).
/// </summary>
public interface IStockService
{
    Task PostGrnStockAsync(Guid tenantId, GrnHeader grn, Guid userId, CancellationToken ct);
    Task<StockBatch> DeductFefoAsync(Guid tenantId, Guid storeId, Guid itemId, decimal quantity, Guid userId, string txType, string refId, string refNumber, CancellationToken ct);
    Task PostTransferAsync(Guid tenantId, StockTransfer transfer, Guid userId, CancellationToken ct);
}

public sealed class StockService : IStockService
{
    private readonly InventoryDbContext _db;

    public StockService(InventoryDbContext db) => _db = db;

    /// <summary>
    /// Called on Final GRN Approval — creates stock batches and ledger entries.
    ///
    /// Two IOL billing paths (per plan):
    ///   Bulk (Carl Zeiss OT stock):
    ///     → creates inv_stock_batch + "GRN_IN" ledger entry
    ///   PatientSpecific (WIIZ/Biotech — IOL bought per patient):
    ///     → NO inv_stock_batch entry
    ///     → "PATIENT_IOL_ISSUE" ledger entry with patient_name / patient_ip_no
    ///     → batchId = null in ledger (linked via purchase_item_id instead)
    /// </summary>
    public async Task PostGrnStockAsync(Guid tenantId, GrnHeader grn, Guid userId, CancellationToken ct)
    {
        var invoice = await _db.PurchaseInvoices
            .Include(i => i.Items)
            .FirstAsync(i => i.Id == grn.InvoiceId, ct);

        var isPatientSpecific = invoice.BillingMode == "PatientSpecific";
        var vendor = await _db.Vendors.AsNoTracking()
            .FirstOrDefaultAsync(v => v.Id == invoice.VendorId && v.DeletedAt == null, ct);
        var isConsignment = vendor?.IsConsignmentVendor == true;

        foreach (var grnItem in grn.GrnItems.Where(gi => gi.AcceptedQuantity > 0))
        {
            var purchaseItem = invoice.Items.First(pi => pi.Id == grnItem.PurchaseItemId);

            if (isPatientSpecific)
            {
                // Patient-specific path: no stock batch — post PATIENT_IOL_ISSUE ledger directly.
                // batchId = null; patient context comes from the purchase_item row.
                await PostPatientIolLedgerAsync(
                    tenantId, grn.StoreId, grnItem.ItemId,
                    grn.Id.ToString(), grn.GrnNumber,
                    grnItem.AcceptedQuantity, purchaseItem.PurchaseRate,
                    purchaseItem.PatientName, purchaseItem.PatientIpNo,
                    userId, ct);
            }
            else
            {
                // Bulk path: create stock batch, then GRN_IN ledger entry.
                var batch = new StockBatch
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    StoreId = grn.StoreId,
                    ItemId = grnItem.ItemId,
                    InvoiceId = invoice.Id,
                    PurchaseItemId = purchaseItem.Id,
                    BatchNumber = purchaseItem.BatchNumber ?? $"AUTO-{DateTime.UtcNow:yyyyMMdd}",
                    ExpiryDate = purchaseItem.ExpiryDate,
                    Barcode = grnItem.Barcode ?? purchaseItem.Barcode,
                    Mrp = purchaseItem.Mrp,
                    PurchaseRate = purchaseItem.PurchaseRate,
                    QuantityIn = grnItem.AcceptedQuantity,
                    QuantityAvailable = grnItem.AcceptedQuantity,
                    IsConsignment = isConsignment,
                    VendorId = isConsignment ? invoice.VendorId : null,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    CreatedByUserId = userId,
                    UpdatedByUserId = userId
                };

                // Copy cold storage flag from item master
                var item = await _db.Items.FindAsync([grnItem.ItemId], ct);
                if (item is not null) batch.RequiresColdStorage = item.RequiresColdStorage;

                _db.StockBatches.Add(batch);

                await PostLedgerAsync(tenantId, grn.StoreId, grnItem.ItemId, batch.Id,
                    "GRN_IN", grn.Id.ToString(), grn.GrnNumber,
                    grnItem.AcceptedQuantity, 0, purchaseItem.PurchaseRate,
                    userId, ct);
            }
        }
    }

    /// <summary>
    /// Posts a PATIENT_IOL_ISSUE ledger entry with StockBatchId = null.
    /// Used for PatientSpecific billing mode where no physical batch is held.
    /// Patient name and IP number are stored in the dedicated PatientName / PatientIpNo columns.
    /// </summary>
    private async Task PostPatientIolLedgerAsync(
        Guid tenantId, Guid storeId, Guid itemId,
        string refId, string refNumber, decimal quantity, decimal unitRate,
        string? patientName, string? patientIpNo,
        Guid userId, CancellationToken ct)
    {
        var lastLedger = await _db.StockLedgers
            .Where(l => l.TenantId == tenantId && l.StoreId == storeId && l.ItemId == itemId)
            .OrderByDescending(l => l.CreatedAt)
            .FirstOrDefaultAsync(ct);

        var balance = (lastLedger?.BalanceQuantity ?? 0) + quantity;

        _db.StockLedgers.Add(new StockLedger
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            StoreId = storeId,
            ItemId = itemId,
            StockBatchId = null,         // No batch for PatientSpecific
            TransactionType = "PATIENT_IOL_ISSUE",
            ReferenceId = refId,
            ReferenceNumber = refNumber,
            QuantityIn = quantity,
            QuantityOut = 0,
            BalanceQuantity = balance,
            UnitRate = unitRate,
            TotalValue = Math.Round(quantity * unitRate, 2),
            PatientName = patientName,
            PatientIpNo = patientIpNo,
            TransactionDate = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = userId,
            UpdatedByUserId = userId
        });
    }

    /// <summary>
    /// FEFO deduction — picks the batch nearest to expiry with available stock.
    /// Returns the batch that was used (for bill/consumable line linkage).
    /// </summary>
    public async Task<StockBatch> DeductFefoAsync(
        Guid tenantId, Guid storeId, Guid itemId, decimal quantity,
        Guid userId, string txType, string refId, string refNumber, CancellationToken ct)
    {
        // Get batches ordered by expiry ascending (FEFO), then by created_at for same expiry
        var batches = (await _db.StockBatches
            .Where(b => b.TenantId == tenantId && b.StoreId == storeId && b.ItemId == itemId
                     && b.QuantityAvailable > 0 && b.DeletedAt == null && b.IsActive)
            .ToListAsync(ct))
            .OrderByDescending(b => b.IsConsignment)
            .ThenBy(b => b.ExpiryDate ?? DateTime.MaxValue)
            .ThenBy(b => b.CreatedAt)
            .ToList();

        decimal remaining = quantity;
        StockBatch? primaryBatch = null;

        foreach (var batch in batches)
        {
            if (remaining <= 0) break;

            var toDeduct = Math.Min(batch.QuantityAvailable, remaining);
            batch.QuantityOut += toDeduct;
            batch.QuantityAvailable -= toDeduct;
            batch.UpdatedAt = DateTime.UtcNow;
            remaining -= toDeduct;

            primaryBatch ??= batch;

            await PostLedgerAsync(tenantId, storeId, itemId, batch.Id,
                txType, refId, refNumber,
                0, toDeduct, batch.PurchaseRate,
                userId, ct);
        }

        if (remaining > 0)
            throw new InvalidOperationException(
                $"Insufficient stock for item {itemId} in store {storeId}. Short by {remaining}.");

        return primaryBatch!;
    }

    public async Task PostTransferAsync(Guid tenantId, StockTransfer transfer, Guid userId, CancellationToken ct)
    {
        foreach (var line in transfer.Items)
        {
            var batch = await _db.StockBatches.FindAsync([line.StockBatchId], ct)
                ?? throw new InvalidOperationException($"Batch {line.StockBatchId} not found.");

            if (batch.QuantityAvailable < line.TransferQuantity)
                throw new InvalidOperationException($"Insufficient stock in batch {batch.Id}.");

            // Deduct from source
            batch.QuantityOut += line.TransferQuantity;
            batch.QuantityAvailable -= line.TransferQuantity;
            batch.UpdatedAt = DateTime.UtcNow;

            await PostLedgerAsync(tenantId, transfer.FromStoreId, line.ItemId, batch.Id,
                "TRANSFER_OUT", transfer.Id.ToString(), transfer.TransferNumber,
                0, line.TransferQuantity, line.UnitRate, userId, ct);

            // Create new batch in destination store
            var destBatch = new StockBatch
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                StoreId = transfer.ToStoreId,
                ItemId = line.ItemId,
                BatchNumber = batch.BatchNumber,
                ExpiryDate = batch.ExpiryDate,
                Barcode = batch.Barcode,
                RequiresColdStorage = batch.RequiresColdStorage,
                Mrp = batch.Mrp,
                PurchaseRate = line.UnitRate,
                QuantityIn = line.TransferQuantity,
                QuantityAvailable = line.TransferQuantity,
                IsConsignment = batch.IsConsignment,
                VendorId = batch.VendorId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                CreatedByUserId = userId
            };
            _db.StockBatches.Add(destBatch);

            await PostLedgerAsync(tenantId, transfer.ToStoreId, line.ItemId, destBatch.Id,
                "TRANSFER_IN", transfer.Id.ToString(), transfer.TransferNumber,
                line.TransferQuantity, 0, line.UnitRate, userId, ct);
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private async Task PostLedgerAsync(
        Guid tenantId, Guid storeId, Guid itemId, Guid batchId,
        string txType, string refId, string refNumber,
        decimal qtyIn, decimal qtyOut, decimal unitRate,
        Guid userId, CancellationToken ct)
    {
        // Calculate running balance for this store/item
        var lastLedger = await _db.StockLedgers
            .Where(l => l.TenantId == tenantId && l.StoreId == storeId && l.ItemId == itemId)
            .OrderByDescending(l => l.CreatedAt)
            .FirstOrDefaultAsync(ct);

        var balance = (lastLedger?.BalanceQuantity ?? 0) + qtyIn - qtyOut;

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
            TransactionDate = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = userId,
            UpdatedByUserId = userId
        });
    }
}
