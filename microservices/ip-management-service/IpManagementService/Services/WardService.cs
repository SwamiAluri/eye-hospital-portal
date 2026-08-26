using Microsoft.EntityFrameworkCore;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

public class WardService
{
    private readonly IpManagementDbContext _db;
    private readonly IAuthBedLifecycleClient _beds;

    public WardService(IpManagementDbContext db, IAuthBedLifecycleClient beds)
    {
        _db = db;
        _beds = beds;
    }

    public async Task<List<WardDto>> ListAsync(Guid tenantId, Guid branchId)
    {
        return await _db.Wards
            .Where(w => w.TenantId == tenantId && w.BranchId == branchId && w.DeletedAt == null)
            .OrderBy(w => w.WardName)
            .Select(w => new WardDto(w.Id, w.TenantId, w.BranchId, w.WardName, w.WardType,
                                     w.Floor, w.TotalBeds, w.IsActive))
            .ToListAsync();
    }

    public async Task<WardDto?> GetByIdAsync(Guid id, Guid tenantId)
    {
        var w = await _db.Wards.FirstOrDefaultAsync(w => w.Id == id && w.TenantId == tenantId && w.DeletedAt == null);
        if (w is null) return null;
        return new WardDto(w.Id, w.TenantId, w.BranchId, w.WardName, w.WardType, w.Floor, w.TotalBeds, w.IsActive);
    }

    public async Task<WardDto> CreateAsync(Guid tenantId, Guid branchId, Guid userId, CreateWardRequest req)
    {
        var ward = new Ward
        {
            TenantId          = tenantId,
            BranchId          = branchId,
            WardName          = req.WardName,
            WardType          = req.WardType,
            Floor             = req.Floor,
            TotalBeds         = req.TotalBeds,
            IsActive          = true,
            CreatedAt         = DateTime.UtcNow,
            UpdatedAt         = DateTime.UtcNow,
            CreatedByUserId   = userId,
            UpdatedByUserId   = userId,
        };
        _db.Wards.Add(ward);
        await _db.SaveChangesAsync();
        return new WardDto(ward.Id, ward.TenantId, ward.BranchId, ward.WardName, ward.WardType,
                           ward.Floor, ward.TotalBeds, ward.IsActive);
    }

    public async Task<WardDto?> UpdateAsync(Guid id, Guid tenantId, Guid userId, UpdateWardRequest req)
    {
        var ward = await _db.Wards.FirstOrDefaultAsync(w => w.Id == id && w.TenantId == tenantId && w.DeletedAt == null);
        if (ward is null) return null;

        if (req.WardName  != null) ward.WardName  = req.WardName;
        if (req.WardType  != null) ward.WardType  = req.WardType;
        if (req.Floor     != null) ward.Floor     = req.Floor;
        if (req.TotalBeds.HasValue) ward.TotalBeds = req.TotalBeds.Value;
        if (req.IsActive.HasValue)  ward.IsActive  = req.IsActive.Value;
        ward.UpdatedAt       = DateTime.UtcNow;
        ward.UpdatedByUserId = userId;

        await _db.SaveChangesAsync();
        return new WardDto(ward.Id, ward.TenantId, ward.BranchId, ward.WardName, ward.WardType,
                           ward.Floor, ward.TotalBeds, ward.IsActive);
    }

