using System.Net;
using LaboratoryApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace LaboratoryApi.Functions;

/// <summary>L-COL-01C/01D/01E Specimen APIs under /api/lms/specimens.</summary>
public class SpecimenFunctions
{
    private readonly ISpecimenService _specimens;
    private readonly ISpecimenBarcodeService _barcodes;
    private readonly JwtService _jwt;
    private readonly ILogger<SpecimenFunctions> _log;

    public SpecimenFunctions(
        ISpecimenService specimens, ISpecimenBarcodeService barcodes, JwtService jwt, ILogger<SpecimenFunctions> log)
    {
        _specimens = specimens;
        _barcodes = barcodes;
        _jwt = jwt;
        _log = log;
    }

    [Function("LmsSpecimensList")]
    public async Task<HttpResponseData> List(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/specimens")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(
                req, claims!, LaboratoryAuthz.SpecimensView, LaboratoryAuthz.SpecimensManage) is { } denied)
            return denied;

        var qp = ParseQuery(req.Url.Query);
        var listQuery = new SpecimenListQuery(
            Status: qp.GetValueOrDefault("status"),
            CollectionBranchId: Guid.TryParse(qp.GetValueOrDefault("collectionBranchId"), out var cb) ? cb : null,
            ReceivingBranchId: Guid.TryParse(
                qp.GetValueOrDefault("receivingBranchId") ?? qp.GetValueOrDefault("branchId"), out var rb)
                ? rb
                : null,
            Search: qp.GetValueOrDefault("search"),
            Page: int.TryParse(qp.GetValueOrDefault("page"), out var p) ? p : 1,
            PageSize: int.TryParse(qp.GetValueOrDefault("pageSize"), out var ps) ? ps : 25);

        return await ExecuteAsync(req, () => _specimens.ListAsync(claims!.TenantId, listQuery));
    }

    [Function("LmsSpecimensGet")]
    public async Task<HttpResponseData> Get(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/specimens/{id:guid}")] HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(
                req, claims!, LaboratoryAuthz.SpecimensView, LaboratoryAuthz.SpecimensManage) is { } denied)
            return denied;
        return await ExecuteAsync(req, () => _specimens.GetAsync(claims!.TenantId, id));
    }

    [Function("LmsSpecimensByCollectionTask")]
    public async Task<HttpResponseData> GetByCollectionTask(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "lms/specimens/by-collection-task/{collectionTaskId:guid}")]
        HttpRequestData req,
        Guid collectionTaskId)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(
                req, claims!, LaboratoryAuthz.SpecimensView, LaboratoryAuthz.SpecimensManage) is { } denied)
            return denied;

        return await ExecuteAsync(req, async () =>
        {
            var detail = await _specimens.GetByCollectionTaskAsync(claims!.TenantId, collectionTaskId);
            if (detail is null)
                throw new SpecimenDomainException("Specimen not found for collection task.", statusCode: 404, code: "not_found");
            return detail;
        });
    }

    [Function("LmsSpecimenRejectionReasons")]
    public async Task<HttpResponseData> ListRejectionReasons(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/specimens/rejection-reasons")]
        HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(
                req, claims!, LaboratoryAuthz.SpecimensView, LaboratoryAuthz.SpecimensManage,
                LaboratoryAuthz.SpecimensReceive) is { } denied)
            return denied;
        return await ExecuteAsync(req, () => _specimens.ListRejectionReasonsAsync(claims!.TenantId));
    }

    [Function("LmsSpecimensReceive")]
    public async Task<HttpResponseData> Receive(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/specimens/{id:guid}/receive")]
        HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.SpecimensReceive) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<ReceiveSpecimenRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");

        var idem = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        if (idem is not null)
            body = body with { IdempotencyKey = idem };

        return await ExecuteAsync(
            req, () => _specimens.ReceiveAsync(claims!.TenantId, claims.UserId, id, body));
    }

    [Function("LmsSpecimensReject")]
    public async Task<HttpResponseData> Reject(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/specimens/{id:guid}/reject")]
        HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.SpecimensReceive) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<RejectSpecimenRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");

        var idem = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        if (idem is not null)
            body = body with { IdempotencyKey = idem };

        return await ExecuteAsync(
            req, () => _specimens.RejectAsync(claims!.TenantId, claims.UserId, id, body));
    }

    [Function("LmsSpecimensGetBarcode")]
    public async Task<HttpResponseData> GetBarcode(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/specimens/{id:guid}/barcode")]
        HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.SpecimensBarcodeView) is { } denied)
            return denied;

        return await ExecuteAsync(req, async () =>
        {
            var barcode = await _barcodes.GetBarcodeAsync(claims!.TenantId, id);
            if (barcode is null)
                throw new SpecimenDomainException("Barcode not found.", statusCode: 404, code: "not_found");
            return barcode;
        });
    }

    [Function("LmsSpecimensAssignBarcode")]
    public async Task<HttpResponseData> AssignBarcode(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/specimens/{id:guid}/barcode")]
        HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.SpecimensLabelPrint) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<AssignBarcodeRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");

        var idem = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        if (idem is not null)
            body = body with { IdempotencyKey = idem };

        return await ExecuteAsync(
            req, () => _barcodes.AssignBarcodeAsync(claims!.TenantId, claims.UserId, id, body), created: true);
    }

    [Function("LmsSpecimensPrintLabel")]
    public async Task<HttpResponseData> PrintLabel(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/specimens/{id:guid}/label/print")]
        HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.SpecimensLabelPrint) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<PrintSpecimenLabelRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");

        var idem = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        if (idem is not null)
            body = body with { IdempotencyKey = idem };

        return await ExecuteAsync(
            req, () => _barcodes.PrintLabelAsync(claims!.TenantId, claims.UserId, id, body));
    }

    [Function("LmsSpecimensReprintLabel")]
    public async Task<HttpResponseData> ReprintLabel(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lms/specimens/{id:guid}/label/reprint")]
        HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.SpecimensLabelReprint) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<ReprintSpecimenLabelRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");

        var idem = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        if (idem is not null)
            body = body with { IdempotencyKey = idem };

        return await ExecuteAsync(
            req, () => _barcodes.ReprintLabelAsync(claims!.TenantId, claims.UserId, id, body));
    }

    [Function("LmsCollectionCompleteCollection")]
    public async Task<HttpResponseData> CompleteCollection(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post",
            Route = "lms/collection/tasks/{id:guid}/complete-collection")]
        HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await LaboratoryAuthz.ForbidUnlessAllAsync(
                req, claims!, LaboratoryAuthz.SpecimensManage, LaboratoryAuthz.CollectionCollect) is { } denied)
            return denied;

        var body = await req.ReadJsonAsync<CompleteCollectionRequest>();
        if (body is null)
            return await req.BadRequestAsync("Request body is required.");

        var idem = GetIdempotencyKey(req) ?? body.IdempotencyKey;
        if (idem is not null)
            body = body with { IdempotencyKey = idem };

        return await ExecuteAsync(
            req, () => _specimens.CompleteCollectionAsync(claims!.TenantId, claims.UserId, id, body), created: true);
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
        catch (SpecimenDomainException ex)
        {
            _log.LogWarning(ex, "Specimen domain error {Code}", ex.Code);
            return ex.StatusCode switch
            {
                403 => await req.ForbiddenAsync(ex.Message),
                404 => await req.NotFoundAsync(ex.Message),
                409 => await req.ConflictAsync(ex.Message, ex.Code),
                503 => await req.StatusJsonAsync(HttpStatusCode.ServiceUnavailable, ex.Message, ex.Code),
                _ => await req.BadRequestAsync(ex.Message, ex.Code),
            };
        }
        catch (CollectionDomainException ex)
        {
            _log.LogWarning(ex, "Collection domain error during specimen {Code}", ex.Code);
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
