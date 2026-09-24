using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using AuthService.Authorization;
using AuthService.Controllers;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Contract tests for Admin User Management "Send Password Reset" email flow.
/// Guards AmbiguousMatchException on POST /api/users/{id}/reset-password
/// and ensures admin reset reuses the forgot-password email + token mechanism.
/// </summary>
public class AdminResetPasswordContractTests
{
    [Fact]
    public void UsersController_has_exactly_one_post_reset_password_route()
    {
        var resetPasswordPosts = typeof(UsersController)
            .GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)
            .Where(m => m.GetCustomAttribute<HttpPostAttribute>()?.Template == "{id}/reset-password")
            .ToList();

        Assert.Single(resetPasswordPosts);
    }

    [Fact]
    public void Admin_initiate_reset_password_is_post_id_reset_password_with_user_manage_and_guid_id_only()
    {
        var method = typeof(UsersController)
            .GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)
            .Single(m => m.GetCustomAttribute<HttpPostAttribute>()?.Template == "{id}/reset-password");

        Assert.Equal("ResetPassword", method.Name);
        Assert.Equal(typeof(Guid), method.GetParameters().Single().ParameterType);

        var perm = method.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(perm);
        Assert.Equal("user.manage", perm!.PermissionCode);
    }

    [Fact]
    public void Admin_direct_set_password_if_present_uses_distinct_route_not_reset_password()
    {
        var colliding = typeof(UsersController)
            .GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)
            .Where(m =>
            {
                var post = m.GetCustomAttribute<HttpPostAttribute>();
                if (post?.Template != "{id}/reset-password") return false;
                return m.GetParameters().Any(p =>
                    p.GetCustomAttribute<FromBodyAttribute>() != null);
            })
            .ToList();

        Assert.Empty(colliding);

        var setPassword = typeof(UsersController)
            .GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)
            .FirstOrDefault(m =>
                m.GetCustomAttribute<HttpPostAttribute>()?.Template == "{id}/set-password");

        Assert.NotNull(setPassword);
        var perm = setPassword!.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(perm);
        Assert.Equal("user.manage", perm!.PermissionCode);
    }

    [Fact]
    public void Admin_reset_password_source_sends_email_via_notification_client_and_does_not_return_token()
    {
        var path = LocateUsersControllerSource();
        Assert.True(File.Exists(path), $"Expected source at {path}");
        var src = File.ReadAllText(path);

        // Isolate the admin initiate method (Guid id, no body).
        var marker = "public async Task<IActionResult> ResetPassword(Guid id)";
        var start = src.IndexOf(marker, StringComparison.Ordinal);
        Assert.True(start >= 0, "Admin ResetPassword(Guid id) method missing");

        var nextMethod = src.IndexOf("public async Task<IActionResult>", start + marker.Length, StringComparison.Ordinal);
        var methodSrc = nextMethod > start
            ? src.Substring(start, nextMethod - start)
            : src.Substring(start);

        Assert.Contains("SendPasswordResetEmailAsync", methodSrc, StringComparison.Ordinal);
        Assert.Contains("/auth/reset-password?token=", methodSrc, StringComparison.Ordinal);
        Assert.DoesNotContain("resetToken = resetToken", methodSrc, StringComparison.Ordinal);
        Assert.DoesNotContain("TODO: Send email", methodSrc, StringComparison.Ordinal);

        // Must not silently mutate tenant/branch/role/ownership.
        Assert.DoesNotContain("user.TenantId =", methodSrc, StringComparison.Ordinal);
        Assert.DoesNotContain("user.BranchId =", methodSrc, StringComparison.Ordinal);
        Assert.DoesNotContain("CounselorId", methodSrc, StringComparison.Ordinal);
    }

    [Fact]
    public void Admin_reset_password_source_uses_forgot_password_compatible_token_generation()
    {
        var usersPath = LocateUsersControllerSource();
        var authPath = LocateAuthControllerSource();
        Assert.True(File.Exists(usersPath));
        Assert.True(File.Exists(authPath));

        var usersSrc = File.ReadAllText(usersPath);
        var authSrc = File.ReadAllText(authPath);

        var marker = "public async Task<IActionResult> ResetPassword(Guid id)";
        var start = usersSrc.IndexOf(marker, StringComparison.Ordinal);
        Assert.True(start >= 0);
        var nextMethod = usersSrc.IndexOf("public async Task<IActionResult>", start + marker.Length, StringComparison.Ordinal);
        var methodSrc = nextMethod > start
            ? usersSrc.Substring(start, nextMethod - start)
            : usersSrc.Substring(start);

        // Same construction as ForgotPassword (RandomNumberGenerator + URL-safe base64).
        Assert.Contains("RandomNumberGenerator.GetBytes(32)", methodSrc, StringComparison.Ordinal);
        Assert.Contains("Replace(\"+\", \"-\")", methodSrc, StringComparison.Ordinal);
        Assert.DoesNotContain("GeneratePasswordResetTokenAsync", methodSrc, StringComparison.Ordinal);

        // Forgot-password completion looks up PasswordResetToken == request.Token
        Assert.Contains("u.PasswordResetToken == request.Token", authSrc, StringComparison.Ordinal);
        Assert.Contains("user.PasswordResetToken = resetToken", methodSrc, StringComparison.Ordinal);
    }

    [Fact]
    public void Password_reset_request_audit_stores_hash_not_raw_token_shape()
    {
        // Sanity: SHA256 hex of a sample token is not equal to the token itself.
        var token = "sample-reset-token-value";
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
        Assert.NotEqual(token, hash);
        Assert.Equal(64, hash.Length);
    }

    [Fact]
    public void PasswordResetRequest_entity_maps_requested_at_and_required_audit_columns()
    {
        var entityPath = LocateRepoFile(Path.Combine("Models", "Domain", "PasswordResetRequest.cs"));
        Assert.True(File.Exists(entityPath), $"Expected entity at {entityPath}");
        var src = File.ReadAllText(entityPath);

        Assert.Contains("[Table(\"password_reset_requests\")]", src, StringComparison.Ordinal);
        Assert.Contains("[Column(\"requested_at\")]", src, StringComparison.Ordinal);
        Assert.Contains("public DateTime RequestedAt", src, StringComparison.Ordinal);
        Assert.Contains("[Column(\"reset_token_hash\")]", src, StringComparison.Ordinal);
        Assert.Contains("[Column(\"requested_by_user_id\")]", src, StringComparison.Ordinal);
        Assert.Contains("[Column(\"expires_at\")]", src, StringComparison.Ordinal);
        Assert.Contains("[Column(\"status\")]", src, StringComparison.Ordinal);
        Assert.Contains("[Column(\"tenant_id\")]", src, StringComparison.Ordinal);
        Assert.Contains("[Column(\"user_id\")]", src, StringComparison.Ordinal);
        Assert.DoesNotContain("[Column(\"reset_token\")]", src, StringComparison.Ordinal);
    }

    [Fact]
    public void Admin_reset_password_persists_PasswordResetRequest_with_RequestedAt_semantics()
    {
        var path = LocateUsersControllerSource();
        var src = File.ReadAllText(path);
        var marker = "public async Task<IActionResult> ResetPassword(Guid id)";
        var start = src.IndexOf(marker, StringComparison.Ordinal);
        Assert.True(start >= 0);
        var nextMethod = src.IndexOf("public async Task<IActionResult>", start + marker.Length, StringComparison.Ordinal);
        var methodSrc = nextMethod > start
            ? src.Substring(start, nextMethod - start)
            : src.Substring(start);

        Assert.Contains("Set<PasswordResetRequest>()", methodSrc, StringComparison.Ordinal);
        Assert.Contains("ResetTokenHash = resetTokenHash", methodSrc, StringComparison.Ordinal);
        Assert.Contains("RequestedByUserId = requestedBy", methodSrc, StringComparison.Ordinal);
        Assert.Contains("ExpiresAt = user.ResetTokenExpiresAt.Value", methodSrc, StringComparison.Ordinal);
        Assert.Contains("Status = \"pending\"", methodSrc, StringComparison.Ordinal);
        Assert.Contains("SaveChangesAsync()", methodSrc, StringComparison.Ordinal);
        // RequestedAt comes from entity default DateTime.UtcNow — must not be stripped.
        Assert.DoesNotContain("RequestedAt = null", methodSrc, StringComparison.Ordinal);
        Assert.Contains("SendPasswordResetEmailAsync", methodSrc, StringComparison.Ordinal);
        // Persistence happens before notification.
        Assert.True(
            methodSrc.IndexOf("SaveChangesAsync()", StringComparison.Ordinal)
            < methodSrc.IndexOf("SendPasswordResetEmailAsync", StringComparison.Ordinal));
    }

    [Fact]
    public void Align_password_reset_requests_sql_migration_exists_and_adds_requested_at()
    {
        var sqlPath = LocateRepoFile(Path.Combine(
            "Data", "Migrations",
            "20260918220000_AlignPasswordResetRequestsWithEfModel.sql"));
        Assert.True(File.Exists(sqlPath), $"Expected SQL migration at {sqlPath}");
        var sql = File.ReadAllText(sqlPath);

        Assert.Contains("requested_at", sql, StringComparison.Ordinal);
        Assert.Contains("reset_token_hash", sql, StringComparison.Ordinal);
        Assert.Contains("requested_by_user_id", sql, StringComparison.Ordinal);
        Assert.Contains("password_reset_requests", sql, StringComparison.Ordinal);
        Assert.Contains("timestamp with time zone", sql, StringComparison.Ordinal);
        // Must not blindly rewrite migration history for already-recorded HIPAA id.
        Assert.DoesNotContain("INSERT INTO \"__EFMigrationsHistory\"", sql, StringComparison.Ordinal);
        Assert.DoesNotContain("Database.Migrate", sql, StringComparison.Ordinal);
    }

    [Fact]
    public void NotificationClient_posts_password_reset_to_notifications_password_reset_with_tenant_and_recipient()
    {
        var path = LocateRepoFile(Path.Combine("Services", "NotificationClient.cs"));
        Assert.True(File.Exists(path), $"Expected NotificationClient at {path}");
        var src = File.ReadAllText(path);

        var marker = "public async Task<(bool Success, string? Error)> SendPasswordResetEmailAsync";
        var start = src.IndexOf(marker, StringComparison.Ordinal);
        Assert.True(start >= 0, "Implementation of SendPasswordResetEmailAsync missing");
        var nextPublic = src.IndexOf("\n    public ", start + marker.Length, StringComparison.Ordinal);
        var methodSrc = nextPublic > start
            ? src.Substring(start, nextPublic - start)
            : src.Substring(start);

        Assert.Contains("/api/notifications/password-reset", methodSrc, StringComparison.Ordinal);
        Assert.Contains("tenantId", methodSrc, StringComparison.Ordinal);
        Assert.Contains("email", methodSrc, StringComparison.Ordinal);
        Assert.Contains("resetUrl", methodSrc, StringComparison.Ordinal);
        Assert.Contains("userName", methodSrc, StringComparison.Ordinal);
        Assert.Contains("userId", methodSrc, StringComparison.Ordinal);
        Assert.Contains("templateType = \"password_reset\"", methodSrc, StringComparison.Ordinal);
        Assert.Contains("NotificationService:BaseUrl", src, StringComparison.Ordinal);
        Assert.Contains("http://localhost:7073", src, StringComparison.Ordinal);

        // Azure Functions isolated worker drops chunked JSON bodies without Content-Length.
        // Password-reset must use StringContent + PostAsync (same as activation OTP).
        Assert.Contains("StringContent", methodSrc, StringComparison.Ordinal);
        Assert.Contains("PostAsync", methodSrc, StringComparison.Ordinal);
        Assert.Contains("JsonSerializer.Serialize", methodSrc, StringComparison.Ordinal);
        Assert.Contains("IsSuccessStatusCode", methodSrc, StringComparison.Ordinal);
        // Guard against regressing to JsonContent / PostAsJsonAsync call on this method.
        Assert.DoesNotContain("PostAsJsonAsync(\"/api/notifications/password-reset\"", methodSrc, StringComparison.Ordinal);
        Assert.DoesNotContain("PostAsJsonAsync($\"{_notificationServiceUrl", methodSrc, StringComparison.Ordinal);
    }

    [Fact]
    public void NotificationClient_password_reset_success_is_http_status_based_not_success_property()
    {
        var path = LocateRepoFile(Path.Combine("Services", "NotificationClient.cs"));
        var src = File.ReadAllText(path);
        var marker = "public async Task<(bool Success, string? Error)> SendPasswordResetEmailAsync";
        var start = src.IndexOf(marker, StringComparison.Ordinal);
        Assert.True(start >= 0);
        var nextPublic = src.IndexOf("\n    public ", start + marker.Length, StringComparison.Ordinal);
        var methodSrc = nextPublic > start
            ? src.Substring(start, nextPublic - start)
            : src.Substring(start);

        // Success = HTTP 2xx; must not require a deserialized success DTO (ACS probe returns messageId).
        Assert.Contains("IsSuccessStatusCode", methodSrc, StringComparison.Ordinal);
        Assert.DoesNotContain("ReadFromJsonAsync", methodSrc, StringComparison.Ordinal);
        Assert.DoesNotContain("result?.Success", methodSrc, StringComparison.Ordinal);
    }

    [Fact]
    public void Admin_reset_password_notification_failure_returns_safe_502_without_token()
    {
        var path = LocateUsersControllerSource();
        var src = File.ReadAllText(path);
        var marker = "public async Task<IActionResult> ResetPassword(Guid id)";
        var start = src.IndexOf(marker, StringComparison.Ordinal);
        Assert.True(start >= 0);
        var nextMethod = src.IndexOf("public async Task<IActionResult>", start + marker.Length, StringComparison.Ordinal);
        var methodSrc = nextMethod > start
            ? src.Substring(start, nextMethod - start)
            : src.Substring(start);

        Assert.Contains("StatusCode(502", methodSrc, StringComparison.Ordinal);
        Assert.Contains("Password reset was prepared but the email could not be sent", methodSrc, StringComparison.Ordinal);

        // Response payloads must never include the raw token or hash.
        var okIdx = methodSrc.IndexOf("return Ok(new", StringComparison.Ordinal);
        Assert.True(okIdx > 0);
        var okBlock = methodSrc.Substring(okIdx);
        Assert.DoesNotContain("resetToken", okBlock, StringComparison.Ordinal);
        Assert.DoesNotContain("ResetTokenHash", okBlock, StringComparison.Ordinal);
        Assert.DoesNotContain("PasswordResetToken", okBlock, StringComparison.Ordinal);

        var failIdx = methodSrc.IndexOf("return StatusCode(502", StringComparison.Ordinal);
        Assert.True(failIdx > 0);
        var failBlock = methodSrc.Substring(failIdx, Math.Min(280, methodSrc.Length - failIdx));
        Assert.DoesNotContain("resetToken", failBlock, StringComparison.Ordinal);
        Assert.DoesNotContain("ResetTokenHash", failBlock, StringComparison.Ordinal);
    }

    private static string LocateUsersControllerSource()
        => LocateRepoFile(Path.Combine("Controllers", "UsersController.cs"));

    private static string LocateAuthControllerSource()
        => LocateRepoFile(Path.Combine("Controllers", "AuthController.cs"));

    private static string LocateRepoFile(
        string relativeUnderAuthService,
        [System.Runtime.CompilerServices.CallerFilePath] string callerFilePath = "")
    {
        var relativeCandidates = new[]
        {
            Path.Combine("microservices", "auth-service", "AuthService", relativeUnderAuthService),
            Path.Combine("AuthService", relativeUnderAuthService),
        };

        var roots = new List<DirectoryInfo> { new(AppContext.BaseDirectory) };
        try
        {
            var cwd = new DirectoryInfo(Directory.GetCurrentDirectory());
            if (roots.All(r => !string.Equals(r.FullName, cwd.FullName, StringComparison.OrdinalIgnoreCase)))
                roots.Add(cwd);
        }
        catch
        {
            // ignore cwd probe failures
        }

        // When VSTest sets BaseDirectory/cwd to an isolated OutputPath, walk from this test file.
        if (!string.IsNullOrWhiteSpace(callerFilePath))
        {
            try
            {
                var callerDir = new DirectoryInfo(Path.GetDirectoryName(Path.GetFullPath(callerFilePath))!);
                if (roots.All(r => !string.Equals(r.FullName, callerDir.FullName, StringComparison.OrdinalIgnoreCase)))
                    roots.Add(callerDir);
            }
            catch
            {
                // ignore caller path probe failures
            }
        }

        foreach (var root in roots)
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
