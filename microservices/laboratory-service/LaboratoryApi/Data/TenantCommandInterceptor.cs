using System.Data.Common;
using LaboratoryApi.Services;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace LaboratoryApi.Data;

/// <summary>
/// Sets PostgreSQL RLS session variable before commands (same pattern as CCMS / IP).
/// </summary>
public class TenantCommandInterceptor : DbCommandInterceptor
{
    private readonly TenantContext _tenantCtx;

    public TenantCommandInterceptor(TenantContext tenantCtx)
    {
        _tenantCtx = tenantCtx;
    }

    public override async ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
        DbCommand command, CommandEventData eventData,
        InterceptionResult<DbDataReader> result,
        CancellationToken cancellationToken = default)
    {
        await SetRlsAsync(command, cancellationToken);
        return await base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
    }

    public override InterceptionResult<DbDataReader> ReaderExecuting(
        DbCommand command, CommandEventData eventData,
        InterceptionResult<DbDataReader> result)
    {
        SetRls(command);
        return base.ReaderExecuting(command, eventData, result);
    }

    public override async ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(
        DbCommand command, CommandEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        await SetRlsAsync(command, cancellationToken);
        return await base.NonQueryExecutingAsync(command, eventData, result, cancellationToken);
    }

    public override InterceptionResult<int> NonQueryExecuting(
        DbCommand command, CommandEventData eventData,
        InterceptionResult<int> result)
    {
        SetRls(command);
        return base.NonQueryExecuting(command, eventData, result);
    }

    private void SetRls(DbCommand command)
    {
        if (_tenantCtx.TenantId is not { } tid) return;

        var cmd = command.Connection?.CreateCommand();
        if (cmd is null) return;
        cmd.CommandText = $"SET LOCAL app.current_tenant_id = '{tid}'";
        cmd.Transaction = command.Transaction;
        try
        {
            if (command.Connection?.State == System.Data.ConnectionState.Open)
                cmd.ExecuteNonQuery();
        }
        catch { /* connection may not be open yet */ }
    }

    private async Task SetRlsAsync(DbCommand command, CancellationToken ct)
    {
        if (_tenantCtx.TenantId is not { } tid) return;

        var cmd = command.Connection?.CreateCommand();
        if (cmd is null) return;
        cmd.CommandText = $"SET LOCAL app.current_tenant_id = '{tid}'";
        cmd.Transaction = command.Transaction;
        try
        {
            if (command.Connection?.State == System.Data.ConnectionState.Open)
                await cmd.ExecuteNonQueryAsync(ct);
        }
        catch { /* ignore */ }
    }
}
