using InventoryApi.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace InventoryApi.Data;

public class InventoryDbContext : DbContext
{
    public InventoryDbContext(DbContextOptions<InventoryDbContext> options) : base(options) { }

    // ── Store & Item Masters ──────────────────────────────────────────────────
    public DbSet<StoreMaster> Stores => Set<StoreMaster>();
    public DbSet<PurchaseCategory> PurchaseCategories => Set<PurchaseCategory>();
    public DbSet<ItemMaster> Items => Set<ItemMaster>();

    // ── Vendors ───────────────────────────────────────────────────────────────
    public DbSet<Vendor> Vendors => Set<Vendor>();
    public DbSet<VendorPayment> VendorPayments => Set<VendorPayment>();
    public DbSet<VendorBankAccount> VendorBankAccounts => Set<VendorBankAccount>();
    public DbSet<VendorOutstandingLedger> VendorOutstandingLedgers => Set<VendorOutstandingLedger>();

    // ── Purchase / GRN ────────────────────────────────────────────────────────
    public DbSet<PurchaseInvoice> PurchaseInvoices => Set<PurchaseInvoice>();
    public DbSet<PurchaseItem> PurchaseItems => Set<PurchaseItem>();
    public DbSet<InvoiceGstSummary> InvoiceGstSummaries => Set<InvoiceGstSummary>();
    public DbSet<GrnSequence> GrnSequences => Set<GrnSequence>();
    public DbSet<GrnHeader> GrnHeaders => Set<GrnHeader>();
    public DbSet<GrnItem> GrnItems => Set<GrnItem>();
    public DbSet<PurchaseReturn> PurchaseReturns => Set<PurchaseReturn>();
    public DbSet<PurchaseReturnItem> PurchaseReturnItems => Set<PurchaseReturnItem>();

    // ── Stock ─────────────────────────────────────────────────────────────────
    public DbSet<StockBatch> StockBatches => Set<StockBatch>();
    public DbSet<StockLedger> StockLedgers => Set<StockLedger>();
    public DbSet<StockTransfer> StockTransfers => Set<StockTransfer>();
    public DbSet<StockTransferItem> StockTransferItems => Set<StockTransferItem>();

    // ── Approvals ─────────────────────────────────────────────────────────────
    public DbSet<ApprovalLog> ApprovalLogs => Set<ApprovalLog>();

    // ── Billing & Issue ───────────────────────────────────────────────────────
    public DbSet<PharmacyBill> PharmacyBills => Set<PharmacyBill>();
    public DbSet<PharmacyBillItem> PharmacyBillItems => Set<PharmacyBillItem>();
    public DbSet<SurgeryConsumable> SurgeryConsumables => Set<SurgeryConsumable>();
    public DbSet<SharedIntegrationOutboxEvent> IntegrationOutboxEvents => Set<SharedIntegrationOutboxEvent>();

    // ── Requisitions ──────────────────────────────────────────────────────────
    public DbSet<PurchaseRequisition> PurchaseRequisitions => Set<PurchaseRequisition>();
    public DbSet<PurchaseRequisitionItem> PurchaseRequisitionItems => Set<PurchaseRequisitionItem>();

    // ── Procurement Policy ────────────────────────────────────────────────────
    public DbSet<BranchProcurementPolicy> BranchProcurementPolicies => Set<BranchProcurementPolicy>();
    public DbSet<BranchProcurementPolicyVersion> BranchProcurementPolicyVersions => Set<BranchProcurementPolicyVersion>();

    // ── RFQ ───────────────────────────────────────────────────────────────────
    public DbSet<RfqHeader> RfqHeaders => Set<RfqHeader>();
    public DbSet<RfqItem> RfqItems => Set<RfqItem>();
    public DbSet<RfqVendorInvite> RfqVendorInvites => Set<RfqVendorInvite>();
    public DbSet<VendorQuote> VendorQuotes => Set<VendorQuote>();
    public DbSet<VendorQuoteItem> VendorQuoteItems => Set<VendorQuoteItem>();

    // ── Purchase Orders ───────────────────────────────────────────────────────
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<PurchaseOrderItem> PurchaseOrderItems => Set<PurchaseOrderItem>();

    // ── Vendor Acknowledgment ──────────────────────────────────────────────────
    public DbSet<VendorAcknowledgment> VendorAcknowledgments => Set<VendorAcknowledgment>();

    // ── Procurement Audit ─────────────────────────────────────────────────────
    public DbSet<ProcurementTransitionLog> ProcurementTransitionLogs => Set<ProcurementTransitionLog>();

    // ── Vendor Performance ────────────────────────────────────────────────────
    public DbSet<VendorPerformanceRecord> VendorPerformanceRecords => Set<VendorPerformanceRecord>();

    // ── Bill Transfer & Settlement ────────────────────────────────────────────
    public DbSet<BillTransfer> BillTransfers => Set<BillTransfer>();
    public DbSet<InvoiceSettlement> InvoiceSettlements => Set<InvoiceSettlement>();
    public DbSet<SettlementPayment> SettlementPayments => Set<SettlementPayment>();

    // ── Bill Transfer Governance (Phase 1) ───────────────────────────────────
    public DbSet<BillTransferPolicy> BillTransferPolicies => Set<BillTransferPolicy>();
    public DbSet<BillTransferEventLog> BillTransferEventLogs => Set<BillTransferEventLog>();

    // ── Settlement Audit Trail ────────────────────────────────────────────────
    public DbSet<SettlementEventLog> SettlementEventLogs => Set<SettlementEventLog>();

    // ── Bill Transfer Governance (Phase 2–4) ─────────────────────────────────
    public DbSet<BtReasonCatalog> BtReasonCatalog => Set<BtReasonCatalog>();
    public DbSet<RequestIdempotency> RequestIdempotencies => Set<RequestIdempotency>();
    public DbSet<BtEscalationQueue> BtEscalationQueue => Set<BtEscalationQueue>();

