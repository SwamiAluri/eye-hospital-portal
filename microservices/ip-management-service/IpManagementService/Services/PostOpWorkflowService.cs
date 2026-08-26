using Microsoft.EntityFrameworkCore;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

/// <summary>
/// Handles all 4 post-op modals:
///   1. Nurse checklist
///   2. Surgeon checklist
///   3. Post-op instructions
///   4. Discharge summary
/// Plus IOL returns and FormatHeads (surgery note templates).
/// </summary>
public class PostOpWorkflowService
{
    private readonly IpManagementDbContext _db;
    private readonly ImplantUsageService _implants;
    private readonly IAuthAppointmentStatusClient? _appointments;

    // Default checklist labels — seeded by backend on first use per tenant
    private static readonly string[] DefaultNurseItems =
    [
        "Eye Pad / Shield in Place",
        "Intra-Ocular Pressure (IOP) Checked",
        "Post-Op Eye Drops: First Dose Given",
        "Pain Level Assessed",
        "Vital Signs Stable",
        "Patient & Family Education: Eye Shield & Drops",
        "Light Perception Confirmed",
    ];

    private static readonly string[] DefaultSurgeonItems =
    [
        "Operative Note Signed",
        "IOL Power Confirmed",
        "Eye Drop Prescription Written",
        "Follow-up Appointment Scheduled",
        "Discharge Orders Signed",
    ];

    public PostOpWorkflowService(
        IpManagementDbContext db,
        ImplantUsageService implants,
        IAuthAppointmentStatusClient? appointments = null)
    {
        _db = db;
        _implants = implants;
        _appointments = appointments;
    }

    // ── Nurse Checklist ────────────────────────────────────────────────────────

    public async Task<List<ChecklistItemDto>> GetNurseItemsAsync(Guid tenantId)
    {
        await EnsureNurseItemsSeededAsync(tenantId);
        return await _db.NurseChecklistItems
            .Where(i => i.TenantId == tenantId && i.IsActive && i.DeletedAt == null)
            .OrderBy(i => i.ItemOrder)
            .Select(i => new ChecklistItemDto(i.Id, i.ItemLabel, i.ItemOrder, i.IsActive))
            .ToListAsync();
    }

    public async Task<List<ChecklistResponseDto>> GetNurseResponsesAsync(Guid journeyId, Guid tenantId)
    {
        var items     = await GetNurseItemsAsync(tenantId);
        var responses = await _db.NurseChecklistResponses
            .Where(r => r.PatientJourneyId == journeyId && r.TenantId == tenantId && r.DeletedAt == null)
            .ToListAsync();

        return items.Select(item =>
        {
            var resp = responses.FirstOrDefault(r => r.ChecklistItemId == item.Id);
            return new ChecklistResponseDto(item.Id, item.ItemLabel,
                resp?.IsCompleted ?? false, resp?.Notes, resp?.CompletedAt);
        }).ToList();
    }

    public async Task SaveNurseResponsesAsync(
        Guid journeyId, Guid tenantId, Guid userId, SaveChecklistRequest req)
    {
        foreach (var item in req.Responses)
        {
            var existing = await _db.NurseChecklistResponses.FirstOrDefaultAsync(
                r => r.PatientJourneyId == journeyId
                  && r.ChecklistItemId  == item.ChecklistItemId
                  && r.TenantId         == tenantId
                  && r.DeletedAt        == null);

            if (existing is null)
            {
                _db.NurseChecklistResponses.Add(new NurseChecklistResponse
                {
                    TenantId           = tenantId,
                    PatientJourneyId   = journeyId,
                    ChecklistItemId    = item.ChecklistItemId,
                    IsCompleted        = item.IsCompleted,
                    Notes              = item.Notes,
                    CompletedByUserId  = item.IsCompleted ? userId : null,
                    CompletedAt        = item.IsCompleted ? DateTime.UtcNow : null,
                    CreatedAt          = DateTime.UtcNow,
                    UpdatedAt          = DateTime.UtcNow,
                });
            }
            else
            {
                existing.IsCompleted       = item.IsCompleted;
                existing.Notes             = item.Notes;
                existing.CompletedByUserId = item.IsCompleted ? userId : existing.CompletedByUserId;
                existing.CompletedAt       = item.IsCompleted ? DateTime.UtcNow : existing.CompletedAt;
                existing.UpdatedAt         = DateTime.UtcNow;
            }
        }
        await _db.SaveChangesAsync();
    }

    // ── Surgeon Checklist ──────────────────────────────────────────────────────

    public async Task<List<ChecklistItemDto>> GetSurgeonItemsAsync(Guid tenantId)
    {
        await EnsureSurgeonItemsSeededAsync(tenantId);
        return await _db.SurgeonChecklistItems
            .Where(i => i.TenantId == tenantId && i.IsActive && i.DeletedAt == null)
            .OrderBy(i => i.ItemOrder)
            .Select(i => new ChecklistItemDto(i.Id, i.ItemLabel, i.ItemOrder, i.IsActive))
            .ToListAsync();
    }

