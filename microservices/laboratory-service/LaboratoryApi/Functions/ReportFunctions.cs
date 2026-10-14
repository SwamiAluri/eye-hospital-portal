using System.Net;
using LaboratoryApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace LaboratoryApi.Functions;

/// <summary>LMS Report APIs under /api/lms/reports. Draft + Finalize + Release + Assign Number. Official PDF is OfficialPdfFunctions.</summary>
public class ReportFunctions
{
    private readonly IReportService _reports;
    private readonly JwtService _jwt;
    private readonly ILogger<ReportFunctions> _log;

    public ReportFunctions(IReportService reports, JwtService jwt, ILogger<ReportFunctions> log)
    {
        _reports = reports;
        _jwt = jwt;
        _log = log;
    }

    [Function("LmsReportsEligibleSources")]
    public async Task<HttpResponseData> ListEligibleSources(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/reports/eligible-sources")]
        HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(
                req, claims!, LaboratoryAuthz.ReportsView, LaboratoryAuthz.ReportsManage) is { } denied)
            return denied;

        var qp = ParseQuery(req.Url.Query);
        if (!Guid.TryParse(qp.GetValueOrDefault("operatingBranchId"), out var branchId))
            return await req.BadRequestAsync("operatingBranchId is required.");

        Guid? orderId = Guid.TryParse(qp.GetValueOrDefault("orderId"), out var o) ? o : null;
        var page = int.TryParse(qp.GetValueOrDefault("page"), out var p) ? p : 1;
        var pageSize = int.TryParse(qp.GetValueOrDefault("pageSize"), out var ps) ? ps : 50;

        return await ExecuteAsync(req, () =>
            _reports.ListEligibleSourcesAsync(
                claims!.TenantId, claims.UserId, branchId, orderId, page, pageSize));
    }

    [Function("LmsReportsList")]
    public async Task<HttpResponseData> List(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/reports")]
        HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(
                req, claims!, LaboratoryAuthz.ReportsView, LaboratoryAuthz.ReportsManage) is { } denied)
            return denied;

        var qp = ParseQuery(req.Url.Query);
        var query = new ReportListQuery(
            OperatingBranchId: Guid.TryParse(qp.GetValueOrDefault("operatingBranchId"), out var b) ? b : null,
            PatientId: Guid.TryParse(qp.GetValueOrDefault("patientId"), out var p) ? p : null,
            OrderId: Guid.TryParse(qp.GetValueOrDefault("orderId"), out var o) ? o : null,
            Status: qp.GetValueOrDefault("status"),
            Page: int.TryParse(qp.GetValueOrDefault("page"), out var page) ? page : 1,
            PageSize: int.TryParse(qp.GetValueOrDefault("pageSize"), out var ps) ? ps : 25);

        return await ExecuteAsync(req, () =>
            _reports.ListAsync(claims!.TenantId, claims.UserId, query));
    }

    [Function("LmsReportCreate")]
    public async Task<HttpResponseData> Create(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/reports")]
        HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.ReportsManage) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<CreateReportDraftRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");

        var key = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        body = body with { IdempotencyKey = key ?? string.Empty };

        return await ExecuteAsync(
            req, () => _reports.CreateDraftAsync(claims!.TenantId, claims.UserId, body), created: true);
    }

    [Function("LmsReportGet")]
    public async Task<HttpResponseData> Get(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/reports/{id:guid}")]
        HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(
                req, claims!, LaboratoryAuthz.ReportsView, LaboratoryAuthz.ReportsManage) is { } denied)
            return denied;

        var qp = ParseQuery(req.Url.Query);
        if (!Guid.TryParse(qp.GetValueOrDefault("operatingBranchId"), out var branchId))
            return await req.BadRequestAsync("operatingBranchId is required.");

        return await ExecuteAsync(req, () =>
            _reports.GetAsync(claims!.TenantId, claims.UserId, id, branchId));
    }

    [Function("LmsReportVersionGet")]
    public async Task<HttpResponseData> GetVersion(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "lms/reports/{id:guid}/versions/{versionNumber:int}")]
        HttpRequestData req,
        Guid id,
        int versionNumber)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(
                req, claims!, LaboratoryAuthz.ReportsView, LaboratoryAuthz.ReportsManage) is { } denied)
            return denied;

        var qp = ParseQuery(req.Url.Query);
        if (!Guid.TryParse(qp.GetValueOrDefault("operatingBranchId"), out var branchId))
            return await req.BadRequestAsync("operatingBranchId is required.");

        return await ExecuteAsync(req, () =>
            _reports.GetVersionAsync(claims!.TenantId, claims.UserId, id, versionNumber, branchId));
    }

    [Function("LmsReportVersionAppend")]
    public async Task<HttpResponseData> AppendVersion(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/reports/{id:guid}/versions")]
        HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.ReportsManage) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<AppendReportVersionRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");

        var key = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        body = body with { IdempotencyKey = key ?? string.Empty };

        return await ExecuteAsync(
            req, () => _reports.AppendVersionAsync(claims!.TenantId, claims.UserId, id, body), created: true);
    }

    [Function("LmsReportFinalize")]
    public async Task<HttpResponseData> Finalize(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/reports/{id:guid}/finalize")]
        HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.ReportsFinalize) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<FinalizeReportRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");

        var key = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        body = body with { IdempotencyKey = key ?? string.Empty };

        return await ExecuteAsync(
            req, () => _reports.FinalizeAsync(claims!.TenantId, claims.UserId, id, body));
    }

    [Function("LmsReportRelease")]
    public async Task<HttpResponseData> Release(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/reports/{id:guid}/release")]
        HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.ReportsRelease) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<ReleaseReportRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");

        var key = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        body = body with { IdempotencyKey = key ?? string.Empty };

        return await ExecuteAsync(
            req, () => _reports.ReleaseAsync(claims!.TenantId, claims.UserId, id, body));
    }

    [Function("LmsReportAssignNumber")]
    public async Task<HttpResponseData> AssignNumber(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/reports/{id:guid}/assign-number")]
        HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.ReportsAssignNumber) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<AssignReportNumberRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");

        var key = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        body = body with { IdempotencyKey = key ?? string.Empty };

        return await ExecuteAsync(
            req, () => _reports.AssignNumberAsync(claims!.TenantId, claims.UserId, id, body));
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

    private async Task<HttpResponseData> ExecuteAsync<T>(
        HttpRequestData req, Func<Task<T>> action, bool created = false)
    {
        try
        {
            var result = await action();
            return created ? await req.CreatedJsonAsync(result!) : await req.OkJsonAsync(result!);
        }
        catch (TestingDomainException ex)
        {
            _log.LogWarning(ex, "Report domain error {Code}", ex.Code);
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
            _log.LogWarning(ex, "Order/platform error during reporting {Code}", ex.Code);
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
