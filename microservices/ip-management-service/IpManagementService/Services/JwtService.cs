using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Azure.Functions.Worker.Http;

namespace IpManagementService.Services;

/// <summary>
/// Validates the Bearer JWT from the Authorization header and extracts claims.
/// Mirrors the same validation logic used in the auth-service and counselling-service.
/// </summary>
public class JwtService
{
    private readonly IConfiguration _config;

    private readonly TenantContext _tenantCtx;

    public JwtService(IConfiguration config, TenantContext tenantCtx)
    {
        _config    = config;
        _tenantCtx = tenantCtx;
    }

    /// <summary>
    /// Returns (userId, tenantId) if the token is valid.
    /// Throws UnauthorizedAccessException when invalid.
    /// </summary>
    public (Guid UserId, Guid TenantId) ValidateAndExtract(HttpRequestData request)
    {
        var principal = ValidatePrincipal(request);

        var userIdStr  = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value
                       ?? principal.FindFirst("sub")?.Value
                       ?? throw new UnauthorizedAccessException("Token missing user ID claim.");

        var tenantIdStr = principal.FindFirst("tenant_id")?.Value
                        ?? throw new UnauthorizedAccessException("Token missing tenant_id claim.");

        if (!Guid.TryParse(userIdStr, out var userId) || !Guid.TryParse(tenantIdStr, out var tenantId))
            throw new UnauthorizedAccessException("Token claims contain invalid GUIDs.");

        return (userId, tenantId);
    }

    public ClaimsPrincipal ValidatePrincipal(HttpRequestData request)
    {
        var authHeader = request.Headers
            .TryGetValues("Authorization", out var vals)
                ? vals.FirstOrDefault()
                : null;

        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("Missing or malformed Authorization header.");

        var token = authHeader["Bearer ".Length..].Trim();

        var key   = _config["Jwt__Key"] ?? _config["Values:Jwt__Key"]
                    ?? throw new InvalidOperationException("JWT key not configured.");
        var issuer   = _config["Jwt__Issuer"]   ?? "EyeHospitalAuth";
        var audience = _config["Jwt__Audience"] ?? "EyeHospitalAPI";

        var handler = new JwtSecurityTokenHandler();
        var parameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidIssuer              = issuer,
            ValidateAudience         = true,
            ValidAudience            = audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            ValidateLifetime         = true,
            ClockSkew                = TimeSpan.FromMinutes(5),
        };

        try
        {
            return handler.ValidateToken(token, parameters, out _);
        }
        catch (Exception ex)
        {
            throw new UnauthorizedAccessException($"Invalid token: {ex.Message}");
        }
    }

    public IReadOnlyList<string> ExtractRoles(HttpRequestData request)
        => IpChecklistAuth.ExtractRoles(ValidatePrincipal(request));

    public IReadOnlyList<string> ExtractPermissions(HttpRequestData request)
        => IpChecklistAuth.ExtractPermissions(ValidatePrincipal(request));

    public string? PrimaryRole(HttpRequestData request)
        => ExtractRoles(request).FirstOrDefault();

    /// <summary>
    /// Extracts tenant-id from X-Tenant-ID header (used alongside JWT for multi-tenancy).
    /// Falls back to the tenant_id in the JWT claim.
    /// </summary>
    public Guid ExtractTenantId(HttpRequestData request, Guid jwtTenantId)
    {
        Guid resolved;
        if (request.Headers.TryGetValues("X-Tenant-ID", out var vals))
        {
            var raw = vals.FirstOrDefault();
            if (Guid.TryParse(raw, out var headerTenant))
            {
                // Security: ensure header tenant matches JWT claim (no tenant hopping)
                if (headerTenant != jwtTenantId)
                    throw new UnauthorizedAccessException(
                        "X-Tenant-ID header does not match authenticated tenant.");
                resolved = headerTenant;
            }
            else
            {
                resolved = jwtTenantId;
            }
        }
        else
        {
            resolved = jwtTenantId;
        }

        // Set RLS tenant context so TenantCommandInterceptor fires SET LOCAL before every query
        _tenantCtx.Set(resolved);
        return resolved;
    }
}
