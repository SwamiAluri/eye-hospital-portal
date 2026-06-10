using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using AuthService.Hubs;
using Microsoft.Extensions.DependencyInjection;

namespace AuthService.Services
{
    public class QueueService : IQueueService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<QueueService> _logger;
        private readonly IHubContext<QueueHub> _hubContext;
        private readonly IServiceProvider _serviceProvider;

        public QueueService(
            AppDbContext context,
            ILogger<QueueService> logger,
            IHubContext<QueueHub> hubContext,
            IServiceProvider serviceProvider)
        {
            _context = context;
            _logger = logger;
            _hubContext = hubContext;
            _serviceProvider = serviceProvider;
        }

        public async Task<Dictionary<string, object>> GetAllQueuesAsync(Guid branchId)
        {
            var queues = await _context.QueueItems
                .Where(q => q.BranchId == branchId && q.Status == "waiting")
                .Include(q => q.Patient)
                .Include(q => q.Appointment)
                .OrderBy(q => q.CheckedInAt)
                .ToListAsync();

            var groupedQueues = new Dictionary<string, List<QueueItem>>
            {
                ["Optometry"] = queues.Where(q => q.QueueType == "Optometry").ToList(),
                ["Doctor"] = queues.Where(q => q.QueueType == "Doctor").ToList(),
                ["Billing"] = queues.Where(q => q.QueueType == "Billing").ToList(),
                ["Pharmacy"] = queues.Where(q => q.QueueType == "Pharmacy").ToList()
            };

            var stats = new Dictionary<string, object>();
            foreach (var queueType in new[] { "Optometry", "Doctor", "Billing", "Pharmacy" })
            {
                var queueItems = groupedQueues[queueType];
                var completed = await _context.QueueItems
                    .Where(q => q.BranchId == branchId && q.QueueType == queueType && 
                                q.Status == "completed" && q.CheckedInAt.Date == DateTime.UtcNow.Date)
                    .CountAsync();

                var absent = await _context.QueueItems
                    .Where(q => q.BranchId == branchId && q.QueueType == queueType && 
                                q.Status == "absent" && q.CheckedInAt.Date == DateTime.UtcNow.Date)
                    .CountAsync();

                var avgWaitTime = queueItems.Any() 
                    ? queueItems.Average(q => (DateTime.UtcNow - q.CheckedInAt).TotalMinutes) 
                    : 0;

                stats[queueType] = new
                {
                    totalWaiting = queueItems.Count,
                    averageWaitTime = (int)avgWaitTime,
                    totalCompleted = completed,
                    totalAbsent = absent
                };
            }

            return new Dictionary<string, object>
            {
                ["queues"] = groupedQueues,
                ["stats"] = stats
            };
        }

        public async Task<QueueDisplayData?> GetQueueDisplayDataAsync(Guid? branchId, Guid? departmentId, string queueType)
        {
            if (!branchId.HasValue || string.IsNullOrWhiteSpace(queueType))
            {
                return null;
            }

            var branch = await _context.Branches.AsNoTracking()
                .FirstOrDefaultAsync(b => b.Id == branchId.Value);
            if (branch == null)
            {
                return null;
            }

            var displayService = _serviceProvider.GetRequiredService<IQueueDisplayService>();
            var station = MapQueueTypeToStation(queueType);
            var payload = await displayService.GetBranchDisplayAsync(
                branch.TenantId,
                branchId.Value,
                mode: "station",
                station: station,
                roomCode: null,
                rotationSeconds: 10);

            var slide = payload.Slides.FirstOrDefault();
            if (slide == null)
            {
                return null;
            }

            return QueueDisplayMapper.ToLegacyDisplayData(slide, queueType);
        }

        private static string MapQueueTypeToStation(string queueType) => queueType.ToLowerInvariant() switch
        {
            "optometry" => "optometrist",
            "doctor" => "doctor",
            "imaging" => "imaging",
            "billing" => "billing",
            "counseling" or "counsellor" => "counselor",
            _ => queueType.ToLowerInvariant(),
        };

        public async Task<QueueItem?> CallPatientAsync(Guid queueItemId, string? roomNumber, string? doctorName)
        {
            var queueItem = await _context.QueueItems.FindAsync(queueItemId);
            if (queueItem == null)
                return null;

            queueItem.Status = "called";
            queueItem.CalledAt = DateTime.UtcNow;
            queueItem.RoomNumber = roomNumber;
            queueItem.DoctorName = doctorName;
            queueItem.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Emit SignalR event for real-time TV display update
            try
            {
                var display = await GetQueueDisplayDataAsync(
                    queueItem.BranchId,
                    queueItem.DepartmentId,
                    queueItem.QueueType);

                var groupName = $"Queue-{queueItem.TenantId}-{queueItem.BranchId}-{queueItem.DepartmentId}-{queueItem.QueueType}";
                await _hubContext.Clients.Group(groupName).SendAsync("TokenCalled", new
                {
                    queueItem.Id,
                    queueItem.TokenNumber,
                    PatientName = display?.CurrentPatientName,
                    Gender = display?.CurrentGender,
                    AgeCategory = display?.CurrentAgeCategory,
                    Urgency = display?.CurrentUrgency,
                    IsReturnVisit = display?.CurrentIsReturnVisit ?? false,
                    PassNumber = display?.CurrentPassNumber ?? 1,
                    ReasonLabel = display?.CurrentReasonLabel,
                    queueItem.RoomNumber,
                    queueItem.DoctorName,
                    queueItem.QueueType,
                    queueItem.CalledAt,
                    NextTokens = display?.NextTokens ?? new List<string>(),
                    NextPatients = display?.NextPatients ?? new List<QueueDisplayPatientEntry>(),
                });

                var branchGroup = $"Branch-{queueItem.TenantId}-{queueItem.BranchId}";
                await _hubContext.Clients.Group(branchGroup).SendAsync("QueueUpdate", new
                {
                    queueItem.Id,
                    queueItem.TokenNumber,
                    queueItem.Status,
                    queueItem.QueueType,
                    Action = "called"
                });

                var notifier = _serviceProvider.GetRequiredService<IQueueDisplayNotifier>();
                await notifier.NotifyBranchDisplayUpdatedAsync(queueItem.TenantId, queueItem.BranchId);

                _logger.LogInformation("SignalR event emitted for token {TokenNumber}", queueItem.TokenNumber);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error emitting SignalR event for queue item {QueueItemId}", queueItemId);
            }

            return queueItem;
        }

        public async Task<bool> MarkAbsentAsync(Guid queueItemId)
        {
            var queueItem = await _context.QueueItems.FindAsync(queueItemId);
            if (queueItem == null)
                return false;

            queueItem.Status = "absent";
            queueItem.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<QueueItem?> TransferQueueAsync(Guid queueItemId, string newQueueType)
        {
            var queueItem = await _context.QueueItems.FindAsync(queueItemId);
            if (queueItem == null)
                return null;

            queueItem.QueueType = newQueueType;
            queueItem.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return queueItem;
        }
    }
}
