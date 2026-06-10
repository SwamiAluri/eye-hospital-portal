using System.Security.Cryptography;
using System.Text;
using Microsoft.Azure.Functions.Worker.Http;

namespace IpManagementService.Services;

/// <summary>
/// Validates inbound LIS / imaging webhooks via X-Api-Key or X-Signature (HMAC-SHA256).
/// Falls back to JWT when webhook credentials are absent or not supplied.
/// </summary>
public static class IntegrationWebhookAuth
{
    public const string ApiKeyHeader     = "X-Api-Key";
    public const string SignatureHeader  = "X-Signature";
    public const string TenantHeader     = "X-Tenant-ID";
    public const string ApiKeyEnvVar     = "INTEGRATION_WEBHOOK_API_KEY";
    public const string HmacSecretEnvVar = "INTEGRATION_WEBHOOK_HMAC_SECRET";

    public static bool IsWebhookAuthConfigured()
        => !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(ApiKeyEnvVar))
           || !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(HmacSecretEnvVar));

    public static bool UsesWebhookCredentials(HttpRequestData req)
        => IsWebhookAuthConfigured() && TryValidateWebhook(req);

    public static void RequireWebhookOrJwt(HttpRequestData req, JwtService jwt)
    {
        if (UsesWebhookCredentials(req))
            return;

        jwt.ValidateAndExtract(req);
    }

    public static Guid ExtractTenantId(HttpRequestData req, JwtService jwt, Guid jwtTenantId)
    {
        if (UsesWebhookCredentials(req)
            && req.Headers.TryGetValues(TenantHeader, out var tenants)
            && Guid.TryParse(tenants.FirstOrDefault(), out var headerTenant))
            return headerTenant;

        return jwt.ExtractTenantId(req, jwtTenantId);
    }

    public static bool TryValidateWebhook(HttpRequestData req)
    {
        var apiKey = Environment.GetEnvironmentVariable(ApiKeyEnvVar);
        if (!string.IsNullOrWhiteSpace(apiKey)
            && req.Headers.TryGetValues(ApiKeyHeader, out var keys)
            && keys.Any(k => string.Equals(k, apiKey, StringComparison.Ordinal)))
            return true;

        var secret = Environment.GetEnvironmentVariable(HmacSecretEnvVar);
        if (!string.IsNullOrWhiteSpace(secret)
            && req.Headers.TryGetValues(SignatureHeader, out var sigs)
            && req.Body.CanRead)
        {
            using var ms = new MemoryStream();
            req.Body.CopyTo(ms);
            var body = ms.ToArray();
            req.Body.Position = 0;

            var expected = ComputeHmacHex(secret, body);
            return sigs.Any(s => FixedTimeEquals(s.Trim(), expected));
        }

        return false;
    }

    private static string ComputeHmacHex(string secret, byte[] body)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        return Convert.ToHexString(hmac.ComputeHash(body)).ToLowerInvariant();
    }

    private static bool FixedTimeEquals(string a, string b)
    {
        if (a.Length != b.Length) return false;
        var diff = 0;
        for (var i = 0; i < a.Length; i++)
            diff |= a[i] ^ b[i];
        return diff == 0;
    }
}
