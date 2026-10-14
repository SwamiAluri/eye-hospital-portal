using System.Net;
using LaboratoryApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace LaboratoryApi.Functions;

/// <summary>L-TST-01A Testing work queue + Result Draft APIs under /api/lms/testing.</summary>
public class TestingFunctions
{
    private readonly IResultService _results;
    private readonly ICriticalResultService _critical;
    private readonly JwtService _jwt;
    private readonly ILogger<TestingFunctions> _log;

    public TestingFunctions(
        IResultService results,
        ICriticalResultService critical,
        JwtService jwt,
        ILogger<TestingFunctions> log)
    {
        _results = results;
        _critical = critical;
        _jwt = jwt;
        _log = log;
    }

    [Function("LmsTestingWorkQueue")]
    public async Task<HttpResponseData> ListWorkQueue(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/testing/work-queue")]
        HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(
                req, claims!, LaboratoryAuthz.TestingView, LaboratoryAuthz.TestingManage,
                LaboratoryAuthz.TestingResult, LaboratoryAuthz.TestingVerify,
                LaboratoryAuthz.ResultsAuthorize) is { } denied)
            return denied;

        var qp = ParseQuery(req.Url.Query);
        var query = new TestingWorkQueueQuery(
            OperatingBranchId: Guid.TryParse(qp.GetValueOrDefault("operatingBranchId"), out var b) ? b : null,
            Search: qp.GetValueOrDefault("search"),
            Priority: qp.GetValueOrDefault("priority"),
            HasDraft: bool.TryParse(qp.GetValueOrDefault("hasDraft"), out var hd) ? hd : null,
            ResultStatus: qp.GetValueOrDefault("resultStatus"),
            Page: int.TryParse(qp.GetValueOrDefault("page"), out var p) ? p : 1,
            PageSize: int.TryParse(qp.GetValueOrDefault("pageSize"), out var ps) ? ps : 25);

