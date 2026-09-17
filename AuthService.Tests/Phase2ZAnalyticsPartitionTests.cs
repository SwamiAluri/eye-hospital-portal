using System;
using System.Linq;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using Xunit;

namespace AuthService.Tests;

/// <summary>Phase 2Z — PD13 mutually exclusive partition + analytics branch scope.</summary>
public class Phase2ZAnalyticsPartitionTests : IDisposable
{
    private static readonly DateTime FixedUtc = new(2026, 9, 10, 15, 30, 0, DateTimeKind.Utc);

    private readonly AppDbContext _db;
    private readonly CounselingAnalyticsService _analytics;
    private readonly FollowupBranchAccessService _branchAccess;
    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _branchA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _branchB = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private readonly Guid _branchUnauthorized = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private readonly Guid _userSingle = Guid.Parse("c0000001-0000-0000-0000-000000000001");
    private readonly Guid _counselor = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private readonly Guid _patient = Guid.Parse("a1000001-0000-0000-0000-000000000001");

    public Phase2ZAnalyticsPartitionTests()
    {
        _db = TestDbContextFactory.CreateInMemory();
        _analytics = new CounselingAnalyticsService(_db);
        _branchAccess = new FollowupBranchAccessService(_db);
        SeedBranchAuth();
    }

    public void Dispose() => _db.Dispose();

