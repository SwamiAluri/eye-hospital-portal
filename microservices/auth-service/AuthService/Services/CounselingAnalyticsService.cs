using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Counselor;
using AuthService.Models.Domain;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public interface ICounselingAnalyticsService
{
    Task<CounselingAnalyticsSummaryDto> GetSummaryAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> accessibleBranchIds,
        Guid? echoBranchId,
        Guid? counselorId,
        int period,
        DateTime? from,
        DateTime? to,
        DateTime? utcNow = null,
        CancellationToken ct = default);

    Task<CounselingAnalyticsTrendsDto> GetTrendsAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> accessibleBranchIds,
        Guid? echoBranchId,
        Guid? counselorId,
        int period,
        DateTime? from,
        DateTime? to,
        DateTime? utcNow = null,
        CancellationToken ct = default);

    Task<CounselingAnalyticsAgingDto> GetFollowupAgingAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> accessibleBranchIds,
        Guid? echoBranchId,
        Guid? counselorId,
        int? period,
        DateTime? from,
        DateTime? to,
        DateTime? utcNow = null,
        CancellationToken ct = default);
}

/// <summary>
/// Phase 2D — Counselling Analytics (Summary / Trends / PendingDecision aging).
/// Phase 2Z — PD13 mutually exclusive partition + PD16 branch scope.
/// Does not implement Follow-up Center due dates. Aging ≠ Active Follow-up population.
/// </summary>
public class CounselingAnalyticsService : ICounselingAnalyticsService
{
    public const int MaxAgingItemsPerBucket = 100;

    private readonly AppDbContext _context;

