using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services.Uat;

public sealed class UatSeedResult
{
    public int Created { get; set; }
    public int Skipped { get; set; }
    public int Failed { get; set; }
    public List<string> Errors { get; set; } = [];
    public List<UatRowStatus> Rows { get; set; } = [];
}

public sealed class UatRowStatus
{
    public string Code { get; set; } = "";
    public string Scenario { get; set; } = "";
    public Guid? JourneyId { get; set; }
    public string? ClinicalState { get; set; }
    public string? Error { get; set; }
}

public sealed class UatDashboardDto
{
    public bool Enabled { get; set; }
    public int Total { get; set; }
    public Dictionary<string, int> Clinical { get; set; } = new();
    public Dictionary<string, int> Billing { get; set; } = new();
    public Dictionary<string, int> Coverage { get; set; } = new();
    public int OccupiedBeds { get; set; }
    public int AvailableBeds { get; set; }
    public List<UatRowStatus> Rows { get; set; } = [];
    public IReadOnlyDictionary<string, bool> FailureFlags { get; set; } = new Dictionary<string, bool>();
}

public class UatDatasetService
{
    private readonly IpManagementDbContext _db;
    private readonly PatientJourneyService _journeys;
    private readonly BillingService _billing;
    private readonly PacAssessmentService _pac;
    private readonly WardService _wards;
    private readonly IAuthBedLifecycleClient _beds;
    private readonly IAuthBillingClient _authBilling;
    private readonly IHostEnvironment _env;
    private readonly IConfiguration _config;
    private readonly ILogger<UatDatasetService> _log;

    public UatDatasetService(
        IpManagementDbContext db,
        PatientJourneyService journeys,
        BillingService billing,
        PacAssessmentService pac,
        WardService wards,
        IAuthBedLifecycleClient beds,
        IAuthBillingClient authBilling,
        IHostEnvironment env,
        IConfiguration config,
        ILogger<UatDatasetService> log)
    {
        _db = db;
        _journeys = journeys;
        _billing = billing;
        _pac = pac;
        _wards = wards;
        _beds = beds;
        _authBilling = authBilling;
        _env = env;
        _config = config;
        _log = log;
    }

    public async Task<UatDashboardDto> StatusAsync(Guid tenantId, Guid branchId)
    {
        var enabled = UatEnvironment.IsEnabled(_env, _config);
        var rows = await _db.PatientJourneys.AsNoTracking()
            .Where(j => j.TenantId == tenantId && j.DeletedAt == null && j.Uhid != null && j.Uhid.StartsWith(UatEnvironment.UhidPrefix))
            .OrderBy(j => j.Uhid)
            .ToListAsync();
        var patients = await _db.Patients.AsNoTracking()
            .Where(p => rows.Select(r => r.PatientId).Contains(p.Id))
            .ToDictionaryAsync(p => p.Id);

        IReadOnlyList<AuthBedSnapshot> beds = [];
        try { beds = await _beds.ListAsync(tenantId, branchId, null); } catch { /* inventory optional */ }

        var dto = new UatDashboardDto
        {
            Enabled = enabled,
            Total = rows.Count,
            OccupiedBeds = beds.Count(b => string.Equals(b.BedStatus, "Occupied", StringComparison.OrdinalIgnoreCase)),
            AvailableBeds = beds.Count(b => string.Equals(b.BedStatus, "Available", StringComparison.OrdinalIgnoreCase)),
            FailureFlags = UatFailureFlags.Snapshot(),
        };
        foreach (var g in rows.GroupBy(j => j.ClinicalState))
            dto.Clinical[g.Key] = g.Count();

        foreach (var j in rows)
        {
            patients.TryGetValue(j.PatientId, out var p);
            dto.Rows.Add(new UatRowStatus
            {
                Code = j.Uhid ?? "",
                Scenario = p?.LastName ?? j.ProcedureName ?? "",
                JourneyId = j.Id,
                ClinicalState = j.ClinicalState,
            });
        }
        return dto;
    }

