using IpManagementService.Services;
using Xunit;

namespace IpManagementService.Tests;

public class BrowserOriginTests
{
    [Fact]
    public void OriginHeader_IsTreatedAsBrowser()
    {
        Assert.True(BrowserOrigin.LooksLikeBrowser(name => name == "Origin" ? "https://portal.local" : null));
    }

    [Fact]
    public void SecFetchSiteCrossSite_IsTreatedAsBrowser()
    {
        Assert.True(BrowserOrigin.LooksLikeBrowser(name => name == "Sec-Fetch-Site" ? "same-origin" : null));
    }

    [Fact]
    public void InternalCallWithoutCorsHeaders_IsNotBrowser()
    {
        Assert.False(BrowserOrigin.LooksLikeBrowser(_ => null));
        Assert.False(BrowserOrigin.LooksLikeBrowser(name => name == "Sec-Fetch-Site" ? "none" : null));
        Assert.False(BrowserOrigin.LooksLikeBrowser(name => name == "User-Agent" ? "AuthBillingClient/1.0" : null));
    }

    [Fact]
    public void AddBilling_ReturnsGoneForBrowserCallers()
    {
        var src = File.ReadAllText(Path.Combine(
            SchemaDrift.FindRepoRoot(),
            "microservices", "ip-management-service", "IpManagementService", "Functions",
            "JourneyFunctions.cs"));
        Assert.Contains("LooksLikeBrowser(req)", src);
        Assert.Contains("HttpStatusCode.Gone", src);
        Assert.Contains("This billing endpoint is retired", src);
    }
}
