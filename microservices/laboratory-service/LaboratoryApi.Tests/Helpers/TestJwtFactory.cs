using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace LaboratoryApi.Tests.Helpers;

internal static class TestJwtFactory
{
    public const string DefaultKey = "your-secret-key-min-32-characters-change-this";

    public static string CreateBearerToken(
        Guid userId,
        Guid tenantId,
        IConfiguration config,
        params string[] permissions)
    {
        var key = config["Jwt__Key"] ?? config["Values:Jwt__Key"] ?? DefaultKey;
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new("tenant_id", tenantId.ToString()),
        };
        foreach (var p in permissions)
            claims.Add(new Claim("permission", p));

        var handler = new JwtSecurityTokenHandler();
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Issuer = "EyeHospitalAuth",
            Audience = "EyeHospitalAPI",
            Expires = DateTime.UtcNow.AddHours(1),
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
                SecurityAlgorithms.HmacSha256Signature),
        };
        return handler.WriteToken(handler.CreateToken(descriptor));
    }
}
