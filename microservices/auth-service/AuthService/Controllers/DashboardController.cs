using AuthService.Authorization;
using AuthService.Context;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AuthService.Controllers;

[Authorize]
[ApiController]
[Route("api/admin/dashboard")]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboardService;
    private readonly AppDbContext _context;

    public DashboardController(IDashboardService dashboardService, AppDbContext context)
    {
        _dashboardService = dashboardService;
        _context = context;
    }

    private Guid GetTenantId()
    {
        var tenantIdClaim = User.FindFirst("TenantId")?.Value 
            ?? User.FindFirst("tenantId")?.Value
            ?? User.FindFirst("tenant_id")?.Value; // Added for JWT compatibility
        
        if (string.IsNullOrEmpty(tenantIdClaim) || !Guid.TryParse(tenantIdClaim, out var tenantId))
        {
            throw new UnauthorizedAccessException("Tenant ID not found in token");
        }
        
        return tenantId;
    }

    [HttpGet("overview")]
    [RequirePermission("dashboard.view")]
    public async Task<IActionResult> GetOverviewStats()
    {
        try
        {
            var tenantId = GetTenantId();
            var stats = await _dashboardService.GetOverviewStatsAsync(tenantId);
            return Ok(stats);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred while fetching overview stats", error = ex.Message });
        }
    }

    [HttpGet("quick-stats")]
    [RequirePermission("dashboard.view")]
    public async Task<IActionResult> GetQuickStats()
    {
        try
        {
            var tenantId = GetTenantId();
            var stats = await _dashboardService.GetQuickStatsAsync(tenantId);
            return Ok(stats);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred while fetching quick stats", error = ex.Message });
        }
    }

    [HttpGet("recent-activities")]
    [RequirePermission("dashboard.view")]
    public async Task<IActionResult> GetRecentActivities([FromQuery] int limit = 10)
    {
        try
        {
            var tenantId = GetTenantId();
            var activities = await _dashboardService.GetRecentActivitiesAsync(tenantId, limit);
            return Ok(activities);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred while fetching recent activities", error = ex.Message });
        }
    }

    [HttpGet("alerts")]
    [RequirePermission("dashboard.view")]
    public async Task<IActionResult> GetAlerts()
    {
        try
        {
            var tenantId = GetTenantId();
            var alerts = await _dashboardService.GetAlertsAsync(tenantId);
            return Ok(alerts);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred while fetching alerts", error = ex.Message });
        }
    }

    [HttpDelete("alerts/{id}")]
    [RequirePermission("dashboard.manage")]
    public async Task<IActionResult> DismissAlert(Guid id)
    {
        try
        {
            var tenantId = GetTenantId();
            var result = await _dashboardService.DismissAlertAsync(id, tenantId);
            
            if (result)
            {
                return Ok(new { message = "Alert dismissed successfully" });
            }
            
            return NotFound(new { message = "Alert not found" });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred while dismissing alert", error = ex.Message });
        }
    }

    [HttpGet("activity-series")]
    [RequirePermission("dashboard.view")]
    public async Task<IActionResult> GetActivitySeries([FromQuery] int hours = 24)
    {
        try
        {
            var tenantId = GetTenantId();
            var series = await _dashboardService.GetActivitySeriesAsync(tenantId, Math.Clamp(hours, 1, 168));
            return Ok(series);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred while fetching activity series", error = ex.Message });
        }
    }

    [HttpGet("stats")]
    [RequirePermission("dashboard.view")]
    public async Task<IActionResult> GetStats()
    {
        try
        {
            var tenantId = GetTenantId();
            
            var stats = new {
                TotalStaff = await _context.Users
                    .CountAsync(u => u.TenantId == tenantId && u.DeletedAt == null),
                TotalDepartments = await _context.Departments
                    .CountAsync(d => d.TenantId == tenantId && d.DeletedAt == null),
                TotalRoles = await _context.Roles
                    .CountAsync(r => r.TenantId == tenantId && r.DeletedAt == null),
                TotalBranches = await _context.Branches
                    .CountAsync(b => b.TenantId == tenantId && b.DeletedAt == null),
                DepartmentStats = await _context.Departments
                    .Where(d => d.TenantId == tenantId && d.DeletedAt == null)
                    .Select(d => new {
                        d.DepartmentName,
                        StaffCount = _context.UserDepartments
                            .Count(ud => ud.DepartmentId == d.Id && ud.DeletedAt == null)
                    })
                    .Where(d => d.StaffCount > 0)
                    .OrderByDescending(d => d.StaffCount)
                    .Take(10)
                    .ToListAsync(),
                RoleStats = await _context.Roles
                    .Where(r => r.TenantId == tenantId && r.DeletedAt == null)
                    .Select(r => new {
                        r.Name,
                        UserCount = _context.UserRoles.Count(ur => ur.RoleId == r.Id)
                    })
                    .Where(r => r.UserCount > 0)
                    .OrderByDescending(r => r.UserCount)
                    .Take(10)
                    .ToListAsync(),
                BranchStats = await _context.Branches
                    .Where(b => b.TenantId == tenantId && b.DeletedAt == null)
                    .Select(b => new {
                        b.Name,
                        StaffCount = _context.UserBranches
                            .Count(ub => ub.BranchId == b.Id)
                    })
                    .OrderByDescending(b => b.StaffCount)
                    .ToListAsync()
            };

            return Ok(stats);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred while fetching dashboard stats", error = ex.Message });
        }
    }
}
