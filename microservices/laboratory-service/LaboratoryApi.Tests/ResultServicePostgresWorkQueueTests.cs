using LaboratoryApi.Data;
using LaboratoryApi.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Moq;
using Xunit;

namespace LaboratoryApi.Tests;

/// <summary>
/// L-TST-01A Manual UAT blocker — proves Work Queue Count/OrderBy/Skip/Take translate on real Npgsql.
/// InMemory hid the left-join projection translation failure that produced HTTP 500.
/// </summary>
public class ResultServicePostgresWorkQueueTests
{
    private static string? ResolveConnection()
    {
        var env = Environment.GetEnvironmentVariable("LABORATORY_TEST_CONNECTION")
                  ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
        if (!string.IsNullOrWhiteSpace(env))
            return env;

        var localSettings = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory, "..", "..", "..", "..", "LaboratoryApi", "local.settings.json"));
        if (!File.Exists(localSettings))
            return null;

        var cfg = new ConfigurationBuilder().AddJsonFile(localSettings, optional: false).Build();
        return cfg.GetConnectionString("DefaultConnection")
               ?? cfg["ConnectionStrings:DefaultConnection"];
    }

    [Fact]
    public async Task PostgreSQL_Work_Queue_Empty_Does_Not_Throw_Translation_Error()
    {
        var conn = ResolveConnection();
        Assert.False(string.IsNullOrWhiteSpace(conn),
            "LABORATORY_TEST_CONNECTION (or LaboratoryApi local.settings DefaultConnection) is required.");

        var options = new DbContextOptionsBuilder<LaboratoryDbContext>()
            .UseNpgsql(conn)
            .Options;

        await using var db = new LaboratoryDbContext(options);
        Assert.True(db.Database.IsNpgsql(), "Provider must be PostgreSQL (Npgsql), not InMemory.");

        var audit = new Mock<IPlatformAuditClient>();
        var platform = new Mock<IPlatformReferenceClient>();
        var tenant = Guid.NewGuid();
        var actor = Guid.NewGuid();
        var branch = Guid.NewGuid();
        platform.Setup(p => p.ValidateUserBranchAsync(
                tenant, actor, branch, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserBranchRef(actor, branch, true));

        var results = new ResultService(db, audit.Object, platform.Object);

        // Must not throw InvalidOperationException (LINQ could not be translated).
        var page = await results.ListWorkQueueAsync(
            tenant, actor, new TestingWorkQueueQuery(branch, Page: 1, PageSize: 25));

        Assert.Empty(page.Items);
        Assert.Equal(0, page.TotalCount);
        Assert.Equal(1, page.Page);
        Assert.Equal(25, page.PageSize);
    }
}
