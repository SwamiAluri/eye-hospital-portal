using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace LaboratoryApi.Services;

/// <summary>
/// Validates Bearer JWT and extracts claims. Mirrors CCMS / IP / Auth validation parameters.
/// </summary>
public class JwtService
{
    private readonly IConfiguration _config;
    private readonly TenantContext _tenantCtx;

    [ThreadStatic] private static ClaimsPrincipal? _lastPrincipal;

    public JwtService(IConfiguration config, TenantContext tenantCtx)
    {
        _config = config;
        _tenantCtx = tenantCtx;
    }

    public (Guid UserId, Guid TenantId) ValidateAndExtract(HttpRequestData request)
    {
        var authHeader = request.Headers
            .TryGetValues("Authorization", out var vals)
                ? vals.FirstOrDefault()
                : null;

        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("Missing or malformed Authorization header.");

        var token = authHeader["Bearer ".Length..].Trim();

        var key = _config["Jwt__Key"] ?? _config["Values:Jwt__Key"]
                  ?? throw new InvalidOperationException("JWT key not configured.");
        var issuer = _config["Jwt__Issuer"] ?? "EyeHospitalAuth";
        var audience = _config["Jwt__Audience"] ?? "EyeHospitalAPI";

        var handler = new JwtSecurityTokenHandler();
        var parameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = issuer,
            ValidateAudience = true,
            ValidAudience = audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(5)
        };

        ClaimsPrincipal principal;
        try
        {
            principal = handler.ValidateToken(token, parameters, out _);
        }
        catch (Exception ex)
        {
            throw new UnauthorizedAccessException($"Token validation failed: {ex.Message}");
        }

        var userIdStr = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value
                        ?? principal.FindFirst("sub")?.Value
                        ?? throw new UnauthorizedAccessException("userId claim missing.");
        var tenantIdStr = principal.FindFirst("tenant_id")?.Value
                          ?? principal.FindFirst("tenantId")?.Value
                          ?? ExtractTenantFromHeader(request)
                          ?? throw new UnauthorizedAccessException("tenantId claim/header missing.");

        if (!Guid.TryParse(userIdStr, out var userId))
            throw new UnauthorizedAccessException("Invalid userId in token.");
        if (!Guid.TryParse(tenantIdStr, out var tenantId))
            throw new UnauthorizedAccessException("Invalid tenantId.");

        var headerTenant = ExtractTenantFromHeader(request);
        if (!string.IsNullOrWhiteSpace(headerTenant)
            && Guid.TryParse(headerTenant, out var headerTenantId)
            && headerTenantId != tenantId)
        {
            throw new UnauthorizedAccessException("X-Tenant-ID does not match JWT tenant_id.");
        }

        _tenantCtx.Set(tenantId);
        _lastPrincipal = principal;
        return (userId, tenantId);
    }

    public string[] GetLastPermissions()
        => _lastPrincipal?.Claims
              .Where(c => c.Type == "permissions" || c.Type == "permission")
              .Select(c => c.Value)
              .ToArray() ?? Array.Empty<string>();

    public bool ValidateAndExtract(HttpRequestData request, out JwtClaims? claims, out string error)
    {
        try
        {
            var (userId, tenantId) = ValidateAndExtract(request);
            claims = new JwtClaims(userId, tenantId, GetLastPermissions());
            error = string.Empty;
            return true;
        }
        catch (Exception ex)
        {
            claims = null;
            error = ex.Message;
            return false;
        }
    }

    public Guid ValidateInternalKey(HttpRequestData request)
    {
        var expectedKey = _config["AuthService:InternalApiKey"]
            ?? _config["AuthService__InternalApiKey"]
            ?? string.Empty;
        request.Headers.TryGetValues("X-Internal-Key", out var keyVals);
        var providedKey = keyVals?.FirstOrDefault() ?? string.Empty;

        if (string.IsNullOrEmpty(expectedKey) || providedKey != expectedKey)
            throw new UnauthorizedAccessException("Invalid internal API key.");

        var tenantIdStr = ExtractTenantFromHeader(request)
                          ?? throw new UnauthorizedAccessException("X-Tenant-ID header missing.");

        if (!Guid.TryParse(tenantIdStr, out var tenantId))
            throw new UnauthorizedAccessException("Invalid X-Tenant-ID.");

        _tenantCtx.Set(tenantId);
        return tenantId;
    }

    private static string? ExtractTenantFromHeader(HttpRequestData request)
    {
        request.Headers.TryGetValues("X-Tenant-ID", out var vals);
        return vals?.FirstOrDefault();
    }
}

public record JwtClaims(Guid UserId, Guid TenantId, string[]? Permissions = null)
{
    public string[] SafePermissions => Permissions ?? Array.Empty<string>();
}
