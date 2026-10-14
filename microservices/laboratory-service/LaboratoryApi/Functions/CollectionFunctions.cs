using System.Net;
using LaboratoryApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace LaboratoryApi.Functions;

/// <summary>L-COL-01B LMS CollectionTask APIs under /api/lms/collection.</summary>
public class CollectionFunctions
{
    private readonly ICollectionService _collection;
    private readonly JwtService _jwt;
    private readonly ILogger<CollectionFunctions> _log;

    public CollectionFunctions(
        ICollectionService collection,
        JwtService jwt,
        ILogger<CollectionFunctions> log)
    {
        _collection = collection;
        _jwt = jwt;
        _log = log;
    }

    [Function("LmsCollectionTasksList")]
    public async Task<HttpResponseData> List(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/collection/tasks")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.CollectionView) is { } denied)
            return denied;

        var qp = ParseQuery(req.Url.Query);
        var query = new CollectionTaskListQuery(
            Status: qp.GetValueOrDefault("status"),
            CollectionBranchId: Guid.TryParse(
                qp.GetValueOrDefault("collectionBranchId") ?? qp.GetValueOrDefault("branchId"), out var bid)
                ? bid
                : null,
            OrderId: Guid.TryParse(qp.GetValueOrDefault("orderId"), out var oid) ? oid : null,
            Search: qp.GetValueOrDefault("search"),
            Page: int.TryParse(qp.GetValueOrDefault("page"), out var p) ? p : 1,
            PageSize: int.TryParse(qp.GetValueOrDefault("pageSize"), out var ps) ? ps : 25);

        return await ExecuteAsync(req, () => _collection.ListAsync(claims!.TenantId, query));
    }

    [Function("LmsCollectionTasksGet")]
    public async Task<HttpResponseData> Get(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/collection/tasks/{id:guid}")] HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.CollectionView) is { } denied)
            return denied;
        return await ExecuteAsync(req, () => _collection.GetAsync(claims!.TenantId, id));
    }

    [Function("LmsCollectionPlanContext")]
    public async Task<HttpResponseData> PlanContext(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/collection/orders/{orderId:guid}/plan-context")]
        HttpRequestData req,
        Guid orderId)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.CollectionManage) is { } denied)
            return denied;
        return await ExecuteAsync(req, () => _collection.GetPlanContextAsync(claims!.TenantId, orderId));
    }

    [Function("LmsCollectionTasksCreate")]
    public async Task<HttpResponseData> Create(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/collection/tasks")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.CollectionManage) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<CreateCollectionTaskRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");

        var idem = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        if (idem is not null)
            body = body with { IdempotencyKey = idem };

        return await ExecuteAsync(req, () => _collection.CreateAsync(claims!.TenantId, claims.UserId, body), created: true);
    }

    [Function("LmsCollectionTasksTransition")]
    public async Task<HttpResponseData> Transition(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/collection/tasks/{id:guid}/transition")]
        HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(
                req, claims!, LaboratoryAuthz.CollectionManage, LaboratoryAuthz.CollectionCollect) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<TransitionCollectionTaskRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");
        var idem = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        if (idem is not null)
            body = body with { IdempotencyKey = idem };

        return await ExecuteAsync(req, () => _collection.TransitionAsync(claims!.TenantId, claims.UserId, id, body));
    }

    [Function("LmsCollectionTasksClaim")]
    public async Task<HttpResponseData> Claim(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/collection/tasks/{id:guid}/claim")]
        HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.CollectionCollect) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<ClaimCollectionTaskRequest>()
                   ?? new ClaimCollectionTaskRequest(0);
        var idem = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        if (idem is not null)
            body = body with { IdempotencyKey = idem };

        return await ExecuteAsync(req, () => _collection.ClaimAsync(claims!.TenantId, claims.UserId, id, body));
    }

    [Function("LmsCollectionTasksAssign")]
    public async Task<HttpResponseData> Assign(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/collection/tasks/{id:guid}/assign")]
        HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.CollectionManage) is { } denied)
            return denied;

        // Parse inside ExecuteAsync so JsonException on assignToUserId → 400 assignee_invalid (not 500).
        return await ExecuteAsync(req, async () =>
        {
            var body = await CollectionAssignJson.ReadAsync(req.Body);
            var idem = GetIdempotencyKey(req) ?? body.IdempotencyKey;
            if (idem is not null)
                body = body with { IdempotencyKey = idem };
            return await _collection.AssignAsync(claims!.TenantId, claims.UserId, id, body);
        });
    }

    [Function("LmsCollectionTasksRelease")]
    public async Task<HttpResponseData> Release(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/collection/tasks/{id:guid}/release")]
        HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(
                req, claims!, LaboratoryAuthz.CollectionCollect, LaboratoryAuthz.CollectionManage) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<ReleaseCollectionTaskRequest>()
                   ?? new ReleaseCollectionTaskRequest(0);
        var idem = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        if (idem is not null)
            body = body with { IdempotencyKey = idem };

        return await ExecuteAsync(req, () => _collection.ReleaseAsync(claims!.TenantId, claims.UserId, id, body));
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
        catch (CollectionDomainException ex)
        {
            _log.LogWarning(ex, "Collection domain error {Code}", ex.Code);
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
            _log.LogWarning(ex, "Order domain error during collection {Code}", ex.Code);
            return ex.StatusCode switch
            {
                404 => await req.NotFoundAsync(ex.Message),
                409 => await req.ConflictAsync(ex.Message, ex.Code),
                503 => await req.StatusJsonAsync(HttpStatusCode.ServiceUnavailable, ex.Message, ex.Code),
                _ => await req.BadRequestAsync(ex.Message, ex.Code),
            };
        }
    }
}
