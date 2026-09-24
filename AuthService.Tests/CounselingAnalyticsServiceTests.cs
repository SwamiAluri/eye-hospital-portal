using System;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models.Domain;
using AuthService.Services;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace AuthService.Tests;

public class CounselingAnalyticsServiceTests : IDisposable
{
    private static readonly DateTime FixedUtc = new(2026, 9, 10, 15, 30, 0, DateTimeKind.Utc);

    private readonly AppDbContext _db;
    private readonly CounselingAnalyticsService _svc;
    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _branchA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _branchB = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private readonly Guid _counselorA = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private readonly Guid _counselorB = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private readonly Guid _patient1 = Guid.Parse("a1000001-0000-0000-0000-000000000001");
    private readonly Guid _patient2 = Guid.Parse("a1000002-0000-0000-0000-000000000002");

    private Guid[] AllBranches() => new[] { _branchA, _branchB };

    public CounselingAnalyticsServiceTests()
    {
        _db = TestDbContextFactory.CreateInMemory();
        _svc = new CounselingAnalyticsService(_db);
        Seed();
    }

    public void Dispose() => _db.Dispose();

    private void Seed()
    {
        _db.Patients.Add(new Patient
        {
            Id = _patient1,
            TenantId = _tenant,
            FirstName = "Ann",
            LastName = "Pending",
            MedicalRecordNumber = "MRN-1",
            DateOfBirth = new DateTime(1980, 1, 1),
            Gender = "Female",
        });
        _db.Patients.Add(new Patient
        {
            Id = _patient2,
            TenantId = _tenant,
            FirstName = "Bob",
            LastName = "Old",
            MedicalRecordNumber = "MRN-2",
            DateOfBirth = new DateTime(1975, 1, 1),
            Gender = "Male",
        });

        // Inside period=30 window relative to FixedUtc (from 2026-08-11, toExclusive 2026-09-11)
        AddSession("s1", FixedUtc.Date.AddDays(-5), _branchA, _counselorA,
            agreed: true, pending: false, decisionDate: FixedUtc.Date.AddDays(-3), surgery: "Phaco", sessionType: "Initial");
        AddSession("s2", FixedUtc.Date.AddDays(-10), _branchA, _counselorA,
            agreed: false, pending: false, decisionDate: FixedUtc.Date.AddDays(-9), surgery: "Phaco", sessionType: "Followup");
        AddSession("s3", FixedUtc.Date.AddDays(-2), _branchA, _counselorA,
            agreed: false, pending: true, decisionDate: null, surgery: "SICS", sessionType: "Initial");
        AddSession("s4", FixedUtc.Date.AddDays(-1), _branchA, _counselorB,
            agreed: true, pending: false, decisionDate: FixedUtc.Date, surgery: "LASIK", sessionType: "Initial");
        AddSession("s5", FixedUtc.Date.AddDays(-3), _branchB, _counselorA,
            agreed: true, pending: false, decisionDate: FixedUtc.Date.AddDays(-1), surgery: "Vitrectomy", sessionType: "Initial");

        // Outside period window
        AddSession("s6", FixedUtc.Date.AddDays(-60), _branchA, _counselorA,
            agreed: true, pending: false, decisionDate: FixedUtc.Date.AddDays(-50), surgery: "Old", sessionType: "Initial");

        // Aging: pending with various ages (also in 365-day default aging window)
        AddSession("p0", FixedUtc.Date, _branchA, _counselorA,
            agreed: false, pending: true, decisionDate: null, surgery: "Near", sessionType: "Initial",
            idOverride: Guid.Parse("b0000001-0000-0000-0000-000000000001"), patientId: _patient1);
        AddSession("p5", FixedUtc.Date.AddDays(-5), _branchA, _counselorA,
            agreed: false, pending: true, decisionDate: null, surgery: "Mid", sessionType: "Initial",
            idOverride: Guid.Parse("b0000002-0000-0000-0000-000000000002"), patientId: _patient1);
        AddSession("p20", FixedUtc.Date.AddDays(-20), _branchA, _counselorB,
            agreed: false, pending: true, decisionDate: null, surgery: "OldPend", sessionType: "Initial",
            idOverride: Guid.Parse("b0000003-0000-0000-0000-000000000003"), patientId: _patient2);

        // Callbacks (CallbackDate window)
        _db.CounselorCallbackRequests.Add(new CounselorCallbackRequest
        {
            Id = Guid.Parse("c0000001-0000-0000-0000-000000000001"),
            TenantId = _tenant,
            SessionId = Guid.Parse("d0000001-0000-0000-0000-000000000001"), // s1
            PatientId = _patient1,
            BranchId = _branchA,
            AssignedToUserId = _counselorA,
            CallbackDate = FixedUtc.Date.AddDays(-4),
            CallbackStatus = "Completed",
            CreatedAt = FixedUtc,
            UpdatedAt = FixedUtc,
            CreatedByUserId = _counselorA,
            UpdatedByUserId = _counselorA,
        });
        _db.CounselorCallbackRequests.Add(new CounselorCallbackRequest
        {
            Id = Guid.Parse("c0000002-0000-0000-0000-000000000002"),
            TenantId = _tenant,
            SessionId = Guid.Parse("d0000004-0000-0000-0000-000000000004"), // s4 counselor B
            PatientId = _patient2,
            BranchId = _branchA,
            AssignedToUserId = _counselorB,
            CallbackDate = FixedUtc.Date.AddDays(-1),
            CallbackStatus = "Scheduled",
            CreatedAt = FixedUtc,
            UpdatedAt = FixedUtc,
            CreatedByUserId = _counselorB,
            UpdatedByUserId = _counselorB,
        });

        _db.SaveChanges();
    }

