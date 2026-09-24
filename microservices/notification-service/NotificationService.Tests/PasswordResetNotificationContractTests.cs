using Xunit;

namespace NotificationService.Tests;

/// <summary>
/// Contract tests ensuring AuthService NotificationClient password-reset
/// calls match a real NotificationService HTTP endpoint + email path.
/// </summary>
public class PasswordResetNotificationContractTests
{
    [Fact]
    public void Password_reset_http_function_exists_at_notifications_password_reset()
    {
        var path = LocateFile(Path.Combine("Functions", "PasswordResetNotification.cs"));
        Assert.True(File.Exists(path), $"Expected function at {path}");
        var src = File.ReadAllText(path);

        Assert.Contains("Route = \"notifications/password-reset\"", src, StringComparison.Ordinal);
        Assert.Contains("\"post\"", src, StringComparison.Ordinal);
        Assert.Contains("SendPasswordResetEmailAsync", src, StringComparison.Ordinal);
        Assert.Contains("PasswordResetEmailRequest", src, StringComparison.Ordinal);
        // Do not expose token in responses
        Assert.DoesNotContain("resetToken", src, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("ResetTokenHash", src, StringComparison.Ordinal);
    }

    [Fact]
    public void Password_reset_request_dto_matches_auth_notification_client_payload()
    {
        var path = LocateFile(Path.Combine("Models", "Requests", "PasswordResetEmailRequest.cs"));
        Assert.True(File.Exists(path), $"Expected DTO at {path}");
        var src = File.ReadAllText(path);

        Assert.Contains("UserId", src, StringComparison.Ordinal);
        Assert.Contains("TenantId", src, StringComparison.Ordinal);
        Assert.Contains("Email", src, StringComparison.Ordinal);
        Assert.Contains("ResetUrl", src, StringComparison.Ordinal);
        Assert.Contains("UserName", src, StringComparison.Ordinal);
        Assert.Contains("TemplateType", src, StringComparison.Ordinal);
    }

    [Fact]
    public void IEmailService_declares_SendPasswordResetEmailAsync()
    {
        var path = LocateFile(Path.Combine("Services", "Email", "IEmailService.cs"));
        Assert.True(File.Exists(path));
        var src = File.ReadAllText(path);

        Assert.Contains("SendPasswordResetEmailAsync", src, StringComparison.Ordinal);
        Assert.Contains("toEmail", src, StringComparison.Ordinal);
        Assert.Contains("userName", src, StringComparison.Ordinal);
        Assert.Contains("resetUrl", src, StringComparison.Ordinal);
    }

    [Fact]
    public void AzureEmailService_implements_password_reset_template_with_reset_url_variable()
    {
        var path = LocateFile(Path.Combine("Services", "Email", "AzureEmailService.cs"));
        Assert.True(File.Exists(path));
        var src = File.ReadAllText(path);

        Assert.Contains("SendPasswordResetEmailAsync", src, StringComparison.Ordinal);
        Assert.Contains("resetUrl", src, StringComparison.Ordinal);
        Assert.Contains("Password Reset", src, StringComparison.OrdinalIgnoreCase);
        // Must not log the raw reset URL (token-bearing)
        var methodStart = src.IndexOf("SendPasswordResetEmailAsync", StringComparison.Ordinal);
        Assert.True(methodStart >= 0);
        var nextMethod = src.IndexOf("public async Task", methodStart + 1, StringComparison.Ordinal);
        if (nextMethod < 0)
            nextMethod = src.IndexOf("private async Task", methodStart + 1, StringComparison.Ordinal);
        var methodSrc = nextMethod > methodStart
            ? src.Substring(methodStart, nextMethod - methodStart)
            : src.Substring(methodStart);
        Assert.DoesNotContain("LogInformation(\"{ResetUrl}", methodSrc, StringComparison.Ordinal);
        Assert.DoesNotContain("LogWarning(\"   Reset URL:", methodSrc, StringComparison.Ordinal);
    }

    [Fact]
    public void ResendEmailService_implements_SendPasswordResetEmailAsync()
    {
        var path = LocateFile(Path.Combine("Services", "Email", "ResendEmailService.cs"));
        Assert.True(File.Exists(path));
        var src = File.ReadAllText(path);
        Assert.Contains("SendPasswordResetEmailAsync", src, StringComparison.Ordinal);
    }

    [Fact]
    public void Provider_failure_returns_non_success_without_exposing_credentials()
    {
        var path = LocateFile(Path.Combine("Functions", "PasswordResetNotification.cs"));
        Assert.True(File.Exists(path), $"Expected function at {path}");
        var src = File.ReadAllText(path);

        Assert.Contains("HttpStatusCode.BadGateway", src, StringComparison.Ordinal);
        Assert.Contains("success = false", src, StringComparison.Ordinal);
        Assert.DoesNotContain("ConnectionString", src, StringComparison.Ordinal);
        Assert.DoesNotContain("ApiKey", src, StringComparison.Ordinal);
        Assert.DoesNotContain("accesskey", src, StringComparison.OrdinalIgnoreCase);
    }

    private static string LocateFile(
        string relativeUnderNotificationService,
        [System.Runtime.CompilerServices.CallerFilePath] string callerFilePath = "")
    {
        var relativeCandidates = new[]
        {
            Path.Combine("microservices", "notification-service", "NotificationService", relativeUnderNotificationService),
            Path.Combine("NotificationService", relativeUnderNotificationService),
        };

        var roots = new List<DirectoryInfo> { new(AppContext.BaseDirectory) };
        try
        {
            roots.Add(new DirectoryInfo(Directory.GetCurrentDirectory()));
        }
        catch { /* ignore */ }

        if (!string.IsNullOrWhiteSpace(callerFilePath))
        {
            try
            {
                roots.Add(new DirectoryInfo(Path.GetDirectoryName(Path.GetFullPath(callerFilePath))!));
            }
            catch { /* ignore */ }
        }

        foreach (var root in roots.DistinctBy(r => r.FullName, StringComparer.OrdinalIgnoreCase))
        {
            var dir = root;
            while (dir != null)
            {
                foreach (var rel in relativeCandidates)
                {
                    var candidate = Path.GetFullPath(Path.Combine(dir.FullName, rel));
                    if (File.Exists(candidate)) return candidate;
                }
                dir = dir.Parent;
            }
        }

        return Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, relativeCandidates[0]));
    }
}
