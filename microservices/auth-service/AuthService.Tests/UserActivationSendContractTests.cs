using System.Reflection;
using System.Text.Json;
using AuthService.Authorization;
using AuthService.Controllers;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Contract tests for Admin "Send Activation Code" wiring.
/// Guards against AuthService pointing at the wrong local Functions port
/// (Inventory is :7072; Notification is :7073).
/// </summary>
public class UserActivationSendContractTests
{
    [Fact]
    public void Appsettings_NotificationService_BaseUrl_points_to_notification_port_7073()
    {
        var path = LocateAuthAppsettings();
        Assert.True(File.Exists(path), $"Expected appsettings at {path}");

        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var root = doc.RootElement;
        Assert.True(root.TryGetProperty("NotificationService", out var ns),
            "NotificationService section missing from appsettings.json");
        Assert.True(ns.TryGetProperty("BaseUrl", out var baseUrl),
            "NotificationService:BaseUrl missing");

        var url = baseUrl.GetString() ?? "";
        Assert.Contains(":7073", url, StringComparison.Ordinal);
        Assert.DoesNotContain(":7072", url, StringComparison.Ordinal);
    }

    [Fact]
    public void NotificationClient_default_fallback_is_notification_port_7073()
    {
        var path = LocateNotificationClientSource();
        Assert.True(File.Exists(path), $"Expected source at {path}");
        var src = File.ReadAllText(path);

        Assert.Contains("localhost:7073", src, StringComparison.Ordinal);
        Assert.DoesNotContain("localhost:7071", src, StringComparison.Ordinal);
        Assert.DoesNotContain("localhost:7072", src, StringComparison.Ordinal);
    }

    [Fact]
    public void SendActivation_is_post_id_send_activation_with_user_manage_permission()
    {
        var method = typeof(UsersController).GetMethod(
            "SendActivation",
            BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);
        Assert.NotNull(method);

        var httpPost = method!.GetCustomAttribute<HttpPostAttribute>();
        Assert.NotNull(httpPost);
        Assert.Equal("{id}/send-activation", httpPost!.Template);

        var perm = method.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(perm);
        Assert.Equal("user.manage", perm!.PermissionCode);
    }

    [Fact]
    public void SendActivationRequest_has_delivery_method_and_optional_recipient()
    {
        var props = typeof(SendActivationRequest).GetProperties().Select(p => p.Name).ToHashSet();
        Assert.Contains(nameof(SendActivationRequest.DeliveryMethod), props);
        Assert.Contains(nameof(SendActivationRequest.Recipient), props);
    }

    [Fact]
    public void Notification_local_settings_Host_LocalHttpPort_is_7073()
    {
        var path = LocateNotificationLocalSettings();
        Assert.True(File.Exists(path), $"Expected local.settings at {path}");

        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        Assert.True(doc.RootElement.TryGetProperty("Host", out var host));
        Assert.True(host.TryGetProperty("LocalHttpPort", out var port));
        Assert.Equal(7073, port.GetInt32());
    }

    [Fact]
    public void Inventory_local_settings_Host_LocalHttpPort_is_7072_not_notification()
    {
        var path = LocateInventoryLocalSettings();
        Assert.True(File.Exists(path), $"Expected local.settings at {path}");

        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        Assert.True(doc.RootElement.TryGetProperty("Host", out var host));
        Assert.True(host.TryGetProperty("LocalHttpPort", out var port));
        Assert.Equal(7072, port.GetInt32());
    }

    private static string LocateAuthAppsettings()
    {
        return LocateUpwards(
            Path.Combine("microservices", "auth-service", "AuthService", "appsettings.json"),
            Path.Combine("AuthService", "appsettings.json"));
    }

    private static string LocateNotificationClientSource()
    {
        return LocateUpwards(
            Path.Combine("microservices", "auth-service", "AuthService", "Services", "NotificationClient.cs"),
            Path.Combine("AuthService", "Services", "NotificationClient.cs"));
    }

    private static string LocateNotificationLocalSettings()
    {
        return LocateUpwards(
            Path.Combine("microservices", "notification-service", "NotificationService", "local.settings.json"),
            Path.Combine("..", "notification-service", "NotificationService", "local.settings.json"));
    }

    private static string LocateInventoryLocalSettings()
    {
        return LocateUpwards(
            Path.Combine("microservices", "inventory-service", "InventoryApi", "local.settings.json"),
            Path.Combine("..", "inventory-service", "InventoryApi", "local.settings.json"));
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