    private void AddSession(
        string key,
        DateTime sessionDate,
        Guid branchId,
        Guid counselorId,
        bool? agreed,
        bool pending,
        DateTime? decisionDate,
        string surgery,
        string sessionType,
        Guid? idOverride = null,
        Guid? patientId = null)
    {
        var map = new System.Collections.Generic.Dictionary<string, Guid>
        {
            ["s1"] = Guid.Parse("d0000001-0000-0000-0000-000000000001"),
            ["s2"] = Guid.Parse("d0000002-0000-0000-0000-000000000002"),
            ["s3"] = Guid.Parse("d0000003-0000-0000-0000-000000000003"),
            ["s4"] = Guid.Parse("d0000004-0000-0000-0000-000000000004"),
            ["s5"] = Guid.Parse("d0000005-0000-0000-0000-000000000005"),
            ["s6"] = Guid.Parse("d0000006-0000-0000-0000-000000000006"),
        };

        _db.CounselingSession.Add(new CounselingSession
        {
            Id = idOverride ?? map[key],
            TenantId = _tenant,
            BranchId = branchId,
            PatientId = patientId ?? _patient1,
            CounselorId = counselorId,
            ReferredByDoctorId = Guid.NewGuid(),
            SessionDate = sessionDate,
            PatientType = "Cash",
            SessionType = sessionType,
            PatientAgreedToSurgery = agreed,
            PendingDecision = pending,
            DecisionDate = decisionDate,
            RecommendedSurgery = surgery,
            CreatedAt = sessionDate,
        });
    }

    [Fact]
    public async Task SummaryAndTrends_ShareIdenticalWindow_AndConsistentTotals()
    {
        var summary = await _svc.GetSummaryAsync(_tenant, AllBranches(), null, null, 30, null, null, FixedUtc);
        var trends = await _svc.GetTrendsAsync(_tenant, AllBranches(), null, null, 30, null, null, FixedUtc);

        Assert.Equal(summary.From, trends.From);
        Assert.Equal(summary.ToExclusive, trends.ToExclusive);
        Assert.Equal(summary.TotalSessions, trends.Trend.Sum(t => t.Count));
        Assert.Equal(summary.AgreedCount, trends.Trend.Sum(t => t.AgreedCount));
    }

    [Fact]
    public async Task Period_ExcludesSessionsBeforeFromInclusive()
    {
        var summary = await _svc.GetSummaryAsync(_tenant, AllBranches(), null, null, 30, null, null, FixedUtc);
        // s1..s5 + p0,p5,p20 that fall in window — p20 is -20 days so in window; s6 at -60 out
        Assert.DoesNotContain(summary.BySurgeryType, x => x.SurgeryType == "Old");
        Assert.True(summary.TotalSessions >= 5);
    }

