using System.Net;
using LaboratoryApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace LaboratoryApi.Functions;

/// <summary>
/// L-CAT-01B governed catalogue APIs under /api/lms/catalogue.
/// Lifecycle transitions are dedicated endpoints — no arbitrary status assignment.
/// </summary>
public class CatalogueFunctions
{
    private readonly ICatalogueService _catalogue;
    private readonly JwtService _jwt;
    private readonly ILogger<CatalogueFunctions> _log;

    public CatalogueFunctions(ICatalogueService catalogue, JwtService jwt, ILogger<CatalogueFunctions> log)
    {
        _catalogue = catalogue;
        _jwt = jwt;
        _log = log;
    }

    [Function("LmsCatalogueList")]
    public async Task<HttpResponseData> List(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/catalogue")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.CatalogueView) is { } denied)
            return denied;

        var qp = ParseQuery(req.Url.Query);
        var listQuery = new CatalogueListQuery(
            Search: qp.GetValueOrDefault("search"),
            CatalogueType: qp.GetValueOrDefault("catalogueType") ?? qp.GetValueOrDefault("type"),
            Discipline: qp.GetValueOrDefault("discipline"),
            Status: qp.GetValueOrDefault("status"),
            Classification: qp.GetValueOrDefault("classification"),
            BranchId: Guid.TryParse(qp.GetValueOrDefault("branchId"), out var bid) ? bid : null,
            Page: int.TryParse(qp.GetValueOrDefault("page"), out var p) ? p : 1,
            PageSize: int.TryParse(qp.GetValueOrDefault("pageSize"), out var ps) ? ps : 25);

        return await ExecuteAsync(req, () => _catalogue.ListAsync(claims!.TenantId, listQuery));
    }

    [Function("LmsCatalogueGet")]
    public async Task<HttpResponseData> Get(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/catalogue/{id:guid}")] HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.CatalogueView) is { } denied)
            return denied;

        return await ExecuteAsync(req, () => _catalogue.GetAsync(claims!.TenantId, id));
    }

    [Function("LmsCatalogueVersions")]
    public async Task<HttpResponseData> Versions(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/catalogue/{id:guid}/versions")] HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.CatalogueView) is { } denied)
            return denied;

        return await ExecuteAsync(req, () => _catalogue.GetVersionsAsync(claims!.TenantId, id));
    }

    [Function("LmsCatalogueCreate")]
    public async Task<HttpResponseData> Create(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/catalogue")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.CatalogueManage) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<CreateCatalogueDraftRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");

        return await ExecuteAsync(req, () => _catalogue.CreateDraftAsync(claims!.TenantId, claims.UserId, body), created: true);
    }

    [Function("LmsCatalogueUpdateDraft")]
    public async Task<HttpResponseData> UpdateDraft(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "lms/catalogue/{id:guid}/draft")] HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.CatalogueManage) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<UpdateCatalogueDraftRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");

        return await ExecuteAsync(req, () => _catalogue.UpdateDraftAsync(claims!.TenantId, claims.UserId, id, body));
    }

    [Function("LmsCatalogueSubmitReview")]
    public async Task<HttpResponseData> SubmitReview(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/catalogue/{id:guid}/submit-review")] HttpRequestData req,
        Guid id)
        => await LifecycleAsync(req, id, LaboratoryAuthz.CatalogueManage,
            (t, u, r) => _catalogue.SubmitForReviewAsync(t, u, id, r));

    [Function("LmsCatalogueReturnDraft")]
    public async Task<HttpResponseData> ReturnDraft(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/catalogue/{id:guid}/return-draft")] HttpRequestData req,
        Guid id)
        => await LifecycleAsync(req, id, new[] { LaboratoryAuthz.CatalogueManage, LaboratoryAuthz.CatalogueApprove },
            (t, u, r) => _catalogue.ReturnToDraftAsync(t, u, id, r));

    [Function("LmsCatalogueApprove")]
    public async Task<HttpResponseData> Approve(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/catalogue/{id:guid}/approve")] HttpRequestData req,
        Guid id)
        => await LifecycleAsync(req, id, LaboratoryAuthz.CatalogueApprove,
            (t, u, r) => _catalogue.ApproveAsync(t, u, id, r));

    [Function("LmsCatalogueActivate")]
    public async Task<HttpResponseData> Activate(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/catalogue/{id:guid}/activate")] HttpRequestData req,
        Guid id)
        => await LifecycleAsync(req, id, LaboratoryAuthz.CatalogueApprove,
            (t, u, r) => _catalogue.ActivateAsync(t, u, id, r));

    [Function("LmsCatalogueRetire")]
    public async Task<HttpResponseData> Retire(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/catalogue/{id:guid}/retire")] HttpRequestData req,
        Guid id)
        => await LifecycleAsync(req, id, LaboratoryAuthz.CatalogueManage,
            (t, u, r) => _catalogue.RetireAsync(t, u, id, r));

    [Function("LmsCatalogueSupersede")]
    public async Task<HttpResponseData> Supersede(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/catalogue/{id:guid}/supersede")] HttpRequestData req,
        Guid id)
        => await LifecycleAsync(req, id, LaboratoryAuthz.CatalogueManage,
            (t, u, r) => _catalogue.SupersedeAsync(t, u, id, r));

    private async Task<HttpResponseData> LifecycleAsync(
        HttpRequestData req,
        Guid id,
        string requiredPermission,
        Func<Guid, Guid, LifecycleActionRequest, Task<CatalogueItemDetailDto>> action)
        => await LifecycleAsync(req, id, new[] { requiredPermission }, action);

    private async Task<HttpResponseData> LifecycleAsync(
        HttpRequestData req,
        Guid id,
        string[] requiredPermissions,
        Func<Guid, Guid, LifecycleActionRequest, Task<CatalogueItemDetailDto>> action)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, requiredPermissions) is { } denied)
            return denied;

        LifecycleActionRequest body;
        try
        {
            body = await req.ReadJsonAsync<LifecycleActionRequest>() ?? new LifecycleActionRequest();
        }
        catch
        {
            body = new LifecycleActionRequest();
        }

        return await ExecuteAsync(req, () => action(claims!.TenantId, claims.UserId, body));
    }

    private async Task<HttpResponseData> ExecuteAsync<T>(
        HttpRequestData req, Func<Task<T>> action, bool created = false)
    {
        try
        {
            var result = await action();
            return created ? await req.CreatedJsonAsync(result!) : await req.OkJsonAsync(result!);
        }
        catch (CatalogueDomainException ex)
        {
            return await req.StatusJsonAsync((HttpStatusCode)ex.StatusCode, ex.Message, ex.Code);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Catalogue API failure");
            return await req.StatusJsonAsync(HttpStatusCode.InternalServerError, "Unexpected catalogue error.", "internal_error");
        }
    }

    private static Dictionary<string, string?> ParseQuery(string? query)
    {
        var dict = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrEmpty(query)) return dict;
        var q = query.StartsWith('?') ? query[1..] : query;
        foreach (var part in q.Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var idx = part.IndexOf('=');
            if (idx < 0)
            {
                dict[Uri.UnescapeDataString(part)] = null;
                continue;
            }
            var key = Uri.UnescapeDataString(part[..idx]);
            var val = Uri.UnescapeDataString(part[(idx + 1)..]);
            dict[key] = val;
        }
        return dict;
    }
}
