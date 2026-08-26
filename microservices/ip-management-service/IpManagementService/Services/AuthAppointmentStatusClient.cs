using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace IpManagementService.Services;

public record AuthAppointmentStatus(
    bool Exists,
    string? Status,
    DateTime? AppointmentDate,
    Guid? DoctorId,
    Guid? PatientId,
    bool Cancelled);

public interface IAuthAppointmentStatusClient
{
    Task<AuthAppointmentStatus> GetStatusAsync(Guid appointmentId, Guid tenantId);
}

public sealed class AuthAppointmentStatusClient : IAuthAppointmentStatusClient
{
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly HttpClient _http;
    private readonly ILogger<AuthAppointmentStatusClient> _log;

    public AuthAppointmentStatusClient(HttpClient http, ILogger<AuthAppointmentStatusClient> log)
    {
        _http = http;
        _log = log;
    }

    public async Task<AuthAppointmentStatus> GetStatusAsync(Guid appointmentId, Guid tenantId)
    {
        var url = $"api/internal/ip-appointments/{appointmentId:D}/status?tenantId={tenantId:D}";
        try
        {
            var resp = await _http.GetAsync(url);
            if (resp.StatusCode == HttpStatusCode.NotFound)
                return new AuthAppointmentStatus(false, null, null, null, null, true);

            if (!resp.IsSuccessStatusCode)
            {
                var body = await resp.Content.ReadAsStringAsync();
                throw new InvalidOperationException(
                    $"Appointment status failed ({(int)resp.StatusCode}): {body}");
            }

            var row = await resp.Content.ReadFromJsonAsync<AuthAppointmentStatus>(Json);
            return row ?? new AuthAppointmentStatus(false, null, null, null, null, true);
        }
        catch (InvalidOperationException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Auth appointment status failed for {AppointmentId}", appointmentId);
            throw new InvalidOperationException("Appointment service unavailable.", ex);
        }
    }
}