    [Fact]
    public async Task CustomFromTo_FiltersSessions()
    {
        var from = FixedUtc.Date.AddDays(-6);
        var to = FixedUtc.Date.AddDays(-4);
        var summary = await _svc.GetSummaryAsync(_tenant, AllBranches(), null, null, 30, from, to, FixedUtc);
        Assert.Equal("custom", summary.WindowMode);
        Assert.Null(summary.Period);

        var trends = await _svc.GetTrendsAsync(_tenant, AllBranches(), null, null, 30, from, to, FixedUtc);
        Assert.Equal(summary.TotalSessions, trends.Trend.Sum(t => t.Count));
        Assert.All(trends.Trend, t =>
        {
            var d = DateTime.Parse(t.Date);
            Assert.True(d >= from && d <= to);
        });
    }

    [Fact]
    public async Task InvalidFromWithoutTo_Throws()
    {
        await Assert.ThrowsAsync<CounselingAnalyticsDateWindowException>(() =>
            _svc.GetSummaryAsync(_tenant, AllBranches(), null, null, 30, FixedUtc.Date, null, FixedUtc));
    }

    [Fact]
    public async Task CounselorId_FiltersSummaryTrendsAndAging()
    {
        var summaryA = await _svc.GetSummaryAsync(_tenant, AllBranches(), null, _counselorA, 30, null, null, FixedUtc);
        var summaryB = await _svc.GetSummaryAsync(_tenant, AllBranches(), null, _counselorB, 30, null, null, FixedUtc);
        Assert.NotEqual(summaryA.TotalSessions, summaryB.TotalSessions);
        Assert.True(summaryA.TotalSessions > summaryB.TotalSessions);

        var trendsA = await _svc.GetTrendsAsync(_tenant, AllBranches(), null, _counselorA, 30, null, null, FixedUtc);
        Assert.Equal(summaryA.TotalSessions, trendsA.Trend.Sum(t => t.Count));

        var agingA = await _svc.GetFollowupAgingAsync(_tenant, AllBranches(), null, _counselorA, 365, null, null, FixedUtc);
        var agingB = await _svc.GetFollowupAgingAsync(_tenant, AllBranches(), null, _counselorB, 365, null, null, FixedUtc);
        Assert.True(agingA.TotalPending >= 1);
        Assert.True(agingB.TotalPending >= 1);
        Assert.NotEqual(agingA.TotalPending, agingB.TotalPending);
    }

