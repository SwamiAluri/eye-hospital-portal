using Hangfire;
using Hangfire.PostgreSql;
using IpManagementService.Jobs;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using IpManagementService.Data;
using IpManagementService.Services;
using IpManagementService.Services.Uat;
using System.Net.Http.Headers;

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

        // Build a shared Npgsql data source with dynamic JSON enabled so that
        // string-backed `jsonb` columns (e.g. journey_audit_log.previous_state,
        // pac_assessment.airway_exam) serialize correctly instead of being sent
        // as `text` and failing with "column is of type jsonb but expression is of type text".
        var dataSourceBuilder = new NpgsqlDataSourceBuilder(connectionString);
        dataSourceBuilder.EnableDynamicJson();
        var dataSource = dataSourceBuilder.Build();
        services.AddSingleton(dataSource);

        services.AddDbContext<IpManagementDbContext>((sp, options) =>
            options.UseNpgsql(sp.GetRequiredService<NpgsqlDataSource>())
                   .AddInterceptors(new TenantCommandInterceptor(sp.GetRequiredService<TenantContext>())));

        // Application services
        services.AddScoped<JwtService>();
        services.AddScoped<JourneyCommandAuthContext>();
        services.AddScoped<WardService>();
        services.AddScoped<SlotService>();
        services.AddScoped<JourneyMutationGuardService>();
        services.AddScoped<JourneySchedulingGuardService>();
        services.AddScoped<PatientJourneyService>();
        services.AddScoped<UatDatasetService>();
        services.AddScoped<UatWorkflowSimulator>();
        services.AddScoped<BillingService>();
        services.AddScoped<IntraOpNoteService>();
        services.AddScoped<IntraOpPresetService>();
        services.AddScoped<IIolCatalogService, IolCatalogService>();
        services.AddScoped<PostOpWorkflowService>();
        services.AddScoped<VitalSignService>();
        services.AddScoped<ChecklistPhaseStatusService>();
        services.AddScoped<CounsellorChecklistService>();
        services.AddScoped<WardChecklistService>();
        services.AddScoped<WardChecklistAutoSyncService>();
        services.AddScoped<WardInvestigationChecklistService>();
        services.AddScoped<ChecklistGateService>();
        services.AddScoped<ChecklistIntegrationService>();
        services.AddScoped<MedicationLogService>();
        services.AddScoped<WardPostOpChecklistService>();
        services.AddScoped<SurgicalSafetyService>();
        services.AddScoped<PacAssessmentService>();
        services.AddScoped<AnaesthesiaMonitoringService>();
        services.AddScoped<PreOpClearanceService>();
        services.AddScoped<PreOpReadinessService>();
        services.AddSingleton<IAzureBlobStorageService, AzureBlobStorageService>();
        // Cross-service notification client → calls auth service /api/notifications/internal/*
        var authBaseUrl = context.Configuration["AuthService:BaseUrl"] ?? "http://localhost:5073";
        var internalKey = context.Configuration["AuthService:InternalApiKey"] ?? string.Empty;
        services.AddHttpClient<PreOpNotificationClient>(client =>
        {
            client.BaseAddress = new Uri(authBaseUrl.TrimEnd('/') + "/");
            if (!string.IsNullOrWhiteSpace(internalKey))
                client.DefaultRequestHeaders.Add("X-Internal-Key", internalKey);
        });
        services.AddScoped<IPreOpNotificationClient, PreOpNotificationClient>();

        var ccmsBaseUrl = context.Configuration["CcmsService:BaseUrl"] ?? "http://localhost:7075/api";
        var ccmsKey = context.Configuration["CcmsService:InternalApiKey"]
            ?? context.Configuration["AuthService:InternalApiKey"]
            ?? string.Empty;
        // Register the typed client on ICcmsAdmissionClient. A separate AddScoped of the
        // implementation gets a default HttpClient with no BaseAddress and fail-closes admission.
        services.AddHttpClient<ICcmsAdmissionClient, CcmsAdmissionClient>(client =>
        {
            client.BaseAddress = new Uri(ccmsBaseUrl.TrimEnd('/') + "/");
            if (!string.IsNullOrWhiteSpace(ccmsKey))
                client.DefaultRequestHeaders.TryAddWithoutValidation("X-Internal-Key", ccmsKey);
        });
        services.AddScoped<IImplantChargeHandler, ImplantChargeHandler>();
        services.AddScoped<IConsumableChargeHandler, ConsumableChargeHandler>();
        services.AddScoped<ImplantUsageService>();
        services.AddScoped<JourneySafetyTokenService>();
        services.AddScoped<PostOpTaperService>();
        services.AddHttpClient<IHl7AdtPublisher, Hl7AdtPublisher>();
        services.AddHttpClient<IPacsWorklistPublisher, PacsWorklistPublisher>();
        services.AddScoped<IIntegrationOutboxService, IntegrationOutboxService>();
        services.AddTransient<IntegrationOutboxProcessorJob>();
        services.AddScoped<DailyProgressNoteService>();
        services.AddHttpClient<IAuthBedLifecycleClient, AuthBedLifecycleClient>(client =>
        {
            client.BaseAddress = new Uri(authBaseUrl.TrimEnd('/') + "/");
            if (!string.IsNullOrWhiteSpace(internalKey))
                client.DefaultRequestHeaders.Add("X-Internal-Key", internalKey);
        });
        services.AddHttpClient<IAuthBillingClient, AuthBillingClient>(client =>
        {
            client.BaseAddress = new Uri(authBaseUrl.TrimEnd('/') + "/");
            if (!string.IsNullOrWhiteSpace(internalKey))
                client.DefaultRequestHeaders.Add("X-Internal-Key", internalKey);
        });
        services.AddHttpClient<IAuthAppointmentStatusClient, AuthAppointmentStatusClient>(client =>
        {
            client.BaseAddress = new Uri(authBaseUrl.TrimEnd('/') + "/");
            if (!string.IsNullOrWhiteSpace(internalKey))
                client.DefaultRequestHeaders.Add("X-Internal-Key", internalKey);
        });
        services.AddHttpClient<IAuthOpdClinicalClient, AuthOpdClinicalClient>(client =>
        {
            client.BaseAddress = new Uri(authBaseUrl.TrimEnd('/') + "/");
            if (!string.IsNullOrWhiteSpace(internalKey))
                client.DefaultRequestHeaders.Add("X-Internal-Key", internalKey);
        });

        var inventoryBaseUrl = context.Configuration["InventoryService:BaseUrl"] ?? string.Empty;
        var inventoryKey = context.Configuration["InventoryService:InternalApiKey"]
            ?? internalKey;
        if (!string.IsNullOrWhiteSpace(inventoryBaseUrl))
        {
            services.AddHttpClient<IInventoryImplantClient, InventoryImplantClient>(client =>
            {
                client.BaseAddress = new Uri(inventoryBaseUrl.TrimEnd('/') + "/");
                if (!string.IsNullOrWhiteSpace(inventoryKey))
                    client.DefaultRequestHeaders.Add("X-Internal-Key", inventoryKey);
            });
        }
        else
        {
            services.AddScoped<IInventoryImplantClient, NoOpInventoryImplantClient>();
        }

        var hangfireEnabled = context.Configuration.GetValue("Hangfire:Enabled", true);
        if (hangfireEnabled)
        {
            services.AddHangfire(cfg => cfg
                .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
                .UseSimpleAssemblyNameTypeSerializer()
                .UseRecommendedSerializerSettings()
                .UsePostgreSqlStorage(
                    bootstrap => bootstrap.UseNpgsqlConnection(connectionString),
                    new PostgreSqlStorageOptions { SchemaName = "hangfire" }));
            services.AddHangfireServer();
        }
    })
    .Build();

if (host.Services.GetRequiredService<IConfiguration>().GetValue("Hangfire:Enabled", true))
{
    try
    {
        RecurringJob.AddOrUpdate<IntegrationOutboxProcessorJob>(
            "ip-ccms-integration-outbox",
            job => job.ExecuteAsync(),
            Cron.Minutely);
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine("Hangfire outbox recurring job not registered: " + ex.Message);
    }
}

host.Run();
