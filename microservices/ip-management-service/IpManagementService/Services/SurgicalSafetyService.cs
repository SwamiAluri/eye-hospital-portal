using Microsoft.EntityFrameworkCore;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

/// <summary>Form 1 OT — Surgical Safety Checklist (Before Anaesthesia, WHO, After Surgery).</summary>
public class SurgicalSafetyService
{
    private static readonly HashSet<string> BillingOkStates =
    [
        FinancialState.Paid,
        FinancialState.PartiallyPaid,
        FinancialState.Confirmed,
        FinancialState.Settled,
    ];

    private readonly IpManagementDbContext           _db;
    private readonly ChecklistPhaseStatusService   _phaseStatus;

    public SurgicalSafetyService(
        IpManagementDbContext db,
        ChecklistPhaseStatusService phaseStatus)
    {
        _db          = db;
        _phaseStatus = phaseStatus;
    }

    public async Task<SurgicalSafetyChecklistDto> GetChecklistAsync(Guid journeyId, Guid tenantId)
    {
        var journey   = await RequireJourneyAsync(journeyId, tenantId);
        var checklist = await GetOrInitAsync(journey, tenantId);
        return BuildDto(journey, checklist);
    }

    public async Task<SurgicalSafetyChecklistDto> SaveBeforeAnaesthesiaAsync(
        Guid journeyId, Guid tenantId, Guid userId, SaveBeforeAnaesthesiaRequest req)
    {
        var journey   = await RequireJourneyAsync(journeyId, tenantId);
        var checklist = await GetOrInitAsync(journey, tenantId);

        checklist.IdentityConfirmed        = req.IdentityConfirmed;
        checklist.EyeRe                    = req.EyeRe;
        checklist.EyeLe                    = req.EyeLe;
        checklist.TopicalAntibioticsUsed   = req.TopicalAntibioticsUsed;
        checklist.SurgeryType              = req.SurgeryType;
        checklist.BillingVerifiedOverride  = req.BillingVerifiedOverride;
        checklist.AscanVerified            = req.AscanVerified;
        checklist.AllergyKnown             = req.AllergyKnown;
        checklist.AllergyDetails           = req.AllergyDetails;
        checklist.ConsentFormChecked       = req.ConsentFormChecked;
        checklist.FitnessConfirmed         = req.FitnessConfirmed;

        ApplyBeforeAnaesthesiaCompletion(checklist, userId);
        checklist.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await _phaseStatus.UpdateAsync(journeyId, tenantId, d =>
            d["before_anaesthesia_complete"] = IsBeforeAnaesthesiaComplete(checklist));

        return BuildDto(journey, checklist);
    }

    public async Task<SurgicalSafetyChecklistDto> SaveWhoTimeoutAsync(
        Guid journeyId, Guid tenantId, Guid userId, SaveWhoTimeoutRequest req)
    {
        var journey   = await RequireJourneyAsync(journeyId, tenantId);
        var checklist = await GetOrInitAsync(journey, tenantId);

        checklist.WhoPatientIdentity   = req.PatientIdentity;
        checklist.WhoCorrectEye          = req.CorrectEye;
        checklist.WhoCorrectProcedure    = req.CorrectProcedure;
        checklist.WhoConsentConfirmed    = req.ConsentConfirmed;
        checklist.WhoSurgeonUserId       = req.SurgeonUserId;
        checklist.WhoNurseUserId         = req.NurseUserId;

        if (IsWhoComplete(checklist))
        {
            checklist.WhoCompletedAt ??= DateTime.UtcNow;
        }
        else
        {
            checklist.WhoCompletedAt = null;
        }

        checklist.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await _phaseStatus.UpdateAsync(journeyId, tenantId, d =>
            d["who_timeout_complete"] = IsWhoComplete(checklist));

        return BuildDto(journey, checklist);
    }

