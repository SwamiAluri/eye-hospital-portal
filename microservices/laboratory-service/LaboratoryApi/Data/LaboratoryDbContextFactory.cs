using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace LaboratoryApi.Data;

/// <summary>Design-time factory for EF migrations (no host required).</summary>
public class LaboratoryDbContextFactory : IDesignTimeDbContextFactory<LaboratoryDbContext>
{
    public LaboratoryDbContext CreateDbContext(string[] args)
    {
        var basePath = Directory.GetCurrentDirectory();
        var config = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("local.settings.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var cs = config.GetConnectionString("DefaultConnection")
                 ?? config["ConnectionStrings:DefaultConnection"]
                 ?? config["Values:ConnectionStrings:DefaultConnection"]
                 ?? "Host=localhost;Port=5432;Database=hospitalportal;Username=postgres;Password=postgres;SSL Mode=Disable";

        var options = new DbContextOptionsBuilder<LaboratoryDbContext>()
            .UseNpgsql(cs)
            .Options;

        return new LaboratoryDbContext(options);
    }
}
