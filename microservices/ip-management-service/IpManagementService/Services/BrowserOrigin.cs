using Microsoft.Azure.Functions.Worker.Http;

namespace IpManagementService.Services;

/// <summary>
/// Distinguishes a browser call (CORS Origin / Fetch metadata) from an
/// internal service-to-service call. Browser callers of the retired
/// journey billing POST receive 410 Gone; UAT/internal callers continue.
/// </summary>
public static class BrowserOrigin
{
    public static bool LooksLikeBrowser(HttpRequestData request)
        => LooksLikeBrowser(name => request.Headers.TryGetValues(name, out var values)
            ? values.FirstOrDefault()
            : null);

    public static bool LooksLikeBrowser(Func<string, string?> header)
    {
        if (!string.IsNullOrWhiteSpace(header("Origin"))) return true;
        var site = header("Sec-Fetch-Site");
        return !string.IsNullOrWhiteSpace(site)
            && !string.Equals(site, "none", StringComparison.OrdinalIgnoreCase);
    }
}
