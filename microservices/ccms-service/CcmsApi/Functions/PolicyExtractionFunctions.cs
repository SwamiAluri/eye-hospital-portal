using System.Net;
using System.Text.Json;
using CcmsApi.Data;
using CcmsApi.Models.Domain;
using CcmsApi.Models.Dtos;
using CcmsApi.Services;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Net.Http.Headers;

namespace CcmsApi.Functions;

/// <summary>
/// POST /ccms/coverage-cases/{caseId}/policy-extraction/upload   — OCR front/back card
/// POST /ccms/coverage-cases/{caseId}/policy-extraction/confirm — apply reviewed fields
/// </summary>
public class PolicyExtractionFunctions
{
    private const long MaxFileBytes = 10 * 1024 * 1024;

    private static readonly HashSet<string> AllowedMime = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp", "application/pdf",
    };

    private readonly IPolicyExtractionService _extractor;
    private readonly PolicyExtractionBlobService _blobs;
    private readonly VisitPolicyService _policies;
    private readonly DocumentEngineService _documents;
    private readonly CcmsDbContext _db;
    private readonly JwtService _jwt;
    private readonly IConfiguration _config;
    private readonly ILogger<PolicyExtractionFunctions> _log;

    public PolicyExtractionFunctions(
        IPolicyExtractionService extractor,
        PolicyExtractionBlobService blobs,
        VisitPolicyService policies,
        DocumentEngineService documents,
        CcmsDbContext db,
        JwtService jwt,
        IConfiguration config,
        ILogger<PolicyExtractionFunctions> log)
    {
        _extractor  = extractor;
        _blobs      = blobs;
        _policies   = policies;
        _documents  = documents;
        _db         = db;
        _jwt        = jwt;
        _config     = config;
        _log        = log;
    }

    [Function("GetPolicyExtractionStatus")]
    public async Task<HttpResponseData> GetStatus(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "ccms/policy-extraction/status")]
        HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out _, out var err))
            return await req.UnauthorizedAsync(err);

        var enabled = _config["PolicyExtraction:Enabled"] is not "false";
        return await req.OkJsonAsync(new { enabled });
    }

    [Function("UploadPolicyForExtraction")]
    public async Task<HttpResponseData> Upload(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post",
            Route = "ccms/coverage-cases/{caseId:guid}/policy-extraction/upload")]
        HttpRequestData req, Guid caseId, CancellationToken ct)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        if (_config["PolicyExtraction:Enabled"] is "false")
        {
            var disabled = req.CreateResponse(HttpStatusCode.ServiceUnavailable);
            await disabled.WriteStringAsync("Policy card extraction is currently disabled.");
            return disabled;
        }

        try
        {
            var coverageCase = await _db.CoverageCases.AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == caseId && c.DeletedAt == null, ct)
                ?? throw new KeyNotFoundException($"Coverage case {caseId} not found.");

            var contentType = req.Headers.TryGetValues("Content-Type", out var ctValues)
                ? ctValues.FirstOrDefault() ?? string.Empty
                : string.Empty;

            PolicyCardImage? front = null;
            PolicyCardImage? back  = null;
            string? paymentType = null;

            if (contentType.Contains("multipart/form-data", StringComparison.OrdinalIgnoreCase))
            {
                (front, back, paymentType) = await ParseMultipartAsync(req, contentType, claims!.TenantId, caseId, ct);
            }
            else
            {
                var side = GetHeader(req, "X-Card-Side")?.ToLowerInvariant() ?? "front";
                var filename = GetHeader(req, "X-Filename") is { } fn
                    ? Uri.UnescapeDataString(fn) : "policy-card";
                var mime = contentType.Split(';')[0].Trim();
                if (!AllowedMime.Contains(mime))
                    return await Error(req, HttpStatusCode.BadRequest,
                        $"File type '{mime}' is not supported. Allowed: JPEG, PNG, WebP, PDF.");

                using var buffer = new MemoryStream();
                await req.Body.CopyToAsync(buffer, ct);
                if (buffer.Length > MaxFileBytes)
                    return await Error(req, HttpStatusCode.BadRequest, "File exceeds 10 MB limit.");
                buffer.Position = 0;

                var sessionId = GetHeader(req, "X-Session-Id") ?? Guid.NewGuid().ToString("N");
                var url = await _blobs.UploadAsync(
                    buffer, filename, mime, claims!.TenantId, caseId, sessionId, side, ct);
                buffer.Position = 0;
                var image = new PolicyCardImage(buffer, filename, mime, url);
                if (side == "back") back = image; else front = image;
            }

            if (front is null && back is null)
                return await Error(req, HttpStatusCode.BadRequest, "No card image provided.");

            var session = GetHeader(req, "X-Session-Id") ?? Guid.NewGuid().ToString("N");

            using var openAiCts = new CancellationTokenSource(TimeSpan.FromMinutes(8));
            var preview = await _extractor.ExtractAsync(
                front, back, session, claims!.TenantId, caseId, paymentType, openAiCts.Token);

            return await req.OkJsonAsync(preview);
        }
        catch (KeyNotFoundException ex)
        {
            var nf = req.CreateResponse(HttpStatusCode.NotFound);
            await nf.WriteStringAsync(ex.Message);
            return nf;
        }
        catch (ArgumentException ex)
        {
            return await Error(req, HttpStatusCode.BadRequest, ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            _log.LogError(ex, "Policy extraction failed");
            return await Error(req, HttpStatusCode.BadGateway, ex.Message);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return await Error(req, HttpStatusCode.GatewayTimeout,
                "Policy extraction timed out. Please try again with a clearer image.");
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Unexpected policy extraction error");
            return await Error(req, HttpStatusCode.InternalServerError,
                "An unexpected error occurred during policy extraction.");
        }
    }

    [Function("ConfirmPolicyExtraction")]
    public async Task<HttpResponseData> Confirm(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post",
            Route = "ccms/coverage-cases/{caseId:guid}/policy-extraction/confirm")]
        HttpRequestData req, Guid caseId, CancellationToken ct)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        ConfirmPolicyExtractionRequest? body;
        try
        {
            body = await JsonSerializer.DeserializeAsync<ConfirmPolicyExtractionRequest>(
                req.Body, Services.HttpRequestDataExtensions.DeserializeOpts, ct);
        }
        catch
        {
            return req.CreateResponse(HttpStatusCode.BadRequest);
        }

        if (body is null || string.IsNullOrWhiteSpace(body.PolicyNumber))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("policyNumber is required.");
            return bad;
        }

        try
        {
            var coverageCase = await _db.CoverageCases
                .FirstOrDefaultAsync(c => c.Id == caseId && c.DeletedAt == null, ct)
                ?? throw new KeyNotFoundException($"Coverage case {caseId} not found.");

            if (!string.IsNullOrWhiteSpace(body.IdempotencyKey))
            {
                var prior = await _db.PolicyExtractionAuditLogs.AsNoTracking()
                    .FirstOrDefaultAsync(a =>
                        a.IdempotencyKey == body.IdempotencyKey
                        && a.CreatedPolicyId != null, ct);
                if (prior?.CreatedPolicyId is Guid existingId)
                {
                    var existing = await _db.VisitInsurancePolicies.AsNoTracking()
                        .FirstOrDefaultAsync(p => p.Id == existingId && p.DeletedAt == null, ct);
                    if (existing is not null)
                    {
                        return await req.OkJsonAsync(new ConfirmPolicyExtractionResponse(
                            existing.Id,
                            existing.PolicyNumber,
                            existing.InsuranceProviderId,
                            body.InsurerName));
                    }
                }
            }

            var policy = new CcmsVisitInsurancePolicy
            {
                TenantId             = claims!.TenantId,
                CoverageCase_Id      = caseId,
                PolicyNumber         = body.PolicyNumber.Trim(),
                CardNumber           = body.CardNumber,
                MembershipNumber     = body.MembershipNumber,
                InsuranceProviderId  = body.InsuranceProviderId,
                InsuredName          = body.InsuredName,
                RelationshipToInsured = body.RelationshipToInsured,
                CompanyName          = body.CompanyName,
                ContactNumber        = body.ContactNumber,
                IsPrimary            = body.IsPrimary,
            };

            var created = await _policies.CreateAsync(policy, claims.UserId, ct);

            if (body.ApplyToCoverageDraft)
            {
                var draft = new Dictionary<string, object?>
                {
                    ["insurerName"] = body.InsurerName,
                    ["insuranceCompany"] = body.InsurerName,
                    ["policyNumber"] = body.PolicyNumber,
                    ["cardNumber"] = body.CardNumber,
                    ["membershipNumber"] = body.MembershipNumber,
                    ["insuredName"] = body.InsuredName,
                    ["sumInsured"] = body.SumInsured,
                    ["coPay"] = body.CoPayPercent,
                    ["insuranceProviderId"] = body.InsuranceProviderId,
                };
                coverageCase.InsurerName = body.InsurerName ?? coverageCase.InsurerName;
                coverageCase.CounsellorDraftJson = JsonSerializer.Serialize(draft);
                coverageCase.IsDraft = true;
                coverageCase.DraftSavedAt = DateTime.UtcNow;
                if (body.InsuranceProviderId.HasValue)
                    coverageCase.InsuranceProviderId = body.InsuranceProviderId;
                coverageCase.UpdatedAt = DateTime.UtcNow;
                coverageCase.UpdatedByUserId = claims.UserId;
                await _db.SaveChangesAsync(ct);
            }

            await EnsureCardDocumentsAsync(
                caseId, claims.UserId, body.FrontDocumentUrl, body.BackDocumentUrl, ct);

            try
            {
                _db.PolicyExtractionAuditLogs.Add(new CcmsPolicyExtractionAuditLog
                {
                    Id               = Guid.NewGuid(),
                    TenantId         = claims.TenantId,
                    UserId           = claims.UserId,
                    CoverageCase_Id  = caseId,
                    SessionId        = body.SessionId,
                    IdempotencyKey   = body.IdempotencyKey,
                    Outcome          = "Confirmed",
                    OriginalFilename = body.OriginalFilename ?? string.Empty,
                    FrontDocumentUrl = body.FrontDocumentUrl,
                    BackDocumentUrl  = body.BackDocumentUrl,
                    BlobPurgeAt      = DateTime.UtcNow.AddDays(90),
                    ProviderModel    = body.ProviderModel ?? string.Empty,
                    ProcessingMs     = body.ProcessingMs ?? 0,
                    HighFieldCount   = body.HighFieldCount ?? 0,
                    ReviewFieldCount = body.ReviewFieldCount ?? 0,
                    LowFieldCount    = body.LowFieldCount ?? 0,
                    FieldOverrideCount = body.FieldOverrideCount ?? 0,
                    OverriddenFieldsJson = body.OverriddenFieldsJson,
                    CreatedPolicyId  = created.Id,
                    CreatedAt        = DateTime.UtcNow,
                });
                await _db.SaveChangesAsync(ct);
            }
            catch (Exception auditEx)
            {
                _log.LogError(auditEx, "Failed to write policy extraction audit for session {Session}", body.SessionId);
            }

            return await req.CreatedJsonAsync(new ConfirmPolicyExtractionResponse(
                created.Id, created.PolicyNumber, created.InsuranceProviderId, body.InsurerName));
        }
        catch (KeyNotFoundException ex)
        {
            var nf = req.CreateResponse(HttpStatusCode.NotFound);
            await nf.WriteStringAsync(ex.Message);
            return nf;
        }
        catch (InvalidOperationException ex)
        {
            var conflict = req.CreateResponse(HttpStatusCode.Conflict);
            await conflict.WriteStringAsync(ex.Message);
            return conflict;
        }
        catch (ArgumentException ex)
        {
            return await Error(req, HttpStatusCode.BadRequest, ex.Message);
        }
    }

    private async Task EnsureCardDocumentsAsync(
        Guid caseId, Guid actorId,
        string? frontUrl, string? backUrl, CancellationToken ct)
    {
        async Task attachIfMissing(string docType, string? url)
        {
            if (string.IsNullOrWhiteSpace(url)) return;
            var exists = await _db.Documents.AnyAsync(d =>
                d.CoverageCase_Id == caseId
                && d.DocumentType == docType
                && d.DeletedAt == null, ct);
            if (exists) return;

            await _documents.UploadAsync(caseId, actorId, new UploadDocumentRequest(
                Stage: "preauth",
                DocumentType: docType,
                DocumentName: docType.Replace('_', ' '),
                BlobUrl: url,
                FileSizeBytes: null,
                MimeType: null
            ), ct);
        }

        await attachIfMissing("insurance_card_front", frontUrl);
        await attachIfMissing("insurance_card_back", backUrl);
    }

    private async Task<(PolicyCardImage? front, PolicyCardImage? back, string? paymentType)> ParseMultipartAsync(
        HttpRequestData req, string contentType, Guid tenantId, Guid caseId, CancellationToken ct)
    {
        var boundaryVal = MediaTypeHeaderValue.Parse(contentType).Boundary;
        var boundary    = boundaryVal.HasValue
            ? boundaryVal.Value.ToString().Trim('"')
            : throw new InvalidOperationException("Missing multipart boundary.");

        var reader = new MultipartReader(boundary, req.Body);
        var sessionId = GetHeader(req, "X-Session-Id") ?? Guid.NewGuid().ToString("N");
        string? paymentType = null;

        MemoryStream? frontMs = null;
        MemoryStream? backMs  = null;
        string frontName = "card-front", backName = "card-back";
        string frontMime = "image/jpeg", backMime = "image/jpeg";

        MultipartSection? section;
        while ((section = await reader.ReadNextSectionAsync(ct)) != null)
        {
            var disposition = ContentDispositionHeaderValue.Parse(section.Headers!["Content-Disposition"].ToString());
            var fieldName   = disposition.Name.Value?.Trim('"') ?? string.Empty;

            if (!disposition.FileName.HasValue)
            {
                using var sr = new StreamReader(section.Body);
                var val = (await sr.ReadToEndAsync(ct)).Trim();
                if (fieldName.Equals("sessionId", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(val))
                    sessionId = val;
                else if (fieldName.Equals("paymentType", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(val))
                    paymentType = val;
                continue;
            }

            var fileName = disposition.FileName.Value!.Trim('"');
            var mime     = section.ContentType ?? "application/octet-stream";
            if (!AllowedMime.Contains(mime))
                throw new ArgumentException($"File type '{mime}' is not supported.");

            var ms = new MemoryStream();
            await section.Body.CopyToAsync(ms, ct);
            if (ms.Length > MaxFileBytes)
                throw new ArgumentException("File exceeds 10 MB limit.");
            ms.Position = 0;

            if (fieldName.Equals("back", StringComparison.OrdinalIgnoreCase)
                || fieldName.Equals("insurance_card_back", StringComparison.OrdinalIgnoreCase))
            {
                backMs = ms; backName = fileName; backMime = mime;
            }
            else
            {
                frontMs = ms; frontName = fileName; frontMime = mime;
            }
        }

        PolicyCardImage? front = null;
        PolicyCardImage? back  = null;

        if (frontMs is not null)
        {
            var url = await _blobs.UploadAsync(
                frontMs, frontName, frontMime, tenantId, caseId, sessionId, "front", ct);
            frontMs.Position = 0;
            front = new PolicyCardImage(frontMs, frontName, frontMime, url);
        }

        if (backMs is not null)
        {
            var url = await _blobs.UploadAsync(
                backMs, backName, backMime, tenantId, caseId, sessionId, "back", ct);
            backMs.Position = 0;
            back = new PolicyCardImage(backMs, backName, backMime, url);
        }

        return (front, back, paymentType);
    }

    private static string? GetHeader(HttpRequestData req, string header)
        => req.Headers.TryGetValues(header, out var v) ? v.First() : null;

    private static async Task<HttpResponseData> Error(HttpRequestData req, HttpStatusCode code, string msg)
    {
        var res = req.CreateResponse(code);
        await res.WriteStringAsync(msg);
        return res;
    }
}