        return await ExecuteAsync(req, () =>
            _results.ListWorkQueueAsync(claims!.TenantId, claims.UserId, query));
    }

    [Function("LmsTestingWorkItem")]
    public async Task<HttpResponseData> GetWorkItem(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/testing/work-items")]
        HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(
                req, claims!, LaboratoryAuthz.TestingView, LaboratoryAuthz.TestingManage,
                LaboratoryAuthz.TestingResult, LaboratoryAuthz.TestingVerify,
                LaboratoryAuthz.ResultsAuthorize) is { } denied)
            return denied;

        var qp = ParseQuery(req.Url.Query);
        if (!Guid.TryParse(qp.GetValueOrDefault("orderTestId"), out var orderTestId)
            || !Guid.TryParse(qp.GetValueOrDefault("specimenId"), out var specimenId)
            || !Guid.TryParse(qp.GetValueOrDefault("operatingBranchId"), out var branchId))
            return await req.BadRequestAsync("orderTestId, specimenId, and operatingBranchId are required.");

        return await ExecuteAsync(req, () =>
            _results.GetWorkItemAsync(claims!.TenantId, claims.UserId, orderTestId, specimenId, branchId));
    }

    [Function("LmsResultDraftGet")]
    public async Task<HttpResponseData> GetDraft(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/testing/results/{id:guid}")]
        HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(
                req, claims!, LaboratoryAuthz.TestingView, LaboratoryAuthz.TestingManage,
                LaboratoryAuthz.TestingResult, LaboratoryAuthz.TestingVerify,
                LaboratoryAuthz.ResultsAuthorize) is { } denied)
            return denied;

        return await ExecuteAsync(req, () => _results.GetDraftAsync(claims!.TenantId, id));
    }

    [Function("LmsResultDraftCreate")]
    public async Task<HttpResponseData> CreateDraft(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/testing/results")]
        HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.TestingResult) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<CreateResultDraftRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");

        var idem = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        if (idem is not null)
            body = body with { IdempotencyKey = idem };

        return await ExecuteAsync(
            req, () => _results.CreateDraftAsync(claims!.TenantId, claims.UserId, body), created: true);
    }

    [Function("LmsResultDraftUpdate")]
    public async Task<HttpResponseData> UpdateDraft(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "lms/testing/results/{id:guid}")]
        HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.TestingResult) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<UpdateResultDraftRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");

        var idem = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        if (idem is not null)
            body = body with { IdempotencyKey = idem };

        return await ExecuteAsync(
            req, () => _results.UpdateDraftAsync(claims!.TenantId, claims.UserId, id, body));
    }

    [Function("LmsResultVerify")]
    public async Task<HttpResponseData> VerifyResult(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/testing/results/{id:guid}/verify")]
        HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.TestingVerify) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<VerifyResultRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");

        var idem = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        if (idem is not null)
            body = body with { IdempotencyKey = idem };

        return await ExecuteAsync(
            req, () => _results.VerifyAsync(claims!.TenantId, claims.UserId, id, body));
    }

    [Function("LmsResultAuthorize")]
    public async Task<HttpResponseData> AuthorizeResult(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/testing/results/{id:guid}/authorize")]
        HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.ResultsAuthorize) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<AuthorizeResultRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");

        var idem = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        if (idem is not null)
            body = body with { IdempotencyKey = idem };

        return await ExecuteAsync(
            req, () => _results.AuthorizeAsync(claims!.TenantId, claims.UserId, id, body));
    }

    [Function("LmsCriticalWorkQueue")]
    public async Task<HttpResponseData> ListCriticalWorkQueue(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/testing/critical-work-queue")]
        HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(
                req, claims!, LaboratoryAuthz.ResultsCriticalView,
                LaboratoryAuthz.ResultsCriticalManage, LaboratoryAuthz.ResultsCriticalAcknowledge) is { } denied)
            return denied;

        var qp = ParseQuery(req.Url.Query);
        var query = new CriticalWorkQueueQuery(
            OperatingBranchId: Guid.TryParse(qp.GetValueOrDefault("operatingBranchId"), out var b) ? b : null,
            Status: qp.GetValueOrDefault("status"),
            Search: qp.GetValueOrDefault("search"),
            Page: int.TryParse(qp.GetValueOrDefault("page"), out var p) ? p : 1,
            PageSize: int.TryParse(qp.GetValueOrDefault("pageSize"), out var ps) ? ps : 25);

        return await ExecuteAsync(req, () =>
            _critical.ListWorkQueueAsync(claims!.TenantId, claims.UserId, query));
    }

    [Function("LmsResultCriticalList")]
    public async Task<HttpResponseData> ListCriticalForResult(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/testing/results/{id:guid}/critical")]
        HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(
                req, claims!, LaboratoryAuthz.ResultsCriticalView,
                LaboratoryAuthz.ResultsCriticalManage, LaboratoryAuthz.ResultsCriticalAcknowledge) is { } denied)
            return denied;

        var qp = ParseQuery(req.Url.Query);
        if (!Guid.TryParse(qp.GetValueOrDefault("operatingBranchId"), out var branchId))
            return await req.BadRequestAsync("operatingBranchId is required.");

        return await ExecuteAsync(req, () =>
            _critical.ListForResultAsync(claims!.TenantId, claims.UserId, id, branchId));
    }

    [Function("LmsResultCriticalCreate")]
    public async Task<HttpResponseData> CreateCriticalEvent(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/testing/results/{id:guid}/critical")]
        HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.ResultsCriticalManage) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<CreateCriticalEventRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");

        var idem = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        if (idem is not null)
            body = body with { IdempotencyKey = idem };

        return await ExecuteAsync(
            req, () => _critical.CreateAsync(claims!.TenantId, claims.UserId, id, body), created: true);
    }

    [Function("LmsResultCriticalAcknowledge")]
    public async Task<HttpResponseData> AcknowledgeCriticalEvent(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post",
            Route = "lms/testing/results/{id:guid}/critical/{criticalEventId:guid}/acknowledge")]
        HttpRequestData req,
        Guid id,
        Guid criticalEventId)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(
                req, claims!, LaboratoryAuthz.ResultsCriticalAcknowledge) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<AcknowledgeCriticalEventRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");

        var idem = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        if (idem is not null)
            body = body with { IdempotencyKey = idem };

        return await ExecuteAsync(
            req, () => _critical.AcknowledgeAsync(claims!.TenantId, claims.UserId, id, criticalEventId, body));
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
            _log.LogWarning(ex, "Testing domain error {Code}", ex.Code);
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
            _log.LogWarning(ex, "Order/platform error during testing {Code}", ex.Code);
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
