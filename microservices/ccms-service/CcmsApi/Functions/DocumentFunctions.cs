using System.Net;
using System.Text.Json;
using CcmsApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace CcmsApi.Functions;

public class DocumentFunctions
{
    private readonly DocumentEngineService _svc;
    private readonly JwtService _jwt;

    public DocumentFunctions(DocumentEngineService svc, JwtService jwt)
    {
        _svc = svc;
        _jwt = jwt;
    }

    // POST /api/ccms/coverage-cases/{id}/documents
    [Function("UploadCcmsDocument")]
    public async Task<HttpResponseData> Upload(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/coverage-cases/{id:guid}/documents")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<UploadDocumentRequest>(req.Body);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        var result = await _svc.UploadAsync(id, claims!.UserId, body);
        var resp = req.CreateResponse(HttpStatusCode.Created);
        await resp.WriteAsJsonAsync(result);
        return resp;
    }

    // GET /api/ccms/coverage-cases/{id}/documents?stage=
    [Function("GetCcmsDocuments")]
    public async Task<HttpResponseData> GetForCase(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/coverage-cases/{id:guid}/documents")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var stage = req.Query["stage"];
        var list = await _svc.GetByCaseAsync(id, stage);
        return await req.OkJsonAsync(list);
    }

    // DELETE /api/ccms/documents/{id}
    [Function("DeleteCcmsDocument")]
    public async Task<HttpResponseData> Delete(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "ccms/documents/{id:guid}")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        await _svc.DeleteAsync(id, claims!.UserId);
        return req.CreateResponse(HttpStatusCode.NoContent);
    }
}
