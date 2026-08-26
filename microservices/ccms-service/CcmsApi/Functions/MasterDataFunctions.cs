using System.Net;
using System.Text.Json;
using CcmsApi.Models.Domain;
using CcmsApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Functions;

public class MasterDataFunctions
{
    private readonly MasterDataService _svc;
    private readonly JwtService _jwt;
    private readonly ILogger<MasterDataFunctions> _log;

    public MasterDataFunctions(MasterDataService svc, JwtService jwt, ILogger<MasterDataFunctions> log)
    {
        _svc = svc;
        _jwt = jwt;
        _log = log;
    }

    // ── Insurance Providers ──────────────────────────────────────────────────

    [Function("ListInsuranceProviders")]
    public async Task<HttpResponseData> ListInsuranceProviders(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/master/insurance-providers")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var list = await _svc.ListInsuranceProvidersAsync(claims!.TenantId);
        return await req.OkJsonAsync(list);
    }

    [Function("GetInsuranceProvider")]
    public async Task<HttpResponseData> GetInsuranceProvider(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/master/insurance-providers/{id:guid}")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var item = await _svc.GetInsuranceProviderAsync(id);
        if (item is null) return req.CreateResponse(HttpStatusCode.NotFound);
        return await req.OkJsonAsync(item);
    }

    [Function("CreateInsuranceProvider")]
    public async Task<HttpResponseData> CreateInsuranceProvider(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/master/insurance-providers")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<CcmsInsuranceProvider>(
            req.Body, CcmsApi.Services.HttpRequestDataExtensions.DeserializeOpts);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        body.TenantId           = claims!.TenantId;
        body.CreatedByUserId    = claims.UserId;
        body.UpdatedByUserId    = claims.UserId;

        try
        {
            var result = await _svc.CreateInsuranceProviderAsync(body);
            return await req.CreatedJsonAsync(result);
        }
        catch (ArgumentException ex)
        {
            return await req.BadRequestAsync(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return await req.BadRequestAsync(ex.Message);
        }
    }

    [Function("UpdateInsuranceProvider")]
    public async Task<HttpResponseData> UpdateInsuranceProvider(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "ccms/master/insurance-providers/{id:guid}")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<CcmsInsuranceProvider>(
            req.Body, CcmsApi.Services.HttpRequestDataExtensions.DeserializeOpts);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        body.Id                 = id;
        body.UpdatedByUserId    = claims!.UserId;

