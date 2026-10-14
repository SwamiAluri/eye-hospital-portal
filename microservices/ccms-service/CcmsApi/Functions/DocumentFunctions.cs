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

                Stream?  fileStream        = null;
                string?  multipartFileName = null;
                string?  explicitFileName  = null;
                string   mimeType          = "application/octet-stream";
                string   docType           = "other";
                string   stage             = "preauth";

                MultipartSection? section;
                while ((section = await reader.ReadNextSectionAsync()) != null)
                {
                    var dispositionStr = section.Headers!["Content-Disposition"].ToString();
                    var disposition    = ContentDispositionHeaderValue.Parse(dispositionStr);

                    var fieldName = disposition.Name.Value?.Trim('"') ?? string.Empty;

                    if (fieldName.Equals("file", StringComparison.OrdinalIgnoreCase))
                    {
                        var partName = CcmsDocumentFileNames.FromContentDisposition(disposition);
                        if (!string.IsNullOrEmpty(partName))
                            multipartFileName = partName;

                        var ms = new MemoryStream();
                        await section.Body.CopyToAsync(ms);
                        ms.Seek(0, SeekOrigin.Begin);
                        fileStream = ms;
                        mimeType   = section.ContentType ?? mimeType;
                    }
                    else
                    {
                        using var sr  = new StreamReader(section.Body);
                        var value     = (await sr.ReadToEndAsync()).Trim();

                        if (fieldName.Equals("documentType", StringComparison.OrdinalIgnoreCase))
                            docType = value;
                        else if (fieldName.Equals("stage", StringComparison.OrdinalIgnoreCase))
                            stage = value;
                        else if (fieldName.Equals("fileName", StringComparison.OrdinalIgnoreCase))
                            explicitFileName = value;
                    }
                }

                if (fileStream is null || fileStream.Length <= 0)
                {
                    var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                    await bad.WriteAsJsonAsync(new { error = "No non-empty 'file' part found in multipart body." });
                    return bad;
                }

                var resolvedFileName = CcmsDocumentFileNames.Resolve(multipartFileName, explicitFileName, docType);

                result = await _svc.UploadFileAsync(
                    id, claims!.UserId, fileStream, resolvedFileName, mimeType, docType,
                    CcmsDocumentStages.Normalize(stage));
            }
            else
            {
                // JSON metadata path — only for integrations that already uploaded to blob storage.
                var body = await JsonSerializer.DeserializeAsync<UploadDocumentRequest>(
                    req.Body, CcmsApi.Services.HttpRequestDataExtensions.DeserializeOpts);
                if (body is null)
                {
                    return req.CreateResponse(HttpStatusCode.BadRequest);
                }
                if (string.IsNullOrWhiteSpace(body.BlobUrl) || (body.FileSizeBytes ?? 0) <= 0)
                {
                    var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                    await bad.WriteAsJsonAsync(new
                    {
                        error = "Binary file upload required. POST multipart/form-data with a non-empty file part.",
                    });
                    return bad;
                }
                result = await _svc.UploadAsync(id, claims!.UserId, body);
            }

            CcmsDocumentUploadValidator.EnsureCompleteFileDocument(result);

            var resp = req.CreateResponse(HttpStatusCode.Created);
            await resp.WriteAsJsonAsync(MapToDto(result, await _svc.TryBuildReadAccessUrlAsync(result)));
            return resp;
        }
        catch (KeyNotFoundException ex)
        {
            var notFound = req.CreateResponse(HttpStatusCode.NotFound);
            await notFound.WriteAsJsonAsync(new { error = ex.Message });
            return notFound;
        }
        catch (Exception ex)
        {
            var resp = req.CreateResponse(HttpStatusCode.InternalServerError);
            await resp.WriteAsJsonAsync(new { error = DatabaseExceptionFormatter.ToClientMessage(ex) });
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
        if (await CcmsAuthz.ForbidUnlessAsync(req, claims!, "ccms.document.read") is { } forbidden)
            return forbidden;

        var stage = req.Query["stage"];
        var list  = await _svc.GetByCaseAsync(id, stage);
        var dtos = new List<object>(list.Count);
        foreach (var d in list)
            dtos.Add(MapToDto(d, await _svc.TryBuildReadAccessUrlAsync(d)));
        return await req.OkJsonAsync(dtos);
    }

    // GET /api/ccms/documents/by-patient/{patientId}
    // Metadata only. Does not build access URLs or open blobs.
    [Function("GetCcmsDocumentsByPatient")]
    public async Task<HttpResponseData> ByPatient(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/documents/by-patient/{patientId:guid}")] HttpRequestData req,
        Guid patientId)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await CcmsAuthz.ForbidUnlessAsync(req, claims!, "ccms.document.read") is { } forbidden)
            return forbidden;

        int.TryParse(req.Query["pageNumber"], out var page);
        if (page == 0) int.TryParse(req.Query["page"], out page);
        int.TryParse(req.Query["pageSize"], out var pageSize);
        var insuranceOnly = string.Equals(req.Query["insuranceOnly"], "true", StringComparison.OrdinalIgnoreCase)
            || string.Equals(req.Query["insuranceOnly"], "1", StringComparison.OrdinalIgnoreCase);

        var list = await _svc.ListMetadataByPatientIdAsync(
            claims!.TenantId, patientId, page, pageSize, insuranceOnly);
        return await req.OkJsonAsync(new
        {
            documents  = list.Items,
            totalCount = list.Total,
            pageNumber = list.Page,
            pageSize   = list.PageSize,
        });
    }

    // GET /api/ccms/coverage-cases/{caseId}/documents/{docId}/access-url
    [Function("GetCcmsDocumentAccessUrl")]
    public async Task<HttpResponseData> GetAccessUrl(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "ccms/coverage-cases/{caseId:guid}/documents/{docId:guid}/access-url")]
        HttpRequestData req, Guid caseId, Guid docId)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await CcmsAuthz.ForbidUnlessAsync(req, claims!, "ccms.document.read") is { } forbidden)
            return forbidden;

        try
        {
            var result = await _svc.GetReadAccessUrlAsync(docId, caseId);
            return await req.OkJsonAsync(new
            {
                url       = result.Url,
                expiresAt = result.ExpiresAt,
                isPointer = result.IsPointer,
            });
        }
        catch (KeyNotFoundException ex)
        {
            var notFound = req.CreateResponse(HttpStatusCode.NotFound);
            await notFound.WriteAsJsonAsync(new { error = ex.Message });
            return notFound;
        }
        catch (InvalidOperationException ex)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = ex.Message });
            return bad;
        }
        catch (Exception ex)
        {
            var resp = req.CreateResponse(HttpStatusCode.InternalServerError);
            await resp.WriteAsJsonAsync(new { error = DatabaseExceptionFormatter.ToClientMessage(ex) });
            return resp;
        }
    }

    // GET /api/ccms/documents/{docId}/access-url?coverageCaseId=
    [Function("GetCcmsDocumentAccessUrlById")]
    public async Task<HttpResponseData> GetAccessUrlByDocumentId(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "ccms/documents/{docId:guid}/access-url")]
        HttpRequestData req, Guid docId)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await CcmsAuthz.ForbidUnlessAsync(req, claims!, "ccms.document.read") is { } forbidden)
            return forbidden;

        Guid? caseId = null;
        var caseIdRaw = req.Query["coverageCaseId"];
        if (!string.IsNullOrWhiteSpace(caseIdRaw))
        {
            if (!Guid.TryParse(caseIdRaw, out var parsed))
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = "Invalid coverageCaseId query parameter." });
                return bad;
            }
            caseId = parsed;
        }

        try
        {
            var result = await _svc.GetReadAccessUrlAsync(docId, caseId);
            return await req.OkJsonAsync(new
            {
                url       = result.Url,
                expiresAt = result.ExpiresAt,
                isPointer = result.IsPointer,
            });
        }
        catch (KeyNotFoundException ex)
        {
            var notFound = req.CreateResponse(HttpStatusCode.NotFound);
            await notFound.WriteAsJsonAsync(new { error = ex.Message });
            return notFound;
        }
        catch (InvalidOperationException ex)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = ex.Message });
            return bad;
        }
        catch (Exception ex)
        {
            var resp = req.CreateResponse(HttpStatusCode.InternalServerError);
            await resp.WriteAsJsonAsync(new { error = DatabaseExceptionFormatter.ToClientMessage(ex) });
            return resp;
        }
    }

    // GET /api/ccms/documents/{docId}/content?coverageCaseId=
    [Function("GetCcmsDocumentContent")]
    public async Task<HttpResponseData> GetDocumentContent(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "ccms/documents/{docId:guid}/content")]
        HttpRequestData req, Guid docId)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await CcmsAuthz.ForbidUnlessAsync(req, claims!, "ccms.document.read") is { } forbidden)
            return forbidden;

        Guid? caseId = null;
        var caseIdRaw = req.Query["coverageCaseId"];
        if (!string.IsNullOrWhiteSpace(caseIdRaw))
        {
            if (!Guid.TryParse(caseIdRaw, out var parsed))
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = "Invalid coverageCaseId query parameter." });
                return bad;
            }
            caseId = parsed;
        }

        try
        {
            var content = await _svc.OpenBlobReadStreamAsync(docId, caseId);
            var resp = req.CreateResponse(HttpStatusCode.OK);
            resp.Headers.Add("Content-Type", content.ContentType);
            if (content.ContentLength is > 0)
                resp.Headers.Add("Content-Length", content.ContentLength.Value.ToString());
            var safeName = ToContentDispositionFileName(content.FileName);
            resp.Headers.Add("Content-Disposition", $"inline; filename=\"{safeName}\"");
            await content.Stream.CopyToAsync(resp.Body);
            return resp;
        }
        catch (KeyNotFoundException ex)
        {
            return await req.NotFoundAsync(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = ex.Message });
            return bad;
        }
        catch (Exception ex)
        {
            var resp = req.CreateResponse(HttpStatusCode.InternalServerError);
            await resp.WriteAsJsonAsync(new { error = DatabaseExceptionFormatter.ToClientMessage(ex) });
            return resp;
        }
    }

    // POST /api/ccms/coverage-cases/{id}/documents/pacs-study
    [Function("AttachPacsStudy")]
    public async Task<HttpResponseData> AttachPacsStudy(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post",
            Route = "ccms/coverage-cases/{id:guid}/documents/pacs-study")]
        HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        try
        {
            var body = await JsonSerializer.DeserializeAsync<AttachPacsStudyRequest>(
                req.Body, CcmsApi.Services.HttpRequestDataExtensions.DeserializeOpts)
                ?? throw new ArgumentException("Body required.");
            var result = await _svc.AttachPacsStudyAsync(
                id, claims!.UserId, body.StudyUid, body.AccessionNumber);
            var resp = req.CreateResponse(HttpStatusCode.Created);
            await resp.WriteAsJsonAsync(MapToDto(result, await _svc.TryBuildReadAccessUrlAsync(result)));
            return resp;
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
        catch (ArgumentException ex)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = ex.Message });
            return bad;
        }
    }

    // POST /api/ccms/coverage-cases/{id}/documents/biometry
    [Function("AttachBiometryRecord")]
    public async Task<HttpResponseData> AttachBiometryRecord(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post",
            Route = "ccms/coverage-cases/{id:guid}/documents/biometry")]
        HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        try
        {
            var body = await JsonSerializer.DeserializeAsync<AttachBiometryRecordRequest>(
                req.Body, CcmsApi.Services.HttpRequestDataExtensions.DeserializeOpts)
                ?? throw new ArgumentException("Body required.");
            var result = await _svc.AttachBiometryRecordAsync(
                id, claims!.UserId, body.BiometryRecordId,
                body.Eye, body.ExaminationDate, body.CalculatedIol, body.Device);
            var resp = req.CreateResponse(HttpStatusCode.Created);
            await resp.WriteAsJsonAsync(MapToDto(result, await _svc.TryBuildReadAccessUrlAsync(result)));
            return resp;
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
        catch (ArgumentException ex)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = ex.Message });
            return bad;
        }
    }

    // POST /api/ccms/documents/{docId}/ensure-canonical
    // Lazy/idempotent historical registration (file-backed only). Requires document.read.
    [Function("EnsureCcmsDocumentCanonical")]
    public async Task<HttpResponseData> EnsureCanonical(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post",
            Route = "ccms/documents/{docId:guid}/ensure-canonical")]
        HttpRequestData req, Guid docId)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await CcmsAuthz.ForbidUnlessAsync(req, claims!, "ccms.document.read") is { } forbidden)
            return forbidden;

        try
        {
            var canonicalId = await _svc.EnsureCanonicalRegistrationAsync(docId, claims!.UserId);
            return await req.OkJsonAsync(new
            {
                ccmsDocumentId = docId,
                canonicalDocumentId = canonicalId,
                registered = canonicalId is not null,
            });
        }
        catch (KeyNotFoundException ex)
        {
            return await req.NotFoundAsync(ex.Message);
        }
        catch (Exception ex)
        {
            var resp = req.CreateResponse(HttpStatusCode.InternalServerError);
            await resp.WriteAsJsonAsync(new { error = DatabaseExceptionFormatter.ToClientMessage(ex) });
            return resp;
        }
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
    private static object MapToDto(CcmsApi.Models.Domain.CcmsDocument d, string? accessUrl = null) => new
    {
        id           = d.Id,
        caseId       = d.CoverageCase_Id,
        documentType = d.DocumentType,
        fileName     = d.DocumentName,
        url          = d.BlobUrl ?? string.Empty,
        accessUrl    = accessUrl ?? string.Empty,
        mimeType     = d.MimeType,
        sizeBytes    = d.FileSizeBytes,
        uploadedBy   = d.UploadedByUserId,
        uploadedAt   = d.UploadedAt,
        isActive     = d.DeletedAt == null
    };

    private static string ToContentDispositionFileName(string? fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
            return "document";

        var sanitized = fileName.Trim()
            .Replace("\"", string.Empty, StringComparison.Ordinal)
            .Replace("\r", string.Empty, StringComparison.Ordinal)
            .Replace("\n", string.Empty, StringComparison.Ordinal);

        foreach (var ch in new[] { '(', ')', ';', ',', '\\' })
            sanitized = sanitized.Replace(ch, '_');

        return string.IsNullOrWhiteSpace(sanitized) ? "document" : sanitized;
    }
}
