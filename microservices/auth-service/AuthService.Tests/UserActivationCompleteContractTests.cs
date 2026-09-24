using System.Reflection;
using AuthService.Authorization;
using AuthService.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Guards the missing final step of /activate wizard:
/// MFA verify must be followed by Auth persistence of UserStatus=active.
/// </summary>
public class UserActivationCompleteContractTests
{
    [Fact]
    public void CompleteActivation_is_post_id_complete_activation_allow_anonymous()
    {
        var method = typeof(UsersController).GetMethod(
            "CompleteActivation",
            BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);
        Assert.NotNull(method);

        var httpPost = method!.GetCustomAttribute<HttpPostAttribute>();
        Assert.NotNull(httpPost);
        Assert.Equal("{id}/complete-activation", httpPost!.Template);

        Assert.NotNull(method.GetCustomAttribute<AllowAnonymousAttribute>());
        Assert.Null(method.GetCustomAttribute<RequirePermissionAttribute>());
    }

    [Fact]
    public void Activate_page_calls_complete_activation_before_showing_complete_step()
    {
        var path = LocateActivatePageSource();
        Assert.True(File.Exists(path), $"Expected activate page at {path}");
        var src = File.ReadAllText(path);

        Assert.Contains("/complete-activation", src, StringComparison.Ordinal);
        Assert.Contains("setStep('complete')", src, StringComparison.Ordinal);

        // MFA success must call complete-activation before UI "Activation Complete"
        var mfaVerifyIdx = src.IndexOf("mfa/enroll/verify", StringComparison.Ordinal);
        Assert.True(mfaVerifyIdx >= 0, "Expected MFA verify call in activate page");
        var completeApiIdx = src.IndexOf("/complete-activation", mfaVerifyIdx, StringComparison.Ordinal);
        Assert.True(completeApiIdx > mfaVerifyIdx, "complete-activation must run after MFA verify");
        var completeStepIdx = src.IndexOf("setStep('complete')", completeApiIdx, StringComparison.Ordinal);
        Assert.True(completeStepIdx > completeApiIdx, "setStep('complete') must run after complete-activation API");
    }

    [Fact]
    public void SetActivationPassword_does_not_finalize_to_active()
    {
        var path = LocateUsersControllerSource();
        var src = File.ReadAllText(path);
        // Ensure password step still leaves pending_activation (lifecycle mid-state)
        Assert.Contains("user.UserStatus = \"pending_activation\";  // Still in activation process", src, StringComparison.Ordinal);
    }

    private static string LocateActivatePageSource()
    {
        return LocateUpwards(
            Path.Combine("apps", "hospital-portal-web", "src", "app", "activate", "page.tsx"),
            Path.Combine("..", "..", "..", "apps", "hospital-portal-web", "src", "app", "activate", "page.tsx"));
    }

    private static string LocateUsersControllerSource()
    {
        return LocateUpwards(
            Path.Combine("microservices", "auth-service", "AuthService", "Controllers", "UsersController.cs"),
            Path.Combine("AuthService", "Controllers", "UsersController.cs"));
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