        try
        {
            var result = await _svc.UpdateInsuranceProviderAsync(body);
            return await req.OkJsonAsync(result);
        }
        catch (KeyNotFoundException)
        {
            return await req.NotFoundAsync("Insurance provider not found.");
        }
    }

    [Function("DeleteInsuranceProvider")]
    public async Task<HttpResponseData> DeleteInsuranceProvider(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "ccms/master/insurance-providers/{id:guid}")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        await _svc.SoftDeleteInsuranceProviderAsync(id, claims!.UserId);
        return req.CreateResponse(HttpStatusCode.NoContent);
    }

    // ── TPA Providers ────────────────────────────────────────────────────────

    [Function("ListTpaProviders")]
    public async Task<HttpResponseData> ListTpaProviders(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/master/tpa-providers")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var list = await _svc.ListTpaProvidersAsync(claims!.TenantId);
        return await req.OkJsonAsync(list);
    }

    [Function("GetTpaProvider")]
    public async Task<HttpResponseData> GetTpaProvider(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/master/tpa-providers/{id:guid}")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var item = await _svc.GetTpaProviderAsync(id);
        if (item is null) return req.CreateResponse(HttpStatusCode.NotFound);
        return await req.OkJsonAsync(item);
    }

    [Function("CreateTpaProvider")]
    public async Task<HttpResponseData> CreateTpaProvider(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/master/tpa-providers")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<CcmsTpaProvider>(req.Body);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        body.TenantId        = claims!.TenantId;
        body.CreatedByUserId = claims.UserId;
        body.UpdatedByUserId = claims.UserId;

        var result = await _svc.CreateTpaProviderAsync(body);
        var resp = req.CreateResponse(HttpStatusCode.Created);
        await resp.WriteAsJsonAsync(result);
        return resp;
    }

    [Function("UpdateTpaProvider")]
    public async Task<HttpResponseData> UpdateTpaProvider(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "ccms/master/tpa-providers/{id:guid}")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<CcmsTpaProvider>(req.Body);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        body.Id              = id;
        body.UpdatedByUserId = claims!.UserId;

        var result = await _svc.UpdateTpaProviderAsync(body);
        return await req.OkJsonAsync(result);
    }

    [Function("DeleteTpaProvider")]
    public async Task<HttpResponseData> DeleteTpaProvider(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "ccms/master/tpa-providers/{id:guid}")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        await _svc.SoftDeleteTpaProviderAsync(id, claims!.UserId);
        return req.CreateResponse(HttpStatusCode.NoContent);
    }

    // ── Government Schemes ───────────────────────────────────────────────────

    [Function("ListGovernmentSchemes")]
    public async Task<HttpResponseData> ListGovernmentSchemes(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/master/government-schemes")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var list = await _svc.ListGovernmentSchemesAsync(claims!.TenantId);
        return await req.OkJsonAsync(list);
    }

    [Function("GetGovernmentScheme")]
    public async Task<HttpResponseData> GetGovernmentScheme(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/master/government-schemes/{id:guid}")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var item = await _svc.GetGovernmentSchemeAsync(id);
        if (item is null) return req.CreateResponse(HttpStatusCode.NotFound);
        return await req.OkJsonAsync(item);
    }

    [Function("CreateGovernmentScheme")]
    public async Task<HttpResponseData> CreateGovernmentScheme(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/master/government-schemes")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<CcmsGovernmentScheme>(req.Body);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        body.TenantId        = claims!.TenantId;
        body.CreatedByUserId = claims.UserId;
        body.UpdatedByUserId = claims.UserId;

        var result = await _svc.CreateGovernmentSchemeAsync(body);
        var resp = req.CreateResponse(HttpStatusCode.Created);
        await resp.WriteAsJsonAsync(result);
        return resp;
    }

    [Function("UpdateGovernmentScheme")]
    public async Task<HttpResponseData> UpdateGovernmentScheme(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "ccms/master/government-schemes/{id:guid}")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<CcmsGovernmentScheme>(req.Body);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        body.Id              = id;
        body.UpdatedByUserId = claims!.UserId;

        var result = await _svc.UpdateGovernmentSchemeAsync(body);
        return await req.OkJsonAsync(result);
    }

    // ── Coverage Packages ────────────────────────────────────────────────────

    [Function("ListCoveragePackages")]
    public async Task<HttpResponseData> ListCoveragePackages(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/master/coverage-packages")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var list = await _svc.ListCoveragePackagesAsync(claims!.TenantId);
        return await req.OkJsonAsync(list);
    }

    [Function("GetCoveragePackage")]
    public async Task<HttpResponseData> GetCoveragePackage(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/master/coverage-packages/{id:guid}")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var item = await _svc.GetCoveragePackageAsync(id);
        if (item is null) return req.CreateResponse(HttpStatusCode.NotFound);
        return await req.OkJsonAsync(item);
    }

    [Function("CreateCoveragePackage")]
    public async Task<HttpResponseData> CreateCoveragePackage(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/master/coverage-packages")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<CcmsCoveragePackage>(req.Body);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        body.TenantId        = claims!.TenantId;
        body.CreatedByUserId = claims.UserId;
        body.UpdatedByUserId = claims.UserId;

        var result = await _svc.CreateCoveragePackageAsync(body);
        var resp = req.CreateResponse(HttpStatusCode.Created);
        await resp.WriteAsJsonAsync(result);
        return resp;
    }

    // ── Document Requirements ────────────────────────────────────────────────

    [Function("ListDocumentRequirements")]
    public async Task<HttpResponseData> ListDocumentRequirements(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/master/document-requirements")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var payerType = req.Query["payerType"];
        var stage = req.Query["stage"];
        Guid? ParseGuid(string? raw) => Guid.TryParse(raw, out var g) ? g : null;
        var caseScoped = string.Equals(req.Query["caseScoped"], "true", StringComparison.OrdinalIgnoreCase)
                         || string.Equals(req.Query["caseScoped"], "1", StringComparison.OrdinalIgnoreCase);
        var list = await _svc.ListDocumentRequirementsAsync(
            claims!.TenantId,
            payerType,
            stage,
            ParseGuid(req.Query["insuranceProviderId"]),
            ParseGuid(req.Query["tpaProviderId"]),
            ParseGuid(req.Query["governmentSchemeId"]),
            caseScoped);
        return await req.OkJsonAsync(list);
    }

    [Function("CreateDocumentRequirement")]
    public async Task<HttpResponseData> CreateDocumentRequirement(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/master/document-requirements")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<CcmsDocumentRequirement>(req.Body);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        body.TenantId        = claims!.TenantId;
        body.CreatedByUserId = claims.UserId;
        body.UpdatedByUserId = claims.UserId;

        var result = await _svc.CreateDocumentRequirementAsync(body);
        var resp = req.CreateResponse(HttpStatusCode.Created);
        await resp.WriteAsJsonAsync(result);
        return resp;
    }
}