    public CounselingAnalyticsService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<CounselingAnalyticsSummaryDto> GetSummaryAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> accessibleBranchIds,
        Guid? echoBranchId,
        Guid? counselorId,
        int period,
        DateTime? from,
        DateTime? to,
        DateTime? utcNow = null,
        CancellationToken ct = default)
    {
        var now = utcNow ?? DateTime.UtcNow;
        var window = CounselingAnalyticsDateWindow.Resolve(period, from, to, now);
        var sessions = BuildSessionQuery(tenantId, accessibleBranchIds, counselorId, window);

        var rows = await sessions
            .Select(s => new SessionOutcomeRow
            {
                PendingDecision = s.PendingDecision,
                PatientAgreedToSurgery = s.PatientAgreedToSurgery,
                PatientIntention = s.PatientIntention,
                RecommendedSurgery = s.RecommendedSurgery,
                SessionType = s.SessionType,
                DecisionDate = s.DecisionDate,
                SessionDate = s.SessionDate,
            })
            .ToListAsync(ct);

        var totalSessions = rows.Count;
        var agreedCount = 0;
        var declinedCount = 0;
        var pendingCount = 0;
        var exceptionCount = 0;
        var otherCount = 0;

        foreach (var row in rows)
        {
            switch (CounselingAnalyticsOutcomeClassifier.Classify(
                row.PendingDecision, row.PatientAgreedToSurgery, row.PatientIntention))
            {
                case CounselingAnalyticsOutcomePartition.Agreed:
                    agreedCount++;
                    break;
                case CounselingAnalyticsOutcomePartition.Declined:
                    declinedCount++;
                    break;
                case CounselingAnalyticsOutcomePartition.PendingDecision:
                    pendingCount++;
                    break;
                case CounselingAnalyticsOutcomePartition.Exception:
                    exceptionCount++;
                    break;
                default:
                    otherCount++;
                    break;
            }
        }

        Debug.Assert(
            agreedCount + declinedCount + pendingCount + exceptionCount + otherCount == totalSessions,
            "PD13 partitions must be mutually exclusive and sum to TotalSessions.");

        var eligibleOutcomeSessions = totalSessions - exceptionCount - otherCount;
        var conversionRate = eligibleOutcomeSessions > 0
            ? Math.Round(agreedCount * 100.0 / eligibleOutcomeSessions, 1)
            : 0;
        var decisionRate = eligibleOutcomeSessions > 0
            ? Math.Round((agreedCount + declinedCount) * 100.0 / eligibleOutcomeSessions, 1)
            : 0;

        double avgDaysToDecision = 0;
        var withDecision = rows.Where(r => r.DecisionDate != null).ToList();
        if (withDecision.Count > 0)
        {
            avgDaysToDecision = withDecision.Average(r => (r.DecisionDate!.Value - r.SessionDate).TotalDays);
            avgDaysToDecision = Math.Round(avgDaysToDecision, 1);
        }

        var bySurgeryType = rows
            .Where(r => !string.IsNullOrEmpty(r.RecommendedSurgery))
            .GroupBy(r => r.RecommendedSurgery!)
            .Select(g => new AnalyticsSurgeryTypeCountDto
            {
                SurgeryType = g.Key,
                Count = g.Count(),
                AgreedCount = g.Count(r => CounselingAnalyticsOutcomeClassifier.Classify(
                    r.PendingDecision, r.PatientAgreedToSurgery, r.PatientIntention)
                    == CounselingAnalyticsOutcomePartition.Agreed),
            })
            .OrderByDescending(g => g.Count)
            .Take(8)
            .ToList();

        var bySessionType = rows
            .GroupBy(r => r.SessionType)
            .Select(g => new AnalyticsSessionTypeCountDto
            {
                SessionType = g.Key,
                Count = g.Count(),
            })
            .OrderByDescending(g => g.Count)
            .ToList();

        var callbacks = BuildCallbackQuery(tenantId, accessibleBranchIds, counselorId, window);
        var callbackTotal = await callbacks.CountAsync(ct);
        var callbackCompleted = await callbacks.CountAsync(c => c.CallbackStatus == "Completed", ct);
        var callbackCompletionRate = callbackTotal > 0
            ? Math.Round(callbackCompleted * 100.0 / callbackTotal, 1)
            : 0;

        return new CounselingAnalyticsSummaryDto
        {
            Period = window.Period,
            WindowMode = window.Mode == CounselingAnalyticsDateWindowMode.Custom ? "custom" : "period",
            From = window.FromInclusive,
            ToExclusive = window.ToExclusive,
            BranchId = echoBranchId,
            CounselorId = counselorId,
            TotalSessions = totalSessions,
            AgreedCount = agreedCount,
            DeclinedCount = declinedCount,
            UndecidedCount = pendingCount,
            PendingDecisionCount = pendingCount,
            ExceptionCount = exceptionCount,
            OtherUnclassifiedCount = otherCount,
            EligibleOutcomeSessions = eligibleOutcomeSessions,
            DecisionRate = decisionRate,
            ConversionRate = conversionRate,
            AvgDaysToDecision = avgDaysToDecision,
            BySurgeryType = bySurgeryType,
            BySessionType = bySessionType,
            CallbackTotal = callbackTotal,
            CallbackCompleted = callbackCompleted,
            CallbackCompletionRate = callbackCompletionRate,
            GeneratedAt = now,
        };
    }

    public async Task<CounselingAnalyticsTrendsDto> GetTrendsAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> accessibleBranchIds,
        Guid? echoBranchId,
        Guid? counselorId,
        int period,
        DateTime? from,
        DateTime? to,
        DateTime? utcNow = null,
        CancellationToken ct = default)
    {
        var now = utcNow ?? DateTime.UtcNow;
        var window = CounselingAnalyticsDateWindow.Resolve(period, from, to, now);
        var sessions = BuildSessionQuery(tenantId, accessibleBranchIds, counselorId, window);

        var rows = await sessions
            .Select(s => new SessionOutcomeRow
            {
                PendingDecision = s.PendingDecision,
                PatientAgreedToSurgery = s.PatientAgreedToSurgery,
                PatientIntention = s.PatientIntention,
                SessionDate = s.SessionDate,
            })
            .ToListAsync(ct);

        var trend = rows
            .GroupBy(r => r.SessionDate.Date)
            .Select(g => new
            {
                Date = g.Key,
                Count = g.Count(),
                AgreedCount = g.Count(r => CounselingAnalyticsOutcomeClassifier.Classify(
                    r.PendingDecision, r.PatientAgreedToSurgery, r.PatientIntention)
                    == CounselingAnalyticsOutcomePartition.Agreed),
            })
            .OrderBy(g => g.Date)
            .ToList();

        return new CounselingAnalyticsTrendsDto
        {
            Period = window.Period,
            WindowMode = window.Mode == CounselingAnalyticsDateWindowMode.Custom ? "custom" : "period",
            From = window.FromInclusive,
            ToExclusive = window.ToExclusive,
            BranchId = echoBranchId,
            CounselorId = counselorId,
            Trend = trend.Select(t => new AnalyticsTrendPointDto
            {
                Date = t.Date.ToString("yyyy-MM-dd"),
                Count = t.Count,
                AgreedCount = t.AgreedCount,
            }).ToList(),
        };
    }

    public async Task<CounselingAnalyticsAgingDto> GetFollowupAgingAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> accessibleBranchIds,
        Guid? echoBranchId,
        Guid? counselorId,
        int? period,
        DateTime? from,
        DateTime? to,
        DateTime? utcNow = null,
        CancellationToken ct = default)
    {
        var now = utcNow ?? DateTime.UtcNow;
        var today = DateTime.SpecifyKind(now.Date, DateTimeKind.Utc);

        CounselingAnalyticsDateWindow? window = null;
        if (from.HasValue || to.HasValue || period.HasValue)
        {
            window = CounselingAnalyticsDateWindow.Resolve(
                period ?? CounselingAnalyticsDateWindow.DefaultPeriodDays,
                from,
                to,
                now);
        }
        else
        {
            window = CounselingAnalyticsDateWindow.Resolve(365, null, null, now);
        }

        var pending = BuildPendingDecisionQuery(tenantId, accessibleBranchIds, counselorId, window);

        var totalPending = await pending.CountAsync(ct);

        // PostgreSQL-safe half-open SessionDate bounds (avoid SessionDate.Date / TotalDays in SQL).
        // Calendar-day buckets relative to UTC `today` (00:00):
        // 0–3:  [today-3, today+1)
        // 4–7:  [today-7, today-3)
        // 8–14: [today-14, today-7)
        // 15+:  SessionDate < today-14 (already window-scoped by pending)
        var bucket03From = today.AddDays(-3);
        var bucket03ToExclusive = today.AddDays(1);
        var bucket47From = today.AddDays(-7);
        var bucket47ToExclusive = today.AddDays(-3);
        var bucket814From = today.AddDays(-14);
        var bucket814ToExclusive = today.AddDays(-7);
        var bucket15PlusToExclusive = today.AddDays(-14);

        var c03 = await pending.CountAsync(
            s => s.SessionDate >= bucket03From && s.SessionDate < bucket03ToExclusive, ct);
        var c47 = await pending.CountAsync(
            s => s.SessionDate >= bucket47From && s.SessionDate < bucket47ToExclusive, ct);
        var c814 = await pending.CountAsync(
            s => s.SessionDate >= bucket814From && s.SessionDate < bucket814ToExclusive, ct);
        var c15 = await pending.CountAsync(
            s => s.SessionDate < bucket15PlusToExclusive, ct);

        async Task<List<AnalyticsAgingSessionDto>> LoadBucketAsync(
            DateTime? fromInclusive,
            DateTime? toExclusive)
        {
            var q = pending.Join(
                _context.Patients.AsNoTracking(),
                s => s.PatientId,
                p => p.Id,
                (s, p) => new
                {
                    s.Id,
                    PatientName = (p.FirstName + " " + p.LastName).Trim(),
                    RecommendedSurgery = s.RecommendedSurgery ?? "—",
                    Phone = s.AttenderPhone,
                    SessionDate = s.SessionDate,
                });

            if (fromInclusive.HasValue && toExclusive.HasValue)
            {
                var from = fromInclusive.Value;
                var toEx = toExclusive.Value;
                q = q.Where(x => x.SessionDate >= from && x.SessionDate < toEx);
            }
            else if (toExclusive.HasValue)
            {
                // 15+: upper-bounded only (lower bound is the analytics window on `pending`)
                var toEx = toExclusive.Value;
                q = q.Where(x => x.SessionDate < toEx);
            }
            else
            {
                throw new ArgumentException("Aging bucket requires at least an exclusive upper bound.");
            }

            var rows = await q
                .OrderBy(x => x.SessionDate)
                .ThenBy(x => x.Id)
                .Take(MaxAgingItemsPerBucket)
                .ToListAsync(ct);

            // DaysSinceSession is display-only — computed in memory after materialization.
            return rows.Select(x => new AnalyticsAgingSessionDto
            {
                Id = x.Id,
                PatientName = string.IsNullOrWhiteSpace(x.PatientName) ? "Unknown" : x.PatientName,
                RecommendedSurgery = x.RecommendedSurgery,
                Phone = x.Phone,
                DaysSinceSession = (today - x.SessionDate.Date).Days,
            }).ToList();
        }

        var b03 = await LoadBucketAsync(bucket03From, bucket03ToExclusive);
        var b47 = await LoadBucketAsync(bucket47From, bucket47ToExclusive);
        var b814 = await LoadBucketAsync(bucket814From, bucket814ToExclusive);
        var b15 = await LoadBucketAsync(null, bucket15PlusToExclusive);

        var truncated = b03.Count < c03 || b47.Count < c47 || b814.Count < c814 || b15.Count < c15;

        return new CounselingAnalyticsAgingDto
        {
            Period = window.Period,
            WindowMode = window.Mode == CounselingAnalyticsDateWindowMode.Custom ? "custom" : "period",
            From = window.FromInclusive,
            ToExclusive = window.ToExclusive,
            BranchId = echoBranchId,
            CounselorId = counselorId,
            TotalPending = totalPending,
            Counts = new AnalyticsAgingBucketCountsDto
            {
                Bucket03 = c03,
                Bucket47 = c47,
                Bucket814 = c814,
                Bucket15Plus = c15,
            },
            Buckets = new AnalyticsAgingBucketsDto
            {
                Bucket03 = b03,
                Bucket47 = b47,
                Bucket814 = b814,
                Bucket15Plus = b15,
            },
            Truncated = truncated,
            MaxItemsPerBucket = MaxAgingItemsPerBucket,
            GeneratedAt = now,
            Population = "PendingDecision",
        };
    }

    internal IQueryable<CounselingSession> BuildSessionQuery(
        Guid tenantId,
        IReadOnlyCollection<Guid> accessibleBranchIds,
        Guid? counselorId,
        CounselingAnalyticsDateWindow window)
    {
        if (accessibleBranchIds.Count == 0)
        {
            return _context.CounselingSession
                .AsNoTracking()
                .Where(s => false);
        }

        var branchIds = accessibleBranchIds as Guid[] ?? accessibleBranchIds.ToArray();

        return _context.CounselingSession
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId
                     && s.DeletedAt == null
                     && s.SessionDate >= window.FromInclusive
                     && s.SessionDate < window.ToExclusive
                     && s.BranchId != null
                     && branchIds.Contains(s.BranchId.Value)
                     && (counselorId == null
                         || s.CounselorId == counselorId
                         || (s.CounselorId == null && s.CreatedByUserId == counselorId)));
    }

    internal IQueryable<CounselorCallbackRequest> BuildCallbackQuery(
        Guid tenantId,
        IReadOnlyCollection<Guid> accessibleBranchIds,
        Guid? counselorId,
        CounselingAnalyticsDateWindow window)
    {
        if (accessibleBranchIds.Count == 0)
        {
            return _context.CounselorCallbackRequests
                .AsNoTracking()
                .Where(c => false);
        }

        var branchIds = accessibleBranchIds as Guid[] ?? accessibleBranchIds.ToArray();

        var callbacks = _context.CounselorCallbackRequests
            .AsNoTracking()
            .Where(c => c.TenantId == tenantId
                     && c.DeletedAt == null
                     && c.CallbackDate >= window.FromInclusive
                     && c.CallbackDate < window.ToExclusive
                     && branchIds.Contains(c.BranchId));

        if (counselorId == null)
            return callbacks;

        // Effective owner: CounselorId, else CreatedByUserId when CounselorId is unset.
        return from c in callbacks
               join s in _context.CounselingSession.AsNoTracking() on c.SessionId equals s.Id
               where s.TenantId == tenantId
                  && s.DeletedAt == null
                  && (s.CounselorId == counselorId
                      || (s.CounselorId == null && s.CreatedByUserId == counselorId))
               select c;
    }

    /// <summary>PendingDecision population only — not Follow-up Active intentions.</summary>
    internal IQueryable<CounselingSession> BuildPendingDecisionQuery(
        Guid tenantId,
        IReadOnlyCollection<Guid> accessibleBranchIds,
        Guid? counselorId,
        CounselingAnalyticsDateWindow window)
    {
        if (accessibleBranchIds.Count == 0)
        {
            return _context.CounselingSession
                .AsNoTracking()
                .Where(s => false);
        }

        var branchIds = accessibleBranchIds as Guid[] ?? accessibleBranchIds.ToArray();

        return _context.CounselingSession
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId
                     && s.DeletedAt == null
                     && s.PendingDecision == true
                     && s.SessionDate >= window.FromInclusive
                     && s.SessionDate < window.ToExclusive
                     && s.BranchId != null
                     && branchIds.Contains(s.BranchId.Value)
                     && (counselorId == null
                         || s.CounselorId == counselorId
                         || (s.CounselorId == null && s.CreatedByUserId == counselorId)));
    }

    private sealed class SessionOutcomeRow
    {
        public bool PendingDecision { get; init; }
        public bool? PatientAgreedToSurgery { get; init; }
        public string? PatientIntention { get; init; }
        public string? RecommendedSurgery { get; init; }
        public string SessionType { get; init; } = "";
        public DateTime? DecisionDate { get; init; }
        public DateTime SessionDate { get; init; }
    }
}