    public async Task<bool> DeleteAsync(Guid id, Guid tenantId, Guid userId)
    {
        var ward = await _db.Wards.FirstOrDefaultAsync(w => w.Id == id && w.TenantId == tenantId && w.DeletedAt == null);
        if (ward is null) return false;
        ward.DeletedAt       = DateTime.UtcNow;
        ward.Status          = "inactive";
        ward.UpdatedAt       = DateTime.UtcNow;
        ward.UpdatedByUserId = userId;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<List<WardStatsDto>> GetStatsAsync(Guid tenantId, Guid branchId)
    {
        var wards = await _db.Wards
            .Where(w => w.TenantId == tenantId && w.BranchId == branchId && w.DeletedAt == null && w.IsActive)
            .OrderBy(w => w.WardName)
            .ToListAsync();

        var activeJourneys = await _db.PatientJourneys
            .Where(j => j.TenantId == tenantId && j.BranchId == branchId
                        && j.ClinicalState != "Discharged" && j.DeletedAt == null)
            .Select(j => new { j.WardId, j.ClinicalState })
            .ToListAsync();

        IReadOnlyList<AuthBedSnapshot> inventory = [];
        try
        {
            inventory = await _beds.ListAsync(tenantId, branchId, wardName: null);
        }
        catch
        {
            inventory = [];
        }

        return wards.Select(w =>
        {
            var jForWard = activeJourneys.Where(j => j.WardId == w.Id).ToList();
            var byState  = jForWard
                .GroupBy(j => j.ClinicalState)
                .ToDictionary(g => g.Key, g => g.Count());
            var beds = inventory
                .Where(b => BelongsToWard(b, w))
                .ToList();
            var occupied = beds.Count(b =>
                string.Equals(b.BedStatus, "Occupied", StringComparison.OrdinalIgnoreCase)
                || string.Equals(b.BedStatus, "Reserved", StringComparison.OrdinalIgnoreCase));
            var available = beds.Count(b =>
                string.Equals(b.BedStatus, "Available", StringComparison.OrdinalIgnoreCase));
            return new WardStatsDto(w.Id, w.WardName, w.WardType, beds.Count,
                                    occupied, available, byState);
        }).ToList();
    }

    public async Task<List<WardBedDto>> GetBedsAsync(Guid wardId, Guid tenantId)
    {
        var ward = await _db.Wards.FirstOrDefaultAsync(
            w => w.Id == wardId && w.TenantId == tenantId && w.DeletedAt == null);
        if (ward is null) return [];

        var inventory = await _beds.ListAsync(tenantId, ward.BranchId, ward.WardName, ward.Id);
        var ofWard = inventory.Where(b => BelongsToWard(b, ward)).ToList();
        var occupants = await LoadOccupantsAsync(tenantId, ofWard.Select(b => b.BedId).ToList());

        return ofWard.Select(b =>
        {
            var occupied = string.Equals(b.BedStatus, "Occupied", StringComparison.OrdinalIgnoreCase)
                           || string.Equals(b.BedStatus, "Reserved", StringComparison.OrdinalIgnoreCase);
            var typeLabel = FormatBedType(b.BedType);
            var core = string.IsNullOrWhiteSpace(b.RoomNumber)
                ? b.BedNumber
                : $"{b.RoomNumber} · {b.BedNumber}";
            occupants.TryGetValue(b.BedId, out var who);
            return new WardBedDto(
                BedId:            b.BedId.ToString(),
                Description:      string.IsNullOrEmpty(typeLabel) ? core : $"{core} · {typeLabel}",
                RoomNo:           b.RoomNumber ?? b.BedNumber,
                Capacity:         1,
                CurrentOccupancy: occupied ? 1 : 0,
                IsAvailable:      string.Equals(b.BedStatus, "Available", StringComparison.OrdinalIgnoreCase),
                BedType:          b.BedType,
                BedStatus:        b.BedStatus,
                BedNumber:        b.BedNumber,
                OccupantJourneyId: who?.JourneyId,
                OccupantUhid:     who?.Uhid,
                OccupantName:     who?.Name);
        }).ToList();
    }

    /// <summary>Occupant identity is IP journey; occupancy status stays on Auth beds.</summary>
    private async Task<Dictionary<Guid, Occupant>> LoadOccupantsAsync(Guid tenantId, List<Guid> bedIds)
    {
        if (bedIds.Count == 0) return [];
        var inHouse = new[]
        {
            ClinicalState.Admitted, ClinicalState.ReadyForSurgery, ClinicalState.SentToOT,
            ClinicalState.InOT, ClinicalState.SurgeryCompleted, ClinicalState.PostOp,
            ClinicalState.ReadyForDischarge,
        };
        var rows = await _db.PatientJourneys
            .AsNoTracking()
            .Where(j =>
                j.TenantId == tenantId
                && j.DeletedAt == null
                && j.AssignedBedId != null
                && bedIds.Contains(j.AssignedBedId.Value)
                && inHouse.Contains(j.ClinicalState))
            .Select(j => new { j.Id, j.AssignedBedId, j.Uhid, j.PatientId, j.AdmittedAt })
            .ToListAsync();
        if (rows.Count == 0) return [];

        var patientIds = rows.Select(r => r.PatientId).Distinct().ToList();
        var names = await _db.Patients.AsNoTracking()
            .Where(p => patientIds.Contains(p.Id))
            .Select(p => new { p.Id, p.FirstName, p.LastName })
            .ToListAsync();
        var nameById = names.ToDictionary(
            p => p.Id,
            p => $"{p.FirstName} {p.LastName}".Trim());

        return rows
            .GroupBy(r => r.AssignedBedId!.Value)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var pick = g.OrderByDescending(r => r.AdmittedAt ?? DateTime.MinValue).First();
                    return new Occupant(
                        pick.Id,
                        pick.Uhid,
                        nameById.GetValueOrDefault(pick.PatientId));
                });
    }

    private sealed record Occupant(Guid JourneyId, string? Uhid, string? Name);

    /// <summary>DB-004. Prefer ward_id; fall back to ward_name only when the FK is unset.</summary>
    internal static bool BelongsToWard(AuthBedSnapshot bed, Ward ward)
    {
        if (bed.WardId.HasValue)
            return bed.WardId == ward.Id;
        return string.Equals(bed.WardName?.Trim(), ward.WardName?.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    internal static string FormatBedType(string? bedType)
        => bedType switch
        {
            "Recliner" => "Recliner",
            "DayCareChair" => "Day-care chair",
            _ => string.IsNullOrWhiteSpace(bedType) ? "" : bedType.Trim(),
        };

    /// <summary>Map cell kind. Recliner / day-care chair are labelled Chair, never colour-only.</summary>
    internal static string MapSurfaceLabel(string? bedType)
        => bedType is "Recliner" or "DayCareChair" ? "Chair"
            : string.IsNullOrWhiteSpace(bedType) ? "Bed"
            : bedType.Trim();

    internal static string MapStatusLabel(string? bedStatus)
    {
        var raw = (bedStatus ?? "").Trim();
        if (raw.Length == 0) return "Unknown";
        return char.ToUpperInvariant(raw[0]) + raw[1..].ToLowerInvariant();
    }
}
