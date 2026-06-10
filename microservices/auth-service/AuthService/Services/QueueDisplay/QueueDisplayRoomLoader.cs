using System.Text.Json;
using AuthService.Context;
using AuthService.DTOs.Queue;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services.QueueDisplay;

public static class QueueDisplayRoomLoader
{
    public static async Task<List<ServiceRoomConfigDto>> LoadRoomsAsync(
        AppDbContext context,
        Guid tenantId,
        Guid branchId,
        string station)
    {
        var items = await context.MasterValues
            .Where(m =>
                m.TenantId == tenantId &&
                m.EntityType == "operations.service_room" &&
                m.IsActive &&
                m.DeletedAt == null)
            .OrderBy(m => m.SortOrder)
            .ToListAsync();

        var branchKey = branchId.ToString();
        var result = new List<ServiceRoomConfigDto>();

        foreach (var item in items)
        {
            try
            {
                using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(item.Metadata) ? "{}" : item.Metadata);
                var root = doc.RootElement;
                var metaBranch = root.TryGetProperty("branchId", out var b) ? b.GetString() : null;
                var metaStation = root.TryGetProperty("station", out var s) ? s.GetString() : null;
                if (!string.Equals(metaStation, station, StringComparison.OrdinalIgnoreCase)) continue;
                if (!string.IsNullOrEmpty(metaBranch) &&
                    !string.Equals(metaBranch, branchKey, StringComparison.OrdinalIgnoreCase)) continue;

                var roomCode = root.TryGetProperty("roomCode", out var rc) ? rc.GetString() : item.Code;
                var tvLabel = root.TryGetProperty("tvDisplayLabel", out var tl) ? tl.GetString() : item.Label;
                var tvLabelTe = root.TryGetProperty("tvDisplayLabelTe", out var tlt) ? tlt.GetString() : null;
                var isActive = !root.TryGetProperty("isActive", out var ia) || ia.GetBoolean();

                result.Add(new ServiceRoomConfigDto
                {
                    Code = item.Code,
                    Label = item.Label,
                    RoomCode = roomCode ?? item.Code,
                    Station = metaStation ?? station,
                    TvDisplayLabel = tvLabel,
                    TvDisplayLabelTe = tvLabelTe,
                    IsActive = isActive,
                });
            }
            catch
            {
                // skip malformed metadata
            }
        }

        return result;
    }
}
