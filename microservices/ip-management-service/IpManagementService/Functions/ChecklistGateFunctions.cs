using System.Net;

using System.Text.Json;

using System.Text.Json.Serialization;

using Microsoft.Azure.Functions.Worker;

using Microsoft.Azure.Functions.Worker.Http;

using IpManagementService.Models.Dtos;

using IpManagementService.Services;



namespace IpManagementService.Functions;



public class ChecklistGateFunctions

{

    private readonly PatientJourneyService       _journey;

    private readonly ChecklistIntegrationService _integration;

    private readonly JwtService                  _jwt;



    private static readonly JsonSerializerOptions Json = new()

    {

        PropertyNamingPolicy   = JsonNamingPolicy.CamelCase,

        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,

    };



    public ChecklistGateFunctions(

        PatientJourneyService journey,

        ChecklistIntegrationService integration,

        JwtService jwt)

    {

        _journey     = journey;

        _integration = integration;

        _jwt         = jwt;

    }



    [Function("GetTransitionGates")]

    public async Task<HttpResponseData> GetTransitionGates(

        [HttpTrigger(AuthorizationLevel.Function, "get",

            Route = "ip-management/journeys/{id:guid}/transition-gates")]

        HttpRequestData req, Guid id)

    {

        try

        {

            var (_, tenantId) = _jwt.ValidateAndExtract(req);

            var tid = _jwt.ExtractTenantId(req, tenantId);

            var qs  = req.Url.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries)

                .Select(p => p.Split('=', 2))

                .Where(p => p.Length == 2)

                .ToDictionary(p => p[0], p => Uri.UnescapeDataString(p[1]), StringComparer.OrdinalIgnoreCase);

            if (!qs.TryGetValue("newState", out var newState) || string.IsNullOrWhiteSpace(newState))

                throw new ArgumentException("Query parameter newState is required.");



            var result = await _journey.GetTransitionGatesAsync(id, tid, newState);

            return await Ok(req, result);

        }

        catch (ArgumentException ex)           { return await BadRequest(req, ex.Message); }

        catch (KeyNotFoundException ex)      { return await NotFound(req, ex.Message); }

        catch (UnauthorizedAccessException ex){ return await Unauthorized(req, ex.Message); }