    private void SeedBranchAuth()
    {
        _db.Users.Add(new AppUser
        {
            Id = _userSingle,
            TenantId = _tenant,
            UserName = "single@test",
            NormalizedUserName = "SINGLE@TEST",
            Email = "single@test",
            NormalizedEmail = "SINGLE@TEST",
            FirstName = "Single",
            LastName = "User",
            BranchId = _branchA,
        });
        _db.UserBranches.Add(new UserBranch
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            UserId = _userSingle,
            BranchId = _branchA,
            Status = "active",
            EffectiveFrom = DateTime.UtcNow.AddDays(-30),
        });
        _db.Patients.Add(new Patient
        {
            Id = _patient,
            TenantId = _tenant,
            FirstName = "Test",
            LastName = "Patient",
            MedicalRecordNumber = "MRN-Z",
            DateOfBirth = new DateTime(1980, 1, 1),
            Gender = "Female",
        });
        _db.SaveChanges();
    }

    // ── PD13 classifier cases A–G ───────────────────────────────────────────

    [Fact]
    public void CaseA_PendingPlusAgreed_ClassifiesAsPendingDecision()
    {
        var partition = CounselingAnalyticsOutcomeClassifier.Classify(
            pending: true, patientAgreedToSurgery: true, patientIntention: "WillingWeek");
        Assert.Equal(CounselingAnalyticsOutcomePartition.PendingDecision, partition);
    }

    [Fact]
    public void CaseB_DeclinedMarkerPlusPending_ClassifiesAsException()
    {
        var partition = CounselingAnalyticsOutcomeClassifier.Classify(
            pending: true, patientAgreedToSurgery: false, patientIntention: "Declined");
        Assert.Equal(CounselingAnalyticsOutcomePartition.Exception, partition);
    }

    [Fact]
    public void CaseC_AgreedPlusDeclinedMarker_ClassifiesAsException()
    {
        var partition = CounselingAnalyticsOutcomeClassifier.Classify(
            pending: false, patientAgreedToSurgery: true, patientIntention: "ReferredElsewhere");
        Assert.Equal(CounselingAnalyticsOutcomePartition.Exception, partition);
    }

    [Fact]
    public void CaseC_BoolOnlyAgreedAndDeclinedFalse_IsAgreed_NotException()
    {
        // Agreed+Declined Exception requires declinedMarker — bool-only is not Exception.
        var partition = CounselingAnalyticsOutcomeClassifier.Classify(
            pending: false, patientAgreedToSurgery: true, patientIntention: "WillingWeek");
        Assert.Equal(CounselingAnalyticsOutcomePartition.Agreed, partition);
    }

    [Fact]
    public void CaseD_PendingOnly_ClassifiesAsPendingDecision()
    {
        var partition = CounselingAnalyticsOutcomeClassifier.Classify(
            pending: true, patientAgreedToSurgery: false, patientIntention: "Undecided");
        Assert.Equal(CounselingAnalyticsOutcomePartition.PendingDecision, partition);
    }

    [Fact]
    public void CaseE_AgreedOnly_ClassifiesAsAgreed()
    {
        var partition = CounselingAnalyticsOutcomeClassifier.Classify(
            pending: false, patientAgreedToSurgery: true, patientIntention: null);
        Assert.Equal(CounselingAnalyticsOutcomePartition.Agreed, partition);
    }

    [Fact]
    public void CaseF_DeclinedOnly_ClassifiesAsDeclined()
    {
        var partition = CounselingAnalyticsOutcomeClassifier.Classify(
            pending: false, patientAgreedToSurgery: false, patientIntention: null);
        Assert.Equal(CounselingAnalyticsOutcomePartition.Declined, partition);
    }

    [Fact]
    public void CaseG_NoRecognizedFlags_ClassifiesAsOtherUnclassified()
    {
        var partition = CounselingAnalyticsOutcomeClassifier.Classify(
            pending: false, patientAgreedToSurgery: null, patientIntention: "Undecided");
        Assert.Equal(CounselingAnalyticsOutcomePartition.OtherUnclassified, partition);
    }

    [Fact]
    public async Task Summary_PartitionsSumToTotal_AndEligibleDenominator()
    {
        AddPartitionSession(Guid.Parse("e0000001-0000-0000-0000-000000000001"),
            agreed: true, pending: false, intention: null); // E Agreed
        AddPartitionSession(Guid.Parse("e0000002-0000-0000-0000-000000000002"),
            agreed: false, pending: false, intention: null); // F Declined
        AddPartitionSession(Guid.Parse("e0000003-0000-0000-0000-000000000003"),
            agreed: false, pending: true, intention: "Undecided"); // D Pending
        AddPartitionSession(Guid.Parse("e0000004-0000-0000-0000-000000000004"),
            agreed: true, pending: true, intention: "WillingWeek"); // A Pending
        AddPartitionSession(Guid.Parse("e0000005-0000-0000-0000-000000000005"),
            agreed: true, pending: false, intention: "Declined"); // C Exception
        AddPartitionSession(Guid.Parse("e0000006-0000-0000-0000-000000000006"),
            agreed: false, pending: true, intention: "Declined"); // B Exception
        AddPartitionSession(Guid.Parse("e0000007-0000-0000-0000-000000000007"),
            agreed: null, pending: false, intention: "Undecided"); // G Other
        await _db.SaveChangesAsync();

        var s = await _analytics.GetSummaryAsync(
            _tenant, new[] { _branchA }, _branchA, null, 30, null, null, FixedUtc);

        Assert.Equal(7, s.TotalSessions);
        Assert.Equal(1, s.AgreedCount);
        Assert.Equal(1, s.DeclinedCount);
        Assert.Equal(2, s.UndecidedCount);
        Assert.Equal(2, s.PendingDecisionCount);
        Assert.Equal(2, s.ExceptionCount);
        Assert.Equal(1, s.OtherUnclassifiedCount);
        Assert.Equal(4, s.EligibleOutcomeSessions);
        Assert.Equal(
            s.AgreedCount + s.DeclinedCount + s.UndecidedCount + s.ExceptionCount + s.OtherUnclassifiedCount,
            s.TotalSessions);
        Assert.Equal(Math.Round(1 * 100.0 / 4, 1), s.ConversionRate);
        Assert.Equal(Math.Round(2 * 100.0 / 4, 1), s.DecisionRate);
    }

    [Fact]
    public async Task Trends_AgreedCount_UsesPartition_NotRawBool()
    {
        AddPartitionSession(Guid.Parse("e0000011-0000-0000-0000-000000000011"),
            agreed: true, pending: true, intention: "WillingWeek", sessionDate: FixedUtc.Date);
        AddPartitionSession(Guid.Parse("e0000012-0000-0000-0000-000000000012"),
            agreed: true, pending: false, intention: null, sessionDate: FixedUtc.Date);
        await _db.SaveChangesAsync();

        var trends = await _analytics.GetTrendsAsync(
            _tenant, new[] { _branchA }, _branchA, null, 30, null, null, FixedUtc);

        var point = Assert.Single(trends.Trend);
        Assert.Equal(2, point.Count);
        Assert.Equal(1, point.AgreedCount);
    }

    [Fact]
    public async Task BySurgeryType_AgreedCount_UsesPartitionOnly()
    {
        AddPartitionSession(Guid.Parse("e0000021-0000-0000-0000-000000000021"),
            agreed: true, pending: true, intention: null, surgery: "Phaco");
        AddPartitionSession(Guid.Parse("e0000022-0000-0000-0000-000000000022"),
            agreed: true, pending: false, intention: null, surgery: "Phaco");
        await _db.SaveChangesAsync();

        var s = await _analytics.GetSummaryAsync(
            _tenant, new[] { _branchA }, _branchA, null, 30, null, null, FixedUtc);

        var phaco = Assert.Single(s.BySurgeryType, x => x.SurgeryType == "Phaco");
        Assert.Equal(2, phaco.Count);
        Assert.Equal(1, phaco.AgreedCount);
    }

    // ── PD16 branch scope for analytics ───────────────────────────────────────

    [Fact]
    public async Task BranchAccess_UnauthorizedBranchId_Throws()
    {
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _branchAccess.ResolveAccessibleBranchesAsync(_tenant, _userSingle, _branchUnauthorized));

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _branchAccess.ResolveAccessibleBranchesAsync(_tenant, _userSingle, _branchB));
    }

    [Fact]
    public async Task Analytics_EmptyAccessibleBranchSet_ReturnsZeroSessions()
    {
        var s = await _analytics.GetSummaryAsync(
            _tenant, Array.Empty<Guid>(), null, null, 30, null, null, FixedUtc);
        Assert.Equal(0, s.TotalSessions);
        Assert.Equal(0, s.EligibleOutcomeSessions);
    }

    [Fact]
    public async Task Analytics_ScopedToAccessibleBranchesOnly()
    {
        AddPartitionSession(Guid.Parse("e0000031-0000-0000-0000-000000000031"),
            agreed: true, pending: false, intention: null, branchId: _branchA);
        AddPartitionSession(Guid.Parse("e0000032-0000-0000-0000-000000000032"),
            agreed: true, pending: false, intention: null, branchId: _branchB);
        await _db.SaveChangesAsync();

        var scopeA = await _branchAccess.ResolveAccessibleBranchesAsync(_tenant, _userSingle, null);
        var summary = await _analytics.GetSummaryAsync(
            _tenant, scopeA, null, null, 30, null, null, FixedUtc);

        Assert.Equal(new[] { _branchA }, scopeA.ToArray());
        Assert.Equal(1, summary.TotalSessions);
        Assert.Null(summary.BranchId);
    }

    private void AddPartitionSession(
        Guid id,
        bool? agreed,
        bool pending,
        string? intention,
        Guid? branchId = null,
        DateTime? sessionDate = null,
        string surgery = "TestSurgery")
    {
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = id,
            TenantId = _tenant,
            BranchId = branchId ?? _branchA,
            PatientId = _patient,
            CounselorId = _counselor,
            ReferredByDoctorId = Guid.NewGuid(),
            SessionDate = sessionDate ?? FixedUtc.Date.AddDays(-1),
            PatientType = "Cash",
            SessionType = "Initial",
            PatientAgreedToSurgery = agreed,
            PendingDecision = pending,
            PatientIntention = intention,
            RecommendedSurgery = surgery,
            CreatedAt = FixedUtc,
        });
    }
}
