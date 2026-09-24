using AuthService.Middleware;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Anonymous /activate wizard calls Auth without a logged-in X-Tenant-ID.
/// Middleware must allow those endpoints; tenant is resolved from the user record.
/// </summary>
public class ActivationTenantMiddlewareContractTests
{
    [Theory]
    [InlineData("/api/users/074c4154-103c-44ec-b8ac-17081795e9a3/set-activation-password", true)]
    [InlineData("/api/users/074c4154-103c-44ec-b8ac-17081795e9a3/accept-terms", true)]
    [InlineData("/api/users/074c4154-103c-44ec-b8ac-17081795e9a3/complete-activation", true)]
    [InlineData("/api/users/074c4154-103c-44ec-b8ac-17081795e9a3/professional-info", true)]
    [InlineData("/api/users", false)]
    [InlineData("/api/users/074c4154-103c-44ec-b8ac-17081795e9a3", false)]
    [InlineData("/api/auth/login", false)]
    public void IsAnonymousActivationPath_matches_only_activation_steps(string path, bool expected)
    {
        Assert.Equal(expected, TenantResolutionMiddleware.IsAnonymousActivationPath(new PathString(path)));
    }

    [Fact]
    public void TenantResolutionMiddleware_source_skips_activation_anonymous_paths()
    {
        var path = LocateMiddlewareSource();
        Assert.True(File.Exists(path), $"Expected middleware at {path}");
        var src = File.ReadAllText(path);

        Assert.Contains("IsAnonymousActivationPath", src, StringComparison.Ordinal);
        Assert.Contains("set-activation-password", src, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("accept-terms", src, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("complete-activation", src, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Tenant ID is required", src, StringComparison.Ordinal);
    }

    [Fact]
    public void Activate_page_retains_tenantId_from_token_validation_and_sends_header()
    {
        var path = LocateActivatePage();
        Assert.True(File.Exists(path), $"Expected activate page at {path}");
        var src = File.ReadAllText(path);

        Assert.Contains("setTenantId", src, StringComparison.Ordinal);
        Assert.Contains("data.tenantId", src, StringComparison.Ordinal);
        Assert.Contains("X-Tenant-ID", src, StringComparison.Ordinal);
        Assert.Contains("activationAuthHeaders", src, StringComparison.Ordinal);
        Assert.Contains("set-activation-password", src, StringComparison.Ordinal);
        Assert.Contains("complete-activation", src, StringComparison.Ordinal);
    }

    private static string LocateMiddlewareSource()
    {
        return LocateUpwards(
            Path.Combine("microservices", "auth-service", "AuthService", "Middleware", "TenantResolutionMiddleware.cs"),
            Path.Combine("AuthService", "Middleware", "TenantResolutionMiddleware.cs"));
    }

    private static string LocateActivatePage()
    {
        return LocateUpwards(
            Path.Combine("apps", "hospital-portal-web", "src", "app", "activate", "page.tsx"),
            Path.Combine("..", "..", "..", "apps", "hospital-portal-web", "src", "app", "activate", "page.tsx"));
    }

    private static string LocateUpwards(params string[] relativeCandidates)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            foreach (var rel in relativeCandidates)
            {
                var candidate = Path.GetFullPath(Path.Combine(dir.FullName, rel));
                if (File.Exists(candidate)) return candidate;
            }
            dir = dir.Parent;
        }
        return Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, relativeCandidates[0]));
    }
}
