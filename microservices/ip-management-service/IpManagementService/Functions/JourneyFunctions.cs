using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;

namespace IpManagementService.Functions;

/// <summary>
/// HTTP triggers for the patient_journey resource.
/// Routes:
///   GET    /api/ip-management/journeys              → list (Ward page & IP Management page)
///   GET    /api/ip-management/journeys/{id}         → detail (Journey detail + OT inline form)
///   POST   /api/ip-management/journeys/{id}/admit   → Admit patient (Ward page)
///   PUT    /api/ip-management/journeys/{id}/ward    → Update ward assignment (Ward Updation Modal)
///   PUT    /api/ip-management/journeys/{id}/ot      → Update OT details (OT inline form)
///   POST   /api/ip-management/journeys/{id}/clinical-transition  → Clinical state transition
///   POST   /api/ip-management/journeys/{id}/financial-transition → Financial state transition
///   POST   /api/ip-management/journeys/{id}/emergency-fc         → Emergency FC modal
///   POST   /api/ip-management/journeys/{id}/discharge-override   → Discharge override
///   GET    /api/ip-management/journeys/{id}/audit   → audit log
///   POST   /api/ip-management/journeys/{id}/billing             → add billing transaction
///   GET    /api/ip-management/journeys/{id}/billing             → list billing transactions
///   GET/POST /api/ip-management/journeys/{id}/intra-op         → intra-op note
///   POST   /api/ip-management/journeys/{id}/intra-op/sign      → sign intra-op note
/// </summary>
public class JourneyFunctions
{
    private readonly PatientJourneyService _journeySvc;
    private readonly BillingService        _billingSvc;
    private readonly IntraOpNoteService    _intraOpSvc;
    private readonly IntraOpPresetService  _presetSvc;
    private readonly JwtService            _jwt;
    private readonly IIolCatalogService    _iolCatalogSvc;

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy   = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented          = false,
    };

    public JourneyFunctions(
        PatientJourneyService journeySvc,
        BillingService        billingSvc,
        IntraOpNoteService    intraOpSvc,
        IntraOpPresetService  presetSvc,
        JwtService            jwt,
        IIolCatalogService    iolCatalogSvc)
    {
        _journeySvc    = journeySvc;
        _billingSvc    = billingSvc;
        _intraOpSvc    = intraOpSvc;
        _presetSvc     = presetSvc;
        _jwt           = jwt;
        _iolCatalogSvc = iolCatalogSvc;
    }

    // ── List journeys ─────────────────────────────────────────────────────────

    [Function("ListJourneys")]
    public async Task<HttpResponseData> ListJourneys(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "ip-management/journeys")]
        HttpRequestData req)
    {
        try
        {
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid   = _jwt.ExtractTenantId(req, tenantId);
            var qs    = ParseQs(req.Url.Query);
            if (!qs.TryGetValue("branchId", out var branchStr) || !Guid.TryParse(branchStr, out var branchId))
                return await BadRequest(req, "branchId is required.");
            qs.TryGetValue("clinicalState", out var clinicalState);
            qs.TryGetValue("wardId", out var wardId);
            qs.TryGetValue("otRoom", out var otRoom);
            qs.TryGetValue("anaesthetist", out var anaesthetist);
            qs.TryGetValue("paymentMode", out var paymentMode);
            qs.TryGetValue("surgeryDate", out var surgeryDateStr);
            DateTime? surgeryDate = DateTime.TryParse(surgeryDateStr, out var sd) ? sd : null;
            qs.TryGetValue("limit", out var limitStr);
            qs.TryGetValue("offset", out var offsetStr);
            int? limit  = int.TryParse(limitStr, out var lim) && lim > 0 ? lim : null;
            int? offset = int.TryParse(offsetStr, out var off) && off > 0 ? off : null;

            if (string.IsNullOrWhiteSpace(clinicalState)
                || string.Equals(clinicalState, "Expected", StringComparison.OrdinalIgnoreCase)
                || string.Equals(clinicalState, "All", StringComparison.OrdinalIgnoreCase))
            {
                await _journeySvc.OnboardExpectedJourneysAsync(tid, branchId, userId);
            }

            var (rows, total) = await _journeySvc.ListAsync(
                tid, branchId, clinicalState, wardId,
                otRoom, anaesthetist, paymentMode, surgeryDate, limit, offset);
            return await Ok(req, rows, total);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    // ── Ward dashboard summary (Phase 2) ────────────────────────────────────────

    [Function("WardDashboardSummary")]
    public async Task<HttpResponseData> WardDashboardSummary(
        [HttpTrigger(AuthorizationLevel.Function, "get",
             Route = "ip-management/journeys/dashboard-summary")]
        HttpRequestData req)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var qs  = ParseQs(req.Url.Query);
            if (!qs.TryGetValue("branchId", out var branchStr) || !Guid.TryParse(branchStr, out var branchId))
                return await BadRequest(req, "branchId is required.");

            DateTime? date = null;
            if (qs.TryGetValue("date", out var dateStr)
                && DateTime.TryParse(dateStr, out var parsed))
                date = parsed;

            var summary = await _journeySvc.GetDashboardSummaryAsync(tid, branchId, date);
            return await Ok(req, summary);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    // ── Get detail ────────────────────────────────────────────────────────────

    [Function("GetJourneyDetail")]
    public async Task<HttpResponseData> GetJourneyDetail(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "ip-management/journeys/{id:guid}")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var detail = await _journeySvc.GetDetailAsync(id, tid, userId);
            if (detail is null) return await NotFound(req, "Journey not found.");
            return await Ok(req, detail);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    [Function("OnboardExpectedJourneys")]
    public async Task<HttpResponseData> OnboardExpectedJourneys(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "ip-management/journeys/onboard-expected")]
        HttpRequestData req)
    {
        try
        {
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var qs  = ParseQs(req.Url.Query);
            if (!qs.TryGetValue("branchId", out var branchStr) || !Guid.TryParse(branchStr, out var branchId))
                return await BadRequest(req, "branchId is required.");

            await _journeySvc.OnboardExpectedJourneysAsync(tid, branchId, userId);
            return await Ok(req, new { message = "Expected journeys onboarded." });
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    [Function("OnboardJourneyChecklist")]
    public async Task<HttpResponseData> OnboardJourneyChecklist(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "ip-management/journeys/{id:guid}/onboard-checklist")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            await _journeySvc.EnsureJourneyOnboardedAsync(id, tid, userId);
            return await Ok(req, new { message = "Journey checklist onboarded." });
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    // ── Admit ─────────────────────────────────────────────────────────────────

    [Function("AdmitPatient")]
    public async Task<HttpResponseData> AdmitPatient(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "ip-management/journeys/{id:guid}/admit")]
        HttpRequestData req, Guid id)
    {
        try
        {
            IpChecklistAuth.RequireClinicalTransition(req, _jwt);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<AdmitPatientRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _journeySvc.AdmitAsync(id, tid, userId, body);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (InvalidOperationException ex) { return await Conflict(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.GetBaseException().Message); }
    }

    // ── Ward assignment ────────────────────────────────────────────────────────

    [Function("UpdateWardAssignment")]
    public async Task<HttpResponseData> UpdateWardAssignment(
        [HttpTrigger(AuthorizationLevel.Function, "put", Route = "ip-management/journeys/{id:guid}/ward")]
        HttpRequestData req, Guid id)
    {
        try
        {
            IpChecklistAuth.RequireClinicalTransition(req, _jwt);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<UpdateWardAssignmentRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _journeySvc.UpdateWardAssignmentAsync(id, tid, userId, body);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (InvalidOperationException ex) { return await Conflict(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    // ── OT details ────────────────────────────────────────────────────────────

    [Function("UpdateOtDetails")]
    public async Task<HttpResponseData> UpdateOtDetails(
        [HttpTrigger(AuthorizationLevel.Function, "put", Route = "ip-management/journeys/{id:guid}/ot")]
        HttpRequestData req, Guid id)
    {
        try
        {
            IpChecklistAuth.RequirePermission(req, _jwt, IpChecklistAuth.PermOtSign);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<UpdateOtDetailsRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _journeySvc.UpdateOtDetailsAsync(id, tid, userId, body);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (InvalidOperationException ex) { return await Conflict(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    // ── Clinical transition ────────────────────────────────────────────────────

    [Function("TransitionClinical")]
    public async Task<HttpResponseData> TransitionClinical(
        [HttpTrigger(AuthorizationLevel.Function, "post",
             Route = "ip-management/journeys/{id:guid}/clinical-transition")]
        HttpRequestData req, Guid id)
    {
        try
        {
            IpChecklistAuth.RequireClinicalTransition(req, _jwt);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<TransitionRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var roles  = _jwt.ExtractRoles(req);
            var result = await _journeySvc.TransitionClinicalAsync(id, tid, userId, body, roles);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (InvalidOperationException ex) { return await Conflict(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    // ── Cancel today's surgery (G1) ────────────────────────────────────────────

    [Function("CancelTodaySurgery")]
    public async Task<HttpResponseData> CancelTodaySurgery(
        [HttpTrigger(AuthorizationLevel.Function, "post",
             Route = "ip-management/journeys/{id:guid}/cancel-today-surgery")]
        HttpRequestData req, Guid id)
    {
        try
        {
            IpChecklistAuth.RequireClinicalTransition(req, _jwt);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<CancelTodaySurgeryRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _journeySvc.CancelTodaySurgeryAsync(id, tid, userId, body);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (InvalidOperationException ex) { return await Conflict(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    // ── Rebook a cancelled surgery (Phase 1) ───────────────────────────────────

    [Function("RebookCancelledSurgery")]
    public async Task<HttpResponseData> RebookCancelledSurgery(
        [HttpTrigger(AuthorizationLevel.Function, "post",
             Route = "ip-management/journeys/{id:guid}/rebook")]
        HttpRequestData req, Guid id)
    {
        try
        {
            IpChecklistAuth.RequireClinicalTransition(req, _jwt);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var result = await _journeySvc.RebookCancelledSurgeryAsync(id, tid, userId);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (InvalidOperationException ex) { return await Conflict(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    // ── Financial transition ───────────────────────────────────────────────────

    [Function("TransitionFinancial")]
    public async Task<HttpResponseData> TransitionFinancial(
        [HttpTrigger(AuthorizationLevel.Function, "post",
             Route = "ip-management/journeys/{id:guid}/financial-transition")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<TransitionRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _journeySvc.TransitionFinancialAsync(id, tid, userId, body);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (InvalidOperationException ex) { return await Conflict(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    // ── Accept patient in OT ──────────────────────────────────────────────────

    [Function("AcceptInOt")]
    public async Task<HttpResponseData> AcceptInOt(
        [HttpTrigger(AuthorizationLevel.Function, "post",
             Route = "ip-management/journeys/{id:guid}/accept")]
        HttpRequestData req, Guid id)
    {
        try
        {
            IpChecklistAuth.RequirePermission(req, _jwt, IpChecklistAuth.PermOtSign);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var qs  = ParseQs(req.Url.Query);
            var acknowledge = qs.TryGetValue("acknowledgeWarnings", out var aw)
                              && bool.TryParse(aw, out var b) && b;
            var result = await _journeySvc.AcceptInOtAsync(id, tid, userId, acknowledge);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (InvalidOperationException ex) { return await Conflict(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    // ── Start surgery ─────────────────────────────────────────────────────────

    [Function("StartSurgery")]
    public async Task<HttpResponseData> StartSurgery(
        [HttpTrigger(AuthorizationLevel.Function, "post",
             Route = "ip-management/journeys/{id:guid}/start-surgery")]
        HttpRequestData req, Guid id)
    {
        try
        {
            IpChecklistAuth.RequirePermission(req, _jwt, IpChecklistAuth.PermOtSign);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var qs  = ParseQs(req.Url.Query);
            var acknowledge = qs.TryGetValue("acknowledgeWhoWarning", out var aw)
                              && bool.TryParse(aw, out var b) && b;
            var result = await _journeySvc.StartSurgeryAsync(id, tid, userId, acknowledge);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (InvalidOperationException ex) { return await Conflict(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    // ── Emergency FC ───────────────────────────────────────────────────────────

    [Function("ApplyEmergencyFc")]
    public async Task<HttpResponseData> ApplyEmergencyFc(
        [HttpTrigger(AuthorizationLevel.Function, "post",
             Route = "ip-management/journeys/{id:guid}/emergency-fc")]
        HttpRequestData req, Guid id)
    {
        try
        {
            IpChecklistAuth.RequireClinicalTransition(req, _jwt);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<EmergencyFcRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _journeySvc.ApplyEmergencyFcAsync(id, tid, userId, body);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    // ── Discharge override ─────────────────────────────────────────────────────

    [Function("ApplyDischargeOverride")]
    public async Task<HttpResponseData> ApplyDischargeOverride(
        [HttpTrigger(AuthorizationLevel.Function, "post",
             Route = "ip-management/journeys/{id:guid}/discharge-override")]
        HttpRequestData req, Guid id)
    {
        try
        {
            IpChecklistAuth.RequireClinicalTransition(req, _jwt);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<DischargeOverrideRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _journeySvc.ApplyDischargeOverrideAsync(id, tid, userId, body);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    // ── Billing ────────────────────────────────────────────────────────────────

    [Function("ListBilling")]
    public async Task<HttpResponseData> ListBilling(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/journeys/{id:guid}/billing")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var txs = await _billingSvc.ListAsync(id, tid);
            return await Ok(req, txs);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    [Function("GetFinancialPreauthStatus")]
    public async Task<HttpResponseData> GetFinancialPreauthStatus(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/journeys/{id:guid}/financial/preauth-status")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var status = await _journeySvc.GetPreauthStatusAsync(id, tid);
            if (status is null) return await NotFound(req, "Journey not found.");
            return await Ok(req, status);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    [Function("GetBillingReceipt")]
    public async Task<HttpResponseData> GetBillingReceipt(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/journeys/{id:guid}/billing/{txnId:guid}/receipt")]
        HttpRequestData req, Guid id, Guid txnId)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var tx  = await _billingSvc.GetByIdAsync(txnId, id, tid);
            if (tx is null) return await NotFound(req, "Transaction not found.");
            return await Ok(req, tx);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    [Function("AddBilling")]
    public async Task<HttpResponseData> AddBilling(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/billing")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var qs  = ParseQs(req.Url.Query);
            qs.TryGetValue("branchId", out var branchStr);
            Guid.TryParse(branchStr, out var branchId);
            var body = await JsonSerializer.DeserializeAsync<AddBillingTransactionRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var tx = await _billingSvc.AddAsync(id, tid, branchId, userId, body);
            return await Created(req, tx);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (InvalidOperationException ex) { return await Conflict(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    // ── Intra-Op Note ──────────────────────────────────────────────────────────

    [Function("GetIntraOpNote")]
    public async Task<HttpResponseData> GetIntraOpNote(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/journeys/{id:guid}/intra-op")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var note = await _intraOpSvc.GetAsync(id, tid);
            if (note is null) return await NotFound(req, "Intra-op note not found.");
            return await Ok(req, note);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }
    // ── Verify IOL Barcode ─────────────────────────────────────────────────────

    [Function("VerifyIolBarcode")]
    public async Task<HttpResponseData> VerifyIolBarcode(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/verify-iol-barcode")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<VerifyIolBarcodeRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            if (string.IsNullOrWhiteSpace(body.Barcode))
                return await BadRequest(req, "Barcode must not be empty.");

            var result = await _journeySvc.VerifyIolBarcodeAsync(id, tid, userId, body.Barcode);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }
    [Function("SaveIntraOpNote")]
    public async Task<HttpResponseData> SaveIntraOpNote(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/intra-op")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var qs  = ParseQs(req.Url.Query);
            qs.TryGetValue("branchId", out var branchStr);
            Guid.TryParse(branchStr, out var branchId);
            var body = await JsonSerializer.DeserializeAsync<SaveIntraOpNoteRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var note = await _intraOpSvc.SaveAsync(id, tid, branchId, userId, body);
            return await Ok(req, note);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (InvalidOperationException ex) { return await Conflict(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    [Function("SignIntraOpNote")]
    public async Task<HttpResponseData> SignIntraOpNote(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/intra-op/sign")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var note = await _intraOpSvc.SignAsync(id, tid, userId);
            return await Ok(req, note);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (InvalidOperationException ex) { return await Conflict(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    // ── Intra-Op Note Presets ─────────────────────────────────────────────────

    // GET /api/ip-management/intra-op-presets?fieldName=procedure
    [Function("GetIntraOpPresets")]
    public async Task<HttpResponseData> GetIntraOpPresets(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "ip-management/intra-op-presets")]
        HttpRequestData req)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var qs = ParseQs(req.Url.Query);
            qs.TryGetValue("fieldName", out var fieldName);
            var presets = await _presetSvc.GetPresetsAsync(tid, fieldName);
            return await Ok(req, presets);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    // ── IOL Catalog ────────────────────────────────────────────────────────────

    // GET /api/ip-management/iol-catalog
    [Function("ListIolCatalog")]
    public async Task<HttpResponseData> ListIolCatalog(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "ip-management/iol-catalog")]
        HttpRequestData req)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var items = await _iolCatalogSvc.ListAsync(tid);
            return await Ok(req, items);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private static Dictionary<string, string> ParseQs(string query)
    {
        var d = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrEmpty(query)) return d;
        foreach (var part in query.TrimStart('?').Split('&'))
        {
            var idx = part.IndexOf('=');
            if (idx > 0)
                d[Uri.UnescapeDataString(part[..idx])] = Uri.UnescapeDataString(part[(idx + 1)..]);
        }
        return d;
    }

    private async Task<HttpResponseData> Ok(HttpRequestData req, object payload)
    {
        var r = req.CreateResponse(HttpStatusCode.OK);
        r.Headers.Add("Content-Type", "application/json; charset=utf-8");
        await r.WriteStringAsync(JsonSerializer.Serialize(payload, Json));
        return r;
    }

    /// <summary>OK with a total-row count header for paged list responses.</summary>
    private async Task<HttpResponseData> Ok(HttpRequestData req, object payload, int totalCount)
    {
        var r = req.CreateResponse(HttpStatusCode.OK);
        r.Headers.Add("Content-Type", "application/json; charset=utf-8");
        r.Headers.Add("X-Total-Count", totalCount.ToString());
        r.Headers.Add("Access-Control-Expose-Headers", "X-Total-Count");
        await r.WriteStringAsync(JsonSerializer.Serialize(payload, Json));
        return r;
    }

    private async Task<HttpResponseData> Created(HttpRequestData req, object payload)
    {
        var r = req.CreateResponse(HttpStatusCode.Created);
        r.Headers.Add("Content-Type", "application/json; charset=utf-8");
        await r.WriteStringAsync(JsonSerializer.Serialize(payload, Json));
        return r;
    }

    private static async Task<HttpResponseData> BadRequest(HttpRequestData req, string message)
    {
        var r = req.CreateResponse(HttpStatusCode.BadRequest);
        await r.WriteAsJsonAsync(new { error = message });
        return r;
    }

    private static async Task<HttpResponseData> Unauthorized(HttpRequestData req, string message)
    {
        var r = req.CreateResponse(HttpStatusCode.Unauthorized);
        await r.WriteAsJsonAsync(new { error = message });
        return r;
    }

    private static async Task<HttpResponseData> NotFound(HttpRequestData req, string message)
    {
        var r = req.CreateResponse(HttpStatusCode.NotFound);
        await r.WriteAsJsonAsync(new { error = message });
        return r;
    }

    private static async Task<HttpResponseData> Conflict(HttpRequestData req, string message)
    {
        var r = req.CreateResponse(HttpStatusCode.Conflict);
        await r.WriteAsJsonAsync(new { error = message });
        return r;
    }

    private static async Task<HttpResponseData> InternalError(HttpRequestData req, string message)
    {
        var r = req.CreateResponse(HttpStatusCode.InternalServerError);
        await r.WriteAsJsonAsync(new { error = message });
        return r;
    }
}
