using System.Net;
using System.Text.Json;
using CcmsApi.Data;
using CcmsApi.Models.Domain;
using CcmsApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.EntityFrameworkCore;

namespace CcmsApi.Functions;

public class GovtSchemeFunctions
{
    private readonly CcmsDbContext _db;
    private readonly JwtService _jwt;

    public GovtSchemeFunctions(CcmsDbContext db, JwtService jwt)
    {
        _db  = db;
        _jwt = jwt;
    }

    // POST /api/ccms/coverage-cases/{id}/govt-scheme-application
    [Function("CreateGovtSchemeApplication")]
    public async Task<HttpResponseData> Create(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/coverage-cases/{id:guid}/govt-scheme-application")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<CreateGovtApplicationRequest>(req.Body);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        var coverageCase = await _db.CoverageCases.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id && c.DeletedAt == null);
        if (coverageCase is null) return req.CreateResponse(HttpStatusCode.NotFound);

        var application = new CcmsGovtSchemeApplication
        {
            Id                      = Guid.NewGuid(),
            TenantId                = coverageCase.TenantId,
            CoverageCase_Id         = id,
            GovernmentSchemeId      = body.GovernmentSchemeId,
            SchemeReferenceNumber   = body.ApplicationNumber,
            BeneficiaryId           = body.BeneficiaryId,
            SubmittedAt             = DateTime.UtcNow,
            CreatedAt               = DateTime.UtcNow,
            UpdatedAt               = DateTime.UtcNow,
            CreatedByUserId         = claims!.UserId,
            UpdatedByUserId         = claims.UserId,
            Status                  = "active"
        };

        _db.GovtSchemeApplications.Add(application);
        await _db.SaveChangesAsync();

        var resp = req.CreateResponse(HttpStatusCode.Created);
        await resp.WriteAsJsonAsync(application);
        return resp;
    }

    // GET /api/ccms/coverage-cases/{id}/govt-scheme-application
    [Function("GetGovtSchemeApplication")]
    public async Task<HttpResponseData> GetForCase(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/coverage-cases/{id:guid}/govt-scheme-application")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var application = await _db.GovtSchemeApplications.AsNoTracking()
            .Where(a => a.CoverageCase_Id == id && a.DeletedAt == null)
            .OrderByDescending(a => a.CreatedAt)
            .FirstOrDefaultAsync();

        if (application is null) return req.CreateResponse(HttpStatusCode.NotFound);
        return await req.OkJsonAsync(application);
    }

    // POST /api/ccms/govt-scheme-applications/{id}/disburse
    [Function("DisburseGovtScheme")]
    public async Task<HttpResponseData> Disburse(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/govt-scheme-applications/{id:guid}/disburse")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<DisburseRequest>(req.Body);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        var app = await _db.GovtSchemeApplications.FirstOrDefaultAsync(a => a.Id == id && a.DeletedAt == null);
        if (app is null) return req.CreateResponse(HttpStatusCode.NotFound);

        app.ApprovedAmount   = body.Amount;
        app.DecidedAt        = DateTime.UtcNow;
        app.UpdatedAt        = DateTime.UtcNow;
        app.UpdatedByUserId  = claims!.UserId;
        app.RowVersion       += 1;

        await _db.SaveChangesAsync();
        return await req.OkJsonAsync(app);
    }
}

public record CreateGovtApplicationRequest(
    Guid    GovernmentSchemeId,
    string? ApplicationNumber,
    string? BeneficiaryId
);

public record DisburseRequest(decimal Amount);
