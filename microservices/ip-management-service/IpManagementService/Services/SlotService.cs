using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;
using Microsoft.EntityFrameworkCore;

namespace IpManagementService.Services;

public class SlotService
{
    private readonly IpManagementDbContext _db;
    private readonly IPreOpNotificationClient _notifications;
    private readonly IIntegrationOutboxService _outbox;

    public SlotService(
        IpManagementDbContext db,
        IPreOpNotificationClient notifications,
        IIntegrationOutboxService outbox)
    {
        _db = db;
        _notifications = notifications;
        _outbox = outbox;
    }

    public async Task<SlotBoardDto> ListBoardAsync(
        Guid tenantId, Guid branchId, DateOnly date, Guid? theatreId)
    {
        var slots = await ActiveSlots(tenantId, branchId, date, theatreId)
            .OrderBy(s => s.TheatreId)
            .ThenBy(s => s.SequenceNo)
            .ToListAsync();

        var rows = await MapRowsAsync(tenantId, slots);
        var unassigned = await ListUnassignedAsync(tenantId, branchId);

        IReadOnlyList<JourneySlotRowDto> of(string session) =>
            rows.Where(r => r.Session == session).OrderBy(r => r.SequenceNo).ToList();

        return new SlotBoardDto(date, theatreId, of(SlotSession.Morning), of(SlotSession.Afternoon), of(SlotSession.Evening), unassigned);
    }

    public async Task<SlotMetricsDto> GetMetricsAsync(
        Guid tenantId, Guid branchId, DateOnly date, Guid? theatreId)
    {
        var slots = await ActiveSlots(tenantId, branchId, date, theatreId).ToListAsync();
        var journeyIds = slots.Select(s => s.JourneyId).ToList();
        var journeys = journeyIds.Count == 0
            ? new List<PatientJourney>()
            : await _db.PatientJourneys.AsNoTracking()
                .Where(j => journeyIds.Contains(j.Id))
                .ToListAsync();
        var byId = journeys.ToDictionary(j => j.Id);

        var ready = slots.Count(s =>
            byId.TryGetValue(s.JourneyId, out var j) && j.ClinicalState == ClinicalState.ReadyForSurgery);

        var dischargeMins = slots
            .Select(s => byId.TryGetValue(s.JourneyId, out var j) ? j : null)
            .Where(j => j?.DischargedAt != null)
            .Select(j =>
            {
                var slot = slots.First(s => s.JourneyId == j!.Id);
                return (j!.DischargedAt!.Value - slot.PlannedArrivalAt).TotalMinutes;
            })
            .Where(m => m >= 0 && m < 24 * 60)
            .ToList();

        var turnover = new List<double>();
        foreach (var group in slots.GroupBy(s => (s.TheatreId, s.Session)))
        {
            var ended = group
                .OrderBy(s => s.SequenceNo)
                .Select(s => byId.TryGetValue(s.JourneyId, out var j) ? j.SurgeryEndedAt : null)
                .Where(t => t != null)
                .Select(t => t!.Value)
                .ToList();
            for (var i = 1; i < ended.Count; i++)
            {
                var gap = (ended[i] - ended[i - 1]).TotalMinutes;
                if (gap >= 0 && gap < 180) turnover.Add(gap);
            }
        }

        return new SlotMetricsDto(
            slots.Count,
            ready,
            dischargeMins.Count == 0 ? null : Math.Round(dischargeMins.Average(), 1),
            turnover.Count == 0 ? null : Math.Round(turnover.Average(), 1));
    }

    public async Task<SlotThroughputDto> GetThroughputAsync(
        Guid tenantId, Guid branchId, DateOnly from, DateOnly to, Guid? theatreId)
    {
        if (to < from)
            throw new ArgumentException("to must be on or after from.");
        if (to.DayNumber - from.DayNumber + 1 > SlotThroughputCalculator.MaxInclusiveDays)
            throw new ArgumentException($"Date range cannot exceed {SlotThroughputCalculator.MaxInclusiveDays} days.");

        var q = _db.JourneySlots.AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.BranchId == branchId
                        && s.SlotDate >= from && s.SlotDate <= to);
        if (theatreId is { } tid && tid != Guid.Empty)
            q = q.Where(s => s.TheatreId == tid);

