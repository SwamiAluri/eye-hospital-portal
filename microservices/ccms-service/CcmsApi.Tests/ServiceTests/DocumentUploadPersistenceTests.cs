using CcmsApi.Data;
using CcmsApi.Services;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace CcmsApi.Tests.ServiceTests;

/// <summary>
/// Reproduces EF SaveChanges for document upload against the configured CCMS database.
/// Set CCMS_TEST_CONNECTION to run; skipped otherwise.
/// </summary>
public sealed class DocumentUploadPersistenceTests
{
    private static readonly string? Conn = Environment.GetEnvironmentVariable("CCMS_TEST_CONNECTION");

    [Fact]
    public async Task UploadFileAsync_Persists_WhenConnectionConfigured()
    {
        if (string.IsNullOrWhiteSpace(Conn))
        {
            return; // skip when no connection string supplied
        }

        var caseId = Guid.Parse("efd29668-5976-46d6-908f-c670c17e4e3d");
        var tenantId = Guid.Parse("155fe198-6ae5-4a01-9254-ead5b427247e");
        var actorId = Guid.Parse("11111111-1111-1111-1111-111111111111");

        var tenantCtx = new TenantContext();
        tenantCtx.Set(tenantId);
        var options = new DbContextOptionsBuilder<CcmsDbContext>()
            .UseNpgsql(Conn)
            .AddInterceptors(new TenantCommandInterceptor(tenantCtx))
            .Options;

        await using var db = new CcmsDbContext(options);
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["AzureWebJobsStorage"] = "UseDevelopmentStorage=true",
            })
            .Build();
        var svc = new DocumentEngineService(db, config, NullLogger<DocumentEngineService>.Instance);

        await using var stream = new MemoryStream(new byte[] { 9, 8, 7, 6 });
        try
        {
            var doc = await svc.UploadFileAsync(
                caseId, actorId, stream, "ef-diag.pdf", "application/pdf", "id_proof", "preauth");
            doc.Id.Should().NotBeEmpty();
        }
        catch (Exception ex)
        {
            var inner = ex;
            while (inner.InnerException is not null)
                inner = inner.InnerException;
            throw new Xunit.Sdk.XunitException($"OUTER: {ex.Message} | INNER: {inner.GetType().Name}: {inner.Message}");
        }
    }
}
