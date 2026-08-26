using Microsoft.EntityFrameworkCore;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

public partial class PatientJourneyService
{
    public async Task<PatientJourneyDetailDto> TransferBedAsync(
        Guid id, Guid tenantId, Guid userId, TransferBedRequest req)
    {
        _commandAuth.RequireBedTransfer();
        if (req.AssignedBedId == Guid.Empty)
            throw new ArgumentException("Destination bed is required.");

        var j = await RequireJourneyAsync(id, tenantId);
        await _mutationGuard.EnsureMutableAsync(j);
        EnsureExpectedVersion(j, req.ExpectedUpdatedAt);

        if (j.IsLocked || j.IsDischarged)
            throw new InvalidOperationException("Cannot transfer bed on a locked or discharged journey.");
        if (j.AssignedBedId == req.AssignedBedId)
            throw new InvalidOperationException("Patient is already assigned to that bed.");

        var fromBed = j.AssignedBedId;
        await TransferBedCoreAsync(j, tenantId, userId, req.AssignedBedId, req.WardId, reason: req.Reason ?? "Bed transfer");
        j.UpdatedAt = DateTime.UtcNow;
        j.UpdatedByUserId = userId;
        _outbox.Enqueue(
            tenantId,
            IntegrationEventTypes.BedTransferred,
            id,
            payload: LifecycleEventPayload.Build(
                tenantId, id, j.CounselingSessionId, j.PatientId, userId,
                extra: new { fromBedId = fromBed, toBedId = req.AssignedBedId, wardId = req.WardId }),
            correlationId: id,
            idempotencyKey: $"{IntegrationEventTypes.BedTransferred}:{id:N}:{req.AssignedBedId:N}");
        await SaveJourneyAsync();
        await LogAsync(j, userId, "BedTransferred", "AssignedBedId",
            fromBed?.ToString(), req.AssignedBedId.ToString(),
            previousState: null, newState: null,
            reason: req.Reason, correlationId: j.Id);
        _ = _notifications.NotifyWardChangedAsync(tenantId, j.BranchId, id, IpRealtimeEventMapper.BedChanged);
        return MapDetail(j);
    }

    public async Task<IReadOnlyList<JourneyBedAssignmentDto>> ListBedAssignmentsAsync(Guid id, Guid tenantId)
    {
        var exists = await _db.PatientJourneys.AnyAsync(
            x => x.Id == id && x.TenantId == tenantId && x.DeletedAt == null);
        if (!exists) throw new KeyNotFoundException("Journey not found.");

        return await _db.JourneyBedAssignments.AsNoTracking()
            .Where(a => a.PatientJourneyId == id && a.TenantId == tenantId && a.DeletedAt == null)
            .OrderByDescending(a => a.StartedAt)
            .Select(a => new JourneyBedAssignmentDto(
                a.Id, a.PatientJourneyId, a.PatientId, a.WardId, a.WardName,
                a.RoomNumber, a.BedNumber, a.AssignedBedId, a.AssignmentType,
                a.AssignedFromBedId, a.AssignedToBedId, a.StartedAt, a.EndedAt,
                a.PerformedByUserId, a.Reason, a.CreatedAt))
            .ToListAsync();
    }

    public async Task<PatientJourneyDetailDto> DischargeWithTypeAsync(
        Guid id, Guid tenantId, Guid userId, DischargeWithTypeRequest req)
    {
        _commandAuth.RequireDischarge();
        if (!req.Confirmed)
            throw new InvalidOperationException("Confirmation is required.");
        if (string.IsNullOrWhiteSpace(req.Reason))
            throw new ArgumentException("Documentation reason is required.");

        var type = DischargeType.Normalize(req.DischargeType);
        var j = await RequireJourneyAsync(id, tenantId);
        await _mutationGuard.EnsureMutableAsync(j);
        EnsureExpectedVersion(j, req.ExpectedUpdatedAt);
        StateTransitionValidator.ValidateTypedDischarge(j.ClinicalState, type);

        var gate = await _gates.EvaluateTransitionAsync(j, ClinicalState.Discharged, tenantId);

        // Routine close uses the same hard blocks as TransitionClinicalAsync.
        // AcknowledgeWarnings must not skip money / follow-up; that requires ip.discharge.override.
        // LAMA / Death / Transfer are clinical exceptions: they may vacate the bed with
        // warnings attached, without a financial hard-stop.
        if (type == DischargeType.Routine
            && !gate.CanProceed
            && !DischargeOverridePolicy.ClearsHardBlocks(gate.Warnings, j.DischargeOverrideApplied))
            return MapDetail(j, transitionWarnings: gate.Warnings);

        var prev = j.ClinicalState;
        j.ClinicalStateBeforeDischarge = prev;
        j.DischargeType = type;
        j.DischargeTypeReason = req.Reason.Trim();
        j.ClinicalState = ClinicalState.Discharged;
        j.DischargedAt = DateTime.UtcNow;
        j.WardCheckoutAt ??= DateTime.UtcNow;
        j.IsDischarged = true;
        j.IsLocked = true;
        j.UpdatedAt = DateTime.UtcNow;
        j.UpdatedByUserId = userId;

        if (j.AssignedBedId is { } bedId && bedId != Guid.Empty)
        {
            await CloseOpenBedAssignmentAsync(j, userId, BedAssignmentType.Discharge, req.Reason.Trim());
            await ReleaseAssignedBedAsync(j, tenantId, userId, ClinicalState.Discharged);
        }

        _outbox.Enqueue(
            tenantId,
            IntegrationEventTypes.PatientClinicallyDischarged,
            id,
            payload: LifecycleEventPayload.Build(tenantId, id, j.CounselingSessionId, j.PatientId, userId),
            correlationId: id,
            idempotencyKey: $"{IntegrationEventTypes.PatientClinicallyDischarged}:{id:N}");

        await SaveJourneyAsync();
        await LogAsync(j, userId, $"Discharged:{type}", "ClinicalState", prev, ClinicalState.Discharged,
            previousState: null, newState: SnapshotStates(j),
            reason: req.Reason, correlationId: j.Id);
        _ = _notifications.NotifyWardChangedAsync(tenantId, j.BranchId, id, ClinicalState.Discharged);
        await _notifications.NotifyDepartmentAsync(
            tenantId, j.BranchId, "STD_WARD", $"Discharge{type}", $"Journey closed ({type})", req.Reason.Trim());
        return MapDetail(j, transitionWarnings: gate.Warnings.Count > 0 ? gate.Warnings : null);
    }

