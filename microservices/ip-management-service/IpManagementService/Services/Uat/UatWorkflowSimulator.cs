using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services.Uat;

public sealed class UatSimulateRequest
{
    public Guid JourneyId { get; set; }
    public string Action { get; set; } = "";
    public Guid? AssignedBedId { get; set; }
    public decimal? Amount { get; set; }
    public string? PaymentMode { get; set; }
    public string? Reason { get; set; }
}

public class UatWorkflowSimulator
{
    private readonly PatientJourneyService _journeys;
    private readonly BillingService _billing;
    private readonly WardService _wards;
    private readonly IAuthBedLifecycleClient _beds;
    private readonly IIntegrationOutboxService _outbox;
    private readonly IpManagementDbContext _db;
    private readonly IHostEnvironment _env;
    private readonly IConfiguration _config;

    public UatWorkflowSimulator(
        PatientJourneyService journeys,
        BillingService billing,
        WardService wards,
        IAuthBedLifecycleClient beds,
        IIntegrationOutboxService outbox,
        IpManagementDbContext db,
        IHostEnvironment env,
        IConfiguration config)
    {
        _journeys = journeys;
        _billing = billing;
        _wards = wards;
        _beds = beds;
        _outbox = outbox;
        _db = db;
        _env = env;
        _config = config;
    }

    public async Task<object> SimulateAsync(Guid tenantId, Guid branchId, Guid userId, UatSimulateRequest req)
    {
        UatEnvironment.EnsureEnabled(_env, _config);
        if (UatFailureFlags.IsOn("concurrent_transition"))
            throw new InvalidOperationException("Simulated concurrent transition conflict.");

        var action = (req.Action ?? "").Trim().ToLowerInvariant();
        if (action is "outbox-probe")
            return await OutboxFailProbeAsync(tenantId, userId);

        var j = await _journeys.GetDetailAsync(req.JourneyId, tenantId, userId)
                ?? throw new KeyNotFoundException("Journey not found.");

        return action switch
        {
            "next" or "advance" => await AdvanceAsync(tenantId, branchId, userId, req.JourneyId, j.ClinicalState),
            "admit" => await AdmitAsync(tenantId, branchId, userId, req),
            "transfer-bed" or "transfer" => await TransferAsync(tenantId, branchId, userId, req),
            "send-to-ot" => await _journeys.TransitionClinicalAsync(req.JourneyId, tenantId, userId, new TransitionRequest(ClinicalState.SentToOT, req.Reason ?? "UAT simulate", true)),
            "accept-ot" => await _journeys.AcceptInOtAsync(req.JourneyId, tenantId, userId, true),
            "start-surgery" => await _journeys.StartSurgeryAsync(req.JourneyId, tenantId, userId, true),
            "complete-surgery" => await _journeys.TransitionClinicalAsync(req.JourneyId, tenantId, userId, new TransitionRequest(ClinicalState.SurgeryCompleted, req.Reason ?? "UAT simulate", true)),
            "post-op" => await _journeys.TransitionClinicalAsync(req.JourneyId, tenantId, userId, new TransitionRequest(ClinicalState.PostOp, req.Reason ?? "UAT simulate", true)),
            "ready-discharge" => await _journeys.TransitionClinicalAsync(req.JourneyId, tenantId, userId, new TransitionRequest(ClinicalState.ReadyForDischarge, req.Reason ?? "UAT simulate", true)),
            "payment" => await PayAsync(tenantId, branchId, userId, req, "Payment"),
            "refund" => await PayAsync(tenantId, branchId, userId, req, "Refund"),
            "emergency-fc" => await _journeys.ApplyEmergencyFcAsync(req.JourneyId, tenantId, userId, new EmergencyFcRequest(req.Reason ?? "UAT simulated Emergency FC", false, false, false)),
            "discharge" => await _journeys.TransitionClinicalAsync(req.JourneyId, tenantId, userId, new TransitionRequest(ClinicalState.Discharged, req.Reason ?? "UAT simulate", true)),
            "lama" => await _journeys.DischargeWithTypeAsync(req.JourneyId, tenantId, userId, new DischargeWithTypeRequest(DischargeType.Lama, req.Reason ?? "UAT LAMA", true, true)),
            "cancel" => await _journeys.CancelTodaySurgeryAsync(req.JourneyId, tenantId, userId, new CancelTodaySurgeryRequest(req.Reason ?? "UAT cancel")),
            "rebook" => await _journeys.RebookCancelledSurgeryAsync(req.JourneyId, tenantId, userId),
            "cancel-discharge" => await _journeys.CancelDischargeAsync(req.JourneyId, tenantId, userId, new CancelDischargeRequest(req.Reason ?? "UAT cancel discharge")),
            _ => throw new ArgumentException($"Unknown simulate action '{req.Action}'."),
        };
    }

