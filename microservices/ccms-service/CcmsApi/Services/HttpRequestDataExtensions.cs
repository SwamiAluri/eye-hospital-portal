using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Azure.Functions.Worker.Http;

namespace CcmsApi.Services;

/// <summary>
/// Extension methods on HttpRequestData for concise JSON response helpers.
/// </summary>
public static class HttpRequestDataExtensions
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy      = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition    = JsonIgnoreCondition.WhenWritingNull,
        Converters                = { new JsonStringEnumConverter() }
    };

    /// <summary>
    /// Case-insensitive options for deserializing incoming request bodies.
    /// Accepts both camelCase (JS/TS frontends) and PascalCase (C# record defaults).
    /// </summary>
    public static readonly JsonSerializerOptions DeserializeOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters                  = { new JsonStringEnumConverter() }
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

    public static async Task<HttpResponseData> BadRequestAsync(this HttpRequestData req, string message)
    {
        var resp = req.CreateResponse(HttpStatusCode.BadRequest);
        resp.Headers.Add("Content-Type", "application/json");
        await resp.WriteStringAsync(JsonSerializer.Serialize(new { error = message }, JsonOpts));
        return resp;
    }

    public static async Task<HttpResponseData> NotFoundAsync(this HttpRequestData req, string message = "Not found.")
    {
        var resp = req.CreateResponse(HttpStatusCode.NotFound);
        resp.Headers.Add("Content-Type", "application/json");
        await resp.WriteStringAsync(JsonSerializer.Serialize(new { error = message }, JsonOpts));
        return resp;
    }
}
