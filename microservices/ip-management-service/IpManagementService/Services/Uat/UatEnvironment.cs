using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace IpManagementService.Services.Uat;

public static class UatEnvironment
{
    public const string ConfigFlag = "EnableUatDataSeeder";
    public const string UhidPrefix = "UAT-IP-";
    public const string HealthIdPrefix = "UAT-HID-";
    public const string MrnPrefix = "UAT-MR-";
    public const string DemoTag = "[UAT-DEMO]";

    public static bool IsEnabled(IHostEnvironment env, IConfiguration config)
    {
        if (env.IsProduction()) return false;
        var azureEnv = config["AZURE_FUNCTIONS_ENVIRONMENT"]
                       ?? config["ASPNETCORE_ENVIRONMENT"]
                       ?? env.EnvironmentName;
        if (string.Equals(azureEnv, "Production", StringComparison.OrdinalIgnoreCase))
            return false;
        return config.GetValue(ConfigFlag, false);
    }

    public static void EnsureEnabled(IHostEnvironment env, IConfiguration config)
    {
        if (!IsEnabled(env, config))
            throw new UnauthorizedAccessException(
                "UAT data seeder is disabled. Set EnableUatDataSeeder=true in Development only.");
    }

    public static bool IsUatUhid(string? uhid)
        => !string.IsNullOrWhiteSpace(uhid)
           && uhid.StartsWith(UhidPrefix, StringComparison.OrdinalIgnoreCase);
}