    public async Task<List<ChecklistResponseDto>> GetSurgeonResponsesAsync(Guid journeyId, Guid tenantId)
    {
        var items     = await GetSurgeonItemsAsync(tenantId);
        var responses = await _db.SurgeonChecklistResponses
            .Where(r => r.PatientJourneyId == journeyId && r.TenantId == tenantId && r.DeletedAt == null)
            .ToListAsync();

        return items.Select(item =>
        {
            var resp = responses.FirstOrDefault(r => r.ChecklistItemId == item.Id);
            return new ChecklistResponseDto(item.Id, item.ItemLabel,
                resp?.IsCompleted ?? false, resp?.Notes, resp?.CompletedAt);
        }).ToList();
    }

    public async Task SaveSurgeonResponsesAsync(
        Guid journeyId, Guid tenantId, Guid userId, SaveChecklistRequest req)
    {
        foreach (var item in req.Responses)
        {
            var existing = await _db.SurgeonChecklistResponses.FirstOrDefaultAsync(
                r => r.PatientJourneyId == journeyId
                  && r.ChecklistItemId  == item.ChecklistItemId
                  && r.TenantId         == tenantId
                  && r.DeletedAt        == null);

            if (existing is null)
            {
                _db.SurgeonChecklistResponses.Add(new SurgeonChecklistResponse
                {
                    TenantId           = tenantId,
                    PatientJourneyId   = journeyId,
                    ChecklistItemId    = item.ChecklistItemId,
                    IsCompleted        = item.IsCompleted,
                    Notes              = item.Notes,
                    CompletedByUserId  = item.IsCompleted ? userId : null,
                    CompletedAt        = item.IsCompleted ? DateTime.UtcNow : null,
                    CreatedAt          = DateTime.UtcNow,
                    UpdatedAt          = DateTime.UtcNow,
                });
            }
            else
            {
                existing.IsCompleted       = item.IsCompleted;
                existing.Notes             = item.Notes;
                existing.CompletedByUserId = item.IsCompleted ? userId : existing.CompletedByUserId;
                existing.CompletedAt       = item.IsCompleted ? DateTime.UtcNow : existing.CompletedAt;
                existing.UpdatedAt         = DateTime.UtcNow;
            }
        }
        await _db.SaveChangesAsync();
    }

    // ── Post-Op Instructions ───────────────────────────────────────────────────

    public async Task<PostOpInstructionDto?> GetInstructionsAsync(Guid journeyId, Guid tenantId)
    {
        var i = await _db.PostOpInstructions.FirstOrDefaultAsync(
            i => i.PatientJourneyId == journeyId && i.TenantId == tenantId && i.DeletedAt == null);
        if (i is null) return null;
        return MapInstruction(i);
    }

    public async Task<PostOpInstructionDto> SaveInstructionsAsync(
        Guid journeyId, Guid tenantId, Guid branchId, Guid userId, SavePostOpInstructionRequest req)
    {
        var existing = await _db.PostOpInstructions.FirstOrDefaultAsync(
            i => i.PatientJourneyId == journeyId && i.TenantId == tenantId && i.DeletedAt == null);

        if (existing is null)
        {
            existing = new PostOpInstruction
            {
                TenantId         = tenantId,
                PatientJourneyId = journeyId,
                CreatedAt        = DateTime.UtcNow,
            };
            _db.PostOpInstructions.Add(existing);
        }

        existing.Medications          = req.Medications;
        existing.ActivityRestrictions = req.ActivityRestrictions;
        existing.DietaryInstructions  = req.DietaryInstructions;
        existing.FollowupDate         = req.FollowupDate;
        existing.FollowupDoctorId     = req.FollowupDoctorId;
        existing.EyeCareInstructions  = req.EyeCareInstructions;
        existing.WarningSigns         = req.WarningSigns;

        if (req.FollowupAppointmentId.HasValue)
        {
            await BindFollowupAppointmentAsync(
                existing, journeyId, tenantId, req.FollowupAppointmentId.Value);
        }
        existing.IsSaved              = true;
        existing.SavedAt              = DateTime.UtcNow;
        existing.SavedByUserId        = userId;
        existing.UpdatedAt            = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return MapInstruction(existing);
    }

    // ── Discharge Summary ──────────────────────────────────────────────────────

    public async Task<DischargeSummaryDto?> GetSummaryAsync(Guid journeyId, Guid tenantId)
    {
        var s = await _db.DischargeSummaries.FirstOrDefaultAsync(
            s => s.PatientJourneyId == journeyId && s.TenantId == tenantId && s.DeletedAt == null);
        if (s is null) return null;
        return MapSummary(s);
    }

