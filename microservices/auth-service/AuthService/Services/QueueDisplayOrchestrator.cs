using AuthService.Context;
using AuthService.DTOs.Queue;
using AuthService.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public class QueueDisplayOrchestrator : IQueueDisplayService
{
    private readonly AppDbContext _context;
    private readonly IOptometryQueueService _optometryQueueService;
    private readonly ICounselingDisplayAdapter _counselingDisplayAdapter;
    private readonly IVisitStationDisplayAdapter _visitStationDisplayAdapter;

    public QueueDisplayOrchestrator(
        AppDbContext context,
        IOptometryQueueService optometryQueueService,
        ICounselingDisplayAdapter counselingDisplayAdapter,
        IVisitStationDisplayAdapter visitStationDisplayAdapter)
    {
        _context = context;
        _optometryQueueService = optometryQueueService;
        _counselingDisplayAdapter = counselingDisplayAdapter;
        _visitStationDisplayAdapter = visitStationDisplayAdapter;
    }

    public async Task<QueueDisplayBranchPayloadDto> GetBranchDisplayAsync(
        Guid tenantId,
        Guid branchId,
        string mode = "branch",
        string? station = null,
        string? roomCode = null,
        int rotationSeconds = 10)
    {
        var branch = await _context.Branches.AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == branchId && b.TenantId == tenantId);
        var branchName = branch?.Name ?? "Hospital";

        var slides = new List<QueueDisplayRoomSlideDto>();

        var optometrySlides = await _optometryQueueService.GetRoomSlidesAsync(tenantId, branchId);
        slides.AddRange(optometrySlides);

        var counselingSlides = await _counselingDisplayAdapter.GetRoomSlidesAsync(tenantId, branchId);
        slides.AddRange(counselingSlides);

        var doctorSlides = await _visitStationDisplayAdapter.GetDoctorSlidesAsync(tenantId, branchId);
        slides.AddRange(doctorSlides);

        var imagingSlides = await _visitStationDisplayAdapter.GetImagingSlidesAsync(tenantId, branchId);
        slides.AddRange(imagingSlides);

        var billingSlides = await _visitStationDisplayAdapter.GetBillingRegistrationSlidesAsync(tenantId, branchId);
        slides.AddRange(billingSlides);

        slides = FilterSlides(slides, mode, station, roomCode);

        return new QueueDisplayBranchPayloadDto
        {
            BranchId = branchId,
            BranchName = branchName,
            Mode = mode,
            RotationSeconds = NormalizeInterval(rotationSeconds),
            GeneratedAt = DateTime.UtcNow,
            TickerMessages = QueueDisplayMapper.DefaultTickerMessages(),
            Slides = slides,
        };
    }

    private static int NormalizeInterval(int seconds) =>
        seconds switch
        {
            8 or 10 or 15 => seconds,
            _ => 10,
        };

    private static List<QueueDisplayRoomSlideDto> FilterSlides(
        List<QueueDisplayRoomSlideDto> slides,
        string mode,
        string? station,
        string? roomCode)
    {
        var normalizedMode = (mode ?? "branch").ToLowerInvariant();

        if (normalizedMode == "station" && !string.IsNullOrWhiteSpace(station))
        {
            slides = slides
                .Where(s => s.Station.Equals(station, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }
        else if (normalizedMode == "room" && !string.IsNullOrWhiteSpace(roomCode))
        {
            slides = slides
                .Where(s => s.RoomCode.Equals(roomCode, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        return slides
            .Where(s => s.NowServing != null || s.NextQueue.Count > 0)
            .ToList();
    }
}
