using System.Net;
using System.Text.Json;
using CcmsApi.Services;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Net.Http.Headers;

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
    // Accepts multipart/form-data: field "file" (the actual file) + field "documentType" (string)
    // Also accepts JSON body: { stage, documentType, documentName, blobUrl, fileSizeBytes, mimeType }
    [Function("UploadCcmsDocument")]
    public async Task<HttpResponseData> Upload(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/coverage-cases/{id:guid}/documents")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var contentType = req.Headers.TryGetValues("Content-Type", out var ctValues)
            ? ctValues.FirstOrDefault() ?? string.Empty
            : string.Empty;

        try
        {
            CcmsApi.Models.Domain.CcmsDocument result;

            if (contentType.Contains("multipart/form-data", StringComparison.OrdinalIgnoreCase))
            {
                // ── Multipart: real file upload ──────────────────────────────────
                var boundaryVal = MediaTypeHeaderValue.Parse(contentType).Boundary;
                var boundary    = boundaryVal.HasValue
                    ? boundaryVal.Value.ToString().Trim('"')
                    : throw new InvalidOperationException("Missing multipart boundary.");

                var reader = new MultipartReader(boundary, req.Body);

                Stream?  fileStream   = null;
                string   fileName     = "document";
                string   mimeType     = "application/octet-stream";
                string   docType      = "other";
                string   stage        = "preauth";

                MultipartSection? section;
                while ((section = await reader.ReadNextSectionAsync()) != null)
                {
                    var dispositionStr = section.Headers!["Content-Disposition"].ToString();
                    var disposition    = ContentDispositionHeaderValue.Parse(dispositionStr);

                    var fieldName = disposition.Name.Value?.Trim('"') ?? string.Empty;

                    if (fieldName.Equals("file", StringComparison.OrdinalIgnoreCase) && disposition.FileName.HasValue)
                    {
                        fileName   = disposition.FileName.Value!.Trim('"');
                        mimeType   = section.ContentType ?? "application/octet-stream";
                        // Buffer to memory so we can seek
                        var ms = new MemoryStream();
                        await section.Body.CopyToAsync(ms);
                        ms.Seek(0, SeekOrigin.Begin);
                        fileStream = ms;
                    }
                    else
                    {
                        // Read text field
                        using var sr  = new StreamReader(section.Body);
                        var value     = (await sr.ReadToEndAsync()).Trim();

                        if (fieldName.Equals("documentType", StringComparison.OrdinalIgnoreCase))
                            docType = value;
                        else if (fieldName.Equals("stage", StringComparison.OrdinalIgnoreCase))
                            stage = value;
                        else if (fieldName.Equals("fileName", StringComparison.OrdinalIgnoreCase))
                            fileName = value;
                    }
                }

                if (fileStream is null)
                {
                    var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                    await bad.WriteAsJsonAsync(new { error = "No 'file' part found in multipart body." });
                    return bad;
                }

                result = await _svc.UploadFileAsync(id, claims!.UserId, fileStream, fileName, mimeType, docType, stage);
            }
            else
            {
                // ── JSON: metadata-only (blob URL already known) ─────────────────
                var body = await JsonSerializer.DeserializeAsync<UploadDocumentRequest>(
                    req.Body, CcmsApi.Services.HttpRequestDataExtensions.DeserializeOpts);
                if (body is null)
                {
                    return req.CreateResponse(HttpStatusCode.BadRequest);
                }
                result = await _svc.UploadAsync(id, claims!.UserId, body);
            }

            var resp = req.CreateResponse(HttpStatusCode.Created);
            await resp.WriteAsJsonAsync(MapToDto(result));
            return resp;
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
        catch (Exception ex)
        {
            var resp = req.CreateResponse(HttpStatusCode.InternalServerError);
            await resp.WriteAsJsonAsync(new { error = ex.Message });
            return resp;
        }
    }

    // GET /api/ccms/coverage-cases/{id}/documents?stage=
    [Function("GetCcmsDocuments")]
    public async Task<HttpResponseData> GetForCase(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/coverage-cases/{id:guid}/documents")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var stage = req.Query["stage"];
        var list  = await _svc.GetByCaseAsync(id, stage);
        return await req.OkJsonAsync(list.Select(MapToDto).ToList());
    }

    // DELETE /api/ccms/documents/{id}
    [Function("DeleteCcmsDocument")]
    public async Task<HttpResponseData> Delete(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "ccms/documents/{id:guid}")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        try
        {
            await _svc.DeleteAsync(id, claims!.UserId);
            return req.CreateResponse(HttpStatusCode.NoContent);
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
    }

    // ── Response DTO (matches CaseDocument interface on the frontend) ──────────
    private static object MapToDto(CcmsApi.Models.Domain.CcmsDocument d) => new
    {
        id           = d.Id,
        caseId       = d.CoverageCase_Id,
        documentType = d.DocumentType,
        fileName     = d.DocumentName,
        url          = d.BlobUrl ?? string.Empty,
        mimeType     = d.MimeType,
        sizeBytes    = d.FileSizeBytes,
        uploadedBy   = d.UploadedByUserId,
        uploadedAt   = d.UploadedAt,
        isActive     = d.DeletedAt == null
    };
}
