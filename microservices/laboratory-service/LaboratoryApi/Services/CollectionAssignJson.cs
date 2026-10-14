using System.Text.Json;

namespace LaboratoryApi.Services;

/// <summary>
/// Assign request body parse at the HTTP boundary.
/// Malformed <c>assignToUserId</c> must become <c>assignee_invalid</c> (400), never an unhandled 500.
/// </summary>
public static class CollectionAssignJson
{
    public const string InvalidAssigneeCode = "assignee_invalid";
    public const string InvalidAssigneeMessage = "Assignee user ID must be a valid GUID.";

    public static async Task<AssignCollectionTaskRequest> ReadAsync(Stream body, CancellationToken ct = default)
    {
        try
        {
            var parsed = await JsonSerializer.DeserializeAsync<AssignCollectionTaskRequest>(
                body, HttpRequestDataExtensions.JsonOpts, ct);
            if (parsed is null)
                throw new CollectionDomainException("Request body is required.");
            return parsed;
        }
        catch (JsonException)
        {
            throw new CollectionDomainException(
                InvalidAssigneeMessage, statusCode: 400, code: InvalidAssigneeCode);
        }
    }

    /// <summary>Synchronous helper for unit tests (same options / contract as <see cref="ReadAsync"/>).</summary>
    public static AssignCollectionTaskRequest Parse(string json)
    {
        try
        {
            var parsed = JsonSerializer.Deserialize<AssignCollectionTaskRequest>(
                json, HttpRequestDataExtensions.JsonOpts);
            if (parsed is null)
                throw new CollectionDomainException("Request body is required.");
            return parsed;
        }
        catch (JsonException)
        {
            throw new CollectionDomainException(
                InvalidAssigneeMessage, statusCode: 400, code: InvalidAssigneeCode);
        }
    }
}