    public async Task<DischargeSummaryDto> SaveSummaryAsync(
        Guid journeyId, Guid tenantId, Guid branchId, Guid userId, SaveDischargeSummaryRequest req)
    {
        var existing = await _db.DischargeSummaries.FirstOrDefaultAsync(
            s => s.PatientJourneyId == journeyId && s.TenantId == tenantId && s.DeletedAt == null);

        if (existing is null)
        {
            existing = new DischargeSummary
            {
                TenantId         = tenantId,
                PatientJourneyId = journeyId,
                CreatedAt        = DateTime.UtcNow,
                CreatedByUserId  = userId,
            };
            _db.DischargeSummaries.Add(existing);
        }

        existing.ConditionAtDischarge   = req.ConditionAtDischarge;
        existing.DiagnosisCodes         = req.DiagnosisCodes;
        existing.ProceduresPerformed    = req.ProceduresPerformed;
        existing.HospitalCourse         = req.HospitalCourse;
        existing.DischargeInstructions  = req.DischargeInstructions;
        existing.MedicationsOnDischarge = req.MedicationsOnDischarge;
        existing.FollowUpPlan           = req.FollowUpPlan;
        existing.FormatType             = req.FormatType;
        existing.FinalBillAmount        = req.FinalBillAmount;
        existing.UpdatedAt              = DateTime.UtcNow;
        existing.UpdatedByUserId        = userId;

        await _db.SaveChangesAsync();
        return MapSummary(existing);
    }

    public async Task<DischargeSummaryDto> FinalizeSummaryAsync(Guid journeyId, Guid tenantId, Guid userId)
    {
        var summary = await _db.DischargeSummaries.FirstOrDefaultAsync(
            s => s.PatientJourneyId == journeyId && s.TenantId == tenantId && s.DeletedAt == null)
            ?? throw new KeyNotFoundException("Discharge summary not found.");

        summary.SummaryStatus = "Final";
        summary.FinalizedAt   = DateTime.UtcNow;
        summary.FinalizedBy   = userId;
        summary.UpdatedAt     = DateTime.UtcNow;
        summary.UpdatedByUserId = userId;

        await _db.SaveChangesAsync();
        return MapSummary(summary);
    }

    // ── IOL Returns ────────────────────────────────────────────────────────────

    public async Task<List<IolReturnDto>> GetIolReturnsAsync(Guid journeyId, Guid tenantId)
    {
        return await _db.IolReturns
            .Where(r => r.PatientJourneyId == journeyId && r.TenantId == tenantId && r.DeletedAt == null)
            .OrderByDescending(r => r.ReturnedAt)
            .Select(r => new IolReturnDto(r.Id, r.IolPower, r.IolBatch, r.IolBarcode, r.Reason, r.ReturnedAt))
            .ToListAsync();
    }