    // ── Invoice Extraction Audit ───────────────────────────────────────────────
    public DbSet<InvoiceExtractionAuditLog> InvoiceExtractionAuditLogs => Set<InvoiceExtractionAuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ─── StoreMaster ──────────────────────────────────────────────────────
        modelBuilder.Entity<StoreMaster>(entity =>
        {
            entity.ToTable("inv_store_master");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.BranchId).HasColumnName("branch_id");
            entity.Property(e => e.StoreName).HasColumnName("store_name").HasMaxLength(200);
            entity.Property(e => e.StoreType).HasColumnName("store_type").HasMaxLength(50);
            entity.Property(e => e.IsActive).HasColumnName("is_active");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);
            entity.Property<uint>("xmin").HasColumnType("xid").IsRowVersion();
        });

        // ─── PurchaseCategory ─────────────────────────────────────────────────
        modelBuilder.Entity<PurchaseCategory>(entity =>
        {
            entity.ToTable("inv_purchase_categories");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.CategoryName).HasColumnName("category_name").HasMaxLength(200);
            entity.Property(e => e.CategoryType).HasColumnName("category_type").HasMaxLength(50);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);
        });

        // ─── ItemMaster ───────────────────────────────────────────────────────
        modelBuilder.Entity<ItemMaster>(entity =>
        {
            entity.ToTable("inv_item_master");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.CategoryId).HasColumnName("category_id");
            entity.Property(e => e.ItemName).HasColumnName("item_name").HasMaxLength(300);
            entity.Property(e => e.GenericName).HasColumnName("generic_name").HasMaxLength(300);
            entity.Property(e => e.Brand).HasColumnName("brand").HasMaxLength(200);
            entity.Property(e => e.HsnCode).HasColumnName("hsn_code").HasMaxLength(20);
            entity.Property(e => e.Unit).HasColumnName("unit").HasMaxLength(50);
            entity.Property(e => e.ScheduleType).HasColumnName("schedule_type").HasMaxLength(10);
            entity.Property(e => e.RequiresColdStorage).HasColumnName("requires_cold_storage");
            entity.Property(e => e.IsBarcodeTracked).HasColumnName("is_barcode_tracked");
            entity.Property(e => e.ItemType).HasColumnName("item_type").HasMaxLength(50);
            entity.Property(e => e.ReorderLevel).HasColumnName("reorder_level").HasColumnType("numeric(12,3)");
            entity.Property(e => e.ReorderQuantity).HasColumnName("reorder_quantity").HasColumnType("numeric(12,3)");
            entity.Property(e => e.ReorderSuppressed).HasColumnName("reorder_suppressed");
            entity.Property(e => e.ReorderSuppressedUntil).HasColumnName("reorder_suppressed_until");
            entity.Property(e => e.LastReorderTriggeredAt).HasColumnName("last_reorder_triggered_at");
            entity.Property(e => e.DefaultGstRate).HasColumnName("default_gst_rate").HasMaxLength(10);
            entity.Property(e => e.LinkedInjectorItemId).HasColumnName("linked_injector_item_id");
            entity.Property(e => e.IsSerialized).HasColumnName("is_serialized");
            entity.Property(e => e.IsAssetItem).HasColumnName("is_asset_item");
            entity.Property(e => e.MdrClassification).HasColumnName("mdr_classification").HasMaxLength(20);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);
            entity.Property<uint>("xmin").HasColumnType("xid").IsRowVersion();

            entity.HasOne(e => e.Category)
                  .WithMany(c => c.Items)
                  .HasForeignKey(e => e.CategoryId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.LinkedInjectorItem)
                  .WithMany()
                  .HasForeignKey(e => e.LinkedInjectorItemId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // ─── Vendor ───────────────────────────────────────────────────────────
        modelBuilder.Entity<Vendor>(entity =>
        {
            entity.ToTable("inv_vendors");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(300);
            entity.Property(e => e.VendorCode).HasColumnName("vendor_code").HasMaxLength(50);
            entity.Property(e => e.VendorCategory).HasColumnName("vendor_category").HasMaxLength(50);
            entity.Property(e => e.IsPreferred).HasColumnName("is_preferred");
            entity.Property(e => e.IsConsignmentVendor).HasColumnName("is_consignment_vendor");
            entity.Property(e => e.ContactPerson).HasColumnName("contact_person").HasMaxLength(200);
            entity.Property(e => e.Phone).HasColumnName("phone").HasMaxLength(30);
            entity.Property(e => e.Email).HasColumnName("email").HasMaxLength(200);
            entity.Property(e => e.Address).HasColumnName("address");
            entity.Property(e => e.RegisteredAddress).HasColumnName("registered_address");
            entity.Property(e => e.Website).HasColumnName("website").HasMaxLength(300);
            entity.Property(e => e.GstNumber).HasColumnName("gst_number").HasMaxLength(20);
            entity.Property(e => e.PanNumber).HasColumnName("pan_number").HasMaxLength(15);
            entity.Property(e => e.DrugLicenseNumber).HasColumnName("drug_license_number").HasMaxLength(100);
            entity.Property(e => e.DrugLicense20B).HasColumnName("drug_license_20b").HasMaxLength(50);
            entity.Property(e => e.DrugLicense21B).HasColumnName("drug_license_21b").HasMaxLength(50);
            entity.Property(e => e.DrugLicense20BExpiry).HasColumnName("drug_license_20b_expiry").HasColumnType("date");
            entity.Property(e => e.DrugLicense21BExpiry).HasColumnName("drug_license_21b_expiry").HasColumnType("date");
            entity.Property(e => e.CinNumber).HasColumnName("cin_number").HasMaxLength(21);
            entity.Property(e => e.SwiftCode).HasColumnName("swift_code").HasMaxLength(11);
            entity.Property(e => e.LatePaymentInterestRate).HasColumnName("late_payment_interest_rate").HasColumnType("numeric(5,2)");
            entity.Property(e => e.IsColdChainVendor).HasColumnName("is_cold_chain_vendor");
            entity.Property(e => e.DrugLicenseExpiry).HasColumnName("drug_license_expiry");
            entity.Property(e => e.ApmcRegistration).HasColumnName("apmc_registration").HasMaxLength(100);
            entity.Property(e => e.FoodLicenseNumber).HasColumnName("food_license_number").HasMaxLength(100);
            entity.Property(e => e.ImportExportCode).HasColumnName("import_export_code").HasMaxLength(50);
            entity.Property(e => e.BankName).HasColumnName("bank_name").HasMaxLength(200);
            entity.Property(e => e.BankAccountNumber).HasColumnName("bank_account_number").HasMaxLength(50);
            entity.Property(e => e.BankIfscCode).HasColumnName("bank_ifsc_code").HasMaxLength(20);
            entity.Property(e => e.BankAccountHolderName).HasColumnName("bank_account_holder_name").HasMaxLength(200);
            entity.Property(e => e.BankAccountType).HasColumnName("bank_account_type").HasMaxLength(20);
            entity.Property(e => e.CreditDays).HasColumnName("credit_days").HasColumnType("numeric(5,0)");
            entity.Property(e => e.OutstandingBalance).HasColumnName("outstanding_balance").HasColumnType("numeric(14,2)");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);
            entity.Property<uint>("xmin").HasColumnType("xid").IsRowVersion();
        });

        // ─── PurchaseInvoice ──────────────────────────────────────────────────
        modelBuilder.Entity<PurchaseInvoice>(entity =>
        {
            entity.ToTable("inv_purchase_invoices");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.VendorId).HasColumnName("vendor_id");
            entity.Property(e => e.StoreId).HasColumnName("store_id");
            entity.Property(e => e.InvoiceNumber).HasColumnName("invoice_number").HasMaxLength(100);
            entity.Property(e => e.InvoiceDate).HasColumnName("invoice_date").HasColumnType("date");
            entity.Property(e => e.DeliveryChallNumber).HasColumnName("delivery_chall_number").HasMaxLength(100);
            entity.Property(e => e.DeliveryChallDate).HasColumnName("delivery_chall_date").HasColumnType("date");
            entity.Property(e => e.VendorOrderNumber).HasColumnName("vendor_order_number").HasMaxLength(100);
            entity.Property(e => e.VendorDeliveryNoteNumber).HasColumnName("vendor_delivery_note_number").HasMaxLength(100);
            entity.Property(e => e.VendorSapNumber).HasColumnName("vendor_sap_number").HasMaxLength(100);
            entity.Property(e => e.VendorBatchRef).HasColumnName("vendor_batch_ref").HasMaxLength(100);
            entity.Property(e => e.GrnNumber).HasColumnName("grn_number").HasMaxLength(100);
            entity.Property(e => e.GrnDate).HasColumnName("grn_date").HasColumnType("date");
            entity.Property(e => e.GrossAmount).HasColumnName("gross_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.DiscountAmount).HasColumnName("discount_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.TaxableAmount).HasColumnName("taxable_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.CgstAmount).HasColumnName("cgst_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.SgstAmount).HasColumnName("sgst_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.IgstAmount).HasColumnName("igst_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.TotalGst).HasColumnName("total_gst").HasColumnType("numeric(14,2)");
            entity.Property(e => e.TcsPercent).HasColumnName("tcs_percent").HasColumnType("numeric(5,2)");
            entity.Property(e => e.TcsAmount).HasColumnName("tcs_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.NetAmount).HasColumnName("net_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.PaidAmount).HasColumnName("paid_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.BalanceAmount).HasColumnName("balance_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.BillingMode).HasColumnName("billing_mode").HasMaxLength(20);
            entity.Property(e => e.PatientName).HasColumnName("patient_name").HasMaxLength(200);
            entity.Property(e => e.PatientIpNo).HasColumnName("patient_ip_no").HasMaxLength(50);
            entity.Property(e => e.ApprovalStatus).HasColumnName("approval_status").HasMaxLength(30);
            entity.Property(e => e.PrimaryApprovedBy).HasColumnName("primary_approved_by");
            entity.Property(e => e.PrimaryApprovedAt).HasColumnName("primary_approved_at");
            entity.Property(e => e.FinalApprovedBy).HasColumnName("final_approved_by");
            entity.Property(e => e.FinalApprovedAt).HasColumnName("final_approved_at");
            entity.Property(e => e.Remarks).HasColumnName("remarks");
            entity.Property(e => e.InvoiceType).HasColumnName("invoice_type").HasMaxLength(20);
            entity.Property(e => e.PaymentMode).HasColumnName("payment_mode").HasMaxLength(30);
            entity.Property(e => e.CreditPeriod).HasColumnName("credit_period");
            entity.Property(e => e.DueDate).HasColumnName("due_date");
            entity.Property(e => e.Reference).HasColumnName("reference").HasMaxLength(200);
            entity.Property(e => e.PurchaseCategory).HasColumnName("purchase_category").HasMaxLength(100);

            // e-Invoice & E-Way Bill
            entity.Property(e => e.Irn).HasColumnName("irn").HasMaxLength(200);
            entity.Property(e => e.AckNo).HasColumnName("ack_no").HasMaxLength(50);
            entity.Property(e => e.AckDate).HasColumnName("ack_date").HasColumnType("date");
            entity.Property(e => e.EWayBillNo).HasColumnName("e_way_bill_no").HasMaxLength(50);
            entity.Property(e => e.EWayBillDate).HasColumnName("e_way_bill_date").HasColumnType("date");
            entity.Property(e => e.DateOfDelivery).HasColumnName("date_of_delivery").HasColumnType("date");
            entity.Property(e => e.IsReverseCharge).HasColumnName("is_reverse_charge");
            entity.Property(e => e.VendorGstinOnInvoice).HasColumnName("vendor_gstin_on_invoice").HasMaxLength(20);

            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);
            entity.Property<uint>("xmin").HasColumnType("xid").IsRowVersion();

            entity.HasOne(e => e.Vendor)
                  .WithMany(v => v.PurchaseInvoices)
                  .HasForeignKey(e => e.VendorId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Store)
                  .WithMany()
                  .HasForeignKey(e => e.StoreId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ─── PurchaseItem ─────────────────────────────────────────────────────
        modelBuilder.Entity<PurchaseItem>(entity =>
        {
            entity.ToTable("inv_purchase_items");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.InvoiceId).HasColumnName("invoice_id");
            entity.Property(e => e.ItemId).HasColumnName("item_id");
            entity.Property(e => e.OrderedQuantity).HasColumnName("ordered_quantity").HasColumnType("numeric(12,3)");
            entity.Property(e => e.ReceivedQuantity).HasColumnName("received_quantity").HasColumnType("numeric(12,3)");
            entity.Property(e => e.RejectedQuantity).HasColumnName("rejected_quantity").HasColumnType("numeric(12,3)");
            entity.Property(e => e.FreeQuantity).HasColumnName("free_quantity").HasColumnType("numeric(12,3)");
            entity.Property(e => e.BatchNumber).HasColumnName("batch_number").HasMaxLength(100);
            entity.Property(e => e.ExpiryDate).HasColumnName("expiry_date").HasColumnType("date");
            entity.Property(e => e.Barcode).HasColumnName("barcode").HasMaxLength(100);
            entity.Property(e => e.OriginalMrp).HasColumnName("original_mrp").HasColumnType("numeric(12,2)");
            entity.Property(e => e.Mrp).HasColumnName("mrp").HasColumnType("numeric(12,2)");
            entity.Property(e => e.PurchaseRate).HasColumnName("purchase_rate").HasColumnType("numeric(12,2)");
            entity.Property(e => e.DiscountPercent).HasColumnName("discount_percent").HasColumnType("numeric(6,3)");
            entity.Property(e => e.DiscountAmount).HasColumnName("discount_amount").HasColumnType("numeric(12,2)");
            entity.Property(e => e.IsFullDiscount).HasColumnName("is_full_discount");
            entity.Property(e => e.HsnCode).HasColumnName("hsn_code").HasMaxLength(20);
            entity.Property(e => e.GstPercent).HasColumnName("gst_percent").HasColumnType("numeric(5,2)");
            entity.Property(e => e.CgstPercent).HasColumnName("cgst_percent").HasColumnType("numeric(5,2)");
            entity.Property(e => e.SgstPercent).HasColumnName("sgst_percent").HasColumnType("numeric(5,2)");
            entity.Property(e => e.IgstPercent).HasColumnName("igst_percent").HasColumnType("numeric(5,2)");
            entity.Property(e => e.GstAmount).HasColumnName("gst_amount").HasColumnType("numeric(12,2)");
            entity.Property(e => e.TaxableAmount).HasColumnName("taxable_amount").HasColumnType("numeric(12,2)");
            entity.Property(e => e.NetAmount).HasColumnName("net_amount").HasColumnType("numeric(12,2)");
            entity.Property(e => e.PatientName).HasColumnName("patient_name").HasMaxLength(200);
            entity.Property(e => e.PatientIpNo).HasColumnName("patient_ip_no").HasMaxLength(50);
            entity.Property(e => e.SurgeryId).HasColumnName("surgery_id");
            entity.Property(e => e.ItemRemarks).HasColumnName("item_remarks");

            // Traceability & serialization
            entity.Property(e => e.SerialNumber).HasColumnName("serial_number").HasMaxLength(100);
            entity.Property(e => e.ManufacturerName).HasColumnName("manufacturer_name").HasMaxLength(200);
            entity.Property(e => e.CountryOfOrigin).HasColumnName("country_of_origin").HasMaxLength(100);
            entity.Property(e => e.MfgDate).HasColumnName("mfg_date").HasColumnType("date");
            entity.Property(e => e.ScheduleType).HasColumnName("schedule_type").HasMaxLength(10);
            entity.Property(e => e.IsColdChain).HasColumnName("is_cold_chain");
            entity.Property(e => e.BrandName).HasColumnName("brand_name").HasMaxLength(200);
            entity.Property(e => e.VendorSku).HasColumnName("vendor_sku").HasMaxLength(100);
            entity.Property(e => e.IsInterState).HasColumnName("is_inter_state");
            entity.Property(e => e.ExtraFields).HasColumnName("extra_fields").HasColumnType("jsonb");

            // Pricing / packaging (persisted)
            entity.Property(e => e.SellingPrice).HasColumnName("selling_price").HasColumnType("numeric(12,2)");
            entity.Property(e => e.Packing).HasColumnName("packing").HasColumnType("numeric(8,3)");
            entity.Property(e => e.UnitsPerPack).HasColumnName("units_per_pack").HasColumnType("numeric(8,3)");
            entity.Property(e => e.MrpOnPack).HasColumnName("mrp_on_pack").HasColumnType("numeric(12,2)");
            entity.Property(e => e.TransferMrp).HasColumnName("transfer_mrp").HasColumnType("numeric(12,2)");
            entity.Property(e => e.IsAssetItem).HasColumnName("is_asset_item");
            entity.Property(e => e.TaxOnFree).HasColumnName("tax_on_free");
            entity.Property(e => e.IsReplacement).HasColumnName("is_replacement");

            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.Invoice)
                  .WithMany(i => i.Items)
                  .HasForeignKey(e => e.InvoiceId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Item)
                  .WithMany()
                  .HasForeignKey(e => e.ItemId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ─── InvoiceGstSummary ────────────────────────────────────────────────
        modelBuilder.Entity<InvoiceGstSummary>(entity =>
        {
            entity.ToTable("inv_invoice_gst_summary");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.InvoiceId).HasColumnName("invoice_id");
            entity.Property(e => e.GstRate).HasColumnName("gst_rate").HasColumnType("numeric(5,2)");
            entity.Property(e => e.TaxableAmount).HasColumnName("taxable_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.CgstAmount).HasColumnName("cgst_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.SgstAmount).HasColumnName("sgst_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.IgstAmount).HasColumnName("igst_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.TotalGstAmount).HasColumnName("total_gst_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.Invoice)
                  .WithMany(i => i.GstSummaries)
                  .HasForeignKey(e => e.InvoiceId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ─── GrnSequence ──────────────────────────────────────────────────────
        modelBuilder.Entity<GrnSequence>(entity =>
        {
            entity.ToTable("inv_grn_sequences");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.StoreId).HasColumnName("store_id");
            entity.Property(e => e.FinancialYear).HasColumnName("financial_year").HasMaxLength(10);
            entity.Property(e => e.LastSequence).HasColumnName("last_sequence");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property<uint>("xmin").HasColumnType("xid").IsRowVersion();

            entity.HasIndex(e => new { e.TenantId, e.StoreId, e.FinancialYear })
                  .IsUnique()
                  .HasDatabaseName("idx_grn_sequences_unique");
        });

        // ─── GrnHeader ────────────────────────────────────────────────────────
        modelBuilder.Entity<GrnHeader>(entity =>
        {
            entity.ToTable("inv_grn_headers");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.InvoiceId).HasColumnName("invoice_id");
            entity.Property(e => e.StoreId).HasColumnName("store_id");
            entity.Property(e => e.GrnNumber).HasColumnName("grn_number").HasMaxLength(50);
            entity.Property(e => e.GrnDate).HasColumnName("grn_date").HasColumnType("date");
            entity.Property(e => e.GrnStatus).HasColumnName("grn_status").HasMaxLength(30);
            entity.Property(e => e.Remarks).HasColumnName("remarks");
            entity.Property(e => e.InspectedBy).HasColumnName("inspected_by");
            entity.Property(e => e.InspectedAt).HasColumnName("inspected_at");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);
            entity.Property<uint>("xmin").HasColumnType("xid").IsRowVersion();

            entity.HasOne(e => e.Invoice)
                  .WithMany(i => i.GrnHeaders)
                  .HasForeignKey(e => e.InvoiceId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Store)
                  .WithMany()
                  .HasForeignKey(e => e.StoreId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => new { e.TenantId, e.GrnNumber })
                  .IsUnique()
                  .HasFilter("deleted_at IS NULL")
                  .HasDatabaseName("idx_grn_headers_number_unique");
        });

        // ─── GrnItem ──────────────────────────────────────────────────────────
        modelBuilder.Entity<GrnItem>(entity =>
        {
            entity.ToTable("inv_grn_items");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.GrnHeaderId).HasColumnName("grn_header_id");
            entity.Property(e => e.PurchaseItemId).HasColumnName("purchase_item_id");
            entity.Property(e => e.ItemId).HasColumnName("item_id");
            entity.Property(e => e.AcceptedQuantity).HasColumnName("accepted_quantity").HasColumnType("numeric(12,3)");
            entity.Property(e => e.RejectedQuantity).HasColumnName("rejected_quantity").HasColumnType("numeric(12,3)");
            entity.Property(e => e.RejectionReason).HasColumnName("rejection_reason");
            entity.Property(e => e.IsVerified).HasColumnName("is_verified");
            entity.Property(e => e.Barcode).HasColumnName("barcode").HasMaxLength(100);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.GrnHeader)
                  .WithMany(h => h.GrnItems)
                  .HasForeignKey(e => e.GrnHeaderId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.PurchaseItem)
                  .WithMany()
                  .HasForeignKey(e => e.PurchaseItemId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Item)
                  .WithMany()
                  .HasForeignKey(e => e.ItemId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ─── PurchaseReturn ───────────────────────────────────────────────────
        modelBuilder.Entity<PurchaseReturn>(entity =>
        {
            entity.ToTable("inv_purchase_returns");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.InvoiceId).HasColumnName("invoice_id");
            entity.Property(e => e.VendorId).HasColumnName("vendor_id");
            entity.Property(e => e.SourceType).HasColumnName("source_type").HasMaxLength(20);
            entity.Property(e => e.GrnId).HasColumnName("grn_id");
            entity.Property(e => e.PurchaseCategory).HasColumnName("purchase_category").HasMaxLength(100);
            entity.Property(e => e.ReturnNumber).HasColumnName("return_number").HasMaxLength(50);
            entity.Property(e => e.ReturnDate).HasColumnName("return_date").HasColumnType("date");
            entity.Property(e => e.ReturnReason).HasColumnName("return_reason").HasMaxLength(50);
            entity.Property(e => e.TotalAmount).HasColumnName("total_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.Remarks).HasColumnName("remarks");
            entity.Property(e => e.SettlementStatus).HasColumnName("settlement_status").HasMaxLength(30);
            entity.Property(e => e.CreditNoteNumber).HasColumnName("credit_note_number").HasMaxLength(100);
            entity.Property(e => e.CreditNoteAmount).HasColumnName("credit_note_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.CreditNoteDate).HasColumnName("credit_note_date");
            entity.Property(e => e.PaymentMode).HasColumnName("payment_mode").HasMaxLength(50);
            entity.Property(e => e.Reference).HasColumnName("reference").HasMaxLength(200);
            entity.Property(e => e.SentToVendorAt).HasColumnName("sent_to_vendor_at");
            entity.Property(e => e.SettledAt).HasColumnName("settled_at");
            entity.Property(e => e.TaxableAmount).HasColumnName("taxable_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.CgstAmount).HasColumnName("cgst_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.SgstAmount).HasColumnName("sgst_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.IgstAmount).HasColumnName("igst_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.TcsPercent).HasColumnName("tcs_percent").HasColumnType("numeric(5,2)");
            entity.Property(e => e.TcsAmount).HasColumnName("tcs_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.NetReturnAmount).HasColumnName("net_return_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.ItcReversalAmount).HasColumnName("itc_reversal_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.CancellationReason).HasColumnName("cancellation_reason");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.Invoice)
                  .WithMany()
                  .HasForeignKey(e => e.InvoiceId)
                  .IsRequired(false)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Vendor)
                  .WithMany()
                  .HasForeignKey(e => e.VendorId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ─── PurchaseReturnItem ───────────────────────────────────────────────
        modelBuilder.Entity<PurchaseReturnItem>(entity =>
        {
            entity.ToTable("inv_purchase_return_items");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.ReturnId).HasColumnName("return_id");
            entity.Property(e => e.ItemId).HasColumnName("item_id");
            entity.Property(e => e.StockBatchId).HasColumnName("stock_batch_id");
            entity.Property(e => e.ReturnQuantity).HasColumnName("return_quantity").HasColumnType("numeric(12,3)");
            entity.Property(e => e.FreeQuantity).HasColumnName("free_quantity").HasColumnType("numeric(12,3)");
            entity.Property(e => e.PurchaseRate).HasColumnName("purchase_rate").HasColumnType("numeric(12,2)");
            entity.Property(e => e.Amount).HasColumnName("amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.ReturnCause).HasColumnName("return_cause").HasMaxLength(50);
            entity.Property(e => e.BatchNumber).HasColumnName("batch_number").HasMaxLength(100);
            entity.Property(e => e.ExpiryDate).HasColumnName("expiry_date");
            entity.Property(e => e.HsnCode).HasColumnName("hsn_code").HasMaxLength(20);
            entity.Property(e => e.GstPercent).HasColumnName("gst_percent").HasColumnType("numeric(5,2)");
            entity.Property(e => e.CgstPercent).HasColumnName("cgst_percent").HasColumnType("numeric(5,2)");
            entity.Property(e => e.SgstPercent).HasColumnName("sgst_percent").HasColumnType("numeric(5,2)");
            entity.Property(e => e.IgstPercent).HasColumnName("igst_percent").HasColumnType("numeric(5,2)");
            entity.Property(e => e.TaxableAmount).HasColumnName("taxable_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.CgstAmount).HasColumnName("cgst_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.SgstAmount).HasColumnName("sgst_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.IgstAmount).HasColumnName("igst_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.NetAmount).HasColumnName("net_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.Return)
                  .WithMany(r => r.ReturnItems)
                  .HasForeignKey(e => e.ReturnId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ─── StockBatch ───────────────────────────────────────────────────────
        modelBuilder.Entity<StockBatch>(entity =>
        {
            entity.ToTable("inv_stock_batches");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.StoreId).HasColumnName("store_id");
            entity.Property(e => e.ItemId).HasColumnName("item_id");
            entity.Property(e => e.InvoiceId).HasColumnName("invoice_id");
            entity.Property(e => e.PurchaseItemId).HasColumnName("purchase_item_id");
            entity.Property(e => e.BatchNumber).HasColumnName("batch_number").HasMaxLength(100);
            entity.Property(e => e.ExpiryDate).HasColumnName("expiry_date").HasColumnType("date");
            entity.Property(e => e.Barcode).HasColumnName("barcode").HasMaxLength(100);
            entity.Property(e => e.RequiresColdStorage).HasColumnName("requires_cold_storage");
            entity.Property(e => e.Mrp).HasColumnName("mrp").HasColumnType("numeric(12,2)");
            entity.Property(e => e.PurchaseRate).HasColumnName("purchase_rate").HasColumnType("numeric(12,2)");
            entity.Property(e => e.QuantityIn).HasColumnName("quantity_in").HasColumnType("numeric(12,3)");
            entity.Property(e => e.QuantityOut).HasColumnName("quantity_out").HasColumnType("numeric(12,3)");
            entity.Property(e => e.QuantityAvailable).HasColumnName("quantity_available").HasColumnType("numeric(12,3)");
            entity.Property(e => e.IsConsignment).HasColumnName("is_consignment");
            entity.Property(e => e.VendorId).HasColumnName("vendor_id");
            entity.Property(e => e.IsActive).HasColumnName("is_active");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);
            entity.Property<uint>("xmin").HasColumnType("xid").IsRowVersion();

            entity.HasOne(e => e.Store)
                  .WithMany(s => s.StockBatches)
                  .HasForeignKey(e => e.StoreId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Item)
                  .WithMany(i => i.StockBatches)
                  .HasForeignKey(e => e.ItemId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Invoice)
                  .WithMany()
                  .HasForeignKey(e => e.InvoiceId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(e => new { e.TenantId, e.StoreId, e.ItemId, e.BatchNumber })
                  .HasDatabaseName("idx_stock_batches_lookup");
        });

        // ─── StockLedger ──────────────────────────────────────────────────────
        modelBuilder.Entity<StockLedger>(entity =>
        {
            entity.ToTable("inv_stock_ledger");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.StoreId).HasColumnName("store_id");
            entity.Property(e => e.ItemId).HasColumnName("item_id");
            entity.Property(e => e.StockBatchId).HasColumnName("stock_batch_id");
            entity.Property(e => e.TransactionType).HasColumnName("transaction_type").HasMaxLength(50);
            entity.Property(e => e.ReferenceId).HasColumnName("reference_id").HasMaxLength(100);
            entity.Property(e => e.ReferenceNumber).HasColumnName("reference_number").HasMaxLength(100);
            entity.Property(e => e.QuantityIn).HasColumnName("quantity_in").HasColumnType("numeric(12,3)");
            entity.Property(e => e.QuantityOut).HasColumnName("quantity_out").HasColumnType("numeric(12,3)");
            entity.Property(e => e.BalanceQuantity).HasColumnName("balance_quantity").HasColumnType("numeric(12,3)");
            entity.Property(e => e.UnitRate).HasColumnName("unit_rate").HasColumnType("numeric(12,2)");
            entity.Property(e => e.TotalValue).HasColumnName("total_value").HasColumnType("numeric(14,2)");
            entity.Property(e => e.Remarks).HasColumnName("remarks");
            entity.Property(e => e.PatientName).HasColumnName("patient_name").HasMaxLength(200);
            entity.Property(e => e.PatientIpNo).HasColumnName("patient_ip_no").HasMaxLength(50);
            entity.Property(e => e.TransactionDate).HasColumnName("transaction_date").HasColumnType("date");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.Store)
                  .WithMany(s => s.StockLedgers)
                  .HasForeignKey(e => e.StoreId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Item)
                  .WithMany(i => i.StockLedgers)
                  .HasForeignKey(e => e.ItemId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.StockBatch)
                  .WithMany(b => b.Ledgers)
                  .HasForeignKey(e => e.StockBatchId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(e => new { e.TenantId, e.StoreId, e.ItemId, e.TransactionDate })
                  .HasDatabaseName("idx_stock_ledger_lookup");
        });

        // ─── StockTransfer ────────────────────────────────────────────────────
        modelBuilder.Entity<StockTransfer>(entity =>
        {
            entity.ToTable("inv_stock_transfers");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.FromStoreId).HasColumnName("from_store_id");
            entity.Property(e => e.ToStoreId).HasColumnName("to_store_id");
            entity.Property(e => e.TransferNumber).HasColumnName("transfer_number").HasMaxLength(50);
            entity.Property(e => e.TransferDate).HasColumnName("transfer_date");
            entity.Property(e => e.TransferStatus).HasColumnName("transfer_status").HasMaxLength(30);
            entity.Property(e => e.Remarks).HasColumnName("remarks");
            entity.Property(e => e.ApprovedBy).HasColumnName("approved_by");
            entity.Property(e => e.ApprovedAt).HasColumnName("approved_at");
            entity.Property(e => e.DispatchedBy).HasColumnName("dispatched_by");
            entity.Property(e => e.DispatchedAt).HasColumnName("dispatched_at");
            entity.Property(e => e.ReceivedBy).HasColumnName("received_by");
            entity.Property(e => e.ReceivedAt).HasColumnName("received_at");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.FromStore)
                  .WithMany()
                  .HasForeignKey(e => e.FromStoreId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.ToStore)
                  .WithMany()
                  .HasForeignKey(e => e.ToStoreId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ─── StockTransferItem ────────────────────────────────────────────────
        modelBuilder.Entity<StockTransferItem>(entity =>
        {
            entity.ToTable("inv_stock_transfer_items");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.TransferId).HasColumnName("transfer_id");
            entity.Property(e => e.ItemId).HasColumnName("item_id");
            entity.Property(e => e.StockBatchId).HasColumnName("stock_batch_id");
            entity.Property(e => e.TransferQuantity).HasColumnName("transfer_quantity").HasColumnType("numeric(12,3)");
            entity.Property(e => e.UnitRate).HasColumnName("unit_rate").HasColumnType("numeric(12,2)");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.Transfer)
                  .WithMany(t => t.Items)
                  .HasForeignKey(e => e.TransferId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ─── ApprovalLog ──────────────────────────────────────────────────────
        modelBuilder.Entity<ApprovalLog>(entity =>
        {
            entity.ToTable("inv_approval_logs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.InvoiceId).HasColumnName("invoice_id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.Action).HasColumnName("action").HasMaxLength(50);
            entity.Property(e => e.Remarks).HasColumnName("remarks");
            entity.Property(e => e.ActionAt).HasColumnName("action_at");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.Invoice)
                  .WithMany(i => i.ApprovalLogs)
                  .HasForeignKey(e => e.InvoiceId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ─── PharmacyBill ─────────────────────────────────────────────────────
        modelBuilder.Entity<PharmacyBill>(entity =>
        {
            entity.ToTable("inv_pharmacy_bills");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.StoreId).HasColumnName("store_id");
            entity.Property(e => e.PatientId).HasColumnName("patient_id");
            entity.Property(e => e.BillNumber).HasColumnName("bill_number").HasMaxLength(50);
            entity.Property(e => e.BillDate).HasColumnName("bill_date").HasColumnType("date");
            entity.Property(e => e.PatientName).HasColumnName("patient_name").HasMaxLength(200);
            entity.Property(e => e.PatientIpOpNo).HasColumnName("patient_ip_op_no").HasMaxLength(50);
            entity.Property(e => e.PrescribedByDoctorId).HasColumnName("prescribed_by_doctor_id");
            entity.Property(e => e.GrossAmount).HasColumnName("gross_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.DiscountAmount).HasColumnName("discount_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.GstAmount).HasColumnName("gst_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.NetAmount).HasColumnName("net_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.PaymentMode).HasColumnName("payment_mode").HasMaxLength(30);
            entity.Property(e => e.PaidAmount).HasColumnName("paid_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.BalanceAmount).HasColumnName("balance_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.BillStatus).HasColumnName("bill_status").HasMaxLength(20);
            entity.Property(e => e.Remarks).HasColumnName("remarks");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);
            entity.Property<uint>("xmin").HasColumnType("xid").IsRowVersion();

            entity.HasOne(e => e.Store)
                  .WithMany()
                  .HasForeignKey(e => e.StoreId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ─── PharmacyBillItem ─────────────────────────────────────────────────
        modelBuilder.Entity<PharmacyBillItem>(entity =>
        {
            entity.ToTable("inv_pharmacy_bill_items");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.BillId).HasColumnName("bill_id");
            entity.Property(e => e.ItemId).HasColumnName("item_id");
            entity.Property(e => e.StockBatchId).HasColumnName("stock_batch_id");
            entity.Property(e => e.Quantity).HasColumnName("quantity").HasColumnType("numeric(12,3)");
            entity.Property(e => e.Mrp).HasColumnName("mrp").HasColumnType("numeric(12,2)");
            entity.Property(e => e.SellingRate).HasColumnName("selling_rate").HasColumnType("numeric(12,2)");
            entity.Property(e => e.DiscountPercent).HasColumnName("discount_percent").HasColumnType("numeric(6,3)");
            entity.Property(e => e.GstPercent).HasColumnName("gst_percent").HasColumnType("numeric(5,2)");
            entity.Property(e => e.TaxableAmount).HasColumnName("taxable_amount").HasColumnType("numeric(12,2)");
            entity.Property(e => e.GstAmount).HasColumnName("gst_amount").HasColumnType("numeric(12,2)");
            entity.Property(e => e.NetAmount).HasColumnName("net_amount").HasColumnType("numeric(12,2)");
            entity.Property(e => e.Barcode).HasColumnName("barcode").HasMaxLength(100);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.Bill)
                  .WithMany(b => b.Items)
                  .HasForeignKey(e => e.BillId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ─── SurgeryConsumable ────────────────────────────────────────────────
        modelBuilder.Entity<SurgeryConsumable>(entity =>
        {
            entity.ToTable("inv_surgery_consumables");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.StoreId).HasColumnName("store_id");
            entity.Property(e => e.SurgeryId).HasColumnName("surgery_id");
            entity.Property(e => e.JourneyId).HasColumnName("journey_id");
            entity.Property(e => e.ItemId).HasColumnName("item_id");
            entity.Property(e => e.StockBatchId).HasColumnName("stock_batch_id");
            entity.Property(e => e.IolBillingMode).HasColumnName("iol_billing_mode").HasMaxLength(20);
            entity.Property(e => e.PatientName).HasColumnName("patient_name").HasMaxLength(200);
            entity.Property(e => e.PatientIpNo).HasColumnName("patient_ip_no").HasMaxLength(50);
            entity.Property(e => e.Quantity).HasColumnName("quantity").HasColumnType("numeric(12,3)");
            entity.Property(e => e.UnitRate).HasColumnName("unit_rate").HasColumnType("numeric(12,2)");
            entity.Property(e => e.Amount).HasColumnName("amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.Barcode).HasColumnName("barcode").HasMaxLength(100);
            entity.Property(e => e.Remarks).HasColumnName("remarks");
            entity.Property(e => e.ConsumableStatus).HasColumnName("consumable_status").HasMaxLength(30);
            entity.Property(e => e.EscalationReason).HasColumnName("escalation_reason");
            entity.Property(e => e.ReturnedQuantity).HasColumnName("returned_quantity").HasColumnType("numeric(12,3)");
            entity.Property(e => e.ReturnedAt).HasColumnName("returned_at");
            entity.Property(e => e.ClosedAt).HasColumnName("closed_at");
            entity.Property(e => e.ChargeStatus).HasColumnName("charge_status").HasMaxLength(24);
            entity.Property(e => e.ChargeItemId).HasColumnName("charge_item_id");
            entity.Property(e => e.IssuedAt).HasColumnName("issued_at");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.Store)
                  .WithMany()
                  .HasForeignKey(e => e.StoreId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // Shared IP outbox — same table, no inventory-owned schema.
        modelBuilder.Entity<SharedIntegrationOutboxEvent>(entity =>
        {
            entity.ToTable("integration_outbox_event", t => t.ExcludeFromMigrations());
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.EventType).HasColumnName("event_type");
            entity.Property(e => e.AggregateType).HasColumnName("aggregate_type");
            entity.Property(e => e.AggregateId).HasColumnName("aggregate_id");
            entity.Property(e => e.CorrelationId).HasColumnName("correlation_id");
            entity.Property(e => e.PayloadJson).HasColumnName("payload_json");
            entity.Property(e => e.IdempotencyKey).HasColumnName("idempotency_key");
            entity.Property(e => e.OccurredAt).HasColumnName("occurred_at");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.RetryCount).HasColumnName("retry_count");
            entity.Property(e => e.LastAttemptAt).HasColumnName("last_attempt_at");
            entity.Property(e => e.ProcessedAt).HasColumnName("processed_at");
            entity.Property(e => e.Error).HasColumnName("error");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
        });

        // ─── PurchaseRequisition ──────────────────────────────────────────────
        modelBuilder.Entity<PurchaseRequisition>(entity =>
        {
            entity.ToTable("inv_purchase_requisitions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.StoreId).HasColumnName("store_id");
            entity.Property(e => e.RequisitionNumber).HasColumnName("requisition_number").HasMaxLength(50);
            entity.Property(e => e.RequisitionDate).HasColumnName("requisition_date").HasColumnType("date");
            entity.Property(e => e.RequestedByUserId).HasColumnName("requested_by_user_id");
            entity.Property(e => e.RequisitionType).HasColumnName("requisition_type").HasMaxLength(20);
            entity.Property(e => e.RequisitionStatus).HasColumnName("requisition_status").HasMaxLength(20);
            entity.Property(e => e.Remarks).HasColumnName("remarks");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.Store)
                  .WithMany()
                  .HasForeignKey(e => e.StoreId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ─── PurchaseRequisitionItem ──────────────────────────────────────────
        modelBuilder.Entity<PurchaseRequisitionItem>(entity =>
        {
            entity.ToTable("inv_purchase_requisition_items");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.RequisitionId).HasColumnName("requisition_id");
            entity.Property(e => e.ItemId).HasColumnName("item_id");
            entity.Property(e => e.RequiredQuantity).HasColumnName("required_quantity").HasColumnType("numeric(12,3)");
            entity.Property(e => e.CurrentStock).HasColumnName("current_stock").HasColumnType("numeric(12,3)");
            entity.Property(e => e.PreferredVendor).HasColumnName("preferred_vendor").HasMaxLength(200);
            entity.Property(e => e.Remarks).HasColumnName("remarks");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.Requisition)
                  .WithMany(r => r.Items)
                  .HasForeignKey(e => e.RequisitionId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ─── VendorPayment ────────────────────────────────────────────────────
        modelBuilder.Entity<VendorPayment>(entity =>
        {
            entity.ToTable("inv_vendor_payments");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.VendorId).HasColumnName("vendor_id");
            entity.Property(e => e.InvoiceId).HasColumnName("invoice_id");
            entity.Property(e => e.PaymentReference).HasColumnName("payment_reference").HasMaxLength(100);
            entity.Property(e => e.PaymentDate).HasColumnName("payment_date").HasColumnType("date");
            entity.Property(e => e.Amount).HasColumnName("amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.PaymentMode).HasColumnName("payment_mode").HasMaxLength(20);
            // NEFT / RTGS
            entity.Property(e => e.UtrNumber).HasColumnName("utr_number").HasMaxLength(50);
            entity.Property(e => e.BankName).HasColumnName("bank_name").HasMaxLength(100);
            entity.Property(e => e.AccountNumber).HasColumnName("account_number").HasMaxLength(50);
            entity.Property(e => e.IfscCode).HasColumnName("ifsc_code").HasMaxLength(11);
            // Cheque
            entity.Property(e => e.ChequeNumber).HasColumnName("cheque_number").HasMaxLength(50);
            entity.Property(e => e.ChequeDate).HasColumnName("cheque_date").HasColumnType("date");
            entity.Property(e => e.ExpectedClearanceDate).HasColumnName("expected_clearance_date").HasColumnType("date");
            // UPI
            entity.Property(e => e.UpiId).HasColumnName("upi_id").HasMaxLength(100);
            entity.Property(e => e.UpiApp).HasColumnName("upi_app").HasMaxLength(30);
            // Cash
            entity.Property(e => e.CashReceiptNumber).HasColumnName("cash_receipt_number").HasMaxLength(50);
            entity.Property(e => e.CashReceivedBy).HasColumnName("cash_received_by").HasMaxLength(100);
            // Legacy
            entity.Property(e => e.BankTransactionId).HasColumnName("bank_transaction_id").HasMaxLength(100);
            entity.Property(e => e.Remarks).HasColumnName("remarks");
            // Attachment
            entity.Property(e => e.AttachmentUrl).HasColumnName("attachment_url");
            entity.Property(e => e.AttachmentFilename).HasColumnName("attachment_filename").HasMaxLength(255);
            entity.Property(e => e.AttachmentSizeKb).HasColumnName("attachment_size_kb");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.Vendor)
                  .WithMany(v => v.VendorPayments)
                  .HasForeignKey(e => e.VendorId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Invoice)
                  .WithMany()
                  .HasForeignKey(e => e.InvoiceId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(e => new { e.TenantId, e.PaymentReference })
                  .IsUnique()
                  .HasFilter("deleted_at IS NULL")
                  .HasDatabaseName("uix_vendor_payments_tenant_reference");
        });

        // ─── VendorOutstandingLedger ──────────────────────────────────────────
        modelBuilder.Entity<VendorOutstandingLedger>(entity =>
        {
            entity.ToTable("inv_vendor_outstanding_ledger");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.VendorId).HasColumnName("vendor_id");
            entity.Property(e => e.InvoiceId).HasColumnName("invoice_id");
            entity.Property(e => e.PaymentId).HasColumnName("payment_id");
            entity.Property(e => e.ReturnId).HasColumnName("return_id");
            entity.Property(e => e.EntryType).HasColumnName("entry_type").HasMaxLength(20);
            entity.Property(e => e.Debit).HasColumnName("debit").HasColumnType("numeric(14,2)");
            entity.Property(e => e.Credit).HasColumnName("credit").HasColumnType("numeric(14,2)");
            entity.Property(e => e.RunningBalance).HasColumnName("running_balance").HasColumnType("numeric(14,2)");
            entity.Property(e => e.ReferenceNumber).HasColumnName("reference_number").HasMaxLength(100);
            entity.Property(e => e.EntryDate).HasColumnName("entry_date");
            entity.Property(e => e.Remarks).HasColumnName("remarks");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.Vendor)
                  .WithMany(v => v.OutstandingLedgers)
                  .HasForeignKey(e => e.VendorId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Invoice)
                  .WithMany()
                  .HasForeignKey(e => e.InvoiceId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.Payment)
                  .WithMany()
                  .HasForeignKey(e => e.PaymentId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(e => new { e.TenantId, e.VendorId, e.EntryDate })
                  .HasDatabaseName("idx_vendor_outstanding_lookup");
        });

        // ─── VendorBankAccount ────────────────────────────────────────────────
        modelBuilder.Entity<VendorBankAccount>(entity =>
        {
            entity.ToTable("inv_vendor_bank_accounts");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.VendorId).HasColumnName("vendor_id");
            entity.Property(e => e.AccountHolderName).HasColumnName("account_holder_name").HasMaxLength(200);
            entity.Property(e => e.BankName).HasColumnName("bank_name").HasMaxLength(200);
            entity.Property(e => e.AccountNumber).HasColumnName("account_number").HasMaxLength(50);
            entity.Property(e => e.IfscCode).HasColumnName("ifsc_code").HasMaxLength(11);
            entity.Property(e => e.AccountType).HasColumnName("account_type").HasMaxLength(20);
            entity.Property(e => e.IsPrimary).HasColumnName("is_primary");
            entity.Property(e => e.Nickname).HasColumnName("nickname").HasMaxLength(100);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.Vendor)
                  .WithMany()
                  .HasForeignKey(e => e.VendorId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => new { e.TenantId, e.VendorId })
                  .HasDatabaseName("idx_vendor_bank_accts_vendor")
                  .HasFilter("deleted_at IS NULL");
        });

        // ─── BranchProcurementPolicy ──────────────────────────────────────────
        modelBuilder.Entity<BranchProcurementPolicy>(entity =>
        {
            entity.ToTable("inv_branch_procurement_policies");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.BranchId).HasColumnName("branch_id");
            entity.Property(e => e.PolicyName).HasColumnName("policy_name").HasMaxLength(300);
            entity.Property(e => e.PolicyStatus).HasColumnName("policy_status").HasMaxLength(50);
            entity.Property(e => e.DirectPoLimit).HasColumnName("direct_po_limit").HasColumnType("numeric(15,2)");
            entity.Property(e => e.RfqMandatoryFrom).HasColumnName("rfq_mandatory_from").HasColumnType("numeric(15,2)");
            entity.Property(e => e.DualApprovalFrom).HasColumnName("dual_approval_from").HasColumnType("numeric(15,2)");
            entity.Property(e => e.MinVendorQuotes).HasColumnName("min_vendor_quotes");
            entity.Property(e => e.EmergencyBypassAllowed).HasColumnName("emergency_bypass_allowed");
            entity.Property(e => e.EmergencyBypassExpiryHours).HasColumnName("emergency_bypass_expiry_hours");
            entity.Property(e => e.PublishedAt).HasColumnName("published_at");
            entity.Property(e => e.PublishedByUserId).HasColumnName("published_by_user_id");
            entity.Property(e => e.EffectiveFrom).HasColumnName("effective_from");
            entity.Property(e => e.EffectiveTo).HasColumnName("effective_to");
            entity.Property(e => e.Notes).HasColumnName("notes");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);
        });

        // ─── BranchProcurementPolicyVersion ──────────────────────────────────
        modelBuilder.Entity<BranchProcurementPolicyVersion>(entity =>
        {
            entity.ToTable("inv_branch_procurement_policy_versions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.PolicyId).HasColumnName("policy_id");
            entity.Property(e => e.VersionNumber).HasColumnName("version_number");
            entity.Property(e => e.DirectPoLimit).HasColumnName("direct_po_limit").HasColumnType("numeric(15,2)");
            entity.Property(e => e.RfqMandatoryFrom).HasColumnName("rfq_mandatory_from").HasColumnType("numeric(15,2)");
            entity.Property(e => e.DualApprovalFrom).HasColumnName("dual_approval_from").HasColumnType("numeric(15,2)");
            entity.Property(e => e.MinVendorQuotes).HasColumnName("min_vendor_quotes");
            entity.Property(e => e.EmergencyBypassAllowed).HasColumnName("emergency_bypass_allowed");
            entity.Property(e => e.EmergencyBypassExpiryHours).HasColumnName("emergency_bypass_expiry_hours");
            entity.Property(e => e.ChangeNotes).HasColumnName("change_notes");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.Policy)
                  .WithMany(p => p.Versions)
                  .HasForeignKey(e => e.PolicyId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ─── RfqHeader ────────────────────────────────────────────────────────
        modelBuilder.Entity<RfqHeader>(entity =>
        {
            entity.ToTable("inv_rfq_headers");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.BranchId).HasColumnName("branch_id");
            entity.Property(e => e.RequisitionId).HasColumnName("requisition_id");
            entity.Property(e => e.RfqNumber).HasColumnName("rfq_number").HasMaxLength(50);
            entity.Property(e => e.Title).HasColumnName("title").HasMaxLength(300);
            entity.Property(e => e.RfqStatus).HasColumnName("rfq_status").HasMaxLength(50);
            entity.Property(e => e.PublishedAt).HasColumnName("published_at");
            entity.Property(e => e.ResponseDeadline).HasColumnName("response_deadline");
            entity.Property(e => e.AwardedAt).HasColumnName("awarded_at");
            entity.Property(e => e.AwardedToVendorId).HasColumnName("awarded_to_vendor_id");
            entity.Property(e => e.CancellationReason).HasColumnName("cancellation_reason");
            entity.Property(e => e.Notes).HasColumnName("notes");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.Requisition)
                  .WithMany()
                  .HasForeignKey(e => e.RequisitionId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.AwardedToVendor)
                  .WithMany()
                  .HasForeignKey(e => e.AwardedToVendorId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // ─── RfqItem ──────────────────────────────────────────────────────────
        modelBuilder.Entity<RfqItem>(entity =>
        {
            entity.ToTable("inv_rfq_items");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.RfqId).HasColumnName("rfq_id");
            entity.Property(e => e.ItemId).HasColumnName("item_id");
            entity.Property(e => e.RequestedQty).HasColumnName("requested_qty").HasColumnType("numeric(15,3)");
            entity.Property(e => e.Unit).HasColumnName("unit").HasMaxLength(50);
            entity.Property(e => e.Specifications).HasColumnName("specifications");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.Rfq)
                  .WithMany(r => r.Items)
                  .HasForeignKey(e => e.RfqId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Item)
                  .WithMany()
                  .HasForeignKey(e => e.ItemId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ─── RfqVendorInvite ──────────────────────────────────────────────────
        modelBuilder.Entity<RfqVendorInvite>(entity =>
        {
            entity.ToTable("inv_rfq_vendor_invites");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.RfqId).HasColumnName("rfq_id");
            entity.Property(e => e.VendorId).HasColumnName("vendor_id");
            entity.Property(e => e.InviteStatus).HasColumnName("invite_status").HasMaxLength(50);
            entity.Property(e => e.InvitedAt).HasColumnName("invited_at");
            entity.Property(e => e.ViewedAt).HasColumnName("viewed_at");
            entity.Property(e => e.RespondedAt).HasColumnName("responded_at");
            entity.Property(e => e.DeclineReason).HasColumnName("decline_reason");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.Rfq)
                  .WithMany(r => r.VendorInvites)
                  .HasForeignKey(e => e.RfqId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Vendor)
                  .WithMany()
                  .HasForeignKey(e => e.VendorId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ─── VendorQuote ──────────────────────────────────────────────────────
        modelBuilder.Entity<VendorQuote>(entity =>
        {
            entity.ToTable("inv_vendor_quotes");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.RfqId).HasColumnName("rfq_id");
            entity.Property(e => e.VendorId).HasColumnName("vendor_id");
            entity.Property(e => e.QuoteNumber).HasColumnName("quote_number").HasMaxLength(50);
            entity.Property(e => e.QuoteStatus).HasColumnName("quote_status").HasMaxLength(50);
            entity.Property(e => e.TotalAmount).HasColumnName("total_amount").HasColumnType("numeric(15,2)");
            entity.Property(e => e.QuoteDate).HasColumnName("quote_date");
            entity.Property(e => e.ValidUntil).HasColumnName("valid_until");
            entity.Property(e => e.VendorNotes).HasColumnName("vendor_notes");
            entity.Property(e => e.EvaluationNotes).HasColumnName("evaluation_notes");
            entity.Property(e => e.EvaluationScore).HasColumnName("evaluation_score").HasColumnType("numeric(5,2)");
            entity.Property(e => e.RankPosition).HasColumnName("rank_position");
            entity.Property(e => e.ClarificationNotes).HasColumnName("clarification_notes");
            entity.Property(e => e.ClarificationRequestedAt).HasColumnName("clarification_requested_at");
            entity.Property(e => e.RevisedAt).HasColumnName("revised_at");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.Rfq)
                  .WithMany(r => r.VendorQuotes)
                  .HasForeignKey(e => e.RfqId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Vendor)
                  .WithMany()
                  .HasForeignKey(e => e.VendorId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ─── VendorQuoteItem ──────────────────────────────────────────────────
        modelBuilder.Entity<VendorQuoteItem>(entity =>
        {
            entity.ToTable("inv_vendor_quote_items");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.QuoteId).HasColumnName("quote_id");
            entity.Property(e => e.ItemId).HasColumnName("item_id");
            entity.Property(e => e.QuotedQty).HasColumnName("quoted_qty").HasColumnType("numeric(15,3)");
            entity.Property(e => e.UnitPrice).HasColumnName("unit_price").HasColumnType("numeric(15,4)");
            entity.Property(e => e.GstPercent).HasColumnName("gst_percent").HasColumnType("numeric(5,2)");
            entity.Property(e => e.TotalAmount).HasColumnName("total_amount").HasColumnType("numeric(15,2)");
            entity.Property(e => e.Remarks).HasColumnName("remarks");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.Quote)
                  .WithMany(q => q.Items)
                  .HasForeignKey(e => e.QuoteId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Item)
                  .WithMany()
                  .HasForeignKey(e => e.ItemId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ─── PurchaseOrder ────────────────────────────────────────────────────
        modelBuilder.Entity<PurchaseOrder>(entity =>
        {
            entity.ToTable("inv_purchase_orders");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.BranchId).HasColumnName("branch_id");
            entity.Property(e => e.RequisitionId).HasColumnName("requisition_id");
            entity.Property(e => e.RfqId).HasColumnName("rfq_id");
            entity.Property(e => e.SourceType).HasColumnName("source_type").HasMaxLength(50);
            entity.Property(e => e.PoNumber).HasColumnName("po_number").HasMaxLength(50);
            entity.Property(e => e.VendorId).HasColumnName("vendor_id");
            entity.Property(e => e.PoStatus).HasColumnName("po_status").HasMaxLength(50);
            entity.Property(e => e.TotalAmount).HasColumnName("total_amount").HasColumnType("numeric(15,2)");
            entity.Property(e => e.GstAmount).HasColumnName("gst_amount").HasColumnType("numeric(15,2)");
            entity.Property(e => e.NetAmount).HasColumnName("net_amount").HasColumnType("numeric(15,2)");
            entity.Property(e => e.PoDate).HasColumnName("po_date");
            entity.Property(e => e.ExpectedDeliveryDate).HasColumnName("expected_delivery_date");
            entity.Property(e => e.SentToVendorAt).HasColumnName("sent_to_vendor_at");
            entity.Property(e => e.ActualDeliveryDate).HasColumnName("actual_delivery_date");
            entity.Property(e => e.ReceivedAt).HasColumnName("received_at");
            entity.Property(e => e.L1ApprovedByUserId).HasColumnName("l1_approved_by_user_id");
            entity.Property(e => e.L1ApprovedAt).HasColumnName("l1_approved_at");
            entity.Property(e => e.L2ApprovedByUserId).HasColumnName("l2_approved_by_user_id");
            entity.Property(e => e.L2ApprovedAt).HasColumnName("l2_approved_at");
            entity.Property(e => e.RejectedByUserId).HasColumnName("rejected_by_user_id");
            entity.Property(e => e.RejectedAt).HasColumnName("rejected_at");
            entity.Property(e => e.RejectionReason).HasColumnName("rejection_reason");
            entity.Property(e => e.IsEmergency).HasColumnName("is_emergency");
            entity.Property(e => e.EmergencyBypassExpiry).HasColumnName("emergency_bypass_expiry");
            entity.Property(e => e.Terms).HasColumnName("terms");
            entity.Property(e => e.Notes).HasColumnName("notes");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.Vendor)
                  .WithMany()
                  .HasForeignKey(e => e.VendorId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Requisition)
                  .WithMany()
                  .HasForeignKey(e => e.RequisitionId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.Rfq)
                  .WithMany()
                  .HasForeignKey(e => e.RfqId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(e => new { e.TenantId, e.PoStatus })
                  .HasDatabaseName("idx_inv_po_status_lookup")
                  .HasFilter("deleted_at IS NULL");
        });

        // ─── PurchaseOrderItem ────────────────────────────────────────────────
        modelBuilder.Entity<PurchaseOrderItem>(entity =>
        {
            entity.ToTable("inv_purchase_order_items");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.PoId).HasColumnName("po_id");
            entity.Property(e => e.ItemId).HasColumnName("item_id");
            entity.Property(e => e.OrderedQty).HasColumnName("ordered_qty").HasColumnType("numeric(15,3)");
            entity.Property(e => e.ReceivedQty).HasColumnName("received_qty").HasColumnType("numeric(15,3)");
            entity.Property(e => e.UnitPrice).HasColumnName("unit_price").HasColumnType("numeric(15,4)");
            entity.Property(e => e.GstPercent).HasColumnName("gst_percent").HasColumnType("numeric(5,2)");
            entity.Property(e => e.TotalAmount).HasColumnName("total_amount").HasColumnType("numeric(15,2)");
            entity.Property(e => e.Unit).HasColumnName("unit").HasMaxLength(50);
            entity.Property(e => e.RequiredBy).HasColumnName("required_by");
            entity.Property(e => e.Remarks).HasColumnName("remarks");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.PurchaseOrder)
                  .WithMany(p => p.Items)
                  .HasForeignKey(e => e.PoId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Item)
                  .WithMany()
                  .HasForeignKey(e => e.ItemId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ─── ProcurementTransitionLog ─────────────────────────────────────────
        modelBuilder.Entity<ProcurementTransitionLog>(entity =>
        {
            entity.ToTable("inv_procurement_transition_logs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.EntityType).HasColumnName("entity_type").HasMaxLength(100);
            entity.Property(e => e.EntityId).HasColumnName("entity_id");
            entity.Property(e => e.FromStatus).HasColumnName("from_status").HasMaxLength(100);
            entity.Property(e => e.ToStatus).HasColumnName("to_status").HasMaxLength(100);
            entity.Property(e => e.Reason).HasColumnName("reason");
            entity.Property(e => e.ActorUserId).HasColumnName("actor_user_id");
            entity.Property(e => e.TransitionedAt).HasColumnName("transitioned_at");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasIndex(e => new { e.EntityType, e.EntityId })
                  .HasDatabaseName("idx_inv_ptl_entity_lookup");
        });

        // ─── VendorPerformanceRecord ───────────────────────────────────────────
        modelBuilder.Entity<VendorPerformanceRecord>(entity =>
        {
            entity.ToTable("inv_vendor_performance");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.VendorId).HasColumnName("vendor_id");
            entity.Property(e => e.PoId).HasColumnName("po_id");
            entity.Property(e => e.StoreId).HasColumnName("store_id");
            entity.Property(e => e.ExpectedDeliveryDate).HasColumnName("expected_delivery_date");
            entity.Property(e => e.ActualDeliveryDate).HasColumnName("actual_delivery_date");
            entity.Property(e => e.OnTimeDelivery).HasColumnName("on_time_delivery");
            entity.Property(e => e.DaysLate).HasColumnName("days_late");
            entity.Property(e => e.TotalOrdered).HasColumnName("total_ordered").HasColumnType("numeric(15,3)");
            entity.Property(e => e.TotalReceived).HasColumnName("total_received").HasColumnType("numeric(15,3)");
            entity.Property(e => e.FulfillmentRate).HasColumnName("fulfillment_rate").HasColumnType("numeric(6,2)");
            entity.Property(e => e.Rating).HasColumnName("rating").HasColumnType("numeric(3,1)");
            entity.Property(e => e.Notes).HasColumnName("notes");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.Vendor)
                  .WithMany(v => v.PerformanceRecords)
                  .HasForeignKey(e => e.VendorId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.PurchaseOrder)
                  .WithMany()
                  .HasForeignKey(e => e.PoId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => new { e.TenantId, e.VendorId })
                  .HasDatabaseName("idx_inv_vp_vendor")
                  .HasFilter("deleted_at IS NULL");
        });

        // ─── PurchaseRequisition (PolicyId column) ────────────────────────────
        modelBuilder.Entity<PurchaseRequisition>(entity =>
        {
            entity.Property(e => e.PolicyId).HasColumnName("policy_id");
        });

        // ─── VendorAcknowledgment ─────────────────────────────────────────────
        modelBuilder.Entity<VendorAcknowledgment>(entity =>
        {
            entity.ToTable("inv_vendor_acknowledgments");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.VendorId).HasColumnName("vendor_id");
            entity.Property(e => e.EntityType).HasColumnName("entity_type").HasMaxLength(50);
            entity.Property(e => e.EntityId).HasColumnName("entity_id");
            entity.Property(e => e.AckStatus).HasColumnName("ack_status").HasMaxLength(50);
            entity.Property(e => e.Channel).HasColumnName("channel").HasMaxLength(50);
            entity.Property(e => e.ContactTarget).HasColumnName("contact_target").HasMaxLength(300);
            entity.Property(e => e.AcknowledgedAt).HasColumnName("acknowledged_at");
            entity.Property(e => e.AcknowledgedByUserId).HasColumnName("acknowledged_by_user_id");
            entity.Property(e => e.AckNotes).HasColumnName("ack_notes");
            entity.Property(e => e.DeclineReason).HasColumnName("decline_reason");
            entity.Property(e => e.ExpiresAt).HasColumnName("expires_at");
            entity.Property(e => e.RemindersSent).HasColumnName("reminders_sent");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);

            entity.HasOne(e => e.Vendor)
                  .WithMany()
                  .HasForeignKey(e => e.VendorId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => new { e.TenantId, e.EntityType, e.EntityId })
                  .HasDatabaseName("idx_inv_vack_entity")
                  .HasFilter("deleted_at IS NULL");

            entity.HasIndex(e => new { e.TenantId, e.AckStatus })
                  .HasDatabaseName("idx_inv_vack_status")
                  .HasFilter("deleted_at IS NULL");
        });

        // ─── BillTransfer ─────────────────────────────────────────────────────
        modelBuilder.Entity<BillTransfer>(entity =>
        {
            entity.ToTable("inv_bill_transfers");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.GrnId).HasColumnName("grn_id");
            entity.Property(e => e.InvoiceId).HasColumnName("invoice_id");
            entity.Property(e => e.VendorId).HasColumnName("vendor_id");
            entity.Property(e => e.GrnTotalAmount).HasColumnName("grn_total_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.InvoiceTotalAmount).HasColumnName("invoice_total_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.CgstAmount).HasColumnName("cgst_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.SgstAmount).HasColumnName("sgst_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.IgstAmount).HasColumnName("igst_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.TcsAmount).HasColumnName("tcs_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(32);
            entity.Property(e => e.L1ApprovedBy).HasColumnName("l1_approved_by");
            entity.Property(e => e.L1ApprovedAt).HasColumnName("l1_approved_at");
            entity.Property(e => e.L1Remarks).HasColumnName("l1_remarks");
            entity.Property(e => e.L2ApprovedBy).HasColumnName("l2_approved_by");
            entity.Property(e => e.L2ApprovedAt).HasColumnName("l2_approved_at");
            entity.Property(e => e.L2Remarks).HasColumnName("l2_remarks");
            entity.Property(e => e.Remarks).HasColumnName("remarks");
            entity.Property(e => e.Attachments).HasColumnName("attachments").HasColumnType("text[]");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.StatusMeta).HasColumnName("status_meta").HasMaxLength(20);
            entity.Property(e => e.VersionNo).HasColumnName("version_no");
            entity.Property(e => e.L1DueAt).HasColumnName("l1_due_at");
            entity.Property(e => e.L2DueAt).HasColumnName("l2_due_at");
            entity.Property(e => e.SlaState).HasColumnName("sla_state").HasMaxLength(16);

            entity.HasOne(e => e.Grn)
                  .WithMany()
                  .HasForeignKey(e => e.GrnId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Invoice)
                  .WithMany()
                  .HasForeignKey(e => e.InvoiceId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Vendor)
                  .WithMany()
                  .HasForeignKey(e => e.VendorId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => e.GrnId)
                  .IsUnique()
                  .HasDatabaseName("uix_bill_transfers_grn_id")
                  .HasFilter("deleted_at IS NULL");

            entity.HasIndex(e => new { e.TenantId, e.Status })
                  .HasDatabaseName("idx_bill_transfers_tenant_status")
                  .HasFilter("deleted_at IS NULL");
        });

        // ─── InvoiceSettlement ────────────────────────────────────────────────
        modelBuilder.Entity<InvoiceSettlement>(entity =>
        {
            entity.ToTable("inv_invoice_settlements");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.BillTransferId).HasColumnName("bill_transfer_id");
            entity.Property(e => e.VendorId).HasColumnName("vendor_id");
            entity.Property(e => e.GrossAmount).HasColumnName("gross_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.DebitNoteAdjustment).HasColumnName("debit_note_adjustment").HasColumnType("numeric(14,2)");
            entity.Property(e => e.TcsAmount).HasColumnName("tcs_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.NetPayableAmount).HasColumnName("net_payable_amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.AmountPaid).HasColumnName("amount_paid").HasColumnType("numeric(14,2)");
            entity.Property(e => e.BalanceRemaining).HasColumnName("balance_remaining").HasColumnType("numeric(14,2)");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(20);
            entity.Property(e => e.DueDate).HasColumnName("due_date").HasColumnType("date");
            entity.Property(e => e.SettledAt).HasColumnName("settled_at");
            entity.Property(e => e.OnHoldReason).HasColumnName("on_hold_reason");
            entity.Property(e => e.CancellationReason).HasColumnName("cancellation_reason");
            entity.Property(e => e.WriteOffReason).HasColumnName("write_off_reason");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.StatusMeta).HasColumnName("status_meta").HasMaxLength(20);
            entity.Property(e => e.VersionNo).HasColumnName("version_no");

            entity.HasOne(e => e.BillTransfer)
                  .WithOne(b => b.Settlement)
                  .HasForeignKey<InvoiceSettlement>(e => e.BillTransferId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Vendor)
                  .WithMany()
                  .HasForeignKey(e => e.VendorId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => e.BillTransferId)
                  .IsUnique()
                  .HasDatabaseName("uix_settlements_bill_transfer_id")
                  .HasFilter("deleted_at IS NULL");

            entity.HasIndex(e => new { e.TenantId, e.Status })
                  .HasDatabaseName("idx_settlements_tenant_status")
                  .HasFilter("deleted_at IS NULL");
        });

        // ─── SettlementPayment ────────────────────────────────────────────────
        modelBuilder.Entity<SettlementPayment>(entity =>
        {
            entity.ToTable("inv_settlement_payments");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.SettlementId).HasColumnName("settlement_id");
            entity.Property(e => e.PaymentId).HasColumnName("payment_id");
            entity.Property(e => e.AmountAllocated).HasColumnName("amount_allocated").HasColumnType("numeric(14,2)");
            entity.Property(e => e.AllocationType).HasColumnName("allocation_type").HasMaxLength(20);
            entity.Property(e => e.Reference).HasColumnName("reference");
            entity.Property(e => e.AppliedAt).HasColumnName("applied_at");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");

            entity.HasOne(e => e.Settlement)
                  .WithMany(s => s.Payments)
                  .HasForeignKey(e => e.SettlementId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Payment)
                  .WithMany()
                  .HasForeignKey(e => e.PaymentId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(e => e.SettlementId)
                  .HasDatabaseName("idx_settlement_payments_settlement")
                  .HasFilter("deleted_at IS NULL");
        });

        // ─── SettlementEventLog ───────────────────────────────────────────────
        modelBuilder.Entity<SettlementEventLog>(entity =>
        {
            entity.ToTable("inv_settlement_event_logs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.SettlementId).HasColumnName("settlement_id");
            entity.Property(e => e.FromStatus).HasColumnName("from_status").HasMaxLength(30);
            entity.Property(e => e.ToStatus).HasColumnName("to_status").HasMaxLength(30);
            entity.Property(e => e.EventType).HasColumnName("event_type").HasMaxLength(40);
            entity.Property(e => e.Reason).HasColumnName("reason");
            entity.Property(e => e.Amount).HasColumnName("amount").HasColumnType("numeric(14,2)");
            entity.Property(e => e.ActorUserId).HasColumnName("actor_user_id");
            entity.Property(e => e.ActorType).HasColumnName("actor_type").HasMaxLength(10);
            entity.Property(e => e.OccurredAt).HasColumnName("occurred_at");

            entity.HasOne(e => e.Settlement)
                  .WithMany()
                  .HasForeignKey(e => e.SettlementId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => e.SettlementId)
                  .HasDatabaseName("idx_settlement_event_logs_settlement");

            entity.HasIndex(e => new { e.TenantId, e.OccurredAt })
                  .HasDatabaseName("idx_settlement_event_logs_tenant_time");
        });

        // ─── BillTransferPolicy ───────────────────────────────────────────────
        modelBuilder.Entity<BillTransferPolicy>(entity =>
        {
            entity.ToTable("inv_bill_transfer_policy");
            entity.HasKey(e => e.TenantId);
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.LowValueOverrideThreshold)
                  .HasColumnName("low_value_override_threshold")
                  .HasColumnType("numeric(14,2)");
            entity.Property(e => e.AllowLowValueFlexOverride).HasColumnName("allow_low_value_flex_override");
            entity.Property(e => e.RequireOverrideReason).HasColumnName("require_override_reason");
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
        });

        // ─── BillTransferEventLog ─────────────────────────────────────────────
        modelBuilder.Entity<BillTransferEventLog>(entity =>
        {
            entity.ToTable("inv_bill_transfer_event_log");
            entity.HasKey(e => e.EventId);
            entity.Property(e => e.EventId).HasColumnName("event_id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.BillTransferId).HasColumnName("bill_transfer_id");
            entity.Property(e => e.FromStatus).HasColumnName("from_status").HasMaxLength(32);
            entity.Property(e => e.ToStatus).HasColumnName("to_status").HasMaxLength(32);
            entity.Property(e => e.Action).HasColumnName("action").HasMaxLength(64);
            entity.Property(e => e.ActorUserId).HasColumnName("actor_user_id");
            entity.Property(e => e.ActorRole).HasColumnName("actor_role").HasMaxLength(100);
            entity.Property(e => e.ReasonCode).HasColumnName("reason_code").HasMaxLength(64);
            entity.Property(e => e.ReasonText).HasColumnName("reason_text");
            entity.Property(e => e.OverrideApplied).HasColumnName("override_applied");
            entity.Property(e => e.CorrelationId).HasColumnName("correlation_id").HasMaxLength(128);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");

            entity.HasOne(e => e.BillTransfer)
                  .WithMany()
                  .HasForeignKey(e => e.BillTransferId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => new { e.TenantId, e.BillTransferId, e.CreatedAt })
                  .HasDatabaseName("idx_bt_event_log_bt_id");
        });

        // ─── BtReasonCatalog ──────────────────────────────────────────────────
        modelBuilder.Entity<BtReasonCatalog>(entity =>
        {
            entity.ToTable("inv_bt_reason_catalog");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.ReasonCode).HasColumnName("reason_code").HasMaxLength(64);
            entity.Property(e => e.ReasonLabel).HasColumnName("reason_label").HasMaxLength(200);
            entity.Property(e => e.Category).HasColumnName("category").HasMaxLength(32);
            entity.Property(e => e.IsActive).HasColumnName("is_active");
            entity.Property(e => e.SortOrder).HasColumnName("sort_order");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
        });

        // ─── RequestIdempotency ───────────────────────────────────────────────
        modelBuilder.Entity<RequestIdempotency>(entity =>
        {
            entity.ToTable("inv_request_idempotency");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.EndpointKey).HasColumnName("endpoint_key").HasMaxLength(64);
            entity.Property(e => e.IdempotencyKey).HasColumnName("idempotency_key").HasMaxLength(128);
            entity.Property(e => e.ResponseStatus).HasColumnName("response_status");
            entity.Property(e => e.ResponseBody).HasColumnName("response_body");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.ExpiresAt).HasColumnName("expires_at");

            entity.HasIndex(e => new { e.TenantId, e.EndpointKey, e.IdempotencyKey })
                  .IsUnique()
                  .HasDatabaseName("uix_idempotency_tenant_endpoint_key");
        });

        // ─── InvoiceExtractionAuditLog ─────────────────────────────────────────
        modelBuilder.Entity<InvoiceExtractionAuditLog>(entity =>
        {
            entity.ToTable("inv_invoice_extraction_audit_logs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.SessionId).HasColumnName("session_id").HasMaxLength(64);
            entity.Property(e => e.Outcome).HasColumnName("outcome").HasMaxLength(20);
            entity.Property(e => e.OriginalFilename).HasColumnName("original_filename").HasMaxLength(255);
            entity.Property(e => e.DocumentUrl).HasColumnName("document_url");
            entity.Property(e => e.BlobPurgeAt).HasColumnName("blob_purge_at");
            entity.Property(e => e.BlobPurged).HasColumnName("blob_purged");
            entity.Property(e => e.ProviderModel).HasColumnName("provider_model").HasMaxLength(100);
            entity.Property(e => e.ProcessingMs).HasColumnName("processing_ms");
            entity.Property(e => e.HighFieldCount).HasColumnName("high_field_count");
            entity.Property(e => e.ReviewFieldCount).HasColumnName("review_field_count");
            entity.Property(e => e.LowFieldCount).HasColumnName("low_field_count");
            entity.Property(e => e.LineItemCount).HasColumnName("line_item_count");
            entity.Property(e => e.FieldOverrideCount).HasColumnName("field_override_count");
            entity.Property(e => e.OverriddenFieldsJson).HasColumnName("overridden_fields_json").HasColumnType("text");
            entity.Property(e => e.CreatedInvoiceId).HasColumnName("created_invoice_id");
            entity.Property(e => e.CreatedGrnId).HasColumnName("created_grn_id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");

            entity.HasIndex(e => new { e.TenantId, e.SessionId })
                  .HasDatabaseName("idx_inv_extraction_audit_session")
                  .HasFilter("blob_purged = false");

            entity.HasIndex(e => new { e.TenantId, e.BlobPurgeAt, e.BlobPurged })
                  .HasDatabaseName("idx_inv_extraction_audit_purge")
                  .HasFilter("blob_purged = false");
        });

        // ─── BtEscalationQueue ────────────────────────────────────────────────
        modelBuilder.Entity<BtEscalationQueue>(entity =>
        {
            entity.ToTable("inv_bt_escalation_queue");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.BillTransferId).HasColumnName("bill_transfer_id");
            entity.Property(e => e.EscalationStage).HasColumnName("escalation_stage").HasMaxLength(32);
            entity.Property(e => e.NotifiedAt).HasColumnName("notified_at");
            entity.Property(e => e.ResolvedAt).HasColumnName("resolved_at");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasOne(e => e.BillTransfer)
                  .WithMany()
                  .HasForeignKey(e => e.BillTransferId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => new { e.TenantId, e.CreatedAt })
                  .HasDatabaseName("idx_bt_escalation_tenant_unresolved");
        });

    }
}