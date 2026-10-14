using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace LaboratoryApi.Services;

public record PlatformPatientRef(Guid PatientId, string Mrn, string DisplayName, DateTime DateOfBirth);
public record PlatformVisitRef(Guid VisitId, Guid PatientId, Guid BranchId, string Status);
public record PlatformUserRef(Guid UserId, string DisplayName, string UserStatus);
public record PlatformUserBranchRef(Guid UserId, Guid BranchId, bool Authorized);
public record PlatformMasterValueRef(string EntityType, string Code, string Label, bool IsActive, int SortOrder);

public interface IPlatformReferenceClient
{
    Task<PlatformPatientRef> ValidatePatientAsync(Guid tenantId, Guid patientId, CancellationToken ct = default);
    Task<PlatformVisitRef> ValidateVisitAsync(
        Guid tenantId, Guid visitId, Guid patientId, Guid? operatingBranchId, CancellationToken ct = default);
    Task<PlatformUserRef> ValidateUserAsync(Guid tenantId, Guid userId, CancellationToken ct = default);
    /// <summary>
    /// PD-COL-OWN-05 — validate user exists/active in tenant and holds <paramref name="requiredPermission"/>.
    /// </summary>
    Task<PlatformUserRef> ValidateUserWithPermissionAsync(
        Guid tenantId, Guid userId, string requiredPermission, CancellationToken ct = default);
    /// <summary>
    /// L-COL-01C — validate user is authorized for BranchId via AuthService user_branches / primary branch.
    /// </summary>
    Task<PlatformUserBranchRef> ValidateUserBranchAsync(
        Guid tenantId, Guid userId, Guid branchId, CancellationToken ct = default);
    /// <summary>L-COL-01D — resolve active MasterValue by entity type + code.</summary>
    Task<PlatformMasterValueRef> ValidateMasterValueAsync(
        Guid tenantId, string entityType, string code, CancellationToken ct = default);
    /// <summary>L-COL-01D — list active MasterValues for an entity type.</summary>
    Task<IReadOnlyList<PlatformMasterValueRef>> ListActiveMasterValuesAsync(
        Guid tenantId, string entityType, CancellationToken ct = default);
}

