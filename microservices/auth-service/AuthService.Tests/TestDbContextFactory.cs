using AuthService.Context;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Moq;

namespace AuthService.Tests;

internal static class TestDbContextFactory
{
    public static AppDbContext CreateInMemory()
    {
        return CreateInMemoryNamed(Guid.NewGuid().ToString());
    }

    /// <summary>
    /// Phase 3I Slice 7 — creates a context bound to a caller-supplied InMemory database name so a
    /// second context can be opened against the same store to simulate a concurrent writer racing
    /// the tracked entity in the first context (EF InMemory still enforces [ConcurrencyCheck] tokens).
    /// </summary>
    public static AppDbContext CreateInMemoryNamed(string databaseName)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName)
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        httpContextAccessor.Setup(x => x.HttpContext).Returns(new DefaultHttpContext());

        return new AppDbContext(options, httpContextAccessor.Object);
    }
}
