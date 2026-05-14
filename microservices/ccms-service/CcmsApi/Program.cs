using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using CcmsApi.Data;
using CcmsApi.Services;

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
        var connectionString =
            context.Configuration.GetConnectionString("DefaultConnection")
            ?? context.Configuration["ConnectionStrings:DefaultConnection"]
            ?? throw new InvalidOperationException("DefaultConnection is not configured.");

        services.AddScoped<TenantContext>();
        services.AddDbContext<CcmsDbContext>((sp, options) =>
            options.UseNpgsql(connectionString)
                   .AddInterceptors(new TenantCommandInterceptor(
                       sp.GetRequiredService<TenantContext>())));

        // Core services
        services.AddScoped<JwtService>();

        // Phase 1: Workflow engine
        services.AddScoped<IWorkflowEngine, WorkflowEngine>();
        services.AddScoped<FinancialYearService>();

        // Phase 2: Master data
        services.AddScoped<MasterDataService>();

        // Phase 3: Coverage cases
        services.AddScoped<CoverageCaseService>();

        // Phase 4: Pre-authorization
        services.AddScoped<PreAuthorizationService>();

        // Phase 5: Approval events
        services.AddScoped<ApprovalEventService>();

        // Phase 6: Enhancements
        services.AddScoped<EnhancementService>();

        // Phase 7: Billing integration
        services.AddScoped<CoverageAllocationEngine>();

        // Phase 8: Claims
        services.AddScoped<ClaimPacketGeneratorService>();

        // Phase 9: Settlement
        services.AddScoped<SettlementReconciliationService>();

        // Phase 10: Documents
        services.AddScoped<DocumentEngineService>();

        // Phase 11: Communications
        services.AddScoped<CommunicationEngineService>();

        // Cross-service HTTP clients
        var authBaseUrl = context.Configuration["AuthService__BaseUrl"] ?? "http://localhost:5073";
        var internalKey = context.Configuration["AuthService__InternalApiKey"] ?? string.Empty;
        services.AddHttpClient<AuthServiceClient>(client =>
        {
            client.BaseAddress = new Uri(authBaseUrl.TrimEnd('/') + "/");
            if (!string.IsNullOrWhiteSpace(internalKey))
                client.DefaultRequestHeaders.Add("X-Internal-Key", internalKey);
        });

        var ipBaseUrl = context.Configuration["IpService__BaseUrl"] ?? "http://localhost:5074";
        services.AddHttpClient<IpServiceClient>(client =>
        {
            client.BaseAddress = new Uri(ipBaseUrl.TrimEnd('/') + "/");
            if (!string.IsNullOrWhiteSpace(internalKey))
                client.DefaultRequestHeaders.Add("X-Internal-Key", internalKey);
        });
    })
    .Build();

host.Run();
