using System;
using System.Collections.Generic;
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
        Guid? branchId,
        Guid? counselorId,
        int period,
        DateTime? from,
        DateTime? to,
        DateTime? utcNow = null,
        CancellationToken ct = default);

    Task<CounselingAnalyticsTrendsDto> GetTrendsAsync(
        Guid tenantId,
        Guid? branchId,
        Guid? counselorId,
        int period,
        DateTime? from,
        DateTime? to,
        DateTime? utcNow = null,
        CancellationToken ct = default);

    Task<CounselingAnalyticsAgingDto> GetFollowupAgingAsync(
        Guid tenantId,
        Guid? branchId,
        Guid? counselorId,
        int? period,
        DateTime? from,
        DateTime? to,
        DateTime? utcNow = null,
        CancellationToken ct = default);
}

/// <summary>
/// Phase 2D — Counselling Analytics (Summary / Trends / PendingDecision aging).
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
        Guid? branchId,
        Guid? counselorId,
        int period,
        DateTime? from,
        DateTime? to,
        DateTime? utcNow = null,
        CancellationToken ct = default)
    {
        var now = utcNow ?? DateTime.UtcNow;
        var window = CounselingAnalyticsDateWindow.Resolve(period, from, to, now);
        var sessions = BuildSessionQuery(tenantId, branchId, counselorId, window);

        var totalSessions = await sessions.CountAsync(ct);
        var agreedCount = await sessions.CountAsync(s => s.PatientAgreedToSurgery == true, ct);
        var declinedCount = await sessions.CountAsync(
            s => s.PatientAgreedToSurgery == false && s.PendingDecision == false, ct);
        var undecidedCount = await sessions.CountAsync(s => s.PendingDecision == true, ct);

        var decisionRate = totalSessions > 0
            ? Math.Round((agreedCount + declinedCount) * 100.0 / totalSessions, 1)
            : 0;
        var conversionRate = totalSessions > 0
            ? Math.Round(agreedCount * 100.0 / totalSessions, 1)
            : 0;

        double avgDaysToDecision = 0;
        var withDecision = sessions.Where(s => s.DecisionDate != null);
        if (await withDecision.AnyAsync(ct))
        {
            avgDaysToDecision = await withDecision.AverageAsync(
                s => (double)(s.DecisionDate!.Value - s.SessionDate).TotalDays, ct);
            avgDaysToDecision = Math.Round(avgDaysToDecision, 1);
        }

        var bySurgeryType = await sessions
            .Where(s => s.RecommendedSurgery != null && s.RecommendedSurgery != "")
            .GroupBy(s => s.RecommendedSurgery!)
            .Select(g => new AnalyticsSurgeryTypeCountDto
            {
                SurgeryType = g.Key,
                Count = g.Count(),
                AgreedCount = g.Count(s => s.PatientAgreedToSurgery == true),
            })
            .OrderByDescending(g => g.Count)
            .Take(8)
            .ToListAsync(ct);

        var bySessionType = await sessions
            .GroupBy(s => s.SessionType)
            .Select(g => new AnalyticsSessionTypeCountDto
            {
                SessionType = g.Key,
                Count = g.Count(),
            })
            .OrderByDescending(g => g.Count)
            .ToListAsync(ct);

        var callbacks = BuildCallbackQuery(tenantId, branchId, counselorId, window);
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
            BranchId = branchId,
            CounselorId = counselorId,
            TotalSessions = totalSessions,
            AgreedCount = agreedCount,
            DeclinedCount = declinedCount,
            UndecidedCount = undecidedCount,
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
        Guid? branchId,
        Guid? counselorId,
        int period,
        DateTime? from,
        DateTime? to,
        DateTime? utcNow = null,
        CancellationToken ct = default)
    {
        var now = utcNow ?? DateTime.UtcNow;
        var window = CounselingAnalyticsDateWindow.Resolve(period, from, to, now);
        var sessions = BuildSessionQuery(tenantId, branchId, counselorId, window);

        var trend = await sessions
            .GroupBy(s => s.SessionDate.Date)
            .Select(g => new
            {
                Date = g.Key,
                Count = g.Count(),
                AgreedCount = g.Count(s => s.PatientAgreedToSurgery == true),
            })
            .OrderBy(g => g.Date)
            .ToListAsync(ct);

        return new CounselingAnalyticsTrendsDto
        {
            Period = window.Period,
            WindowMode = window.Mode == CounselingAnalyticsDateWindowMode.Custom ? "custom" : "period",
            From = window.FromInclusive,
            ToExclusive = window.ToExclusive,
            BranchId = branchId,
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
        Guid? branchId,
        Guid? counselorId,
        int? period,
        DateTime? from,
        DateTime? to,
        DateTime? utcNow = null,
        CancellationToken ct = default)
    {
        var now = utcNow ?? DateTime.UtcNow;
        var today = DateTime.SpecifyKind(now.Date, DateTimeKind.Utc);

        // Optional date window on SessionDate to bound aging scans.
        // When neither custom nor period supplied: default period 365 (keeps long-pending visible).
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

        var pending = BuildPendingDecisionQuery(tenantId, branchId, counselorId, window);

        var totalPending = await pending.CountAsync(ct);

        // Project days + bucket in SQL-friendly form, then CountAsync per bucket.
        var withDays = pending.Select(s => new
        {
            s.Id,
            s.SessionDate,
            Days = (int)(today - s.SessionDate.Date).TotalDays,
        });

        var c03 = await withDays.CountAsync(x => x.Days <= 3, ct);
        var c47 = await withDays.CountAsync(x => x.Days >= 4 && x.Days <= 7, ct);
        var c814 = await withDays.CountAsync(x => x.Days >= 8 && x.Days <= 14, ct);
        var c15 = await withDays.CountAsync(x => x.Days >= 15, ct);

        async Task<List<AnalyticsAgingSessionDto>> LoadBucketAsync(int minDays, int? maxDays)
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

            // Filter by days in memory after a bounded Take would lose accuracy;
            // instead filter with SessionDate range equivalent to day buckets.
            DateTime? sessionOnOrBefore = null;
            DateTime? sessionOnOrAfter = null;
            if (maxDays.HasValue)
                sessionOnOrAfter = today.AddDays(-maxDays.Value);
            sessionOnOrBefore = today.AddDays(-minDays);

            q = q.Where(x => x.SessionDate.Date <= sessionOnOrBefore);
            if (sessionOnOrAfter.HasValue)
                q = q.Where(x => x.SessionDate.Date >= sessionOnOrAfter.Value);

            var rows = await q
                .OrderBy(x => x.SessionDate)
                .ThenBy(x => x.Id)
                .Take(MaxAgingItemsPerBucket)
                .ToListAsync(ct);

            return rows.Select(x => new AnalyticsAgingSessionDto
            {
                Id = x.Id,
                PatientName = string.IsNullOrWhiteSpace(x.PatientName) ? "Unknown" : x.PatientName,
                RecommendedSurgery = x.RecommendedSurgery,
                Phone = x.Phone,
                DaysSinceSession = (today - x.SessionDate.Date).Days,
            }).ToList();
        }

        var b03 = await LoadBucketAsync(0, 3);
        var b47 = await LoadBucketAsync(4, 7);
        var b814 = await LoadBucketAsync(8, 14);
        var b15 = await LoadBucketAsync(15, null);

        var truncated = b03.Count < c03 || b47.Count < c47 || b814.Count < c814 || b15.Count < c15;

        return new CounselingAnalyticsAgingDto
        {
            Period = window.Period,
            WindowMode = window.Mode == CounselingAnalyticsDateWindowMode.Custom ? "custom" : "period",
            From = window.FromInclusive,
            ToExclusive = window.ToExclusive,
            BranchId = branchId,
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
        Guid? branchId,
        Guid? counselorId,
        CounselingAnalyticsDateWindow window)
    {
        return _context.CounselingSession
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId
                     && s.DeletedAt == null
                     && s.SessionDate >= window.FromInclusive
                     && s.SessionDate < window.ToExclusive
                     && (branchId == null || s.BranchId == branchId)
                     && (counselorId == null || s.CounselorId == counselorId));
    }

    internal IQueryable<CounselorCallbackRequest> BuildCallbackQuery(
        Guid tenantId,
        Guid? branchId,
        Guid? counselorId,
        CounselingAnalyticsDateWindow window)
    {
        // Callback metrics remain CallbackDate-based (existing semantics).
        // Counselor filter applies via related session.CounselorId.
        var callbacks = _context.CounselorCallbackRequests
            .AsNoTracking()
            .Where(c => c.TenantId == tenantId
                     && c.DeletedAt == null
                     && c.CallbackDate >= window.FromInclusive
                     && c.CallbackDate < window.ToExclusive
                     && (branchId == null || c.BranchId == branchId));

        if (counselorId == null)
            return callbacks;

        return from c in callbacks
               join s in _context.CounselingSession.AsNoTracking() on c.SessionId equals s.Id
               where s.TenantId == tenantId
                  && s.DeletedAt == null
                  && s.CounselorId == counselorId
               select c;
    }

    /// <summary>PendingDecision population only — not Follow-up Active intentions.</summary>
    internal IQueryable<CounselingSession> BuildPendingDecisionQuery(
        Guid tenantId,
        Guid? branchId,
        Guid? counselorId,
        CounselingAnalyticsDateWindow window)
    {
        return _context.CounselingSession
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId
                     && s.DeletedAt == null
                     && s.PendingDecision == true
                     && s.SessionDate >= window.FromInclusive
                     && s.SessionDate < window.ToExclusive
                     && (branchId == null || s.BranchId == branchId)
                     && (counselorId == null || s.CounselorId == counselorId));
    }
}
