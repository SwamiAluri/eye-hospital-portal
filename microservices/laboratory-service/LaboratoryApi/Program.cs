using LaboratoryApi.Data;
using LaboratoryApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults(workerOptions =>
    {
        workerOptions.EnableUserCodeException = true;
    })
    .ConfigureAppConfiguration((_, config) =>
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
        services.AddScoped<JwtService>();
        services.AddScoped<IPlatformAuditClient, PlatformAuditClient>();
        services.AddScoped<IPlatformNotificationClient, PlatformNotificationClient>();
        services.AddScoped<IPlatformReferenceClient, PlatformReferenceClient>();
        services.AddScoped<ICatalogueService, CatalogueService>();
        services.AddScoped<IOrderService, OrderService>();
        services.AddScoped<ICollectionService, CollectionService>();
        services.AddScoped<ISpecimenService, SpecimenService>();
        services.AddScoped<ISpecimenBarcodeService, SpecimenBarcodeService>();
        services.AddScoped<IResultService, ResultService>();
        services.AddScoped<ICriticalResultService, CriticalResultService>();
        services.AddScoped<IReportService, ReportService>();
        services.AddScoped<IOfficialPdfRenderer, OfficialPdfRenderer>();
        services.AddScoped<IPlatformCanonicalDocumentClient, PlatformCanonicalDocumentClient>();
        services.AddScoped<IOfficialPdfService, OfficialPdfService>();
        services.AddDbContext<LaboratoryDbContext>((sp, options) =>
            options.UseNpgsql(connectionString)
                   .AddInterceptors(new TenantCommandInterceptor(
                       sp.GetRequiredService<TenantContext>())));

        var authBaseUrl = ResolveSetting(context.Configuration, "AuthService__BaseUrl", "http://localhost:5073");
        var internalKey = ResolveSetting(context.Configuration, "AuthService__InternalApiKey", string.Empty);
        services.AddHttpClient("AuthService", client =>
        {
            client.BaseAddress = new Uri(authBaseUrl.TrimEnd('/') + "/");
            if (!string.IsNullOrWhiteSpace(internalKey))
                client.DefaultRequestHeaders.Add("X-Internal-Key", internalKey);
        });
        services.AddHttpClient();
    })
    .Build();

host.Run();

static string ResolveSetting(IConfiguration configuration, string key, string fallback)
{
    return configuration[key]
        ?? configuration[$"Values:{key}"]
        ?? fallback;
}