    public async Task<IolReturnDto> RecordIolReturnAsync(
        Guid journeyId, Guid tenantId, Guid branchId, Guid userId, RecordIolReturnRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Reason) || req.Reason.Trim().Length < 3)
            throw new ArgumentException("Reason is required when recording an IOL return.");

        await _implants.RecordReturnAsync(journeyId, tenantId, userId, req);

        var ret = new IolReturn
        {
            TenantId         = tenantId,
            PatientJourneyId = journeyId,
            IolPower         = req.IolPower,
            IolBatch         = req.IolBatch,
            IolBarcode       = req.IolBarcode,
            Reason           = req.Reason.Trim(),
            ReturnedAt       = DateTime.UtcNow,
            ReturnedByUserId = userId,
            CreatedAt        = DateTime.UtcNow,
            UpdatedAt        = DateTime.UtcNow,
            CreatedByUserId  = userId,
            UpdatedByUserId  = userId,
        };
        _db.IolReturns.Add(ret);
        await _db.SaveChangesAsync();
        return new IolReturnDto(ret.Id, ret.IolPower, ret.IolBatch, ret.IolBarcode, ret.Reason, ret.ReturnedAt);
    }

    // ── Surgery Note Templates (Format Heads) ──────────────────────────────────

    public async Task<List<SurgeryNoteTemplateDto>> GetTemplatesAsync(Guid tenantId)
    {
        return await _db.SurgeryNoteTemplates
            .Where(t => t.TenantId == tenantId && t.IsActive && t.DeletedAt == null)
            .OrderBy(t => t.FieldOrder)
            .Select(t => new SurgeryNoteTemplateDto(
                t.Id, t.FieldLabel, t.FieldType, t.FieldOrder,
                t.IsRequired, t.Options, t.IsActive))
            .ToListAsync();
    }

    public async Task<SurgeryNoteTemplateDto> AddTemplateAsync(
        Guid tenantId, Guid userId, SaveSurgeryNoteTemplateRequest req)
    {
        var tmpl = new SurgeryNoteTemplate
        {
            TenantId   = tenantId,
            FieldLabel = req.FieldLabel,
            FieldType  = req.FieldType,
            FieldOrder = req.FieldOrder,
            IsRequired = req.IsRequired,
            Options    = req.Options,
            CreatedAt  = DateTime.UtcNow,
            UpdatedAt  = DateTime.UtcNow,
        };
        _db.SurgeryNoteTemplates.Add(tmpl);
        await _db.SaveChangesAsync();
        return new SurgeryNoteTemplateDto(tmpl.Id, tmpl.FieldLabel, tmpl.FieldType,
                                          tmpl.FieldOrder, tmpl.IsRequired, tmpl.Options, tmpl.IsActive);
    }

    public async Task<bool> DeleteTemplateAsync(Guid id, Guid tenantId)
    {
        var tmpl = await _db.SurgeryNoteTemplates.FirstOrDefaultAsync(
            t => t.Id == id && t.TenantId == tenantId && t.DeletedAt == null);
        if (tmpl is null) return false;
        tmpl.DeletedAt = DateTime.UtcNow;
        tmpl.IsActive  = false;
        tmpl.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }

    // ── Seed helpers ───────────────────────────────────────────────────────────

    private async Task EnsureNurseItemsSeededAsync(Guid tenantId)
    {
        var count = await _db.NurseChecklistItems.CountAsync(
            i => i.TenantId == tenantId && i.DeletedAt == null);
        if (count > 0) return;

        for (int i = 0; i < DefaultNurseItems.Length; i++)
        {
            _db.NurseChecklistItems.Add(new NurseChecklistItem
            {
                TenantId  = tenantId,
                ItemLabel = DefaultNurseItems[i],
                ItemOrder = i + 1,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
        }
        await _db.SaveChangesAsync();
    }

    private async Task EnsureSurgeonItemsSeededAsync(Guid tenantId)
    {
        var count = await _db.SurgeonChecklistItems.CountAsync(
            i => i.TenantId == tenantId && i.DeletedAt == null);
        if (count > 0) return;

        for (int i = 0; i < DefaultSurgeonItems.Length; i++)
        {
            _db.SurgeonChecklistItems.Add(new SurgeonChecklistItem
            {
                TenantId  = tenantId,
                ItemLabel = DefaultSurgeonItems[i],
                ItemOrder = i + 1,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
        }
        await _db.SaveChangesAsync();
    }

    // ── Mappers ────────────────────────────────────────────────────────────────

    private async Task BindFollowupAppointmentAsync(
        PostOpInstruction existing, Guid journeyId, Guid tenantId, Guid appointmentId)
    {
        if (appointmentId == Guid.Empty)
        {
            existing.FollowupAppointmentId = null;
            return;
        }

        var journey = await _db.PatientJourneys.FirstOrDefaultAsync(
            j => j.Id == journeyId && j.TenantId == tenantId && j.DeletedAt == null)
            ?? throw new KeyNotFoundException($"Journey {journeyId} not found.");

        if (_appointments is null)
        {
            existing.FollowupAppointmentId = appointmentId;
            return;
        }

        AuthAppointmentStatus status;
        try
        {
            status = await _appointments.GetStatusAsync(appointmentId, tenantId);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException(
                "Could not verify the follow-up appointment. Try again.", ex);
        }

        if (!status.Exists)
            throw new ArgumentException("That appointment was not found.");
        if (status.Cancelled)
            throw new ArgumentException("That appointment is cancelled. Book or link an active visit.");
        if (status.PatientId is Guid pid && pid != Guid.Empty && pid != journey.PatientId)
            throw new ArgumentException("That appointment belongs to a different patient.");

        existing.FollowupAppointmentId = appointmentId;
        if (status.AppointmentDate is DateTime when)
            existing.FollowupDate = when;
        if (status.DoctorId is Guid doctorId && doctorId != Guid.Empty)
            existing.FollowupDoctorId = doctorId;
    }

    private static PostOpInstructionDto MapInstruction(PostOpInstruction i) => new(
        i.Id, i.Medications, i.ActivityRestrictions, i.DietaryInstructions,
        i.FollowupDate, i.FollowupDoctorId, i.EyeCareInstructions,
        i.WarningSigns, i.IsSaved, i.SavedAt, i.FollowupAppointmentId);

    private static DischargeSummaryDto MapSummary(DischargeSummary s) => new(
        s.Id, s.ConditionAtDischarge, s.DiagnosisCodes, s.ProceduresPerformed,
        s.HospitalCourse, s.DischargeInstructions, s.MedicationsOnDischarge,
        s.FollowUpPlan, s.FormatType, s.SummaryStatus, s.FinalBillAmount, s.FinalizedAt);
}
