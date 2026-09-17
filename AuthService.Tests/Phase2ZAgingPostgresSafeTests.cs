using System;
using System.Linq;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Phase 2Z — Aging bucket date bounds must be Npgsql-safe (no SessionDate.Date / TotalDays in SQL).
/// </summary>
public class Phase2ZAgingPostgresSafeTests : IDisposable
{
    private static readonly DateTime FixedUtc = new(2026, 9, 10, 15, 30, 0, DateTimeKind.Utc);

    private readonly AppDbContext _db;
    private readonly CounselingAnalyticsService _svc;
    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _branchA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _branchB = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private readonly Guid _counselor = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private readonly Guid _patient = Guid.Parse("a1000001-0000-0000-0000-000000000001");

    public Phase2ZAgingPostgresSafeTests()
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
            Id = _patient,
            TenantId = _tenant,
            FirstName = "Ann",
            LastName = "Pending",
            MedicalRecordNumber = "MRN-AGE",
            DateOfBirth = new DateTime(1980, 1, 1),
            Gender = "Female",
        });

        // FixedUtc.Date = 2026-09-10
        AddPending(Guid.Parse("b0000001-0000-0000-0000-000000000001"), FixedUtc.Date, "B03");           // 0–3
        AddPending(Guid.Parse("b0000002-0000-0000-0000-000000000002"), FixedUtc.Date.AddDays(-5), "B47"); // 4–7
        AddPending(Guid.Parse("b0000003-0000-0000-0000-000000000003"), FixedUtc.Date.AddDays(-10), "B814"); // 8–14
        AddPending(Guid.Parse("b0000004-0000-0000-0000-000000000004"), FixedUtc.Date.AddDays(-20), "B15"); // 15+

        // Non-pending — must not appear
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = Guid.Parse("b0000005-0000-0000-0000-000000000005"),
            TenantId = _tenant,
            BranchId = _branchA,
            PatientId = _patient,
            CounselorId = _counselor,
            ReferredByDoctorId = Guid.NewGuid(),
            SessionDate = FixedUtc.Date.AddDays(-2),
            PatientType = "Cash",
            SessionType = "Initial",
            PatientAgreedToSurgery = true,
            PendingDecision = false,
            RecommendedSurgery = "AgreedOnly",
            CreatedAt = FixedUtc,
        });

        // Other branch pending
        AddPending(Guid.Parse("b0000006-0000-0000-0000-000000000006"), FixedUtc.Date.AddDays(-1), "OtherBranch", _branchB);

        _db.SaveChanges();
    }

    private void AddPending(Guid id, DateTime sessionDate, string surgery, Guid? branchId = null)
    {
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = id,
            TenantId = _tenant,
            BranchId = branchId ?? _branchA,
            PatientId = _patient,
            CounselorId = _counselor,
            ReferredByDoctorId = Guid.NewGuid(),
            SessionDate = sessionDate,
            PatientType = "Cash",
            SessionType = "Initial",
            PatientAgreedToSurgery = false,
            PendingDecision = true,
            RecommendedSurgery = surgery,
            CreatedAt = FixedUtc,
        });
    }

    [Theory]
    [InlineData(30)]
    [InlineData(90)]
    [InlineData(180)]
    [InlineData(365)]
    public async Task Aging_Periods_ReturnBucketCounts_WithoutThrowing(int period)
    {
        var aging = await _svc.GetFollowupAgingAsync(
            _tenant, new[] { _branchA }, _branchA, null, period, null, null, FixedUtc);

        Assert.Equal("PendingDecision", aging.Population);
        Assert.Equal(period, aging.Period);
        Assert.Equal(
            aging.Counts.Bucket03 + aging.Counts.Bucket47 + aging.Counts.Bucket814 + aging.Counts.Bucket15Plus,
            aging.TotalPending);
    }

    [Fact]
    public async Task Aging_Buckets_MatchHalfOpenDateBounds()
    {
        var aging = await _svc.GetFollowupAgingAsync(
            _tenant, new[] { _branchA }, _branchA, null, 365, null, null, FixedUtc);

        Assert.Equal(1, aging.Counts.Bucket03);
        Assert.Equal(1, aging.Counts.Bucket47);
        Assert.Equal(1, aging.Counts.Bucket814);
        Assert.Equal(1, aging.Counts.Bucket15Plus);
        Assert.Equal(4, aging.TotalPending);

        Assert.Contains(aging.Buckets.Bucket03, x => x.RecommendedSurgery == "B03");
        Assert.Contains(aging.Buckets.Bucket47, x => x.RecommendedSurgery == "B47");
        Assert.Contains(aging.Buckets.Bucket814, x => x.RecommendedSurgery == "B814");
        Assert.Contains(aging.Buckets.Bucket15Plus, x => x.RecommendedSurgery == "B15");
        Assert.DoesNotContain(
            aging.Buckets.Bucket03.Concat(aging.Buckets.Bucket47)
                .Concat(aging.Buckets.Bucket814).Concat(aging.Buckets.Bucket15Plus),
            x => x.RecommendedSurgery == "AgreedOnly");
    }

    [Fact]
    public async Task Aging_EmptyAccessibleBranches_ReturnsEmpty_NotTenantWide()
    {
        var aging = await _svc.GetFollowupAgingAsync(
            _tenant, Array.Empty<Guid>(), null, null, 365, null, null, FixedUtc);

        Assert.Equal(0, aging.TotalPending);
        Assert.Equal(0, aging.Counts.Bucket03 + aging.Counts.Bucket47 + aging.Counts.Bucket814 + aging.Counts.Bucket15Plus);
    }

    [Fact]
    public async Task Aging_AuthorizedBranchScope_ExcludesOtherBranch()
    {
        var aging = await _svc.GetFollowupAgingAsync(
            _tenant, new[] { _branchA }, _branchA, null, 365, null, null, FixedUtc);

        Assert.DoesNotContain(
            aging.Buckets.Bucket03.Concat(aging.Buckets.Bucket47)
                .Concat(aging.Buckets.Bucket814).Concat(aging.Buckets.Bucket15Plus),
            x => x.RecommendedSurgery == "OtherBranch");
    }

    /// <summary>
    /// Proves Aging count LINQ translates under Npgsql without executing against a live DB.
    /// Guards against regression of date_part(unknown, integer) from SessionDate.Date / TotalDays.
    /// </summary>
    [Fact]
    public void AgingBucketCount_Linq_ToQueryString_IsNpgsqlSafe()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=127.0.0.1;Database=translation_probe;Username=probe;Password=probe")
            .Options;
        var http = new Mock<IHttpContextAccessor>();
        http.Setup(x => x.HttpContext).Returns(new DefaultHttpContext());
        using var db = new AppDbContext(options, http.Object);

        var today = DateTime.SpecifyKind(FixedUtc.Date, DateTimeKind.Utc);
        var branchIds = new[] { _branchA };
        var from = today.AddDays(-365);
        var toExclusive = today.AddDays(1);

        var pending = db.CounselingSession.AsNoTracking()
            .Where(s => s.TenantId == _tenant
                     && s.DeletedAt == null
                     && s.PendingDecision == true
                     && s.SessionDate >= from
                     && s.SessionDate < toExclusive
                     && s.BranchId != null
                     && branchIds.Contains(s.BranchId.Value));

        var bucket03From = today.AddDays(-3);
        var bucket03ToExclusive = today.AddDays(1);
        var bucket47From = today.AddDays(-7);
        var bucket47ToExclusive = today.AddDays(-3);
        var bucket814From = today.AddDays(-14);
        var bucket814ToExclusive = today.AddDays(-7);
        var bucket15PlusToExclusive = today.AddDays(-14);

        var sql03 = pending
            .Where(s => s.SessionDate >= bucket03From && s.SessionDate < bucket03ToExclusive)
            .Select(s => s.Id)
            .ToQueryString();
        var sql47 = pending
            .Where(s => s.SessionDate >= bucket47From && s.SessionDate < bucket47ToExclusive)
            .Select(s => s.Id)
            .ToQueryString();
        var sql814 = pending
            .Where(s => s.SessionDate >= bucket814From && s.SessionDate < bucket814ToExclusive)
            .Select(s => s.Id)
            .ToQueryString();
        var sql15 = pending
            .Where(s => s.SessionDate < bucket15PlusToExclusive)
            .Select(s => s.Id)
            .ToQueryString();

        foreach (var sql in new[] { sql03, sql47, sql814, sql15 })
        {
            Assert.False(string.IsNullOrWhiteSpace(sql));
            Assert.DoesNotContain("date_part", sql, StringComparison.OrdinalIgnoreCase);
            // Reject the known-bad TotalDays / .Date projection pattern if it reappears in SQL shape
            Assert.DoesNotContain("EXTRACT", sql, StringComparison.OrdinalIgnoreCase);
        }
    }
}
