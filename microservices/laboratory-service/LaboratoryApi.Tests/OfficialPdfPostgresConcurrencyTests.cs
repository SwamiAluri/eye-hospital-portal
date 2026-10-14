using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace LaboratoryApi.Tests;

/// <summary>
/// L-REP-03 CUT B — PostgreSQL evidence for one-active Official PDF job uniqueness.
/// Requires LABORATORY_TEST_CONNECTION (or LaboratoryApi local.settings DefaultConnection).
/// </summary>
public class OfficialPdfPostgresConcurrencyTests
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
    public async Task PostgreSQL_Concurrent_Pending_Jobs_Enforce_One_Active_Per_Report()
    {
        var conn = ResolveConnection();
        Assert.False(string.IsNullOrWhiteSpace(conn),
            "LABORATORY_TEST_CONNECTION (or LaboratoryApi local.settings DefaultConnection) is required for PostgreSQL concurrency evidence.");

        var options = new DbContextOptionsBuilder<LaboratoryDbContext>()
            .UseNpgsql(conn)
            .Options;

        await using (var setup = new LaboratoryDbContext(options))
        {
            Assert.True(setup.Database.IsNpgsql());
            await setup.Database.MigrateAsync();
        }

        var tenant = Guid.NewGuid();
        var reportId = Guid.NewGuid();
        var branch = Guid.NewGuid();
        var actor = Guid.NewGuid();

        // Minimal report row required by FK
        await using (var db = new LaboratoryDbContext(options))
        {
            db.Reports.Add(new LmsReport
            {
                Id = reportId,
                TenantId = tenant,
                OperatingBranchId = branch,
                PatientId = Guid.NewGuid(),
                OrderId = Guid.NewGuid(),
                Status = ReportStatuses.Released,
                CurrentVersionNumber = 1,
                BusinessReportNumber = "RPT-TEST-PDF-001",
                CreatedAtUtc = DateTime.UtcNow,
                CreatedByUserId = actor,
                UpdatedAtUtc = DateTime.UtcNow,
                UpdatedByUserId = actor,
                RowVersion = 1,
            });
            await db.SaveChangesAsync();
        }

        try
        {
            async Task<(bool Ok, Guid JobId)> TryInsertAsync()
            {
                await using var db = new LaboratoryDbContext(options);
                var id = Guid.NewGuid();
                db.ReportOfficialPdfJobs.Add(new LmsReportOfficialPdfJob
                {
                    Id = id,
                    TenantId = tenant,
                    OperatingBranchId = branch,
                    ReportId = reportId,
                    Status = OfficialPdfJobStatuses.Pending,
                    RequestedByUserId = actor,
                    RequestedAtUtc = DateTime.UtcNow,
                    AttemptCount = 0,
                    RowVersion = 1,
                });
                try
                {
                    await db.SaveChangesAsync();
                    return (true, id);
                }
                catch (DbUpdateException)
                {
                    var existing = await db.ReportOfficialPdfJobs.AsNoTracking()
                        .FirstAsync(j => j.TenantId == tenant && j.ReportId == reportId
                                         && (j.Status == OfficialPdfJobStatuses.Pending
                                             || j.Status == OfficialPdfJobStatuses.Running));
                    return (false, existing.Id);
                }
            }

            var results = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => TryInsertAsync()));
            Assert.Equal(1, results.Count(r => r.Ok));
            Assert.Single(results.Select(r => r.JobId).Distinct());

            await using var verify = new LaboratoryDbContext(options);
            Assert.Equal(1, await verify.ReportOfficialPdfJobs.CountAsync(j =>
                j.TenantId == tenant && j.ReportId == reportId
                && (j.Status == OfficialPdfJobStatuses.Pending || j.Status == OfficialPdfJobStatuses.Running)));
        }
        finally
        {
            await using var cleanup = new LaboratoryDbContext(options);
            await cleanup.Database.ExecuteSqlAsync($"""
                DELETE FROM lms_report_official_pdf_jobs WHERE tenant_id = {tenant};
                DELETE FROM lms_reports WHERE tenant_id = {tenant};
                """);
        }
    }
}
