using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Azure.Functions.Worker.Http;

namespace LaboratoryApi.Services;

public static class HttpRequestDataExtensions
{
    public static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter() },
        PropertyNameCaseInsensitive = true,
    };

    public static async Task<HttpResponseData> OkJsonAsync(this HttpRequestData req, object data)
    {
        var resp = req.CreateResponse(HttpStatusCode.OK);
        resp.Headers.Add("Content-Type", "application/json");
        await resp.WriteStringAsync(JsonSerializer.Serialize(data, JsonOpts));
        return resp;
    }

    public static async Task<HttpResponseData> CreatedJsonAsync(this HttpRequestData req, object data)
    {
        var resp = req.CreateResponse(HttpStatusCode.Created);
        resp.Headers.Add("Content-Type", "application/json");
        await resp.WriteStringAsync(JsonSerializer.Serialize(data, JsonOpts));
        return resp;
    }

    public static async Task<HttpResponseData> UnauthorizedAsync(this HttpRequestData req, string message)
    {
        var resp = req.CreateResponse(HttpStatusCode.Unauthorized);
        resp.Headers.Add("Content-Type", "application/json");
        await resp.WriteStringAsync(JsonSerializer.Serialize(new { error = message }, JsonOpts));
        return resp;
    }

    public static async Task<HttpResponseData> ForbiddenAsync(this HttpRequestData req, string message)
    {
        var resp = req.CreateResponse(HttpStatusCode.Forbidden);
        resp.Headers.Add("Content-Type", "application/json");
        await resp.WriteStringAsync(JsonSerializer.Serialize(new { error = message }, JsonOpts));
        return resp;
    }

    public static async Task<HttpResponseData> BadRequestAsync(this HttpRequestData req, string message, string? code = null)
    {
        var resp = req.CreateResponse(HttpStatusCode.BadRequest);
        resp.Headers.Add("Content-Type", "application/json");
        await resp.WriteStringAsync(JsonSerializer.Serialize(new { error = message, code }, JsonOpts));
        return resp;
    }

    public static async Task<HttpResponseData> NotFoundAsync(this HttpRequestData req, string message)
    {
        var resp = req.CreateResponse(HttpStatusCode.NotFound);
        resp.Headers.Add("Content-Type", "application/json");
        await resp.WriteStringAsync(JsonSerializer.Serialize(new { error = message, code = "not_found" }, JsonOpts));
        return resp;
    }

    public static async Task<HttpResponseData> ConflictAsync(this HttpRequestData req, string message, string? code = null)
    {
        var resp = req.CreateResponse(HttpStatusCode.Conflict);
        resp.Headers.Add("Content-Type", "application/json");
        await resp.WriteStringAsync(JsonSerializer.Serialize(new { error = message, code }, JsonOpts));
        return resp;
    }

    public static async Task<HttpResponseData> StatusJsonAsync(
        this HttpRequestData req, HttpStatusCode status, string message, string? code = null)
    {
        var resp = req.CreateResponse(status);
        resp.Headers.Add("Content-Type", "application/json");
        await resp.WriteStringAsync(JsonSerializer.Serialize(new { error = message, code }, JsonOpts));
        return resp;
    }

    public static async Task<T?> ReadJsonAsync<T>(this HttpRequestData req)
    {
        return await JsonSerializer.DeserializeAsync<T>(req.Body, JsonOpts);
    }
}
