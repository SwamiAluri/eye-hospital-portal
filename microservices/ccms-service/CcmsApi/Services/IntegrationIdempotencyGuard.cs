using CcmsApi.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace CcmsApi.Services;

/// <summary>
/// P0 — Postgres-backed idempotency so multiple CCMS instances share one truth.
/// Uses INSERT … ON CONFLICT DO NOTHING; a non-insert means duplicate.
/// </summary>
public sealed class DbIntegrationIdempotencyGuard : IIntegrationIdempotencyGuard
{
    private readonly CcmsDbContext _db;
    private readonly ILogger<DbIntegrationIdempotencyGuard> _log;
    private readonly TimeSpan _ttl;

    public DbIntegrationIdempotencyGuard(
        CcmsDbContext db,
        ILogger<DbIntegrationIdempotencyGuard> log,
        TimeSpan? ttl = null)
    {
        _db = db;
        _log = log;
        _ttl = ttl ?? TimeSpan.FromHours(24);
    }

    public async Task<bool> IsDuplicateAsync(string? idempotencyKey, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(idempotencyKey))
            return false;

        var key = idempotencyKey.Trim();
        if (key.Length > 200)
            key = key[..200];

        var expiresAt = DateTime.UtcNow.Add(_ttl);

        await _db.Database.ExecuteSqlInterpolatedAsync($@"
            DELETE FROM ccms_integration_idempotency
             WHERE idempotency_key = {key}
               AND expires_at < NOW() AT TIME ZONE 'utc'", ct);

        var inserted = await _db.Database.ExecuteSqlInterpolatedAsync($@"
            INSERT INTO ccms_integration_idempotency (idempotency_key, seen_at, expires_at)
            VALUES ({key}, NOW() AT TIME ZONE 'utc', {expiresAt})
            ON CONFLICT (idempotency_key) DO NOTHING", ct);

        if (inserted == 0)
        {
            _log.LogInformation("Duplicate integration request suppressed (key={Key})", key);
            return true;
        }

        return false;
    }
}

/// <summary>In-process guard for unit tests (and local fallback if table missing).</summary>
public sealed class MemoryIntegrationIdempotencyGuard : IIntegrationIdempotencyGuard
{
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string, DateTime> _seen = new();
    private readonly TimeSpan _ttl;
    private readonly ILogger<MemoryIntegrationIdempotencyGuard> _log;

    public MemoryIntegrationIdempotencyGuard(
        ILogger<MemoryIntegrationIdempotencyGuard> log,
        TimeSpan? ttl = null)
    {
        _log = log;
        _ttl = ttl ?? TimeSpan.FromHours(24);
    }

    public Task<bool> IsDuplicateAsync(string? idempotencyKey, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(idempotencyKey))
            return Task.FromResult(false);

        var key = idempotencyKey.Trim();
        var now = DateTime.UtcNow;
        if (_seen.TryGetValue(key, out var expires) && expires > now)
        {
            _log.LogInformation("Duplicate integration request suppressed (key={Key})", key);
            return Task.FromResult(true);
        }

        _seen[key] = now.Add(_ttl);
        return Task.FromResult(false);
    }
}

/// <summary>
/// Tries DB first; if the idempotency table is missing, falls back to memory and logs once.
/// </summary>
public sealed class ResilientIntegrationIdempotencyGuard : IIntegrationIdempotencyGuard
{
    private readonly DbIntegrationIdempotencyGuard _db;
    private readonly MemoryIntegrationIdempotencyGuard _memory;
    private readonly ILogger<ResilientIntegrationIdempotencyGuard> _log;
    private int _fallbackLogged;

    public ResilientIntegrationIdempotencyGuard(
        DbIntegrationIdempotencyGuard db,
        MemoryIntegrationIdempotencyGuard memory,
        ILogger<ResilientIntegrationIdempotencyGuard> log)
    {
        _db = db;
        _memory = memory;
        _log = log;
    }

    public async Task<bool> IsDuplicateAsync(string? idempotencyKey, CancellationToken ct = default)
    {
        try
        {
            return await _db.IsDuplicateAsync(idempotencyKey, ct);
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UndefinedTable)
        {
            if (Interlocked.Exchange(ref _fallbackLogged, 1) == 0)
            {
                _log.LogWarning(
                    "ccms_integration_idempotency missing — falling back to in-memory idempotency. Apply database_migrations/schema/ccms_integration_idempotency_p0.sql");
            }
            return await _memory.IsDuplicateAsync(idempotencyKey, ct);
        }
    }
}