    public async Task<PatientJourneyDetailDto> CancelDischargeAsync(
        Guid id, Guid tenantId, Guid userId, CancelDischargeRequest req)
    {
        _commandAuth.RequireDischargeCancel();
        if (string.IsNullOrWhiteSpace(req.Reason))
            throw new ArgumentException("Reason is required to cancel discharge.");

        var j = await RequireJourneyAsync(id, tenantId);
        EnsureExpectedVersion(j, req.ExpectedUpdatedAt);
        StateTransitionValidator.ValidateCancelDischarge(j.ClinicalState);

        var hasActiveSibling = await _db.PatientJourneys.AnyAsync(x =>
            x.TenantId == tenantId && x.PatientId == j.PatientId && x.Id != j.Id && x.DeletedAt == null
            && x.ClinicalState != ClinicalState.Discharged
            && x.ClinicalState != ClinicalState.AdmissionCancelled
            && x.ClinicalState != ClinicalState.CancelledSurgery);
        if (hasActiveSibling)
            throw new InvalidOperationException(
                "Cannot reopen this episode: the patient already has another active journey.");

        StateTransitionValidator.ValidateClinical(ClinicalState.Discharged, ClinicalState.ReadyForDischarge);

        var occupyId = req.AssignedBedId ?? j.AssignedBedId;
        if (occupyId is { } dest && dest != Guid.Empty)
        {
            AuthBedSnapshot? snap;
            try
            {
                snap = await _beds.ApplyAsync(tenantId, dest, userId, j.PatientId, "occupy");
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException(
                    "Destination bed is not available for reoccupy after discharge cancellation.", ex);
            }

            j.AssignedBedId = dest;
            if (snap is not null)
            {
                j.BedNumber = snap.BedNumber;
                if (!string.IsNullOrWhiteSpace(snap.RoomNumber))
                    j.RoomNumber = snap.RoomNumber;
            }
            await OpenBedAssignmentAsync(j, userId, BedAssignmentType.Reoccupy, dest, fromBedId: null, req.Reason.Trim());
        }

        var prevType = j.DischargeType;
        j.ClinicalState = ClinicalState.ReadyForDischarge;
        j.IsDischarged = false;
        j.IsLocked = false;
        j.DischargedAt = null;
        j.DischargeType = null;
        j.DischargeTypeReason = null;
        j.UpdatedAt = DateTime.UtcNow;
        j.UpdatedByUserId = userId;

        await SaveJourneyAsync();
        await LogAsync(j, userId, "DischargeCancelled", "ClinicalState",
            ClinicalState.Discharged, ClinicalState.ReadyForDischarge,
            previousState: prevType, newState: SnapshotStates(j),
            reason: req.Reason.Trim(), correlationId: j.Id);
        _ = _notifications.NotifyWardChangedAsync(tenantId, j.BranchId, id, ClinicalState.ReadyForDischarge);
        await _notifications.NotifyDepartmentAsync(
            tenantId, j.BranchId, "STD_WARD", "DischargeCancelled",
            "Discharge cancelled — journey reopened", req.Reason.Trim());
        return MapDetail(j);
    }

