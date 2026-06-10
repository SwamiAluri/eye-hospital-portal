using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

/// <summary>Form 5 — Anaesthesia monitoring (pre-op review, intra-op readings, discharge clearance).</summary>
public class AnaesthesiaMonitoringService
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly IpManagementDbContext           _db;
    private readonly ChecklistPhaseStatusService   _phaseStatus;

    public AnaesthesiaMonitoringService(
        IpManagementDbContext db,
        ChecklistPhaseStatusService phaseStatus)
    {
        _db          = db;
        _phaseStatus = phaseStatus;
    }

    public async Task<bool> IsDischargeClearanceCompleteAsync(Guid journeyId, Guid tenantId)
    {
        var row = await _db.AnaesthesiaMonitorings
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.PatientJourneyId == journeyId
                                      && m.TenantId == tenantId
                                      && m.DeletedAt == null);
        return row?.DischargeClearedAt.HasValue == true
               && row.DischargePr.HasValue
               && !string.IsNullOrWhiteSpace(row.DischargeBp);
    }

    public async Task<AnaesthesiaMonitoringDto> GetMonitoringAsync(Guid journeyId, Guid tenantId)
    {
        await RequireJourneyAsync(journeyId, tenantId);
        var row = await GetOrInitAsync(journeyId, tenantId);
        return BuildDto(row);
    }

    public async Task<AnaesthesiaMonitoringDto> SavePreOpReviewAsync(
        Guid journeyId, Guid tenantId, Guid userId, SavePreOpReviewRequest req)
    {
        await RequireJourneyAsync(journeyId, tenantId);
        var row = await GetOrInitAsync(journeyId, tenantId);

        row.PreOpPulse             = req.Pulse;
        row.PreOpBp                = req.Bp;
        row.PreOpSpo2              = req.Spo2;
        row.PreOpConsentConfirmed  = req.ConsentConfirmed;
        row.PreOpReviewAt          = DateTime.UtcNow;
        row.UpdatedAt              = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return BuildDto(row);
    }

    public async Task<AnaesthesiaMonitoringDto> AddReadingAsync(
        Guid journeyId, Guid tenantId, SaveMonitoringReadingRequest req)
    {
        await RequireJourneyAsync(journeyId, tenantId);
        var row = await GetOrInitAsync(journeyId, tenantId);

        var readings = DeserializeReadings(row.MonitoringReadings);
        readings.Add(new MonitoringReadingDto(
            Guid.NewGuid(),
            req.ElapsedMin,
            req.Pulse,
            req.Spo2,
            DateTime.UtcNow));

        row.MonitoringReadings = JsonSerializer.Serialize(readings, JsonOpts);
        row.UpdatedAt          = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return BuildDto(row);
    }

    public async Task<AnaesthesiaMonitoringDto> UpdateReadingAsync(
        Guid journeyId, Guid tenantId, Guid readingId, UpdateMonitoringReadingRequest req)
    {
        await RequireJourneyAsync(journeyId, tenantId);
        var row = await GetOrInitAsync(journeyId, tenantId);

        var readings = DeserializeReadings(row.MonitoringReadings);
        var idx = readings.FindIndex(r => r.Id == readingId);
        if (idx < 0) throw new KeyNotFoundException($"Monitoring reading {readingId} not found.");

        var cur = readings[idx];
        readings[idx] = new MonitoringReadingDto(
            cur.Id,
            req.ElapsedMin ?? cur.ElapsedMin,
            req.Pulse ?? cur.Pulse,
            req.Spo2 ?? cur.Spo2,
            cur.RecordedAt);

        row.MonitoringReadings = JsonSerializer.Serialize(readings, JsonOpts);
        row.UpdatedAt          = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return BuildDto(row);
    }

    public async Task<AnaesthesiaMonitoringDto> RemoveReadingAsync(
        Guid journeyId, Guid tenantId, Guid readingId)
    {
        await RequireJourneyAsync(journeyId, tenantId);
        var row = await GetOrInitAsync(journeyId, tenantId);

        var readings = DeserializeReadings(row.MonitoringReadings);
        var removed = readings.RemoveAll(r => r.Id == readingId);
        if (removed == 0)
            throw new KeyNotFoundException($"Monitoring reading {readingId} not found.");

        row.MonitoringReadings = JsonSerializer.Serialize(readings, JsonOpts);
        row.UpdatedAt          = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return BuildDto(row);
    }

    public async Task<AnaesthesiaMonitoringDto> SaveDischargeClearanceAsync(
        Guid journeyId, Guid tenantId, Guid userId, SaveDischargeClearanceRequest req)
    {
        await RequireJourneyAsync(journeyId, tenantId);
        var row = await GetOrInitAsync(journeyId, tenantId);

        row.DischargePr              = req.Pulse;
        row.DischargeBp              = req.Bp;
        row.GeneralConditionNormal     = req.GeneralConditionNormal;
        row.DischargeRemarks         = req.Remarks;
        row.DischargeClearedBy       = userId;
        row.DischargeClearedAt       = DateTime.UtcNow;
        row.UpdatedAt                = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        await _phaseStatus.UpdateAsync(journeyId, tenantId, d => d["anaesthesia_discharge_cleared"] = true);
        return BuildDto(row);
    }

    private async Task<AnaesthesiaMonitoring> GetOrInitAsync(Guid journeyId, Guid tenantId)
    {
        var existing = await _db.AnaesthesiaMonitorings
            .FirstOrDefaultAsync(m => m.PatientJourneyId == journeyId
                                      && m.TenantId == tenantId
                                      && m.DeletedAt == null);
        if (existing is not null) return existing;

        var now = DateTime.UtcNow;
        var journey = await _db.PatientJourneys
            .FirstAsync(j => j.Id == journeyId && j.TenantId == tenantId && j.DeletedAt == null);

        var row = new AnaesthesiaMonitoring
        {
            Id               = Guid.NewGuid(),
            TenantId         = journey.TenantId,
            PatientJourneyId = journeyId,
            CreatedAt        = now,
            UpdatedAt        = now,
        };

        _db.AnaesthesiaMonitorings.Add(row);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            _db.ChangeTracker.Clear();
            return await _db.AnaesthesiaMonitorings
                       .FirstAsync(m => m.PatientJourneyId == journeyId
                                         && m.TenantId == tenantId
                                         && m.DeletedAt == null);
        }

        return row;
    }

    private static AnaesthesiaMonitoringDto BuildDto(AnaesthesiaMonitoring row)
    {
        var readings = DeserializeReadings(row.MonitoringReadings)
            .OrderBy(r => r.ElapsedMin)
            .ToList();

        var dischargeComplete = row.DischargeClearedAt.HasValue
                                && row.DischargePr.HasValue
                                && !string.IsNullOrWhiteSpace(row.DischargeBp);

        return new AnaesthesiaMonitoringDto(
            row.PatientJourneyId,
            row.PreOpPulse,
            row.PreOpBp,
            row.PreOpSpo2,
            row.PreOpConsentConfirmed,
            row.PreOpReviewAt,
            readings,
            row.DischargePr,
            row.DischargeBp,
            row.GeneralConditionNormal,
            row.DischargeRemarks,
            row.DischargeClearedAt,
            dischargeComplete);
    }

    private static List<MonitoringReadingDto> DeserializeReadings(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<MonitoringReadingDto>>(json, JsonOpts) ?? [];
        }
        catch
        {
            return [];
        }
    }

    private async Task RequireJourneyAsync(Guid journeyId, Guid tenantId)
    {
        var exists = await _db.PatientJourneys.AnyAsync(j => j.Id == journeyId
                                                             && j.TenantId == tenantId
                                                             && j.DeletedAt == null);
        if (!exists) throw new KeyNotFoundException($"Journey {journeyId} not found.");
    }
}
