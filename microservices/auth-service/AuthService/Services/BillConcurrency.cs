using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace AuthService.Services;

/// <summary>BILL-030 optimistic concurrency on <c>opd_bills.row_version</c>.</summary>
public static class BillConcurrency
{
    public const string StaleMessage = "This bill was updated by another user.";

    public static bool IsStale(Exception ex)
        => ex is InvalidOperationException && ex.Message == StaleMessage;

    /// <summary>
    /// Unique-index collision on payment/item idempotency (or Postgres 23505).
    /// Callers replay the existing row instead of inserting a second money line.
    /// </summary>
    public static bool IsUniqueViolation(DbUpdateException ex)
    {
        for (Exception? e = ex; e is not null; e = e.InnerException)
        {
            if (e is PostgresException pg && pg.SqlState == PostgresErrorCodes.UniqueViolation)
                return true;
            var msg = e.Message;
            if (msg.Contains("23505", StringComparison.Ordinal)
                || msg.Contains("duplicate key", StringComparison.OrdinalIgnoreCase)
                || msg.Contains("unique constraint", StringComparison.OrdinalIgnoreCase)
                || msg.Contains("UNIQUE constraint", StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }
}
