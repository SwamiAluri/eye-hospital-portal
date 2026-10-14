using System.Net;
using LaboratoryApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace LaboratoryApi.Functions;

/// <summary>
/// L-REP-03 CUT B/C — Official PDF generate + job status + staff download. No patient publication.
/// </summary>
public class OfficialPdfFunctions
{
    private readonly IOfficialPdfService _pdf;
    private readonly JwtService _jwt;
    private readonly ILogger<OfficialPdfFunctions> _log;

    public OfficialPdfFunctions(IOfficialPdfService pdf, JwtService jwt, ILogger<OfficialPdfFunctions> log)
    {
        _pdf = pdf;
        _jwt = jwt;
        _log = log;
    }

    [Function("LmsReportOfficialPdfGenerate")]
    public async Task<HttpResponseData> Generate(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/reports/{id:guid}/official-pdf/generate")]
        HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.ReportsGenerate) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<GenerateOfficialPdfRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");

        var key = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        body = body with { IdempotencyKey = key ?? string.Empty };

        return await ExecuteAsync(
            req, () => _pdf.GenerateAsync(claims!.TenantId, claims.UserId, id, body));
    }

    [Function("LmsReportOfficialPdfJobGet")]
    public async Task<HttpResponseData> GetJob(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/reports/{id:guid}/official-pdf/jobs/{jobId:guid}")]
        HttpRequestData req,
        Guid id,
        Guid jobId)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(
                req, claims!, LaboratoryAuthz.ReportsView, LaboratoryAuthz.ReportsManage,
                LaboratoryAuthz.ReportsGenerate) is { } denied)
            return denied;

        var qp = ParseQuery(req.Url.Query);
        if (!Guid.TryParse(qp.GetValueOrDefault("operatingBranchId"), out var branchId))
            return await req.BadRequestAsync("operatingBranchId is required.");

        return await ExecuteAsync(req, async () =>
        {
            var job = await _pdf.GetJobAsync(claims!.TenantId, claims.UserId, id, jobId, branchId);
            if (job is null)
                throw new TestingDomainException("Official PDF job not found.", statusCode: 404, code: "not_found");
            return job;
        });
    }

    /// <summary>
    /// L-REP-03 CUT D-B — patient-scoped current Official PDF discovery projection (Option B branch).
    /// Does not modify CUT C download contract. Client operatingBranchId is not used for authorization.
    /// </summary>
    [Function("LmsPatientCurrentOfficialPdfDocuments")]
    public async Task<HttpResponseData> ListPatientCurrentOfficialPdfs(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/patients/{patientId:guid}/current-official-pdfs")]
        HttpRequestData req,
        Guid patientId)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(
                req, claims!, LaboratoryAuthz.ReportsView, LaboratoryAuthz.ReportsManage) is { } denied)
            return denied;

        return await ExecuteAsync(req, () =>
            _pdf.ListPatientCurrentOfficialPdfsAsync(claims!.TenantId, claims.UserId, patientId));
    }

    [Function("LmsReportOfficialPdfDownload")]
    public async Task<HttpResponseData> Download(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/reports/{id:guid}/official-pdf")]
        HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.ReportsDownload) is { } denied)
            return denied;

        var qp = ParseQuery(req.Url.Query);
        if (!Guid.TryParse(qp.GetValueOrDefault("operatingBranchId"), out var branchId))
            return await req.BadRequestAsync("operatingBranchId is required.");

        try
        {
            await using var download = await _pdf.DownloadAsync(
                claims!.TenantId, claims.UserId, id, branchId);
            var resp = req.CreateResponse(HttpStatusCode.OK);
            resp.Headers.Add("Content-Type", download.ContentType);
            var safeName = download.FileName.Replace("\"", string.Empty, StringComparison.Ordinal);
            resp.Headers.Add("Content-Disposition", $"attachment; filename=\"{safeName}\"");
            if (download.Content.ContentLength is long len && len >= 0)
                resp.Headers.Add("Content-Length", len.ToString());
            await download.Content.Content.CopyToAsync(resp.Body);
            return resp;
        }
        catch (TestingDomainException ex)
        {
            _log.LogWarning(ex, "Official PDF download domain error {Code}", ex.Code);
            return ex.StatusCode switch
            {
                403 => await req.ForbiddenAsync(ex.Message),
                404 => await req.NotFoundAsync(ex.Message),
                409 => await req.ConflictAsync(ex.Message, ex.Code),
                503 => await req.StatusJsonAsync(HttpStatusCode.ServiceUnavailable, ex.Message, ex.Code),
                _ => await req.BadRequestAsync(ex.Message, ex.Code),
            };
        }
        catch (OrderDomainException ex)
        {
            _log.LogWarning(ex, "Order/platform error during Official PDF download {Code}", ex.Code);
            return ex.StatusCode switch
            {
                403 => await req.ForbiddenAsync(ex.Message),
                404 => await req.NotFoundAsync(ex.Message),
                409 => await req.ConflictAsync(ex.Message, ex.Code),
                503 => await req.StatusJsonAsync(HttpStatusCode.ServiceUnavailable, ex.Message, ex.Code),
                _ => await req.BadRequestAsync(ex.Message, ex.Code),
            };
        }
    }

    private static string? GetIdempotencyKey(HttpRequestData req)
    {
        if (req.Headers.TryGetValues("Idempotency-Key", out var vals))
            return vals.FirstOrDefault();
        if (req.Headers.TryGetValues("X-Idempotency-Key", out var vals2))
            return vals2.FirstOrDefault();
        return null;
    }

    private static Dictionary<string, string?> ParseQuery(string query)
    {
        var dict = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        var q = query.StartsWith('?') ? query[1..] : query;
        foreach (var part in q.Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var kv = part.Split('=', 2);
            var key = Uri.UnescapeDataString(kv[0]);
            var val = kv.Length > 1 ? Uri.UnescapeDataString(kv[1]) : null;
            dict[key] = val;
        }
        return dict;
    }

    private async Task<HttpResponseData> ExecuteAsync<T>(HttpRequestData req, Func<Task<T>> action)
    {
        try
        {
            var result = await action();
            return await req.OkJsonAsync(result!);
        }
        catch (TestingDomainException ex)
        {
            _log.LogWarning(ex, "Official PDF domain error {Code}", ex.Code);
            return ex.StatusCode switch
            {
                403 => await req.ForbiddenAsync(ex.Message),
                404 => await req.NotFoundAsync(ex.Message),
                409 => await req.ConflictAsync(ex.Message, ex.Code),
                503 => await req.StatusJsonAsync(HttpStatusCode.ServiceUnavailable, ex.Message, ex.Code),
                _ => await req.BadRequestAsync(ex.Message, ex.Code),
            };
        }
        catch (OrderDomainException ex)
        {
            _log.LogWarning(ex, "Order/platform error during Official PDF {Code}", ex.Code);
            return ex.StatusCode switch
            {
                403 => await req.ForbiddenAsync(ex.Message),
                404 => await req.NotFoundAsync(ex.Message),
                409 => await req.ConflictAsync(ex.Message, ex.Code),
                503 => await req.StatusJsonAsync(HttpStatusCode.ServiceUnavailable, ex.Message, ex.Code),
                _ => await req.BadRequestAsync(ex.Message, ex.Code),
            };
        }
    }
}
