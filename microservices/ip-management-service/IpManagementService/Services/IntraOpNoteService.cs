using Microsoft.EntityFrameworkCore;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

public class IntraOpNoteService
{
    private readonly IpManagementDbContext _db;

    public IntraOpNoteService(IpManagementDbContext db)
    {
        _db = db;
    }

    public async Task<IntraOpNoteDto?> GetAsync(Guid journeyId, Guid tenantId)
    {
        var note = await _db.IntraOpNotes.FirstOrDefaultAsync(
            n => n.PatientJourneyId == journeyId && n.TenantId == tenantId && n.DeletedAt == null);
        return note is null ? null : await MapAsync(note);
    }

    public async Task<IntraOpNoteDto> SaveAsync(
        Guid journeyId, Guid tenantId, Guid branchId, Guid userId, SaveIntraOpNoteRequest req)
    {
        var existing = await _db.IntraOpNotes.FirstOrDefaultAsync(
            n => n.PatientJourneyId == journeyId && n.TenantId == tenantId && n.DeletedAt == null);

        if (existing is null)
        {
            existing = new IntraOpNote
            {
                TenantId         = tenantId,
                BranchId         = branchId,
                PatientJourneyId = journeyId,
                CreatedAt        = DateTime.UtcNow,
                CreatedByUserId  = userId,
            };
            _db.IntraOpNotes.Add(existing);
        }

        existing.PrimarySurgeonId   = req.PrimarySurgeonId;
        existing.AssistantSurgeonId = req.AssistantSurgeonId;
        existing.AnesthesiologistId = req.AnesthesiologistId;
        existing.ScrubNurseId       = req.ScrubNurseId;
        existing.SurgeryStartTime   = req.SurgeryStartTime;
        existing.SurgeryEndTime     = req.SurgeryEndTime;
        existing.AnesthesiaType     = req.AnesthesiaType;
        existing.AnesthesiaNotes    = req.AnesthesiaNotes;
        existing.ProcedurePerformed = req.ProcedurePerformed;
        existing.EyeOperated        = req.EyeOperated;
        existing.Findings           = req.Findings;
        existing.Complications      = req.Complications;
        // E4: do not persist ImplantUsed / ImplantPower from the client. Registry is usage SoT.
        existing.BloodLossMl        = req.BloodLossMl;
        existing.IvFluidMl          = req.IvFluidMl;
        existing.SpecimenSent       = req.SpecimenSent;
        existing.SpecimenDetails    = req.SpecimenDetails;
        existing.UpdatedAt          = DateTime.UtcNow;
        existing.UpdatedByUserId    = userId;

        _db.JourneyAuditLogs.Add(JourneyClinicalAudit.Entry(
            tenantId, journeyId, userId,
            "IntraOpNoteSaved", "IntraOp",
            oldValue: existing.NotesStatus,
            newValue: existing.NotesStatus,
            notes: existing.ProcedurePerformed,
            correlationId: existing.Id));

        await _db.SaveChangesAsync();
        return await MapAsync(existing);
    }

    public async Task<IntraOpNoteDto> SignAsync(Guid journeyId, Guid tenantId, Guid userId)
    {
        var note = await _db.IntraOpNotes.FirstOrDefaultAsync(
            n => n.PatientJourneyId == journeyId && n.TenantId == tenantId && n.DeletedAt == null)
            ?? throw new KeyNotFoundException("Intra-op note not found.");

        if (note.NotesStatus == "Locked")
            throw new InvalidOperationException("Intra-op note is already locked.");

        var previousStatus = note.NotesStatus;
        note.NotesStatus       = "Signed";
        note.SignedAt          = DateTime.UtcNow;
        note.SignedByUserId    = userId;
        note.UpdatedAt         = DateTime.UtcNow;
        note.UpdatedByUserId   = userId;

        _db.JourneyAuditLogs.Add(JourneyClinicalAudit.Entry(
            tenantId, journeyId, userId,
            "IntraOpNoteSigned", "IntraOp",
            oldValue: previousStatus,
            newValue: note.NotesStatus,
            notes: note.ProcedurePerformed,
            correlationId: note.Id));

        await _db.SaveChangesAsync();
        return await MapAsync(note);
    }

    private async Task<IntraOpNoteDto> MapAsync(IntraOpNote n)
    {
        var usage = await _db.JourneyImplantUsages
            .AsNoTracking()
            .Where(u => u.JourneyId == n.PatientJourneyId
                        && u.TenantId == n.TenantId
                        && u.DeletedAt == null
                        && u.UsageStatus == ImplantUsageStatus.Implanted)
            .OrderByDescending(u => u.ScannedAt)
            .FirstOrDefaultAsync();

        var implantUsed = n.ImplantUsed;
        var implantPower = n.ImplantPower;
        if (usage is not null)
        {
            var label = string.Join(" ", new[] { usage.Brand, usage.Model }
                .Where(s => !string.IsNullOrWhiteSpace(s)));
            if (!string.IsNullOrWhiteSpace(label))
                implantUsed = label;
            if (usage.Power is decimal p)
                implantPower = IolDiopter.Format(p);
        }

        return new IntraOpNoteDto(
            n.Id, n.PrimarySurgeonId, n.AssistantSurgeonId, n.AnesthesiologistId, n.ScrubNurseId,
            n.SurgeryStartTime, n.SurgeryEndTime, n.AnesthesiaType, n.AnesthesiaNotes,
            n.ProcedurePerformed, n.EyeOperated, n.Findings, n.Complications,
            implantUsed, implantPower, n.BloodLossMl, n.IvFluidMl,
            n.SpecimenSent, n.SpecimenDetails, n.NotesStatus, n.SignedAt);
    }
}
