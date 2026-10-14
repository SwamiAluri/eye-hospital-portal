using System.Net;
using LaboratoryApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace LaboratoryApi.Functions;

/// <summary>L-ORD-01B LMS Order domain APIs under /api/lms/orders.</summary>
public class OrderFunctions
{
    private readonly IOrderService _orders;
    private readonly ICatalogueService _catalogue;
    private readonly JwtService _jwt;
    private readonly ILogger<OrderFunctions> _log;

    public OrderFunctions(
        IOrderService orders,
        ICatalogueService catalogue,
        JwtService jwt,
        ILogger<OrderFunctions> log)
    {
        _orders = orders;
        _catalogue = catalogue;
        _jwt = jwt;
        _log = log;
    }

    [Function("LmsCatalogueOrderables")]
    public async Task<HttpResponseData> Orderables(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/catalogue/orderables")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.OrdersCreate) is { } denied)
            return denied;

        var qp = ParseQuery(req.Url.Query);
        if (!Guid.TryParse(qp.GetValueOrDefault("operatingBranchId") ?? qp.GetValueOrDefault("branchId"), out var branchId)
            || branchId == Guid.Empty)
            return await req.BadRequestAsync("operatingBranchId is required.", "branch_required");

        var query = new OrderablesQuery(
            OperatingBranchId: branchId,
            Search: qp.GetValueOrDefault("search"),
            CatalogueType: qp.GetValueOrDefault("catalogueType") ?? qp.GetValueOrDefault("type"),
            Discipline: qp.GetValueOrDefault("discipline"),
            Classification: qp.GetValueOrDefault("classification"),
            Page: int.TryParse(qp.GetValueOrDefault("page"), out var p) ? p : 1,
            PageSize: int.TryParse(qp.GetValueOrDefault("pageSize"), out var ps) ? ps : 25);

        return await ExecuteAsync(req, () => _catalogue.ListOrderablesAsync(claims!.TenantId, query));
    }

    [Function("LmsOrdersList")]
    public async Task<HttpResponseData> List(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/orders")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.OrdersView) is { } denied)
            return denied;

        var qp = ParseQuery(req.Url.Query);
        var query = new OrderListQuery(
            Status: qp.GetValueOrDefault("status"),
            PatientId: Guid.TryParse(qp.GetValueOrDefault("patientId"), out var pid) ? pid : null,
            OperatingBranchId: Guid.TryParse(qp.GetValueOrDefault("operatingBranchId") ?? qp.GetValueOrDefault("branchId"), out var bid) ? bid : null,
            Search: qp.GetValueOrDefault("search"),
            Page: int.TryParse(qp.GetValueOrDefault("page"), out var p) ? p : 1,
            PageSize: int.TryParse(qp.GetValueOrDefault("pageSize"), out var ps) ? ps : 25);

        return await ExecuteAsync(req, () => _orders.ListAsync(claims!.TenantId, query));
    }

    [Function("LmsOrdersGet")]
    public async Task<HttpResponseData> Get(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/orders/{id:guid}")] HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.OrdersView) is { } denied)
            return denied;
        return await ExecuteAsync(req, () => _orders.GetAsync(claims!.TenantId, id));
    }

    [Function("LmsOrdersVersions")]
    public async Task<HttpResponseData> Versions(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/orders/{id:guid}/versions")] HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.OrdersView) is { } denied)
            return denied;
        return await ExecuteAsync(req, () => _orders.GetVersionsAsync(claims!.TenantId, id));
    }

    [Function("LmsOrdersCreate")]
    public async Task<HttpResponseData> Create(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/orders")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.OrdersCreate) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<CreateOrderDraftRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");

        var idem = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        if (idem is not null)
            body = body with { IdempotencyKey = idem };

        return await ExecuteAsync(req, () => _orders.CreateDraftAsync(claims!.TenantId, claims.UserId, body), created: true);
    }

    [Function("LmsOrdersUpdateDraft")]
    public async Task<HttpResponseData> UpdateDraft(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "lms/orders/{id:guid}/draft")] HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.OrdersCreate) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<UpdateOrderDraftRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");

        return await ExecuteAsync(req, () => _orders.UpdateDraftAsync(claims!.TenantId, claims.UserId, id, body));
    }

    [Function("LmsOrdersSubmit")]
    public async Task<HttpResponseData> Submit(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/orders/{id:guid}/submit")] HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.OrdersCreate) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<SubmitOrderRequest>() ?? new SubmitOrderRequest(0);
        var idem = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        if (idem is not null)
            body = body with { IdempotencyKey = idem };

        return await ExecuteAsync(req, () => _orders.SubmitAsync(claims!.TenantId, claims.UserId, id, body));
    }

    [Function("LmsOrdersAmend")]
    public async Task<HttpResponseData> Amend(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/orders/{id:guid}/amend")] HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.OrdersManage) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<AmendOrderRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");
        var idem = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        if (idem is not null)
            body = body with { IdempotencyKey = idem };

        return await ExecuteAsync(req, () => _orders.AmendAsync(claims!.TenantId, claims.UserId, id, body));
    }

    [Function("LmsOrdersCancel")]
    public async Task<HttpResponseData> Cancel(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/orders/{id:guid}/cancel")] HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.OrdersManage) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<CancelOrderRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");
        var idem = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        if (idem is not null)
            body = body with { IdempotencyKey = idem };

        return await ExecuteAsync(req, () => _orders.CancelAsync(claims!.TenantId, claims.UserId, id, body));
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
        catch (OrderDomainException ex)
        {
            _log.LogWarning(ex, "Order domain error {Code}", ex.Code);
            return ex.StatusCode switch
            {
                404 => await req.NotFoundAsync(ex.Message),
                409 => await req.ConflictAsync(ex.Message, ex.Code),
                503 => await req.StatusJsonAsync(HttpStatusCode.ServiceUnavailable, ex.Message, ex.Code),
                _ => await req.BadRequestAsync(ex.Message, ex.Code),
            };
        }
        catch (CatalogueDomainException ex)
        {
            _log.LogWarning(ex, "Catalogue domain error during order {Code}", ex.Code);
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
