using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using LaboratoryApi.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Moq;
using Xunit;

namespace LaboratoryApi.Tests;

/// <summary>
/// L-COL-01E PRE-UAT — real PostgreSQL concurrency evidence for barcode allocation.
/// Requires LABORATORY_TEST_CONNECTION (or ConnectionStrings__DefaultConnection).
/// Fails (does not silently skip) when the connection is unset or not Npgsql.
/// Uses an ephemeral tenant and cleans up sequence rows afterward.
/// </summary>
public class SpecimenBarcodePostgresConcurrencyTests
{
    private const int ConcurrentWorkers = 50;

    private static string? ResolveConnection()
    {
        var env = Environment.GetEnvironmentVariable("LABORATORY_TEST_CONNECTION")
                  ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
        if (!string.IsNullOrWhiteSpace(env))
            return env;

        // Fallback: LaboratoryApi local.settings.json (same source the Functions host uses).
        var localSettings = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory, "..", "..", "..", "..", "LaboratoryApi", "local.settings.json"));
        if (!File.Exists(localSettings))
            return null;

        var cfg = new ConfigurationBuilder().AddJsonFile(localSettings, optional: false).Build();
        return cfg.GetConnectionString("DefaultConnection")
               ?? cfg["ConnectionStrings:DefaultConnection"];
    }

    [Fact]
    public async Task PostgreSQL_Concurrent_Allocation_Is_Unique_And_Sequential_Without_InMemory_Lock()
    {
        var conn = ResolveConnection();
        Assert.False(string.IsNullOrWhiteSpace(conn),
            "LABORATORY_TEST_CONNECTION (or LaboratoryApi local.settings DefaultConnection) is required for PRE-UAT PostgreSQL concurrency evidence.");

        var tenantId = Guid.NewGuid();
        var utcNow = DateTime.UtcNow;
        var date = DateOnly.FromDateTime(utcNow);
        var options = new DbContextOptionsBuilder<LaboratoryDbContext>()
            .UseNpgsql(conn)
            .Options;

        await using (var setup = new LaboratoryDbContext(options))
        {
            Assert.True(setup.Database.IsNpgsql(), "Provider must be PostgreSQL (Npgsql), not InMemory.");
            await setup.Database.MigrateAsync();
            // Isolate this run's sequence row.
            await setup.Database.ExecuteSqlAsync(
                $"""DELETE FROM lms_barcode_number_sequences WHERE tenant_id = {tenantId} AND sequence_date = {date}""");
        }

        var audit = new Mock<IPlatformAuditClient>();
        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        var platform = new Mock<IPlatformReferenceClient>();

        var tasks = Enumerable.Range(0, ConcurrentWorkers).Select(async _ =>
        {
            await using var db = new LaboratoryDbContext(options);
            Assert.True(db.Database.IsNpgsql());
            var svc = new SpecimenBarcodeService(db, audit.Object, platform.Object);
            return await svc.AllocateBarcodeValueAsync(tenantId, utcNow, CancellationToken.None);
        });

        var results = await Task.WhenAll(tasks);
        var values = results.Select(r => r.Value).ToList();
        var sequences = results.Select(r => r.Sequence).OrderBy(x => x).ToList();

        Assert.Equal(ConcurrentWorkers, values.Distinct(StringComparer.Ordinal).Count());
        Assert.All(values, v =>
        {
            Assert.Equal(19, v.Length);
            Assert.Matches(@"^SPC-\d{8}-\d{6}$", v);
            Assert.StartsWith($"SPC-{date:yyyyMMdd}-", v, StringComparison.Ordinal);
        });
        Assert.Equal(Enumerable.Range(1, ConcurrentWorkers).ToList(), sequences);
        Assert.DoesNotContain(values, v => v.Contains("ACC-", StringComparison.Ordinal));

        await using (var verify = new LaboratoryDbContext(options))
        {
            var seq = await verify.BarcodeNumberSequences.AsNoTracking()
                .SingleAsync(s => s.TenantId == tenantId && s.SequenceDate == date);
            Assert.Equal(ConcurrentWorkers, seq.LastValue);

            // Cleanup ephemeral tenant sequence row.
            await verify.Database.ExecuteSqlAsync(
                $"""DELETE FROM lms_barcode_number_sequences WHERE tenant_id = {tenantId} AND sequence_date = {date}""");
        }
    }

    [Fact]
    public async Task PostgreSQL_Exhaustion_Fails_Closed_Without_Wrap()
    {
        var conn = ResolveConnection();
        Assert.False(string.IsNullOrWhiteSpace(conn),
            "LABORATORY_TEST_CONNECTION required for PostgreSQL exhaustion evidence.");

        var tenantId = Guid.NewGuid();
        var utcNow = DateTime.UtcNow;
        var date = DateOnly.FromDateTime(utcNow);
        var options = new DbContextOptionsBuilder<LaboratoryDbContext>()
            .UseNpgsql(conn)
            .Options;

        await using var db = new LaboratoryDbContext(options);
        Assert.True(db.Database.IsNpgsql());
        await db.Database.MigrateAsync();
        await db.Database.ExecuteSqlAsync(
            $"""DELETE FROM lms_barcode_number_sequences WHERE tenant_id = {tenantId} AND sequence_date = {date}""");
        db.BarcodeNumberSequences.Add(new LmsBarcodeNumberSequence
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            SequenceDate = date,
            LastValue = SpecimenBarcodeFormats.SequenceMax,
        });
        await db.SaveChangesAsync();

        var audit = new Mock<IPlatformAuditClient>();
        var platform = new Mock<IPlatformReferenceClient>();
        var svc = new SpecimenBarcodeService(db, audit.Object, platform.Object);

        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            svc.AllocateBarcodeValueAsync(tenantId, utcNow, CancellationToken.None));
        Assert.Equal("barcode_sequence_exhausted", ex.Code);

        await using var cleanup = new LaboratoryDbContext(options);
        await cleanup.Database.ExecuteSqlAsync(
            $"""DELETE FROM lms_barcode_number_sequences WHERE tenant_id = {tenantId} AND sequence_date = {date}""");
    }
}