        catch (Exception ex)                 { return await InternalError(req, ex.Message); }

    }



    [Function("ApplyWhoSupervisorOverride")]

    public async Task<HttpResponseData> ApplyWhoOverride(

        [HttpTrigger(AuthorizationLevel.Function, "post",

            Route = "ip-management/journeys/{id:guid}/who-supervisor-override")]

        HttpRequestData req, Guid id)

    {

        try

        {

            IpChecklistAuth.RequirePermission(req, _jwt, IpChecklistAuth.PermOtOverride);

            var (userId, tenantId) = _jwt.ValidateAndExtract(req);

            var tid  = _jwt.ExtractTenantId(req, tenantId);

            var body = await JsonSerializer.DeserializeAsync<WhoSupervisorOverrideRequest>(req.Body, Json)

                       ?? new WhoSupervisorOverrideRequest(null);

            var result = await _journey.ApplyWhoSupervisorOverrideAsync(id, tid, userId, body);

            return await Ok(req, result);

        }

        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }

        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }

        catch (Exception ex)                 { return await InternalError(req, ex.Message); }

    }



    [Function("LisIntegrationWebhook")]

    public async Task<HttpResponseData> LisWebhook(

        [HttpTrigger(AuthorizationLevel.Function, "post",

            Route = "ip-management/integrations/lis-result")]

        HttpRequestData req)

    {

        try

        {

            IntegrationWebhookAuth.RequireWebhookOrJwt(req, _jwt);

            Guid tid;
            Guid userId;
            if (IntegrationWebhookAuth.UsesWebhookCredentials(req))
            {
                if (!req.Headers.TryGetValues(IntegrationWebhookAuth.TenantHeader, out var tenants)
                    || !Guid.TryParse(tenants.FirstOrDefault(), out tid))
                    throw new ArgumentException("X-Tenant-ID header is required for webhook authentication.");
                userId = Guid.Empty;
            }
            else
            {
                (userId, var tenantId) = _jwt.ValidateAndExtract(req);
                tid = IntegrationWebhookAuth.ExtractTenantId(req, _jwt, tenantId);
            }

            var body = await JsonSerializer.DeserializeAsync<LisIntegrationWebhookRequest>(req.Body, Json)

                       ?? throw new ArgumentException("Body required.");

            var result = await _integration.ProcessLisResultAsync(tid, userId, body);

            return await Ok(req, result);

        }

        catch (ArgumentException ex)           { return await BadRequest(req, ex.Message); }

        catch (UnauthorizedAccessException ex){ return await Unauthorized(req, ex.Message); }

        catch (Exception ex)                 { return await InternalError(req, ex.Message); }

    }



    [Function("ImagingIntegrationWebhook")]

    public async Task<HttpResponseData> ImagingWebhook(

        [HttpTrigger(AuthorizationLevel.Function, "post",

            Route = "ip-management/integrations/imaging-result")]

        HttpRequestData req)

    {

        try

        {

            IntegrationWebhookAuth.RequireWebhookOrJwt(req, _jwt);

            Guid tid;
            Guid userId;
            if (IntegrationWebhookAuth.UsesWebhookCredentials(req))
            {
                if (!req.Headers.TryGetValues(IntegrationWebhookAuth.TenantHeader, out var tenants)
                    || !Guid.TryParse(tenants.FirstOrDefault(), out tid))
                    throw new ArgumentException("X-Tenant-ID header is required for webhook authentication.");
                userId = Guid.Empty;
            }
            else
            {
                (userId, var tenantId) = _jwt.ValidateAndExtract(req);
                tid = IntegrationWebhookAuth.ExtractTenantId(req, _jwt, tenantId);
            }

            var body = await JsonSerializer.DeserializeAsync<ImagingIntegrationWebhookRequest>(req.Body, Json)

                       ?? throw new ArgumentException("Body required.");

            var result = await _integration.ProcessImagingResultAsync(tid, userId, body);

            return await Ok(req, result);

        }

        catch (ArgumentException ex)           { return await BadRequest(req, ex.Message); }

        catch (UnauthorizedAccessException ex){ return await Unauthorized(req, ex.Message); }

        catch (Exception ex)                 { return await InternalError(req, ex.Message); }

    }



    private static async Task<HttpResponseData> Ok(HttpRequestData req, object body)

    {

        var res = req.CreateResponse(HttpStatusCode.OK);

        res.Headers.Add("Content-Type", "application/json; charset=utf-8");

        await res.WriteStringAsync(JsonSerializer.Serialize(body, Json));

        return res;

    }



    private static async Task<HttpResponseData> BadRequest(HttpRequestData req, string msg)

    {

        var res = req.CreateResponse(HttpStatusCode.BadRequest);

        await res.WriteAsJsonAsync(new { error = msg });

        return res;

    }



    private static async Task<HttpResponseData> NotFound(HttpRequestData req, string msg)

    {

        var res = req.CreateResponse(HttpStatusCode.NotFound);

        await res.WriteAsJsonAsync(new { error = msg });

        return res;

    }



    private static async Task<HttpResponseData> Unauthorized(HttpRequestData req, string msg)

    {

        var res = req.CreateResponse(HttpStatusCode.Unauthorized);

        await res.WriteAsJsonAsync(new { error = msg });

        return res;

    }



    private static async Task<HttpResponseData> InternalError(HttpRequestData req, string msg)

    {

        var res = req.CreateResponse(HttpStatusCode.InternalServerError);

        await res.WriteAsJsonAsync(new { error = msg });

        return res;

    }

}


