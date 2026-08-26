namespace IpManagementService.Models.Dtos;

// ─── Ward ────────────────────────────────────────────────────────────────────

public record WardDto(
    Guid    Id,
    Guid    TenantId,
    Guid    BranchId,
    string  WardName,
    string  WardType,
    string? Floor,
    int     TotalBeds,
    bool    IsActive
);

public record CreateWardRequest(
    string  WardName,
    string  WardType,
    string? Floor,
    int     TotalBeds
);

public record UpdateWardRequest(
    string? WardName,
    string? WardType,
    string? Floor,
    int?    TotalBeds,
    bool?   IsActive
);

public record WardStatsDto(
    Guid                    WardId,
    string                  WardName,
    string                  WardType,
    int                     TotalBeds,
    int                     OccupiedBeds,
    int                     AvailableBeds,
    Dictionary<string, int> ByState
);

public record WardBedDto(
    string BedId,
    string Description,
    string RoomNo,
    int    Capacity,
    int    CurrentOccupancy,
    bool   IsAvailable,
    string? BedType = null,
    string? BedStatus = null,
    string? BedNumber = null,
    Guid?   OccupantJourneyId = null,
    string? OccupantUhid = null,
    string? OccupantName = null
);
