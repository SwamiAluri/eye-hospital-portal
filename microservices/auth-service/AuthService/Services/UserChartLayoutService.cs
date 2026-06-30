using AuthService.Context;
using AuthService.Models.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace AuthService.Services;

public interface IUserChartLayoutService
{
    Task<string?> GetLayoutJsonAsync(Guid tenantId, Guid userId);
    Task<bool> SaveLayoutJsonAsync(Guid tenantId, Guid userId, string layoutJson);
}

public class UserChartLayoutService : IUserChartLayoutService
{
    private readonly AppDbContext _context;
    private readonly ILogger<UserChartLayoutService> _logger;

    public UserChartLayoutService(AppDbContext context, ILogger<UserChartLayoutService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<string?> GetLayoutJsonAsync(Guid tenantId, Guid userId)
    {
        try
        {
            var row = await _context.UserChartLayouts.AsNoTracking()
                .FirstOrDefaultAsync(l => l.TenantId == tenantId && l.UserId == userId);
            return row?.LayoutJson;
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UndefinedTable)
        {
            _logger.LogWarning("user_chart_layout table is unavailable ({SqlState})", ex.SqlState);
            return null;
        }
    }

    public async Task<bool> SaveLayoutJsonAsync(Guid tenantId, Guid userId, string layoutJson)
    {
        try
        {
            var row = await _context.UserChartLayouts
                .FirstOrDefaultAsync(l => l.TenantId == tenantId && l.UserId == userId);

            if (row == null)
            {
                _context.UserChartLayouts.Add(new UserChartLayout
                {
                    TenantId = tenantId,
                    UserId = userId,
                    LayoutJson = layoutJson,
                    UpdatedAt = DateTime.UtcNow,
                });
            }
            else
            {
                row.LayoutJson = layoutJson;
                row.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return true;
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UndefinedTable)
        {
            _logger.LogWarning("user_chart_layout table is unavailable ({SqlState})", ex.SqlState);
            return false;
        }
    }
}
