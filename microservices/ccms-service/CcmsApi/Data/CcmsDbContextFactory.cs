using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace CcmsApi.Data;

/// <summary>
/// Design-time factory so that `dotnet ef migrations add` / `dotnet ef database update`
/// can discover CcmsDbContext in an Azure Functions isolated-worker project.
/// </summary>
public class CcmsDbContextFactory : IDesignTimeDbContextFactory<CcmsDbContext>
{
    public CcmsDbContext CreateDbContext(string[] args)
    {
        // Load connection string from local.settings.json when running EF tools locally.
        var config = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("local.settings.json", optional: false)
            .AddEnvironmentVariables()
            .Build();

        var connectionString =
            config.GetConnectionString("DefaultConnection")
            ?? config["ConnectionStrings:DefaultConnection"]
            ?? throw new InvalidOperationException("DefaultConnection not found in local.settings.json");

        var optionsBuilder = new DbContextOptionsBuilder<CcmsDbContext>();
        optionsBuilder.UseNpgsql(connectionString);

        return new CcmsDbContext(optionsBuilder.Options);
    }
}
