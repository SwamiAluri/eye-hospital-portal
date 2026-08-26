using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

/// <summary>
/// Auto-completes Form 2 (WARD_CHECKLIST) items when upstream ward pre-op events occur.
/// Does not auto-uncheck items the nurse has cleared manually.
/// </summary>
public class WardChecklistAutoSyncService
{
    public const string InvestigationReportsKey = "investigation_reports_available";
    public const string AscanConfirmedKey       = "ward_ascan_confirmed";
    public const string VitalsCheckedKey        = "vitals_checked";
    public const string PacDoneKey              = "pac_done_documented";
    public const string DilatationDoneKey       = "ward_dilatation_done";
    public const string ConsentPatientKey       = "consent_patient_signed";
    public const string ConsentWitnessKey       = "consent_witness_signed";
    public const string ConsentSurgeonKey       = "consent_surgeon_signed";
    public const string InformedOtKey           = "informed_surgeon_anaesthesia_ot";

    public const string AnaesthesiaTypeKey           = "anaesthesia_type_selected";
    public const string AnaesthetistAssignedKey      = "anaesthetist_assigned";
    public const string FitnessAssessedKey           = "fitness_assessed";
    public const string ContraindicationsReviewedKey = "contraindications_reviewed";

    private static readonly string[] DilatationKeywords =
    [
        "tropicamide", "cyclopentolate", "phenylephrine", "homatropine",
        "mydriacyl", "atropine", "dilat", "mydriatic", "cyclopleg",
    ];

    private readonly IpManagementDbContext _db;
    private readonly IServiceProvider _serviceProvider;

    public WardChecklistAutoSyncService(IpManagementDbContext db, IServiceProvider serviceProvider)
    {
        _db = db;
        _serviceProvider = serviceProvider;
    }

    private PreOpClearanceService PreOp =>
        _serviceProvider.GetRequiredService<PreOpClearanceService>();

    public static bool IsDilatationMedicine(string? medicineName)
    {
        if (string.IsNullOrWhiteSpace(medicineName)) return false;
        var hay = medicineName.ToLowerInvariant();
        return DilatationKeywords.Any(k => hay.Contains(k, StringComparison.Ordinal));
    }

    public async Task SyncItemAsync(
        Guid journeyId,
        Guid tenantId,
        Guid userId,
        string itemKey,
        bool completed,
        string? notes = null)
    {
        if (!completed) return;

        var item = await _db.PreOpSectionItems
            .FirstOrDefaultAsync(i => i.ItemKey == itemKey
                                      && i.FormCode == WardChecklistService.WardFormCode
                                      && i.FormContext == WardChecklistService.WardFormContext
                                      && i.DeletedAt == null);
        if (item is null) return;

        await PreOp.GetOrInitClearanceAsync(
            journeyId, tenantId, userId,
            new InitPreOpClearanceRequest(null, null));

        var clearance = await _db.PreOpClearances
            .FirstAsync(c => c.JourneyId == journeyId && c.TenantId == tenantId && c.DeletedAt == null);

        var existing = await _db.PreOpCompletions
            .FirstOrDefaultAsync(c => c.ClearanceId == clearance.Id
                                      && c.ItemId == item.Id
                                      && c.DeletedAt == null);

        if (existing is { IsCompleted: true } or { IsBypassed: true })
            return;

        await PreOp.SaveCompletionAsync(
            journeyId, tenantId, userId, item.Id,
            new SavePreOpCompletionRequest(
                item.Id, true, false, null, notes, null));
    }

    public async Task SyncClearanceItemByKeyAsync(
        Guid journeyId,
        Guid tenantId,
        Guid userId,
        string itemKey,
        bool completed,
        string? resultValue = null,
        string? notes = null)
    {
        if (!completed) return;

        var item = await _db.PreOpSectionItems
            .FirstOrDefaultAsync(i => i.ItemKey == itemKey
                                      && i.Category == "Anaesthesia"
                                      && i.DeletedAt == null
                                      && i.Status == "active");
        if (item is null) return;

        await PreOp.GetOrInitClearanceAsync(
            journeyId, tenantId, userId,
            new InitPreOpClearanceRequest(null, null));

        var clearance = await _db.PreOpClearances
            .FirstAsync(c => c.JourneyId == journeyId && c.TenantId == tenantId && c.DeletedAt == null);

        var existing = await _db.PreOpCompletions
            .FirstOrDefaultAsync(c => c.ClearanceId == clearance.Id
                                      && c.ItemId == item.Id
                                      && c.DeletedAt == null);

        if (existing is { IsCompleted: true } or { IsBypassed: true })
            return;

        await PreOp.SaveCompletionAsync(
            journeyId, tenantId, userId, item.Id,
            new SavePreOpCompletionRequest(
                item.Id, true, false, null, notes, null, resultValue));
    }

