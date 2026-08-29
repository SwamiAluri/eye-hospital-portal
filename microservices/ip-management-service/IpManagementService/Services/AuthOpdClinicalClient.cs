using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace IpManagementService.Services;

public record AuthOpdClinicalSnapshot(
    string? ProcedureName,
    string? EyeOperated,
    string? IolPower,
    bool BiometryMissing,
    string? EyePhrase,
    string? Diagnosis,
    string? DiagnosisJson = null);

public interface IAuthOpdClinicalClient
{
    Task<AuthOpdClinicalSnapshot?> GetSnapshotAsync(
        Guid tenantId, Guid patientId, Guid? sessionId, string? eye, bool preferBiometry);
}

public sealed class NoOpAuthOpdClinicalClient : IAuthOpdClinicalClient
{
    public Task<AuthOpdClinicalSnapshot?> GetSnapshotAsync(
        Guid tenantId, Guid patientId, Guid? sessionId, string? eye, bool preferBiometry)
        => Task.FromResult<AuthOpdClinicalSnapshot?>(null);
}

public sealed class AuthOpdClinicalClient : IAuthOpdClinicalClient
{
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly HttpClient _http;
    private readonly ILogger<AuthOpdClinicalClient> _log;

    public AuthOpdClinicalClient(HttpClient http, ILogger<AuthOpdClinicalClient> log)
    {
        _http = http;
        _log = log;
    }

    public async Task<AuthOpdClinicalSnapshot?> GetSnapshotAsync(
        Guid tenantId, Guid patientId, Guid? sessionId, string? eye, bool preferBiometry)
    {
        var url = $"api/internal/opd-clinical/snapshot?tenantId={tenantId:D}&patientId={patientId:D}"
                  + $"&preferBiometry={(preferBiometry ? "true" : "false")}";
        if (sessionId is { } sid && sid != Guid.Empty)
            url += $"&sessionId={sid:D}";
        if (!string.IsNullOrWhiteSpace(eye))
            url += $"&eye={Uri.EscapeDataString(eye)}";

        try
        {
            var resp = await _http.GetAsync(url);
            if (resp.StatusCode == HttpStatusCode.NotFound)
                return null;
            if (!resp.IsSuccessStatusCode)
            {
                _log.LogWarning("OPD snapshot returned {Status} for patient {PatientId}", (int)resp.StatusCode, patientId);
                return null;
            }
            return await resp.Content.ReadFromJsonAsync<AuthOpdClinicalSnapshot>(Json);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "OPD snapshot failed for patient {PatientId}", patientId);
            return null;
        }
    }
}