    internal async Task TransferBedCoreAsync(
        PatientJourney j, Guid tenantId, Guid userId, Guid destinationBedId, Guid? wardId, string reason)
    {
        if (destinationBedId == Guid.Empty)
            throw new ArgumentException("Destination bed is required.");
        if (destinationBedId == j.AssignedBedId)
            return;

        var previous = j.AssignedBedId;
        if (wardId.HasValue) j.WardId = wardId;

        if (previous is { } oldId && oldId != Guid.Empty)
            await _beds.ApplyAsync(tenantId, oldId, userId, j.PatientId, "transfer-out");

        AuthBedSnapshot? snap;
        try
        {
            var action = j.ClinicalState == ClinicalState.Expected && j.AdmittedAt is null ? "reserve" : "occupy";
            snap = await _beds.ApplyAsync(tenantId, destinationBedId, userId, j.PatientId, action);
        }
        catch (Exception occupyEx)
        {
            if (previous is { } rollbackId && rollbackId != Guid.Empty)
            {
                try
                {
                    var rollbackAction = j.ClinicalState == ClinicalState.Expected && j.AdmittedAt is null
                        ? "reserve" : "occupy";
                    await _beds.ApplyAsync(tenantId, rollbackId, userId, j.PatientId, rollbackAction);
                }
                catch (Exception rollbackEx)
                {
                    throw new InvalidOperationException(
                        "Destination bed occupy failed and rollback occupy of the previous bed also failed. Resolve occupancy in Auth.",
                        rollbackEx);
                }
            }
            throw new InvalidOperationException(
                "Destination bed could not be occupied (conflict or Auth failure). Previous bed was restored when possible.",
                occupyEx);
        }

        await CloseOpenBedAssignmentAsync(j, userId, BedAssignmentType.Transfer, reason);
        j.AssignedBedId = destinationBedId;
        if (snap is not null)
        {
            j.BedNumber = snap.BedNumber;
            if (!string.IsNullOrWhiteSpace(snap.RoomNumber))
                j.RoomNumber = snap.RoomNumber;
        }
        await OpenBedAssignmentAsync(
            j, userId,
            previous is null ? BedAssignmentType.Initial : BedAssignmentType.Transfer,
            destinationBedId, fromBedId: previous, reason);
    }

    internal async Task CloseOpenBedAssignmentAsync(PatientJourney j, Guid userId, string closeType, string reason)
    {
        var open = await _db.JourneyBedAssignments
            .Where(a => a.PatientJourneyId == j.Id && a.EndedAt == null && a.DeletedAt == null)
            .OrderByDescending(a => a.StartedAt)
            .ToListAsync();
        var now = DateTime.UtcNow;
        foreach (var row in open)
        {
            row.EndedAt = now;
            if (string.IsNullOrWhiteSpace(row.AssignmentType))
                row.AssignmentType = closeType;
            row.Reason = reason;
            row.UpdatedAt = now;
            row.UpdatedByUserId = userId;
            row.PerformedByUserId = userId;
        }
    }

    internal async Task OpenBedAssignmentAsync(
        PatientJourney j, Guid userId, string assignmentType, Guid? toBedId, Guid? fromBedId, string reason)
    {
        var hasOpen = _db.JourneyBedAssignments.Local.Any(a =>
            a.PatientJourneyId == j.Id && a.EndedAt == null && a.DeletedAt == null);
        if (hasOpen)
        {
            throw new InvalidOperationException(
                "A journey may have only one open bed assignment. Close the current assignment before opening another.");
        }
        string? wardName = null;
        if (j.WardId is { } wid)
            wardName = await _db.Wards.Where(w => w.Id == wid).Select(w => w.WardName).FirstOrDefaultAsync();

        _db.JourneyBedAssignments.Add(new JourneyBedAssignment
        {
            Id = Guid.NewGuid(),
            TenantId = j.TenantId,
            PatientJourneyId = j.Id,
            PatientId = j.PatientId,
            WardId = j.WardId,
            WardName = wardName,
            RoomNumber = j.RoomNumber,
            BedNumber = j.BedNumber,
            AssignedBedId = toBedId ?? j.AssignedBedId,
            AssignmentType = assignmentType,
            AssignedFromBedId = fromBedId,
            AssignedToBedId = toBedId,
            StartedAt = DateTime.UtcNow,
            PerformedByUserId = userId,
            Reason = reason,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = userId,
            UpdatedByUserId = userId,
            Status = "active",
        });
        await Task.CompletedTask;
    }

    internal async Task LinkPriorJourneyIfNeededAsync(Guid journeyId, Guid tenantId)
    {
        var j = await _db.PatientJourneys.FirstOrDefaultAsync(
            x => x.Id == journeyId && x.TenantId == tenantId && x.DeletedAt == null);
        if (j is null || j.PriorJourneyId.HasValue) return;

        var prior = await _db.PatientJourneys
            .Where(x => x.TenantId == tenantId
                        && x.PatientId == j.PatientId
                        && x.Id != j.Id
                        && x.DeletedAt == null
                        && (x.ClinicalState == ClinicalState.Discharged
                            || x.ClinicalState == ClinicalState.AdmissionCancelled))
            .OrderByDescending(x => x.DischargedAt ?? x.UpdatedAt)
            .Select(x => x.Id)
            .FirstOrDefaultAsync();
        if (prior == Guid.Empty) return;

        j.PriorJourneyId = prior;
        j.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }
}