        var slots = await q.ToListAsync();
        var journeyIds = slots.Select(s => s.JourneyId).Distinct().ToList();
        var journeys = journeyIds.Count == 0
            ? new List<PatientJourney>()
            : await _db.PatientJourneys.AsNoTracking()
                .Where(j => journeyIds.Contains(j.Id))
                .ToListAsync();
        var byId = journeys.ToDictionary(j => j.Id);

        var facts = slots.Select(s =>
        {
            byId.TryGetValue(s.JourneyId, out var j);
            return new SlotThroughputFact(
                s.Id,
                s.JourneyId,
                s.TheatreId,
                s.TheatreName,
                s.SlotDate,
                s.Session,
                s.SequenceNo,
                s.PlannedArrivalAt,
                s.CreatedAt,
                s.ReleasedAt,
                j?.SurgeryEndedAt,
                j?.DischargedAt,
                j?.ClinicalState);
        }).ToList();

        return SlotThroughputCalculator.Compute(facts, from, to) with
        {
            VitalsOverrideCount = await CountSlottedAuditAsync(
                tenantId, branchId, from, to, journeyIds, JourneyClinicalAudit.VitalsWarningAcknowledged),
            IolMismatchOverrideCount = await CountSlottedAuditAsync(
                tenantId, branchId, from, to, journeyIds, JourneyClinicalAudit.ImplantMismatchOverridden),
        };
    }

    private async Task<int> CountSlottedAuditAsync(
        Guid tenantId,
        Guid branchId,
        DateOnly from,
        DateOnly to,
        IReadOnlyList<Guid> slottedJourneyIds,
        string action)
    {
        if (slottedJourneyIds.Count == 0)
            return 0;

        var start = from.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var endExclusive = to.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        return await (
            from a in _db.JourneyAuditLogs.AsNoTracking()
            join j in _db.PatientJourneys.AsNoTracking() on a.PatientJourneyId equals j.Id
            where a.TenantId == tenantId
                  && j.BranchId == branchId
                  && a.DeletedAt == null
                  && a.Action == action
                  && a.PerformedAt >= start
                  && a.PerformedAt < endExclusive
                  && slottedJourneyIds.Contains(a.PatientJourneyId)
            select a.Id).CountAsync();
    }

    public async Task<IReadOnlyList<JourneySlotRowDto>> ListHistoryAsync(Guid tenantId, Guid journeyId)
    {
        var slots = await _db.JourneySlots.AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.JourneyId == journeyId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();
        return await MapRowsAsync(tenantId, slots);
    }

    public async Task<JourneySlotRowDto> AssignAsync(Guid tenantId, Guid userId, AssignSlotRequest req)
    {
        if (req.TheatreId == Guid.Empty)
            throw new ArgumentException("theatreId is required.");
        var session = SlotPolicy.NormalizeSession(req.Session);

        var journey = await _db.PatientJourneys.FirstOrDefaultAsync(
            j => j.Id == req.JourneyId && j.TenantId == tenantId && j.DeletedAt == null)
            ?? throw new KeyNotFoundException($"PatientJourney {req.JourneyId} not found.");
        if (journey.BranchId != req.BranchId)
            throw new ArgumentException("Journey does not belong to this branch.");
        if (SlotPolicy.IsPastSentToOt(journey))
            throw new InvalidOperationException("Cannot reassign a patient who has already been sent to OT.");

        await ReleaseActiveForJourneyAsync(journey, userId, "Reassigned");
        if (_db.ChangeTracker.HasChanges())
            await SaveTrackedAsync();

        var sequence = req.SequenceNo ?? await NextSequenceAsync(tenantId, req.TheatreId, req.SlotDate, session);
        if (sequence < 1)
            throw new ArgumentException("sequenceNo must be 1 or greater.");
        if (await SequenceTakenAsync(tenantId, req.TheatreId, req.SlotDate, session, sequence))
            throw new InvalidOperationException("Slot sequence is already taken.");

        var planned = req.PlannedArrivalAt ?? SlotPolicy.DefaultPlannedArrivalUtc(req.SlotDate, session, sequence);
        var now = DateTime.UtcNow;
        var slot = new JourneySlot
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = req.BranchId,
            SlotDate = req.SlotDate,
            Session = session,
            TheatreId = req.TheatreId,
            TheatreName = string.IsNullOrWhiteSpace(req.TheatreName) ? null : req.TheatreName.Trim(),
            SequenceNo = sequence,
            PlannedArrivalAt = planned,
            JourneyId = journey.Id,
            CreatedAt = now,
            UpdatedAt = now,
            CreatedByUserId = userId,
            UpdatedByUserId = userId,
        };
        _db.JourneySlots.Add(slot);
        journey.SlotId = slot.Id;
        journey.UpdatedAt = now;
        journey.UpdatedByUserId = userId;

        Audit(journey, userId, "SlotAssigned", null, SlotPolicy.FormatLabel(session, sequence),
            $"{session} seq {sequence}");

        _outbox.Enqueue(
            tenantId,
            IntegrationEventTypes.JourneyScheduled,
            journey.Id,
            new
            {
                journeyId = journey.Id,
                slotId = slot.Id,
                session,
                sequenceNo = sequence,
                plannedArrivalAt = planned,
                theatreId = req.TheatreId,
            },
            correlationId: journey.Id,
            idempotencyKey: $"{IntegrationEventTypes.JourneyScheduled}:{journey.Id:N}:{slot.Id:N}");

        await SaveTrackedAsync();
        _ = _notifications.NotifyWardChangedAsync(tenantId, journey.BranchId, journey.Id, IpRealtimeEventMapper.SlotChanged);

        return (await MapRowsAsync(tenantId, [slot]))[0];
    }

    public async Task<IReadOnlyList<JourneySlotRowDto>> ReorderAsync(Guid tenantId, Guid userId, ReorderSlotsRequest req)
    {
        var session = SlotPolicy.NormalizeSession(req.Session);
        if (req.JourneyIds == null || req.JourneyIds.Count == 0)
            throw new ArgumentException("journeyIds is required.");
        if (req.JourneyIds.Distinct().Count() != req.JourneyIds.Count)
            throw new ArgumentException("journeyIds must be unique.");

        var current = await ActiveSlots(tenantId, req.BranchId, req.SlotDate, req.TheatreId)
            .Where(s => s.Session == session)
            .OrderBy(s => s.SequenceNo)
            .ToListAsync();

        var currentIds = current.Select(s => s.JourneyId).ToHashSet();
        if (current.Count != req.JourneyIds.Count || req.JourneyIds.Any(id => !currentIds.Contains(id)))
            throw new InvalidOperationException("Slot roster changed. Reload and try again.");

        var journeys = await _db.PatientJourneys
            .Where(j => req.JourneyIds.Contains(j.Id))
            .ToListAsync();
        if (journeys.Any(SlotPolicy.IsPastSentToOt))
            throw new InvalidOperationException("Cannot reassign a patient who has already been sent to OT.");

        var byJourney = current.ToDictionary(s => s.JourneyId);
        var originalSeq = current.ToDictionary(s => s.JourneyId, s => s.SequenceNo);
        var now = DateTime.UtcNow;
        for (var i = 0; i < current.Count; i++)
        {
            current[i].SequenceNo = SlotPolicy.ResequenceOffset + i;
            current[i].UpdatedAt = now;
            current[i].UpdatedByUserId = userId;
        }
        await SaveTrackedAsync();

        for (var i = 0; i < req.JourneyIds.Count; i++)
        {
            var slot = byJourney[req.JourneyIds[i]];
            var journey = journeys.First(j => j.Id == slot.JourneyId);
            var oldValue = SlotPolicy.FormatLabel(session, originalSeq[slot.JourneyId]);
            slot.SequenceNo = i + 1;
            slot.PlannedArrivalAt = SlotPolicy.DefaultPlannedArrivalUtc(req.SlotDate, session, i + 1);
            slot.UpdatedAt = now;
            slot.UpdatedByUserId = userId;
            journey.UpdatedAt = now;
            journey.UpdatedByUserId = userId;
            Audit(journey, userId, "SlotReordered", oldValue, SlotPolicy.FormatLabel(session, i + 1), session);
        }

        await SaveTrackedAsync();
        _ = _notifications.NotifyWardChangedAsync(
            tenantId, req.BranchId, req.JourneyIds[0], IpRealtimeEventMapper.SlotChanged);

        return await MapRowsAsync(tenantId, current.OrderBy(s => s.SequenceNo).ToList());
    }

    public async Task ReleaseAsync(Guid tenantId, Guid userId, Guid slotId, string? reason)
    {
        var slot = await _db.JourneySlots.FirstOrDefaultAsync(s => s.Id == slotId && s.TenantId == tenantId)
            ?? throw new KeyNotFoundException($"Slot {slotId} not found.");
        if (slot.ReleasedAt != null)
            return;

        var journey = await _db.PatientJourneys.FirstOrDefaultAsync(
            j => j.Id == slot.JourneyId && j.TenantId == tenantId && j.DeletedAt == null)
            ?? throw new KeyNotFoundException($"PatientJourney {slot.JourneyId} not found.");
        if (SlotPolicy.IsPastSentToOt(journey))
            throw new InvalidOperationException("Cannot reassign a patient who has already been sent to OT.");

        ReleaseSlotRow(slot, userId, string.IsNullOrWhiteSpace(reason) ? "Released" : reason.Trim());
        if (journey.SlotId == slot.Id)
            journey.SlotId = null;
        journey.UpdatedAt = DateTime.UtcNow;
        journey.UpdatedByUserId = userId;
        Audit(journey, userId, "SlotReleased", SlotPolicy.FormatLabel(slot.Session, slot.SequenceNo), null, reason);

        await SaveTrackedAsync();
        _ = _notifications.NotifyWardChangedAsync(tenantId, journey.BranchId, journey.Id, IpRealtimeEventMapper.SlotChanged);
    }

    private async Task ReleaseActiveForJourneyAsync(PatientJourney journey, Guid userId, string reason)
    {
        var active = await _db.JourneySlots
            .Where(s => s.JourneyId == journey.Id && s.ReleasedAt == null)
            .ToListAsync();
        foreach (var slot in active)
        {
            Audit(journey, userId, "SlotReleased", SlotPolicy.FormatLabel(slot.Session, slot.SequenceNo), null, reason);
            ReleaseSlotRow(slot, userId, reason);
        }
        journey.SlotId = null;
    }

    private static void ReleaseSlotRow(JourneySlot slot, Guid userId, string reason)
    {
        var now = DateTime.UtcNow;
        slot.ReleasedAt = now;
        slot.ReleasedReason = reason.Length > 200 ? reason[..200] : reason;
        slot.ReleasedByUserId = userId;
        slot.UpdatedAt = now;
        slot.UpdatedByUserId = userId;
    }

    private IQueryable<JourneySlot> ActiveSlots(Guid tenantId, Guid branchId, DateOnly date, Guid? theatreId)
    {
        var q = _db.JourneySlots.Where(s =>
            s.TenantId == tenantId && s.BranchId == branchId && s.SlotDate == date && s.ReleasedAt == null);
        if (theatreId is { } tid && tid != Guid.Empty)
            q = q.Where(s => s.TheatreId == tid);
        return q;
    }

    private Task<bool> SequenceTakenAsync(Guid tenantId, Guid theatreId, DateOnly date, string session, int sequence)
        => _db.JourneySlots.AnyAsync(s =>
            s.TenantId == tenantId
            && s.TheatreId == theatreId
            && s.SlotDate == date
            && s.Session == session
            && s.SequenceNo == sequence
            && s.ReleasedAt == null);

    private async Task<int> NextSequenceAsync(Guid tenantId, Guid theatreId, DateOnly date, string session)
    {
        var max = await _db.JourneySlots
            .Where(s => s.TenantId == tenantId
                        && s.TheatreId == theatreId
                        && s.SlotDate == date
                        && s.Session == session
                        && s.ReleasedAt == null)
            .Select(s => (int?)s.SequenceNo)
            .MaxAsync();
        return (max ?? 0) + 1;
    }

    private async Task<IReadOnlyList<UnassignedSlotCandidateDto>> ListUnassignedAsync(Guid tenantId, Guid branchId)
    {
        var rows = await (
            from j in _db.PatientJourneys.AsNoTracking()
            where j.TenantId == tenantId && j.BranchId == branchId && j.DeletedAt == null
                  && j.SlotId == null
                  && (j.ClinicalState == ClinicalState.Expected
                      || j.ClinicalState == ClinicalState.Admitted
                      || j.ClinicalState == ClinicalState.ReadyForSurgery)
            join p in _db.Patients on j.PatientId equals p.Id into patJoin
            from patient in patJoin.DefaultIfEmpty()
            orderby j.SurgeryScheduledAt
            select new { j, patient }
        ).Take(80).ToListAsync();

        return rows
            .Where(r => !SlotPolicy.IsPastSentToOt(r.j))
            .Select(r => new UnassignedSlotCandidateDto(
                r.j.Id,
                r.patient == null ? r.j.Uhid : $"{r.patient.FirstName} {r.patient.LastName}".Trim(),
                r.j.Uhid ?? r.patient?.HealthId,
                r.j.ProcedureName,
                r.j.EyeOperated,
                r.j.ClinicalState))
            .ToList();
    }

    private async Task<IReadOnlyList<JourneySlotRowDto>> MapRowsAsync(Guid tenantId, IReadOnlyList<JourneySlot> slots)
    {
        if (slots.Count == 0) return [];
        var journeyIds = slots.Select(s => s.JourneyId).Distinct().ToList();
        var journeys = await _db.PatientJourneys.AsNoTracking()
            .Where(j => journeyIds.Contains(j.Id) && j.TenantId == tenantId)
            .ToListAsync();
        var byJourney = journeys.ToDictionary(j => j.Id);
        var patientIds = journeys.Select(j => j.PatientId).Distinct().ToList();
        var patients = await _db.Patients.AsNoTracking()
            .Where(p => patientIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id);

        return slots.Select(s =>
        {
            byJourney.TryGetValue(s.JourneyId, out var j);
            IpPatient? pt = null;
            if (j != null) patients.TryGetValue(j.PatientId, out pt);
            var phase = j == null
                ? new Dictionary<string, bool>()
                : ChecklistPhaseStatusService.Parse(j.ChecklistPhaseStatus);
            var pac = phase.TryGetValue("pac_completed", out var pacVal) && pacVal;
            var name = pt == null ? j?.Uhid : $"{pt.FirstName} {pt.LastName}".Trim();
            return new JourneySlotRowDto(
                s.Id,
                s.JourneyId,
                s.TheatreId,
                s.TheatreName,
                s.SlotDate,
                s.Session,
                s.SequenceNo,
                s.PlannedArrivalAt,
                SlotPolicy.FormatLabel(s.Session, s.SequenceNo),
                s.ReleasedAt,
                s.ReleasedReason,
                name,
                j?.Uhid ?? pt?.HealthId,
                j?.ProcedureName,
                j?.EyeOperated,
                j?.ClinicalState,
                pac,
                j?.OtState,
                j?.EmergencyFcApplied ?? false);
        }).ToList();
    }

    private void Audit(PatientJourney j, Guid userId, string action, string? oldValue, string? newValue, string? notes)
    {
        var now = DateTime.UtcNow;
        _db.JourneyAuditLogs.Add(new JourneyAuditLog
        {
            TenantId = j.TenantId,
            PatientJourneyId = j.Id,
            Action = action,
            StateType = "Slot",
            OldValue = Truncate(oldValue),
            NewValue = Truncate(newValue),
            Notes = notes,
            CorrelationId = j.Id,
            PerformedByUserId = userId,
            PerformedAt = now,
            CreatedAt = now,
            UpdatedAt = now,
        });
    }

    private static string? Truncate(string? value)
        => value is null || value.Length <= 50 ? value : value[..50];

    private async Task SaveTrackedAsync()
    {
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            throw new InvalidOperationException("Slot sequence is already taken.");
        }
    }

    private static bool IsUniqueViolation(DbUpdateException ex)
    {
        var msg = ex.InnerException?.Message ?? ex.Message;
        return msg.Contains("23505", StringComparison.Ordinal)
               || msg.Contains("ux_journey_slot", StringComparison.OrdinalIgnoreCase)
               || msg.Contains("unique", StringComparison.OrdinalIgnoreCase)
               || msg.Contains("duplicate", StringComparison.OrdinalIgnoreCase);
    }
}