    public async Task<SurgicalSafetyChecklistDto> SaveAfterSurgeryAsync(
        Guid journeyId, Guid tenantId, Guid userId, SaveAfterSurgeryRequest req)
    {
        var journey   = await RequireJourneyAsync(journeyId, tenantId);
        var checklist = await GetOrInitAsync(journey, tenantId);

        checklist.ProcedureNameRecorded      = req.ProcedureNameRecorded;
        checklist.PostopMedicationInstructed = req.PostopMedicationInstructed;
        checklist.PostopPositionInstructed   = req.PostopPositionInstructed;

        if (IsAfterSurgeryComplete(checklist))
        {
            checklist.AfterSurgeryCompletedAt ??= DateTime.UtcNow;
            checklist.AfterSurgeryCompletedBy ??= userId;
        }
        else
        {
            checklist.AfterSurgeryCompletedAt = null;
            checklist.AfterSurgeryCompletedBy = null;
        }

        checklist.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await _phaseStatus.UpdateAsync(journeyId, tenantId, d =>
            d["after_surgery_complete"] = IsAfterSurgeryComplete(checklist));

        return BuildDto(journey, checklist);
    }

    public async Task ValidateBillingGateForAcceptAsync(Guid journeyId, Guid tenantId)
    {
        var journey   = await RequireJourneyAsync(journeyId, tenantId);
        var checklist = await GetOrInitAsync(journey, tenantId);

        if (!IsBillingGateSatisfied(journey, checklist))
        {
            throw new InvalidOperationException(
                "Billing clearance is required before accepting the patient in OT. "
                + "Confirm payment in IP Management, tick billing verified, or apply Emergency FC.");
        }
    }

    public static bool IsBillingGateSatisfied(PatientJourney journey, SurgicalSafetyChecklist checklist)
    {
        if (journey.EmergencyFcApplied) return true;
        if (checklist.BillingVerifiedOverride) return true;
        if (!BillingOkStates.Contains(journey.FinancialState)) return false;
        return journey.BalanceDue is null or <= 0;
    }

    public static bool IsBillingVerifiedAuto(PatientJourney journey)
        => BillingOkStates.Contains(journey.FinancialState)
           && (journey.BalanceDue is null or <= 0);

    public static bool IsBeforeAnaesthesiaComplete(SurgicalSafetyChecklist c)
        => c.IdentityConfirmed
           && (c.EyeRe || c.EyeLe)
           && c.TopicalAntibioticsUsed
           && !string.IsNullOrWhiteSpace(c.SurgeryType)
           && c.AscanVerified
           && c.ConsentFormChecked
           && c.FitnessConfirmed;

    public static bool IsWhoComplete(SurgicalSafetyChecklist c)
        => c.WhoPatientIdentity
           && c.WhoCorrectEye
           && c.WhoCorrectProcedure
           && c.WhoConsentConfirmed
           && c.WhoSurgeonUserId.HasValue
           && c.WhoNurseUserId.HasValue;

    public static bool IsAfterSurgeryComplete(SurgicalSafetyChecklist c)
        => c.ProcedureNameRecorded
           && c.PostopMedicationInstructed
           && c.PostopPositionInstructed;

    private void ApplyBeforeAnaesthesiaCompletion(SurgicalSafetyChecklist checklist, Guid userId)
    {
        if (IsBeforeAnaesthesiaComplete(checklist))
        {
            checklist.BeforeAnaesthesiaCompletedAt ??= DateTime.UtcNow;
            checklist.BeforeAnaesthesiaCompletedBy ??= userId;
        }
        else
        {
            checklist.BeforeAnaesthesiaCompletedAt = null;
            checklist.BeforeAnaesthesiaCompletedBy = null;
        }
    }

    private async Task<SurgicalSafetyChecklist> GetOrInitAsync(PatientJourney journey, Guid tenantId)
    {
        var existing = await FindActiveChecklistAsync(journey.Id, tenantId);
        if (existing is not null) return existing;

        var revived = await ReviveSoftDeletedChecklistAsync(journey.Id, tenantId);
        if (revived is not null) return revived;

        var now = DateTime.UtcNow;
        var row = new SurgicalSafetyChecklist
        {
            Id                = Guid.NewGuid(),
            TenantId          = tenantId,
            PatientJourneyId  = journey.Id,
            SurgeryType       = InferSurgeryType(journey.ProcedureName),
            CreatedAt         = now,
            UpdatedAt         = now,
            Status            = "active",
        };

        _db.SurgicalSafetyChecklists.Add(row);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            _db.ChangeTracker.Clear();
            var raced = await FindActiveChecklistAsync(journey.Id, tenantId)
                        ?? await ReviveSoftDeletedChecklistAsync(journey.Id, tenantId);
            if (raced is not null) return raced;

            throw new InvalidOperationException(
                "Surgical safety checklist could not be created or loaded for this journey.");
        }