    /// <summary>
    /// Phase 3I Slice 11 (PD-S11-04) — CreatedBy fallback removed.
    /// NULL CounselorId + matching CreatedByUserId must NOT inflate counselor-scoped My Work.
    /// </summary>
    [Fact]
    public async Task CounselorFilter_ExcludesCreatedByOnlyWhenCounselorIdNull()
    {
        var creator = Guid.Parse("55555555-5555-5555-5555-555555555555");
        var other = Guid.Parse("66666666-6666-6666-6666-666666666666");
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = Guid.Parse("b00000aa-0000-0000-0000-0000000000aa"),
            TenantId = _tenant,
            BranchId = _branchA,
            PatientId = _patient1,
            CounselorId = null,
            CreatedByUserId = creator,
            ReferredByDoctorId = Guid.NewGuid(),
            SessionDate = FixedUtc.Date.AddDays(-1),
            PatientType = "Cash",
            SessionType = "Initial",
            PatientAgreedToSurgery = true,
            PendingDecision = false,
            RecommendedSurgery = "CreatedByOnly",
            CreatedAt = FixedUtc,
        });
        _db.SaveChanges();

        var forCreator = await _svc.GetSummaryAsync(
            _tenant, new[] { _branchA }, _branchA, creator, 30, null, null, FixedUtc);
        var forOther = await _svc.GetSummaryAsync(
            _tenant, new[] { _branchA }, _branchA, other, 30, null, null, FixedUtc);
        var branchAggregate = await _svc.GetSummaryAsync(
            _tenant, new[] { _branchA }, _branchA, null, 30, null, null, FixedUtc);

        Assert.Equal(0, forCreator.TotalSessions);
        Assert.Equal(0, forOther.TotalSessions);
        Assert.True(branchAggregate.TotalSessions >= 1);
        Assert.Equal(creator, forCreator.CounselorId);
    }

    [Fact]
    public async Task BranchId_AndCounselorCombination()
    {
        var both = await _svc.GetSummaryAsync(_tenant, new[] { _branchA }, _branchA, _counselorA, 30, null, null, FixedUtc);
        var branchB = await _svc.GetSummaryAsync(_tenant, new[] { _branchB }, _branchB, _counselorA, 30, null, null, FixedUtc);
        Assert.True(both.TotalSessions >= 1);
        Assert.Equal(1, branchB.TotalSessions);
    }

    [Fact]
    public async Task MetricDefinitions_AgreedDeclinedUndecided_AndRates()
    {
        var s = await _svc.GetSummaryAsync(_tenant, new[] { _branchA }, _branchA, _counselorA, 30, null, null, FixedUtc);
        Assert.Equal(
            s.AgreedCount + s.DeclinedCount + s.UndecidedCount + s.ExceptionCount + s.OtherUnclassifiedCount,
            s.TotalSessions);
        Assert.Equal(s.UndecidedCount, s.PendingDecisionCount);
        Assert.Equal(s.TotalSessions - s.ExceptionCount - s.OtherUnclassifiedCount, s.EligibleOutcomeSessions);
        if (s.EligibleOutcomeSessions > 0)
        {
            Assert.Equal(
                Math.Round(s.AgreedCount * 100.0 / s.EligibleOutcomeSessions, 1),
                s.ConversionRate);
            Assert.Equal(
                Math.Round((s.AgreedCount + s.DeclinedCount) * 100.0 / s.EligibleOutcomeSessions, 1),
                s.DecisionRate);
        }
        Assert.True(s.AvgDaysToDecision >= 0);
    }

    [Fact]
    public async Task ZeroSessions_RatesAreZero_NotNaN()
    {
        var emptyTenant = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
        var s = await _svc.GetSummaryAsync(emptyTenant, AllBranches(), null, null, 30, null, null, FixedUtc);
        Assert.Equal(0, s.TotalSessions);
        Assert.Equal(0, s.ConversionRate);
        Assert.Equal(0, s.DecisionRate);
        Assert.Equal(0, s.AvgDaysToDecision);
        Assert.False(double.IsNaN(s.ConversionRate));
        Assert.False(double.IsInfinity(s.DecisionRate));
    }

    [Fact]
    public async Task Aging_UsesPendingDecision_NotActiveIntentions()
    {
        var aging = await _svc.GetFollowupAgingAsync(_tenant, AllBranches(), null, null, 365, null, null, FixedUtc);
        Assert.Equal("PendingDecision", aging.Population);
        Assert.True(aging.TotalPending >= 3);
        Assert.Equal(
            aging.Counts.Bucket03 + aging.Counts.Bucket47 + aging.Counts.Bucket814 + aging.Counts.Bucket15Plus,
            aging.TotalPending);

        // Agreed non-pending sessions must not appear
        Assert.DoesNotContain(aging.Buckets.Bucket03, x => x.RecommendedSurgery == "Phaco" && x.DaysSinceSession == 5);
    }

    [Fact]
    public async Task Aging_Buckets_ClassifyByDaysSinceSession()
    {
        var aging = await _svc.GetFollowupAgingAsync(_tenant, new[] { _branchA }, _branchA, null, 365, null, null, FixedUtc);
        Assert.True(aging.Counts.Bucket03 >= 1); // p0 today
        Assert.True(aging.Counts.Bucket47 >= 1); // p5
        Assert.True(aging.Counts.Bucket15Plus >= 1); // p20
    }

    [Fact]
    public async Task CallbackMetrics_HonorCounselorViaSession()
    {
        var a = await _svc.GetSummaryAsync(_tenant, AllBranches(), null, _counselorA, 30, null, null, FixedUtc);
        var b = await _svc.GetSummaryAsync(_tenant, AllBranches(), null, _counselorB, 30, null, null, FixedUtc);
        Assert.Equal(1, a.CallbackTotal);
        Assert.Equal(1, a.CallbackCompleted);
        Assert.Equal(1, b.CallbackTotal);
        Assert.Equal(0, b.CallbackCompleted);
    }

    [Theory]
    [InlineData(nameof(CounselingController.GetAnalyticsSummary))]
    [InlineData(nameof(CounselingController.GetAnalyticsTrends))]
    [InlineData(nameof(CounselingController.GetFollowupAging))]
    public void AnalyticsEndpoints_RequireCounselingSessionsRead(string methodName)
    {
        var method = typeof(CounselingController).GetMethod(methodName);
        Assert.NotNull(method);
        var attr = method!.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(attr);
        Assert.Equal("counseling_sessions.read", attr!.PermissionCode);
    }
}
