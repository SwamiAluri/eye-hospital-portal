using System.Net;
using System.Text.Json;
using CcmsApi.Models.Domain;
using CcmsApi.Models.Dtos;
using CcmsApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Functions;

/// <summary>
/// REST endpoints for ccms_visit_insurance_policies.
/// All routes use the canonical /policies path (matching FE plan).
///
///   GET    /ccms/coverage-cases/{caseId}/policies
///   POST   /ccms/coverage-cases/{caseId}/policies
///   GET    /ccms/coverage-cases/{caseId}/policies/{id}
///   PUT    /ccms/coverage-cases/{caseId}/policies/{id}
///   DELETE /ccms/coverage-cases/{caseId}/policies/{id}
///   POST   /ccms/coverage-cases/{caseId}/policies/{id}/set-primary
///   GET    /ccms/sessions/{sessionId}/policies
/// </summary>
public class VisitPolicyFunctions
{
    private readonly VisitPolicyService _svc;
    private readonly JwtService _jwt;
    private readonly AuthServiceClient _authClient;
    private readonly ILogger<VisitPolicyFunctions> _log;

    public VisitPolicyFunctions(
        VisitPolicyService svc,
        JwtService jwt,
        AuthServiceClient authClient,
        ILogger<VisitPolicyFunctions> log)
    {
        _svc        = svc;
        _jwt        = jwt;
        _authClient = authClient;
        _log        = log;
    }

    // ── GET by case ──────────────────────────────────────────────────────────

    [Function("ListPoliciesByCase")]
    public async Task<HttpResponseData> ListByCase(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "ccms/coverage-cases/{caseId:guid}/policies")] HttpRequestData req,
        Guid caseId)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var list = await _svc.GetByCaseAsync(caseId);
        return await req.OkJsonAsync(list);
    }

    // ── GET by session ───────────────────────────────────────────────────────

    [Function("ListPoliciesBySession")]
    public async Task<HttpResponseData> ListBySession(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "ccms/sessions/{sessionId:guid}/policies")] HttpRequestData req,
        Guid sessionId)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var list = await _svc.GetBySessionAsync(sessionId);
        return await req.OkJsonAsync(list);
    }

    // ── GET single by case + id ───────────────────────────────────────────────

    [Function("GetPolicyById")]
    public async Task<HttpResponseData> GetById(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "ccms/coverage-cases/{caseId:guid}/policies/{id:guid}")] HttpRequestData req,
        Guid caseId, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var item = await _svc.GetByIdAsync(id);
        if (item is null || item.CoverageCase_Id != caseId) return req.CreateResponse(HttpStatusCode.NotFound);
        return await req.OkJsonAsync(item);   // item is VisitPolicyDto
    }

    // ── POST create under case ───────────────────────────────────────────────

    [Function("CreatePolicy")]
    public async Task<HttpResponseData> Create(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post",
            Route = "ccms/coverage-cases/{caseId:guid}/policies")] HttpRequestData req,
        Guid caseId)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<CcmsVisitInsurancePolicy>(req.Body,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        body.TenantId        = claims!.TenantId;
        body.CoverageCase_Id = caseId;

        try
        {
            var result = await _svc.CreateAsync(body, claims.UserId);
            // Fire-and-forget patient_insurance sync when a primary policy is created
            if (result.IsPrimary)
            {
                var patId = await _svc.GetPatientIdByCaseIdAsync(caseId);
                if (patId.HasValue)
                    _ = _authClient.SyncPatientInsuranceAsync(
                        patId.Value,
                        result.PolicyNumber ?? string.Empty,
                        result.InsuranceProviderId?.ToString() ?? string.Empty,
                        result.InsuredName,
                        result.RelationshipToInsured,
                        result.ContactNumber,
                        startDate: null,
                        endDate: null);
            }

            var resp = req.CreateResponse(HttpStatusCode.Created);
            await resp.WriteAsJsonAsync(result);
            return resp;
        }
        catch (ArgumentException ex)
        {
            var resp = req.CreateResponse(HttpStatusCode.BadRequest);
            await resp.WriteStringAsync(ex.Message);
            return resp;
        }
        catch (InvalidOperationException ex)
        {
            var resp = req.CreateResponse(HttpStatusCode.Conflict);
            await resp.WriteStringAsync(ex.Message);
            return resp;
        }
    }

    // ── PUT update under case ─────────────────────────────────────────────────

    [Function("UpdatePolicy")]
    public async Task<HttpResponseData> Update(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put",
            Route = "ccms/coverage-cases/{caseId:guid}/policies/{id:guid}")] HttpRequestData req,
        Guid caseId, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<CcmsVisitInsurancePolicy>(req.Body,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        try
        {
            var result = await _svc.UpdateAsync(id, body, claims!.UserId);
            return await req.OkJsonAsync(result);
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
    }

    // ── DELETE under case ─────────────────────────────────────────────────────

    [Function("DeletePolicy")]
    public async Task<HttpResponseData> Delete(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete",
            Route = "ccms/coverage-cases/{caseId:guid}/policies/{id:guid}")] HttpRequestData req,
        Guid caseId, Guid id)
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

    // ── POST set-primary under case ───────────────────────────────────────────

    [Function("SetPrimaryPolicy")]
    public async Task<HttpResponseData> SetPrimary(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post",
            Route = "ccms/coverage-cases/{caseId:guid}/policies/{id:guid}/set-primary")] HttpRequestData req,
        Guid caseId, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        try
        {
            var result = await _svc.SetPrimaryAsync(id, claims!.UserId);

            // Fire-and-forget: sync primary policy to auth-service patient_insurance.
            // patientId is looked up from the coverage case using the caseId route param.
            var patientId = await _svc.GetPatientIdByCaseIdAsync(caseId);
            if (patientId.HasValue)
                _ = _authClient.SyncPatientInsuranceAsync(
                    patientId.Value,
                    result.PolicyNumber ?? string.Empty,
                    result.InsuranceProviderId?.ToString() ?? string.Empty,
                    result.InsuredName,
                    result.RelationshipToInsured,
                    result.ContactNumber,
                    startDate: null,
                    endDate: null);

            return await req.OkJsonAsync(result);
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
    }
}