    public async Task<UatSeedResult> ResetAsync(Guid tenantId, Guid userId)
    {
        UatEnvironment.EnsureEnabled(_env, _config);
        var result = new UatSeedResult();
        var journeys = await _db.PatientJourneys
            .Where(j => j.TenantId == tenantId && j.Uhid != null && j.Uhid.StartsWith(UatEnvironment.UhidPrefix))
            .ToListAsync();
        var ids = journeys.Select(j => j.Id).ToList();
        try { await _authBilling.SoftDeleteBillsForJourneysAsync(ids, userId); }
        catch (Exception ex) { result.Errors.Add(ex.Message); }

        foreach (var j in journeys.Where(x => x.AssignedBedId is not null && x.DeletedAt == null))
        {
            try
            {
                await _beds.ApplyAsync(tenantId, j.AssignedBedId!.Value, userId, j.PatientId, "release");
            }
            catch (Exception ex) { _log.LogWarning(ex, "UAT bed release {Uhid}", j.Uhid); }
            j.AssignedBedId = null;
        }

        var now = DateTime.UtcNow;
        foreach (var j in journeys)
        {
            j.DeletedAt = now;
            j.UpdatedAt = now;
            j.UpdatedByUserId = userId;
        }

        var patients = await _db.Patients
            .Where(p => p.HealthId != null && p.HealthId.StartsWith(UatEnvironment.HealthIdPrefix))
            .ToListAsync();
        foreach (var p in patients)
            p.DeletedAt = now;

        await _db.SaveChangesAsync();
        result.Created = journeys.Count;
        return result;
    }

    public async Task<UatSeedResult> SeedAsync(Guid tenantId, Guid branchId, Guid userId)
    {
        UatEnvironment.EnsureEnabled(_env, _config);
        if (UatFailureFlags.IsOn("billing_unavailable"))
            throw new InvalidOperationException("Simulated billing unavailability.");

        var result = new UatSeedResult();
        var wards = await _wards.ListAsync(tenantId, branchId);
        var wardId = wards.FirstOrDefault()?.Id ?? Guid.Empty;
        IReadOnlyList<AuthBedSnapshot> beds = [];
        try { beds = await _beds.ListAsync(tenantId, branchId, null); }
        catch (Exception ex) { result.Errors.Add("Bed list: " + ex.Message); }

        var available = beds
            .Where(b => string.Equals(b.BedStatus, "Available", StringComparison.OrdinalIgnoreCase))
            .ToList();
        if (wardId != Guid.Empty)
        {
            var onWard = available.Where(b => b.WardId is null || b.WardId == wardId).ToList();
            if (onWard.Count > 0)
                available = onWard;
        }
        var occupied = beds.Where(b => string.Equals(b.BedStatus, "Occupied", StringComparison.OrdinalIgnoreCase)).ToList();
        var bedIx = 0;

        var catalog = UatScenarioCatalog.Expand();
        var i = 0;
        foreach (var (code, scenario, replica) in catalog)
        {
            i++;
            try
            {
                var existing = await _db.PatientJourneys.FirstOrDefaultAsync(
                    j => j.TenantId == tenantId && j.Uhid == code && j.DeletedAt == null);
                if (existing is not null)
                {
                    result.Skipped++;
                    result.Rows.Add(new UatRowStatus { Code = code, Scenario = scenario.Label, JourneyId = existing.Id, ClinicalState = existing.ClinicalState });
                    continue;
                }

                AuthBedSnapshot? occupy = null;
                if (scenario.Target != UatTargetState.Expected && scenario.Coverage != UatCoverageKind.Pending && scenario.Coverage != UatCoverageKind.Rejected)
                {
                    if (bedIx < available.Count)
                        occupy = available[bedIx++];
                }

                AuthBedSnapshot? transferTo = null;
                if (scenario.BedTransfer && bedIx < available.Count)
                    transferTo = available[bedIx++];

                var row = await SeedOneAsync(
                    tenantId, branchId, userId, wardId, code, scenario, replica, i, occupy, transferTo, occupied.FirstOrDefault());
                result.Created++;
                result.Rows.Add(row);
            }
            catch (Exception ex)
            {
                result.Failed++;
                var msg = ex.GetBaseException().Message;
                result.Errors.Add($"{code}: {msg}");
                result.Rows.Add(new UatRowStatus { Code = code, Scenario = scenario.Label, Error = msg });
                _log.LogWarning(ex, "UAT seed failed for {Code}", code);
            }
        }

        return result;
    }

