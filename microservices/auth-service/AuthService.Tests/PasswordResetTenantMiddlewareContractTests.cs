using AuthService.Middleware;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Email reset links and self-service forgot-password must not require X-Tenant-ID
/// from an unauthenticated browser. Controllers remain the SoT for token/tenant rules.
/// </summary>
public class PasswordResetTenantMiddlewareContractTests
{
    [Theory]
    [InlineData("/api/auth/forgot-password", true)]
    [InlineData("/api/auth/validate-reset-token", true)]
    [InlineData("/api/auth/reset-password", true)]
    [InlineData("/api/Auth/Validate-Reset-Token", true)]
    [InlineData("/api/auth/login", false)]
    [InlineData("/api/users/074c4154-103c-44ec-b8ac-17081795e9a3/reset-password", false)]
    [InlineData("/api/users", false)]
    public void IsAnonymousPasswordResetPath_matches_only_public_reset_endpoints(string path, bool expected)
    {
        Assert.Equal(expected, TenantResolutionMiddleware.IsAnonymousPasswordResetPath(new PathString(path)));
    }

    [Fact]
    public void TenantResolutionMiddleware_source_skips_anonymous_password_reset_paths()
    {
        var path = LocateMiddlewareSource();
        Assert.True(File.Exists(path), $"Expected middleware at {path}");
        var src = File.ReadAllText(path);

        Assert.Contains("IsAnonymousPasswordResetPath", src, StringComparison.Ordinal);
        Assert.Contains("forgot-password", src, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("validate-reset-token", src, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("/api/auth/reset-password", src, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Validate_and_reset_password_requests_are_token_only_no_tenant_dto()
    {
        var path = LocateAuthControllerSource();
        Assert.True(File.Exists(path), $"Expected AuthController at {path}");
        var src = File.ReadAllText(path);

        Assert.Contains("class ValidateResetTokenRequest", src, StringComparison.Ordinal);
        Assert.Contains("class ResetPasswordRequest", src, StringComparison.Ordinal);
        Assert.Contains("class ForgotPasswordRequest", src, StringComparison.Ordinal);

        var validateStart = src.IndexOf("class ValidateResetTokenRequest", StringComparison.Ordinal);
        var validateEnd = src.IndexOf("class RefreshTokenRequest", validateStart, StringComparison.Ordinal);
        Assert.True(validateStart >= 0 && validateEnd > validateStart);
        var validateBlock = src.Substring(validateStart, validateEnd - validateStart);
        Assert.Contains("Token", validateBlock, StringComparison.Ordinal);
        Assert.DoesNotContain("TenantId", validateBlock, StringComparison.Ordinal);

        var resetStart = src.IndexOf("class ResetPasswordRequest", StringComparison.Ordinal);
        var resetEnd = src.IndexOf("class ValidateResetTokenRequest", resetStart, StringComparison.Ordinal);
        Assert.True(resetStart >= 0 && resetEnd > resetStart);
        var resetBlock = src.Substring(resetStart, resetEnd - resetStart);
        Assert.Contains("Token", resetBlock, StringComparison.Ordinal);
        Assert.Contains("NewPassword", resetBlock, StringComparison.Ordinal);
        Assert.DoesNotContain("TenantId", resetBlock, StringComparison.Ordinal);

        var forgotStart = src.IndexOf("class ForgotPasswordRequest", StringComparison.Ordinal);
        var forgotEnd = src.IndexOf("class ResetPasswordRequest", forgotStart, StringComparison.Ordinal);
        Assert.True(forgotStart >= 0 && forgotEnd > forgotStart);
        var forgotBlock = src.Substring(forgotStart, forgotEnd - forgotStart);
        Assert.Contains("TenantId", forgotBlock, StringComparison.Ordinal);
        Assert.Contains("Email", forgotBlock, StringComparison.Ordinal);
    }

    [Fact]
    public void Admin_reset_url_is_token_only_and_uses_real_generated_token()
    {
        var path = LocateUsersControllerSource();
        Assert.True(File.Exists(path), $"Expected UsersController at {path}");
        var src = File.ReadAllText(path);

        var marker = "public async Task<IActionResult> ResetPassword(Guid id)";
        var start = src.IndexOf(marker, StringComparison.Ordinal);
        Assert.True(start >= 0);
        var next = src.IndexOf("public async Task<IActionResult>", start + marker.Length, StringComparison.Ordinal);
        var methodSrc = next > start ? src.Substring(start, next - start) : src.Substring(start);

        Assert.Contains("RandomNumberGenerator.GetBytes(32)", methodSrc, StringComparison.Ordinal);
        Assert.Contains("/auth/reset-password?token=", methodSrc, StringComparison.Ordinal);
        Assert.DoesNotContain("live-verify", methodSrc, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("dummy", methodSrc, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("tenantId=", methodSrc, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Reset_password_page_validates_with_token_only_and_links_to_forgot_password()
    {
        var path = LocateResetPasswordPage();
        Assert.True(File.Exists(path), $"Expected reset page at {path}");
        var src = File.ReadAllText(path);

        Assert.Contains("searchParams.get('token')", src, StringComparison.Ordinal);
        Assert.Contains("'/auth/validate-reset-token'", src, StringComparison.Ordinal);
        Assert.Contains("{ token }", src, StringComparison.Ordinal);
        Assert.Contains("href=\"/auth/forgot-password\"", src, StringComparison.Ordinal);
        Assert.Contains("Request New Reset Link", src, StringComparison.Ordinal);
        Assert.DoesNotContain("tenantId", src, StringComparison.OrdinalIgnoreCase);
    }

    private static string LocateMiddlewareSource() =>
        LocateUpwards(
            Path.Combine("microservices", "auth-service", "AuthService", "Middleware", "TenantResolutionMiddleware.cs"),
            Path.Combine("AuthService", "Middleware", "TenantResolutionMiddleware.cs"));

    private static string LocateAuthControllerSource() =>
        LocateUpwards(
            Path.Combine("microservices", "auth-service", "AuthService", "Controllers", "AuthController.cs"),
            Path.Combine("AuthService", "Controllers", "AuthController.cs"));

    private static string LocateUsersControllerSource() =>
        LocateUpwards(
            Path.Combine("microservices", "auth-service", "AuthService", "Controllers", "UsersController.cs"),
            Path.Combine("AuthService", "Controllers", "UsersController.cs"));

    private static string LocateResetPasswordPage() =>
        LocateUpwards(
            Path.Combine("apps", "hospital-portal-web", "src", "app", "auth", "reset-password", "page.tsx"),
            Path.Combine("..", "..", "..", "apps", "hospital-portal-web", "src", "app", "auth", "reset-password", "page.tsx"));

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
