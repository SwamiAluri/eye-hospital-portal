using System.Net.Http.Json;
using System.Text.Json;
using IpManagementService.Services.Uat;
using Microsoft.Extensions.Logging;

namespace IpManagementService.Services;

public interface IAuthBedLifecycleClient
{
    Task<AuthBedSnapshot?> ApplyAsync(
        Guid tenantId, Guid bedId, Guid actorUserId, Guid? patientId, string action);

    Task<IReadOnlyList<AuthBedSnapshot>> ListAsync(Guid tenantId, Guid branchId, string? wardName, Guid? wardId = null);
}

public record AuthBedSnapshot(
    Guid BedId,
    string BedNumber,
    string? RoomNumber,
    string? WardName,
    string BedStatus,
    Guid? WardId = null,
    string? BedType = null);

public sealed class NoOpAuthBedLifecycleClient : IAuthBedLifecycleClient
{
    public Task<AuthBedSnapshot?> ApplyAsync(
        Guid tenantId, Guid bedId, Guid actorUserId, Guid? patientId, string action)
        => Task.FromResult<AuthBedSnapshot?>(null);

    public Task<IReadOnlyList<AuthBedSnapshot>> ListAsync(Guid tenantId, Guid branchId, string? wardName, Guid? wardId = null)
        => Task.FromResult<IReadOnlyList<AuthBedSnapshot>>(Array.Empty<AuthBedSnapshot>());
}

public sealed class AuthBedLifecycleClient : IAuthBedLifecycleClient
{
    private readonly HttpClient _http;
    private readonly ILogger<AuthBedLifecycleClient> _log;

    public AuthBedLifecycleClient(HttpClient http, ILogger<AuthBedLifecycleClient> log)
    {
        _http = http;
        _log = log;
    }

    public async Task<AuthBedSnapshot?> ApplyAsync(
        Guid tenantId, Guid bedId, Guid actorUserId, Guid? patientId, string action)
    {
        if (UatFailureFlags.IsOn("bed_service_unavailable"))
            throw new InvalidOperationException("Bed inventory service unavailable.");
        try
        {
            var resp = await _http.PostAsJsonAsync("api/internal/ip-beds/lifecycle", new
            {
                tenantId,
                bedId,
                actorUserId,
                patientId,
                action,
            });
            if (!resp.IsSuccessStatusCode)
            {
                var body = await resp.Content.ReadAsStringAsync();
                throw new InvalidOperationException($"Bed {action} failed ({(int)resp.StatusCode}): {body}");
            }

            return await resp.Content.ReadFromJsonAsync<AuthBedSnapshot>(new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
            });
        }
        catch (InvalidOperationException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Auth bed lifecycle {Action} failed for {BedId}", action, bedId);
            throw new InvalidOperationException("Bed inventory service unavailable.", ex);
        }
    }

    public async Task<IReadOnlyList<AuthBedSnapshot>> ListAsync(
        Guid tenantId, Guid branchId, string? wardName, Guid? wardId = null)
    {
        var url = $"api/internal/ip-beds?tenantId={tenantId}&branchId={branchId}";
        if (!string.IsNullOrWhiteSpace(wardName))
            url += $"&wardName={Uri.EscapeDataString(wardName)}";
        if (wardId is Guid id && id != Guid.Empty)
            url += $"&wardId={id:D}";

        var resp = await _http.GetAsync(url);
        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"Bed inventory list failed ({(int)resp.StatusCode}): {body}");
        }

        var rows = await resp.Content.ReadFromJsonAsync<List<AuthBedSnapshot>>(new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
        });
        return rows ?? [];
    }
}