    public async Task<UatSeedResult> ReseedAsync(Guid tenantId, Guid branchId, Guid userId)
    {
        await ResetAsync(tenantId, userId);
        return await SeedAsync(tenantId, branchId, userId);
    }

    private async Task<UatRowStatus> SeedOneAsync(
        Guid tenantId, Guid branchId, Guid userId, Guid wardId,
        string code, UatScenarioDef scenario, int replica, int index,
        AuthBedSnapshot? occupy, AuthBedSnapshot? transferTo, AuthBedSnapshot? occupiedSample)
    {
        var patientId = await EnsurePatientAsync(tenantId, code, scenario, replica, index);
        Guid? priorId = null;
        if (scenario.Readmission)
            priorId = await SeedPriorDischargedAsync(tenantId, branchId, userId, wardId, patientId, code, occupy);

        var createdAt = StampForReplica(replica);
        var pkg = UatScenarioCatalog.PackageFor(scenario, replica);
        var paymentMode = scenario.Coverage == UatCoverageKind.SelfPay ? "Cash" : replica % 2 == 0 ? "Insurance" : "TPA";
        var journey = new PatientJourney
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            PatientId = patientId,
            Uhid = code,
            ClinicalState = ClinicalState.Expected,
            OtState = OtState.NotSent,
            FinancialState = FinancialState.NotCreated,
            PostOpState = PostOpState.NotStarted,
            ProcedureName = UatScenarioCatalog.ProcedureFor(index),
            EyeOperated = replica % 2 == 0 ? "OD" : "OS",
            AnaesthesiaType = "LA",
            SurgeryScheduledAt = createdAt.AddDays(1),
            AnaesthetistName = "Dr. UAT Anaesthetist",
            OperationTheatreName = "OT-1",
            AssistantName = "UAT Assistant",
            ScrubNurseNames = "UAT Scrub",
            PaymentMode = paymentMode,
            PackageAmount = pkg,
            TotalPaid = 0,
            TotalAdvances = 0,
            ChecklistPhaseStatus = "{}",
            WardPostopIolChecks = "{}",
            PriorJourneyId = priorId,
            CreatedAt = createdAt,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = userId,
            UpdatedByUserId = userId,
            Status = "active",
        };
        _db.PatientJourneys.Add(journey);
        await _db.SaveChangesAsync();
        await LogBootstrapAsync(journey, userId);

