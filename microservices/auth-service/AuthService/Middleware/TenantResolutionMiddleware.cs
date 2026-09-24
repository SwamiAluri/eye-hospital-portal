using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using AuthService.Context;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Middleware
{
    public class TenantResolutionMiddleware
    {
        private readonly RequestDelegate _next;

        public TenantResolutionMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context, AppDbContext dbContext)
        {
            var tenantHeader = context.Request.Headers["X-Tenant-ID"].ToString();
            
            // Skip tenant check for these paths
            if (context.Request.Path.StartsWithSegments("/swagger") ||
                context.Request.Path.StartsWithSegments("/favicon.ico") ||
                context.Request.Path.StartsWithSegments("/_next") ||
                context.Request.Path.StartsWithSegments("/api/auth/login") ||
                context.Request.Path.StartsWithSegments("/api/auth/debug") ||
                context.Request.Path.StartsWithSegments("/api/tenants/debug/codes") ||
                context.Request.Path.StartsWithSegments("/api/license") || // Allow license endpoints for testing
                context.Request.Path.StartsWithSegments("/api/departments") || // Allow department endpoints for testing
                context.Request.Path.StartsWithSegments("/api/roles") || // Allow roles endpoints for testing
                context.Request.Path.StartsWithSegments("/api/permissions") || // Allow permissions endpoints for testing
                context.Request.Path.StartsWithSegments("/api/appointments") || // Allow appointments endpoints for testing
                context.Request.Path.StartsWithSegments("/api/SeedData") || // Allow seed data endpoint for testing
                context.Request.Path.StartsWithSegments("/hubs") || // Skip SignalR hubs - tenant resolved from JWT
                context.Request.Path.StartsWithSegments("/notificationHub") || // Skip NotificationHub - tenant from JWT claim
                context.Request.Path.StartsWithSegments("/api/servicecatalog") || // Global catalog - no tenant context needed
                context.Request.Path.StartsWithSegments("/api/internal") || // service-to-service; tenant is in body/query + X-Internal-Key
                (context.Request.Path.StartsWithSegments("/api/tenants") && context.Request.Method == "GET") ||
                IsAnonymousActivationPath(context.Request.Path) ||
                IsAnonymousPasswordResetPath(context.Request.Path))
            {
                await _next(context);
                return;
            }

            if (string.IsNullOrEmpty(tenantHeader))
            {
                context.Response.StatusCode = 400;
                await context.Response.WriteAsJsonAsync(new { message = "Tenant ID is required" });
                return;
            }

            if (!Guid.TryParse(tenantHeader, out var tenantId))
            {
                context.Response.StatusCode = 400;
                await context.Response.WriteAsJsonAsync(new { message = "Invalid tenant ID format" });
                return;
            }

            var tenant = await dbContext.Tenants
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == tenantId);

            if (tenant == null)
            {
                context.Response.StatusCode = 404;
                await context.Response.WriteAsJsonAsync(new { message = "Tenant not found" });
                return;
            }

            if (!tenant.IsActive)
            {
                context.Response.StatusCode = 403;
                await context.Response.WriteAsJsonAsync(new { message = "Tenant is inactive" });
                return;
            }

            // Store tenant information in the HttpContext for use in controllers
            context.Items["TenantId"] = tenantId;
            context.Items["Tenant"] = tenant;

            await _next(context);
        }

        /// <summary>
        /// /activate wizard is anonymous: tenant comes from the user/OTP identity, not login store.
        /// These AllowAnonymous Auth endpoints must not require X-Tenant-ID from an unauthenticated browser.
        /// </summary>
        internal static bool IsAnonymousActivationPath(PathString path)
        {
            var value = path.Value ?? string.Empty;
            return value.Contains("/set-activation-password", StringComparison.OrdinalIgnoreCase)
                || value.Contains("/accept-terms", StringComparison.OrdinalIgnoreCase)
                || value.Contains("/complete-activation", StringComparison.OrdinalIgnoreCase)
                || value.Contains("/professional-info", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Password-reset email links are anonymous: tenant is derived from the opaque reset token
        /// (user lookup) or supplied in the ForgotPassword request body — not from login X-Tenant-ID.
        /// </summary>
        internal static bool IsAnonymousPasswordResetPath(PathString path)
        {
            var value = path.Value ?? string.Empty;
            return value.Contains("/api/auth/forgot-password", StringComparison.OrdinalIgnoreCase)
                || value.Contains("/api/auth/validate-reset-token", StringComparison.OrdinalIgnoreCase)
                || value.Contains("/api/auth/reset-password", StringComparison.OrdinalIgnoreCase);
        }
    }

    // Extension method for easy middleware registration
    public static class TenantResolutionMiddlewareExtensions
    {
        public static IApplicationBuilder UseTenantResolution(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<TenantResolutionMiddleware>();
        }
    }
}