/// <summary>
/// AuthService internal LMS reference adapters (X-Internal-Key + X-Tenant-ID).
/// </summary>
public sealed class PlatformReferenceClient : IPlatformReferenceClient
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<PlatformReferenceClient> _log;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    public PlatformReferenceClient(IHttpClientFactory httpClientFactory, ILogger<PlatformReferenceClient> log)
    {
        _httpClientFactory = httpClientFactory;
        _log = log;
    }

    public Task<PlatformPatientRef> ValidatePatientAsync(Guid tenantId, Guid patientId, CancellationToken ct = default)
        => PostAsync<PlatformPatientRef>(tenantId, "api/internal/lms/validate-patient", new { patientId }, ct);

    public Task<PlatformVisitRef> ValidateVisitAsync(
        Guid tenantId, Guid visitId, Guid patientId, Guid? operatingBranchId, CancellationToken ct = default)
        => PostAsync<PlatformVisitRef>(
            tenantId,
            "api/internal/lms/validate-visit",
            new { visitId, patientId, operatingBranchId },
            ct);

    public Task<PlatformUserRef> ValidateUserAsync(Guid tenantId, Guid userId, CancellationToken ct = default)
        => PostAsync<PlatformUserRef>(tenantId, "api/internal/lms/validate-user", new { userId }, ct);

    public Task<PlatformUserRef> ValidateUserWithPermissionAsync(
        Guid tenantId, Guid userId, string requiredPermission, CancellationToken ct = default)
        => PostAsync<PlatformUserRef>(
            tenantId,
            "api/internal/lms/validate-user",
            new { userId, requiredPermission },
            ct);

    public Task<PlatformUserBranchRef> ValidateUserBranchAsync(
        Guid tenantId, Guid userId, Guid branchId, CancellationToken ct = default)
        => PostAsync<PlatformUserBranchRef>(
            tenantId,
            "api/internal/lms/validate-user-branch",
            new { userId, branchId },
            ct);

    public Task<PlatformMasterValueRef> ValidateMasterValueAsync(
        Guid tenantId, string entityType, string code, CancellationToken ct = default)
        => PostAsync<PlatformMasterValueRef>(
            tenantId,
            "api/internal/lms/validate-master-value",
            new { entityType, code },
            ct);

    public async Task<IReadOnlyList<PlatformMasterValueRef>> ListActiveMasterValuesAsync(
        Guid tenantId, string entityType, CancellationToken ct = default)
    {
        var client = _httpClientFactory.CreateClient("AuthService");
        var path = $"api/internal/lms/master-values?entityType={Uri.EscapeDataString(entityType)}&activeOnly=true";
        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.TryAddWithoutValidation("X-Tenant-ID", tenantId.ToString("D"));
        using var response = await client.SendAsync(request, ct);
        var raw = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            _log.LogError("Platform master-value list failed {Status}: {Body}", (int)response.StatusCode, Truncate(raw));
            throw new OrderDomainException("Platform master-value list unavailable.", statusCode: 503, code: "platform_unavailable");
        }

        var list = JsonSerializer.Deserialize<List<PlatformMasterValueRef>>(raw, JsonOpts);
        return list ?? new List<PlatformMasterValueRef>();
    }

    private async Task<T> PostAsync<T>(Guid tenantId, string path, object body, CancellationToken ct)
    {
        var client = _httpClientFactory.CreateClient("AuthService");
        using var request = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = JsonContent.Create(body, options: JsonOpts),
        };
        request.Headers.TryAddWithoutValidation("X-Tenant-ID", tenantId.ToString("D"));

        using var response = await client.SendAsync(request, ct);
        var raw = await response.Content.ReadAsStringAsync(ct);

        if (response.StatusCode == HttpStatusCode.NotFound)
            throw new OrderDomainException(ExtractError(raw) ?? "Referenced platform entity not found.", statusCode: 400, code: "platform_not_found");
        if (response.StatusCode == HttpStatusCode.BadRequest)
            throw new OrderDomainException(ExtractError(raw) ?? "Platform validation failed.", statusCode: 400, code: ExtractCode(raw) ?? "platform_invalid");
        if (response.StatusCode == HttpStatusCode.Forbidden)
            throw new OrderDomainException(
                ExtractError(raw) ?? "User is not authorized for the branch.",
                statusCode: 403,
                code: ExtractCode(raw) ?? "branch_unauthorized");
        if (response.StatusCode == HttpStatusCode.Unauthorized)
            throw new OrderDomainException("Platform reference validation unauthorized.", statusCode: 503, code: "platform_auth_failed");
        if (!response.IsSuccessStatusCode)
        {
            _log.LogError("Platform reference call failed {Status}: {Body}", (int)response.StatusCode, Truncate(raw));
            throw new OrderDomainException("Platform reference validation unavailable.", statusCode: 503, code: "platform_unavailable");
        }

        var dto = JsonSerializer.Deserialize<T>(raw, JsonOpts);
        if (dto is null)
            throw new OrderDomainException("Platform reference response invalid.", statusCode: 503, code: "platform_unavailable");
        return dto;
    }

    private static string? ExtractError(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            if (doc.RootElement.TryGetProperty("error", out var e))
                return e.GetString();
        }
        catch { /* ignore */ }
        return null;
    }

    private static string? ExtractCode(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            if (doc.RootElement.TryGetProperty("code", out var e))
                return e.GetString();
        }
        catch { /* ignore */ }
        return null;
    }

    private static string Truncate(string? s) =>
        string.IsNullOrEmpty(s) ? string.Empty : s.Length <= 200 ? s : s[..200];
}
