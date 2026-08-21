using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Extensions.OpenApi.Extensions;
using Microsoft.EntityFrameworkCore;
using CcmsApi;
using CcmsApi.Data;
using CcmsApi.Services;
using Microsoft.Azure.WebJobs.Extensions.OpenApi.Core.Abstractions;
using Microsoft.Azure.WebJobs.Extensions.OpenApi.Core.Configurations;

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults(workerOptions =>
    {
        workerOptions.EnableUserCodeException = true;
    })
    .ConfigureOpenApi()          // registers /api/swagger/ui + /api/swagger.{json|yaml}
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

        services.AddMemoryCache();
        services.AddScoped<DbIntegrationIdempotencyGuard>();
        services.AddSingleton<MemoryIntegrationIdempotencyGuard>();
        services.AddScoped<IIntegrationIdempotencyGuard, ResilientIntegrationIdempotencyGuard>();

        // OpenAPI metadata
        services.AddSingleton<IOpenApiConfigurationOptions, CcmsOpenApiConfigurationOptions>();

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
        services.AddScoped<CoverageCaseWorkspaceService>();

        // Migration 122: Visit policies
        services.AddScoped<VisitPolicyService>();

        // P2: Eligibility + policy capture
        services.AddScoped<EligibilityService>();
        services.AddScoped<PolicyCaptureService>();

        // Phase 4: Pre-authorization
        services.AddScoped<PreAuthorizationService>();

        // Phase 5: Approval events
        services.AddScoped<ApprovalEventService>();
        services.AddScoped<ClarificationService>();

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

        // Phase 3: Policy card OCR
        services.AddScoped<PolicyExtractionBlobService>();
        services.AddScoped<IPolicyExtractionService, OpenAiPolicyExtractionService>();

        // Phase 11: Communications
        services.AddScoped<CommunicationEngineService>();
        services.AddScoped<CommunicationDispatchService>();
        services.AddScoped<TpaInboundEmailService>();

        var notifyBaseUrl = ResolveSetting(context.Configuration, "NotificationService__BaseUrl", "http://localhost:7073");
        services.AddHttpClient("NotificationService", client =>
        {
            client.BaseAddress = new Uri(notifyBaseUrl.TrimEnd('/') + "/");
        });

        // Cross-service HTTP clients
        var authBaseUrl = ResolveSetting(context.Configuration, "AuthService__BaseUrl", "http://localhost:5073");
        var internalKey = ResolveSetting(context.Configuration, "AuthService__InternalApiKey", string.Empty);
        services.AddHttpClient<AuthServiceClient>(client =>
        {
            client.BaseAddress = new Uri(authBaseUrl.TrimEnd('/') + "/");
            if (!string.IsNullOrWhiteSpace(internalKey))
                client.DefaultRequestHeaders.Add("X-Internal-Key", internalKey);
        });

        var ipBaseUrl = ResolveSetting(context.Configuration, "IpService__BaseUrl", "http://localhost:5074");
        services.AddHttpClient<IpServiceClient>(client =>
        {
            client.BaseAddress = new Uri(ipBaseUrl.TrimEnd('/') + "/");
            if (!string.IsNullOrWhiteSpace(internalKey))
                client.DefaultRequestHeaders.Add("X-Internal-Key", internalKey);
        });
    })
    .Build();

host.Run();

static string ResolveSetting(IConfiguration config, string key, string fallback)
{
    return config[key]
        ?? config[$"Values:{key}"]
        ?? fallback;
}
