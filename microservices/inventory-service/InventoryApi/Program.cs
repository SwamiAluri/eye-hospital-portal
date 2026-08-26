using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.Azure.Functions.Worker;
using InventoryApi.Data;
using InventoryApi.Services;
using Microsoft.EntityFrameworkCore;

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults(workerOptions =>
    {
        workerOptions.EnableUserCodeException = true;
    })
    .ConfigureAppConfiguration((context, config) =>
    {
        config.AddJsonFile("local.settings.json", optional: true, reloadOnChange: false);
        config.AddEnvironmentVariables();
    })
    .ConfigureServices((context, services) =>
    {
        var connectionString = context.Configuration.GetConnectionString("DefaultConnection")
            ?? context.Configuration["ConnectionStrings:DefaultConnection"]
            ?? throw new InvalidOperationException("DefaultConnection is not configured.");

        services.AddDbContext<InventoryDbContext>(options =>
            options.UseNpgsql(connectionString));

        var notificationBaseUrl = context.Configuration["NotificationService:BaseUrl"]
            ?? "http://localhost:7073";
        services.AddHttpClient("notifications", client =>
        {
            client.BaseAddress = new Uri(notificationBaseUrl);
            client.DefaultRequestHeaders.Add("Accept", "application/json");
        });

        // Repositories
        services.AddScoped<IInventoryRepository, EfInventoryRepository>();

        // Core services — registered through their interfaces for DI
        services.AddScoped<IVendorService, VendorService>();
        services.AddScoped<IItemService, ItemService>();
        services.AddScoped<ITaxService, TaxService>();
        services.AddScoped<IApprovalService, ApprovalService>();
        services.AddScoped<IStockService, StockService>();
        services.AddScoped<IImplantStockService, ImplantStockService>();
        services.AddScoped<IGrnPartialAcceptanceService, GrnPartialAcceptanceService>();
        services.AddScoped<IGrnService, GrnService>();
        services.AddScoped<IStockTransferService, StockTransferService>();
        services.AddScoped<IStockLedgerService, StockLedgerService>();
        services.AddScoped<IExpiryAlertService, ExpiryAlertService>();
        services.AddScoped<IPharmacyBillService, PharmacyBillService>();
        services.AddScoped<ISurgeryConsumableService, SurgeryConsumableService>();
        services.AddScoped<IPurchaseRequisitionService, PurchaseRequisitionService>();
        services.AddScoped<IAutoReorderService, AutoReorderService>();
        services.AddScoped<IVendorPaymentService, VendorPaymentService>();
        services.AddScoped<IReconciliationService, ReconciliationService>();
        services.AddScoped<IGstSummaryService, GstSummaryService>();
        services.AddScoped<INotificationClient, HttpNotificationClient>();
        services.AddScoped<IBranchProcurementPolicyService, BranchProcurementPolicyService>();
        services.AddScoped<IRfqService, RfqService>();
        services.AddScoped<IVendorAcknowledgmentService, VendorAcknowledgmentService>();
        services.AddScoped<IPurchaseOrderService, PurchaseOrderService>();
        services.AddScoped<IInventoryDashboardService, InventoryDashboardService>();
        services.AddScoped<IInvoiceSettlementService, InvoiceSettlementService>();
        services.AddScoped<IBillTransferPolicyService, BillTransferPolicyService>();
        services.AddScoped<IBillTransferService, BillTransferService>();
        services.AddScoped<IBillTransferSlaService, BillTransferSlaService>();
        services.AddScoped<IVendorBankAccountService, VendorBankAccountService>();
        services.AddSingleton<IBlobStorageService, BlobStorageService>();
        services.AddScoped<IInvoiceExtractionService, OpenAiInvoiceExtractionService>();
    })
    .Build();

host.Run();