        return row;
    }

    private Task<SurgicalSafetyChecklist?> FindActiveChecklistAsync(Guid journeyId, Guid tenantId)
        => _db.SurgicalSafetyChecklists
            .FirstOrDefaultAsync(c => c.PatientJourneyId == journeyId
                                      && c.TenantId == tenantId
                                      && c.DeletedAt == null);

    private async Task<SurgicalSafetyChecklist?> ReviveSoftDeletedChecklistAsync(Guid journeyId, Guid tenantId)
    {
        var deleted = await _db.SurgicalSafetyChecklists
            .FirstOrDefaultAsync(c => c.PatientJourneyId == journeyId && c.DeletedAt != null);
        if (deleted is null) return null;

        deleted.DeletedAt = null;
        deleted.TenantId  = tenantId;
        deleted.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return deleted;
    }

    private static string? InferSurgeryType(string? procedureName)
    {
        if (string.IsNullOrWhiteSpace(procedureName)) return null;
        return procedureName.Contains("cataract", StringComparison.OrdinalIgnoreCase)
            ? "Cataract"
            : "Other";
    }

    private SurgicalSafetyChecklistDto BuildDto(PatientJourney journey, SurgicalSafetyChecklist c)
    {
        var beforeComplete = IsBeforeAnaesthesiaComplete(c);
        var whoComplete    = IsWhoComplete(c);
        var afterComplete  = IsAfterSurgeryComplete(c);

        var warnings = new List<string>();
        if (!beforeComplete)
            warnings.Add("Before Anaesthesia checklist is incomplete.");
        if (!whoComplete)
            warnings.Add("WHO timeout is incomplete (requires surgeon + nurse sign-off).");
        if (!afterComplete)
            warnings.Add("After Surgery checklist is incomplete.");

        var gates = new SurgicalSafetyGateDto(
            IsBillingGateSatisfied(journey, c),
            IsBillingVerifiedAuto(journey),
            journey.EmergencyFcApplied,
            journey.BalanceDue,
            journey.FinancialState,
            beforeComplete,
            whoComplete,
            afterComplete,
            warnings);

        return new SurgicalSafetyChecklistDto(
            journey.Id,
            journey.EyeOperated,
            journey.ProcedureName,
            new BeforeAnaesthesiaSectionDto(
                c.IdentityConfirmed, c.EyeRe, c.EyeLe, c.TopicalAntibioticsUsed,
                c.SurgeryType, c.BillingVerifiedOverride, c.AscanVerified,
                c.AllergyKnown, c.AllergyDetails, c.ConsentFormChecked,
                c.FitnessConfirmed, c.BeforeAnaesthesiaCompletedAt),
            new WhoTimeoutSectionDto(
                c.WhoPatientIdentity, c.WhoCorrectEye, c.WhoCorrectProcedure,
                c.WhoConsentConfirmed, c.WhoSurgeonUserId, c.WhoNurseUserId,
                c.WhoCompletedAt),
            new AfterSurgerySectionDto(
                c.ProcedureNameRecorded, c.PostopMedicationInstructed,
                c.PostopPositionInstructed, c.AfterSurgeryCompletedAt),
            gates);
    }

    private async Task<PatientJourney> RequireJourneyAsync(Guid journeyId, Guid tenantId)
    {
        return await _db.PatientJourneys
                   .FirstOrDefaultAsync(j => j.Id == journeyId
                                             && j.TenantId == tenantId
                                             && j.DeletedAt == null)
               ?? throw new KeyNotFoundException($"Journey {journeyId} not found.");
    }
}
