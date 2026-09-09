using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace CcmsApi.Tests.Helpers;

internal static class TestJwtFactory
{
    public static string CreateBearerToken(Guid userId, Guid tenantId, IConfiguration config)
    {
        var key = config["Jwt__Key"] ?? "your-secret-key-min-32-characters-change-this";
        var handler = new JwtSecurityTokenHandler();
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim("tenant_id", tenantId.ToString()),
            ]),
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
