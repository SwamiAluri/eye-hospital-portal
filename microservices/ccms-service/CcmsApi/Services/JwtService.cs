using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Azure.Functions.Worker.Http;

namespace CcmsApi.Services;

/// <summary>
/// Validates the Bearer JWT from the Authorization header and extracts claims.
/// Mirrors the same validation logic used in auth-service, counselling-service,
/// and ip-management-service.
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
    /// Also sets TenantContext so TenantCommandInterceptor picks it up.
    /// </summary>
    public (Guid UserId, Guid TenantId) ValidateAndExtract(HttpRequestData request)
    {
        var authHeader = request.Headers
            .TryGetValues("Authorization", out var vals)
                ? vals.FirstOrDefault()
                : null;

        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("Missing or malformed Authorization header.");

        var token = authHeader["Bearer ".Length..].Trim();

        var key      = _config["Jwt__Key"] ?? _config["Values:Jwt__Key"]
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
            ClockSkew                = TimeSpan.FromMinutes(5)
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

        var userIdStr   = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value
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

        _tenantCtx.Set(tenantId);
        _lastPrincipal = principal;
        return (userId, tenantId);
    }

    // Cache the last validated principal for permission extraction
    [ThreadStatic] private static ClaimsPrincipal? _lastPrincipal;

    /// <summary>Returns permission codes from the last validated JWT (thread-local).</summary>
    public string[] GetLastPermissions()
        => _lastPrincipal?.Claims
              .Where(c => c.Type == "permissions" || c.Type == "permission")
              .Select(c => c.Value)
              .ToArray() ?? Array.Empty<string>();

    /// <summary>
    /// For internal service-to-service calls that use X-Internal-Key instead of JWT.
    /// Returns the tenantId from the X-Tenant-ID header.
    /// </summary>
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

    /// <summary>Bool overload for try-pattern usage: if (!_jwt.ValidateAndExtract(req, out var claims, out var err))</summary>
    public bool ValidateAndExtract(HttpRequestData request, out JwtClaims? claims, out string error)
    {
        try
        {
            var (userId, tenantId) = ValidateAndExtract(request);
            claims = new JwtClaims(userId, tenantId, GetLastPermissions());
            error  = string.Empty;
            return true;
        }
        catch (Exception ex)
        {
            claims = null;
            error  = ex.Message;
            return false;
        }
    }

    /// <summary>Returns true if the internal API key is valid (non-throwing overload).</summary>
    public bool TryValidateInternalKey(HttpRequestData request)
    {
        try { ValidateInternalKey(request); return true; }
        catch { return false; }
    }

    private static string? ExtractTenantFromHeader(HttpRequestData request)
    {
        request.Headers.TryGetValues("X-Tenant-ID", out var vals);
        return vals?.FirstOrDefault();
    }
}

/// <summary>Extracted JWT claims returned by the bool overload of ValidateAndExtract.</summary>
public record JwtClaims(Guid UserId, Guid TenantId, string[]? Permissions = null)
{
    public string[] SafePermissions => Permissions ?? Array.Empty<string>();
}