        if (scenario.Billing != UatBillingKind.None)
        {
            try
            {
                await ApplyBillingAsync(journey, tenantId, branchId, userId, scenario, replica, pkg);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "UAT billing for {Code}", code);
            }
        }

        if (scenario.ApplyEmergencyFc)
        {
            await _journeys.ApplyEmergencyFcAsync(journey.Id, tenantId, userId,
                new EmergencyFcRequest("UAT emergency financial clearance — trauma demo", false, false, false));
        }

        var needsAdmit = scenario.Target is not UatTargetState.Expected
            || scenario.Lama
            || scenario.BedTransfer
            || scenario.OccupiedBedConflict;
        if (scenario.Coverage is UatCoverageKind.Pending or UatCoverageKind.Rejected && !scenario.ApplyEmergencyFc)
            needsAdmit = false;

        if (needsAdmit && wardId != Guid.Empty)
        {
            Guid? bedId = occupy?.BedId;
            if (scenario.OccupiedBedConflict && occupiedSample is not null)
                bedId = occupiedSample.BedId;

            try
            {
                await _journeys.AdmitAsync(journey.Id, tenantId, userId, new AdmitPatientRequest(
                    wardId, "IPD", null, occupy?.BedNumber, occupy?.RoomNumber,
                    "UAT Attendant", "9000000000", "Spouse", null, null, bedId,
                    false, scenario.ApplyEmergencyFc, scenario.ApplyEmergencyFc ? "Emergency FC" : null,
                    true));
            }
            catch (Exception ex) when (scenario.OccupiedBedConflict)
            {
                _log.LogInformation("UAT bed conflict recorded for {Code}: {Msg}", code, ex.Message);
                await _journeys.AdmitAsync(journey.Id, tenantId, userId, new AdmitPatientRequest(
                    wardId, "IPD", null, occupy?.BedNumber, occupy?.RoomNumber,
                    "UAT Attendant", "9000000000", "Spouse", null, null, occupy?.BedId,
                    false, false, null, true));
            }
        }

        if (scenario.CompletePac && scenario.Target is not UatTargetState.Expected)
            await CompletePacAsync(journey.Id, tenantId, userId);

        if (scenario.BedTransfer && transferTo is not null)
        {
            await _journeys.TransferBedAsync(journey.Id, tenantId, userId,
                new TransferBedRequest(transferTo.BedId, wardId, "UAT transfer demo"));
        }

        await AdvanceToAsync(journey.Id, tenantId, userId, scenario);

        if (scenario.Lama)
        {
            await _journeys.DischargeWithTypeAsync(journey.Id, tenantId, userId,
                new DischargeWithTypeRequest(DischargeType.Lama, "UAT LAMA documentation", true, true));
        }

        var detail = await _journeys.GetDetailAsync(journey.Id, tenantId, userId);
        return new UatRowStatus
        {
            Code = code,
            Scenario = scenario.Label,
            JourneyId = journey.Id,
            ClinicalState = detail?.ClinicalState,
        };
    }

    private async Task AdvanceToAsync(Guid journeyId, Guid tenantId, Guid userId, UatScenarioDef scenario)
    {
        async Task Step(string state)
        {
            await _journeys.TransitionClinicalAsync(
                journeyId, tenantId, userId, new TransitionRequest(state, "UAT seed", true));
        }

        switch (scenario.Target)
        {
            case UatTargetState.Expected:
            case UatTargetState.Admitted:
                break;
            case UatTargetState.ReadyForSurgery:
                try { await Step(ClinicalState.ReadyForSurgery); } catch (Exception ex) { _log.LogInformation(ex, "mark-ready"); }
                break;
            case UatTargetState.SentToOT:
                await TryReady(journeyId, tenantId, userId);
                await Step(ClinicalState.SentToOT);
                break;
            case UatTargetState.InOT:
                await TryReady(journeyId, tenantId, userId);
                await Step(ClinicalState.SentToOT);
                await _journeys.AcceptInOtAsync(journeyId, tenantId, userId, true);
                await _journeys.StartSurgeryAsync(journeyId, tenantId, userId, true);
                break;
            case UatTargetState.SurgeryCompleted:
                await DriveThroughOt(journeyId, tenantId, userId);
                await Step(ClinicalState.SurgeryCompleted);
                break;
            case UatTargetState.PostOp:
                await DriveThroughOt(journeyId, tenantId, userId);
                await Step(ClinicalState.SurgeryCompleted);
                await Step(ClinicalState.PostOp);
                break;
            case UatTargetState.ReadyForDischarge:
                await DriveThroughOt(journeyId, tenantId, userId);
                await Step(ClinicalState.SurgeryCompleted);
                await Step(ClinicalState.PostOp);
                await Step(ClinicalState.ReadyForDischarge);
                if (scenario.DischargeOverride)
                    await _journeys.ApplyDischargeOverrideAsync(journeyId, tenantId, userId, new DischargeOverrideRequest("UAT privileged discharge override"));
                break;
            case UatTargetState.Discharged:
                await DriveThroughOt(journeyId, tenantId, userId);
                await Step(ClinicalState.SurgeryCompleted);
                await Step(ClinicalState.PostOp);
                await Step(ClinicalState.ReadyForDischarge);
                await Step(ClinicalState.Discharged);
                break;
            case UatTargetState.CancelledSurgery:
                if (scenario.CancelFromReady)
                {
                    await TryReady(journeyId, tenantId, userId);
                    await _journeys.CancelTodaySurgeryAsync(journeyId, tenantId, userId,
                        new CancelTodaySurgeryRequest("UAT cancel from ReadyForSurgery"));
                }
                else
                {
                    await _journeys.CancelAdmissionAsync(journeyId, tenantId, userId,
                        new CancelAdmissionRequest("UAT cancel from Expected"));
                }
                break;
        }
    }

    private async Task TryReady(Guid journeyId, Guid tenantId, Guid userId)
    {
        try
        {
            await _journeys.TransitionClinicalAsync(
                journeyId, tenantId, userId, new TransitionRequest(ClinicalState.ReadyForSurgery, "UAT seed", true));
        }
        catch (Exception ex)
        {
            _log.LogInformation(ex, "UAT ReadyForSurgery skipped");
        }
    }

    private async Task DriveThroughOt(Guid journeyId, Guid tenantId, Guid userId)
    {
        await TryReady(journeyId, tenantId, userId);
        await _journeys.TransitionClinicalAsync(
            journeyId, tenantId, userId, new TransitionRequest(ClinicalState.SentToOT, "UAT seed", true));
        await _journeys.AcceptInOtAsync(journeyId, tenantId, userId, true);
        await _journeys.StartSurgeryAsync(journeyId, tenantId, userId, true);
    }

    private async Task ApplyBillingAsync(
        PatientJourney journey, Guid tenantId, Guid branchId, Guid userId,
        UatScenarioDef scenario, int replica, decimal pkg)
    {
        var billId = await _authBilling.EnsureBillAsync(tenantId, branchId, journey.PatientId, journey.Id, pkg, userId);
        journey.OpdBillId = billId;
        journey.FinancialState = scenario.Billing == UatBillingKind.Estimated ? FinancialState.Estimated : FinancialState.Confirmed;
        await _db.SaveChangesAsync();

        if (scenario.Coverage is UatCoverageKind.Approved or UatCoverageKind.PatientSharePartial or UatCoverageKind.TpaOutstandingPatientCleared)
        {
            var payer = scenario.Coverage == UatCoverageKind.Approved ? pkg * 0.7m : 70_000m;
            var patient = pkg - payer;
            if (scenario.Coverage == UatCoverageKind.PatientSharePartial || scenario.Coverage == UatCoverageKind.TpaOutstandingPatientCleared)
            {
                payer = 70_000m;
                patient = 30_000m;
            }
            try { await _authBilling.ApplyCoverageAllocationAsync(journey.Id, payer, patient, userId); }
            catch (Exception ex) { _log.LogWarning(ex, "coverage allocation"); }
        }

        var instrument = replica switch
        {
            1 => "Cash",
            2 => "Card",
            3 => "UPI",
            4 => "BankTransfer",
            _ => "Other",
        };

        async Task Pay(string kind, decimal amount, string mode)
        {
            if (billId == Guid.Empty || amount <= 0) return;
            await _billing.AddAsync(journey.Id, tenantId, branchId, userId,
                new AddBillingTransactionRequest(kind, mode, amount, codeKey(kind), $"{UatEnvironment.DemoTag} {kind}"));
        }

        string codeKey(string kind) => $"{journey.Uhid}-{kind}-{replica}";

        switch (scenario.Billing)
        {
            case UatBillingKind.AdvanceHeld:
                await Pay("Advance", 30_000m, instrument);
                break;
            case UatBillingKind.PartialPayment:
                await Pay("Payment", Math.Min(40_000m, pkg * 0.4m), instrument);
                break;
            case UatBillingKind.FullyPaid:
            {
                var summary = await _authBilling.GetSummaryAsync(journey.Id);
                var due = summary.PatientBalance > 0 ? summary.PatientBalance : summary.BalanceDue;
                if (due > 0) await Pay("Payment", due, instrument);
                break;
            }
            case UatBillingKind.Refund:
                await Pay("Payment", 30_000m, instrument);
                await Pay("Refund", 10_000m, instrument);
                break;
            case UatBillingKind.Reversal:
                await Pay("Payment", 20_000m, instrument);
                var after = await _authBilling.GetSummaryAsync(journey.Id);
                var original = after.Payments.LastOrDefault(p => string.Equals(p.PaymentKind, "Payment", StringComparison.OrdinalIgnoreCase));
                if (original is not null && after.OpdBillId is Guid oid)
                    await _authBilling.ReversePaymentAsync(oid, original.Id, userId, "UAT reversal demo");
                break;
            case UatBillingKind.Discount:
                await Pay("Discount", 10_000m, instrument);
                await Pay("Payment", 20_000m, instrument);
                break;
        }
    }

    private async Task CompletePacAsync(Guid journeyId, Guid tenantId, Guid userId)
    {
        await _pac.SaveAssessmentAsync(journeyId, tenantId, userId, new SavePacAssessmentRequest(
            DateTime.UtcNow, "UAT pre-op diagnosis", "120/80", 72, 2,
            null, "NKDA",
            new PacSystemicReviewDto("NAD", "NAD", "NAD", "NAD", "NAD", "NAD", null),
            "None",
            new PacAirwayExamDto(1, "Adequate", "Normal", "Normal", "Intact", "Clear", "S1S2", "Good"),
            "Local", true, "Written", null, null, null, null, "UAT Anaesthetist"));
        await _pac.CompleteAssessmentAsync(journeyId, tenantId, userId);
    }

    private async Task<Guid> EnsurePatientAsync(Guid tenantId, string code, UatScenarioDef scenario, int replica, int index)
    {
        var healthId = $"{UatEnvironment.HealthIdPrefix}{code[^3..]}";
        var existing = await _db.Patients.IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.HealthId == healthId);
        if (existing is not null)
        {
            existing.DeletedAt = null;
            existing.LastName = code.Length <= 50 ? code : code[..50];
            existing.Status = "active";
            await _db.SaveChangesAsync();
            return existing.Id;
        }

        var id = Guid.NewGuid();
        var dob = UatScenarioCatalog.DobFor(index);
        var first = UatScenarioCatalog.FirstNameFor(index);
        var gender = UatScenarioCatalog.GenderFor(index);
        var mrn = $"{UatEnvironment.MrnPrefix}{code[^3..]}";
        var last = code.Length <= 50 ? code : code[..50];
        var phone = $"98{index:D8}";
        const string status = "active";
        var now = DateTime.UtcNow;
        await _db.Database.ExecuteSqlInterpolatedAsync($@"
INSERT INTO patient (id, tenant_id, first_name, last_name, medical_record_number, health_id, gender, date_of_birth, status, special_needs, contact_number, created_at, updated_at)
VALUES ({id}, {tenantId}, {first}, {last}, {mrn}, {healthId}, {gender}, {dob}, {status}, {$"{UatEnvironment.DemoTag} {scenario.Key} replica {replica}"}, {phone}, {now}, {now})");
        return id;
    }

    private async Task<Guid> SeedPriorDischargedAsync(
        Guid tenantId, Guid branchId, Guid userId, Guid wardId, Guid patientId, string code, AuthBedSnapshot? bed)
    {
        var priorCode = code + "-P1";
        var prior = new PatientJourney
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            PatientId = patientId,
            Uhid = priorCode,
            ClinicalState = ClinicalState.Discharged,
            OtState = OtState.Completed,
            FinancialState = FinancialState.Paid,
            PostOpState = PostOpState.Completed,
            ProcedureName = "Prior cataract (UAT)",
            EyeOperated = "OS",
            IsDischarged = true,
            IsLocked = true,
            DischargedAt = DateTime.UtcNow.AddMonths(-2),
            DischargeType = DischargeType.Routine,
            PaymentMode = "Cash",
            PackageAmount = 40_000m,
            TotalPaid = 0,
            TotalAdvances = 0,
            ChecklistPhaseStatus = "{}",
            WardPostopIolChecks = "{}",
            CreatedAt = DateTime.UtcNow.AddMonths(-2),
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = userId,
            Status = "active",
        };
        _db.PatientJourneys.Add(prior);
        await _db.SaveChangesAsync();
        return prior.Id;
    }

    private async Task LogBootstrapAsync(PatientJourney j, Guid userId)
    {
        _db.JourneyAuditLogs.Add(new JourneyAuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = j.TenantId,
            PatientJourneyId = j.Id,
            Action = "UatSeedCreated",
            StateType = "ClinicalState",
            NewValue = ClinicalState.Expected,
            PerformedByUserId = userId,
            PerformedAt = DateTime.UtcNow,
            Notes = $"{UatEnvironment.DemoTag} provisioned Expected via UAT seeder (same table as counselling handoff).",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        });
        await _db.SaveChangesAsync();
    }

    private static DateTime StampForReplica(int replica) => replica switch
    {
        1 => DateTime.UtcNow.Date,
        2 => DateTime.UtcNow.Date.AddDays(-1),
        3 => DateTime.UtcNow.Date.AddDays(-5),
        4 => new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 2, 0, 0, 0, DateTimeKind.Utc),
        _ => DateTime.UtcNow.Date.AddMonths(-1),
    };
}