    public async Task SyncAnaesthesiaFromPacAsync(
        Guid journeyId,
        Guid tenantId,
        Guid userId,
        PatientJourney journey,
        PacAssessment pac)
    {
        await SyncClearanceItemByKeyAsync(
            journeyId, tenantId, userId, AnaesthesiaTypeKey, true, pac.AnaesthesiaPlan);
        await SyncClearanceItemByKeyAsync(
            journeyId, tenantId, userId, FitnessAssessedKey, true);
        await SyncClearanceItemByKeyAsync(
            journeyId, tenantId, userId, ContraindicationsReviewedKey, true);

        var anaesthetist = journey.AnaesthetistName?.Trim()
                           ?? pac.CompletedByDesignation?.Trim();
        if (!string.IsNullOrWhiteSpace(anaesthetist))
        {
            await SyncClearanceItemByKeyAsync(
                journeyId, tenantId, userId, AnaesthetistAssignedKey, true, anaesthetist);
        }
    }

    public async Task SyncFromInvestigationsAsync(
        Guid journeyId, Guid tenantId, Guid userId, WardInvestigationChecklistDto checklist)
    {
        var applicable = checklist.Items.Where(i => i.AppliesToJourney).ToList();

        if (InvestigationsReportsReady(applicable))
        {
            await SyncItemAsync(
                journeyId, tenantId, userId, InvestigationReportsKey, true,
                "Auto-synced from §1 investigations");
        }

        if (AscanVerified(applicable))
        {
            await SyncItemAsync(
                journeyId, tenantId, userId, AscanConfirmedKey, true,
                "Auto-synced from §1 A-Scan verification");
        }
    }

    public async Task SyncVitalsCheckedAsync(Guid journeyId, Guid tenantId, Guid userId)
    {
        var hasVitals = await _db.VitalSigns.AnyAsync(v =>
            v.JourneyId == journeyId
            && v.TenantId == tenantId
            && v.DeletedAt == null
            && v.Context == null);

        if (hasVitals)
        {
            await SyncItemAsync(
                journeyId, tenantId, userId, VitalsCheckedKey, true,
                "Auto-synced from vitals record");
        }
    }

    public async Task SyncConsentSectionConfirmedAsync(Guid journeyId, Guid tenantId, Guid userId)
    {
        await SyncItemAsync(
            journeyId, tenantId, userId, ConsentPatientKey, true,
            "Auto-synced from §2 consent clearance");
        await SyncItemAsync(
            journeyId, tenantId, userId, ConsentSurgeonKey, true,
            "Auto-synced from §2 consent clearance");
    }

    public async Task SyncMarkReadyOptionalAsync(
        Guid journeyId, Guid tenantId, Guid userId, string previousState, string newState)
    {
        if (previousState == ClinicalState.Admitted && newState == ClinicalState.ReadyForSurgery)
        {
            await SyncItemAsync(
                journeyId, tenantId, userId, InformedOtKey, true,
                "Auto-synced on Mark Ready");
        }
    }

    /// <summary>
    /// Reverses only the Mark Ready auto-tick of <see cref="InformedOtKey"/>.
    /// A nurse who completed the item manually is left untouched.
    /// </summary>
    public async Task ReverseMarkReadyOptionalAsync(
        Guid journeyId, Guid tenantId, Guid userId, string previousState, string newState)
    {
        if (!UnmarkReadyRules.IsUnmarkReady(previousState, newState)) return;

        var item = await _db.PreOpSectionItems
            .FirstOrDefaultAsync(i => i.ItemKey == InformedOtKey
                                      && i.FormCode == WardChecklistService.WardFormCode
                                      && i.FormContext == WardChecklistService.WardFormContext
                                      && i.DeletedAt == null);
        if (item is null) return;

        var clearance = await _db.PreOpClearances
            .FirstOrDefaultAsync(c => c.JourneyId == journeyId && c.TenantId == tenantId && c.DeletedAt == null);
        if (clearance is null) return;

        var existing = await _db.PreOpCompletions
            .FirstOrDefaultAsync(c => c.ClearanceId == clearance.Id
                                      && c.ItemId == item.Id
                                      && c.DeletedAt == null);
        if (existing is null) return;
        if (existing.Notes is null
            || !existing.Notes.Contains("Auto-synced on Mark Ready", StringComparison.Ordinal))
            return;

        existing.IsCompleted = false;
        existing.CompletedAt = null;
        existing.CompletedByUserId = null;
        existing.Notes = "Reversed on Un-mark Ready";
        existing.UpdatedAt = DateTime.UtcNow;
        existing.UpdatedByUserId = userId;
        await _db.SaveChangesAsync();
    }

    private static bool InvestigationsReportsReady(IReadOnlyList<WardInvestigationItemDto> applicable)
    {
        if (applicable.Count == 0) return false;

        return applicable.All(i =>
            i.IsBypassed
            || (!string.IsNullOrWhiteSpace(i.ResultValue)
                && (!i.IsCritical || string.Equals(i.EntryStatus, "verified", StringComparison.OrdinalIgnoreCase))));
    }

    private static bool AscanVerified(IReadOnlyList<WardInvestigationItemDto> applicable)
    {
        var ascan = applicable.FirstOrDefault(i =>
            i.ItemKey.Equals("ascan_done", StringComparison.OrdinalIgnoreCase));

        return ascan is not null
               && (ascan.IsBypassed
                   || (!string.IsNullOrWhiteSpace(ascan.ResultValue)
                       && string.Equals(ascan.EntryStatus, "verified", StringComparison.OrdinalIgnoreCase)));
    }
}