    /// <summary>
    /// Enqueues a throwaway JourneyAdmitted row (idempotency w7-outbox-probe:*) and drains
    /// the outbox once. With ccms_outbox_fail=true the probe fails → Failed/Dead; stats expose age.
    /// </summary>
    private async Task<object> OutboxFailProbeAsync(Guid tenantId, Guid userId)
    {
        var probeJourney = Guid.NewGuid();
        var key = $"w7-outbox-probe:{probeJourney:N}";
        UatFailureFlags.Set("ccms_outbox_fail", true);
        try
        {
            _outbox.Enqueue(
                tenantId,
                IntegrationEventTypes.JourneyAdmitted,
                probeJourney,
                payload: new { tenantId, journeyId = probeJourney, actorUserId = userId },
                correlationId: probeJourney,
                idempotencyKey: key);
            // Drain order is oldest-first; backdate so this probe is claimed before
            // the backlog of unrelated Pending rows (often dozens in Azure UAT).
            var probeRow = _db.IntegrationOutboxEvents.Local
                .FirstOrDefault(e => e.IdempotencyKey == key)
                ?? throw new InvalidOperationException("Outbox probe row missing after enqueue.");
            probeRow.OccurredAt = DateTime.UtcNow.AddYears(-1);
            await _db.SaveChangesAsync();
            var processed = await _outbox.ProcessPendingAsync(batchSize: 5);
            var stats = await _outbox.GetStatsAsync(tenantId);
            return new
            {
                probeKey = key,
                processed,
                stats.Pending,
                stats.Failed,
                stats.Dead,
                stats.OldestPendingAt,
                flagOn = true,
            };
        }
        finally
        {
            UatFailureFlags.Set("ccms_outbox_fail", false);
        }
    }

    private async Task<object> AdvanceAsync(Guid tenantId, Guid branchId, Guid userId, Guid id, string state)
    {
        return state switch
        {
            ClinicalState.Expected => await AdmitAsync(tenantId, branchId, userId, new UatSimulateRequest { JourneyId = id }),
            ClinicalState.Admitted => await _journeys.TransitionClinicalAsync(id, tenantId, userId, new TransitionRequest(ClinicalState.ReadyForSurgery, "UAT next", true)),
            ClinicalState.ReadyForSurgery => await _journeys.TransitionClinicalAsync(id, tenantId, userId, new TransitionRequest(ClinicalState.SentToOT, "UAT next", true)),
            ClinicalState.SentToOT => await _journeys.AcceptInOtAsync(id, tenantId, userId, true),
            ClinicalState.InOT => await _journeys.TransitionClinicalAsync(id, tenantId, userId, new TransitionRequest(ClinicalState.SurgeryCompleted, "UAT next", true)),
            ClinicalState.SurgeryCompleted => await _journeys.TransitionClinicalAsync(id, tenantId, userId, new TransitionRequest(ClinicalState.PostOp, "UAT next", true)),
            ClinicalState.PostOp => await _journeys.TransitionClinicalAsync(id, tenantId, userId, new TransitionRequest(ClinicalState.ReadyForDischarge, "UAT next", true)),
            ClinicalState.ReadyForDischarge => await _journeys.TransitionClinicalAsync(id, tenantId, userId, new TransitionRequest(ClinicalState.Discharged, "UAT next", true)),
            _ => throw new InvalidOperationException($"No automatic next step from {state}."),
        };
    }

    private async Task<object> AdmitAsync(Guid tenantId, Guid branchId, Guid userId, UatSimulateRequest req)
    {
        var wards = await _wards.ListAsync(tenantId, branchId);
        var wardId = wards.FirstOrDefault()?.Id ?? throw new InvalidOperationException("No ward.");
        var beds = await _beds.ListAsync(tenantId, branchId, null);
        var bed = beds.FirstOrDefault(b => string.Equals(b.BedStatus, "Available", StringComparison.OrdinalIgnoreCase));
        return await _journeys.AdmitAsync(req.JourneyId, tenantId, userId, new AdmitPatientRequest(
            wardId, "IPD", null, bed?.BedNumber, bed?.RoomNumber, "UAT Attendant", "9000000000", "Spouse",
            null, null, req.AssignedBedId ?? bed?.BedId, false, false, null, true));
    }

    private async Task<object> TransferAsync(Guid tenantId, Guid branchId, Guid userId, UatSimulateRequest req)
    {
        var dest = req.AssignedBedId;
        if (dest is null || dest == Guid.Empty)
        {
            var beds = await _beds.ListAsync(tenantId, branchId, null);
            dest = beds.FirstOrDefault(b => string.Equals(b.BedStatus, "Available", StringComparison.OrdinalIgnoreCase))?.BedId;
        }
        if (dest is null) throw new InvalidOperationException("No available bed to transfer into.");
        return await _journeys.TransferBedAsync(req.JourneyId, tenantId, userId,
            new TransferBedRequest(dest.Value, null, req.Reason ?? "UAT simulate transfer"));
    }

    private async Task<object> PayAsync(Guid tenantId, Guid branchId, Guid userId, UatSimulateRequest req, string kind)
    {
        var amount = req.Amount ?? 1000m;
        var mode = string.IsNullOrWhiteSpace(req.PaymentMode) ? "Cash" : req.PaymentMode;
        return await _billing.AddAsync(req.JourneyId, tenantId, branchId, userId,
            new AddBillingTransactionRequest(kind, mode, amount, $"UAT-{kind}-{Guid.NewGuid():N}"[..28], req.Reason));
    }
}
