using System;
using System.Linq;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

/// <summary>Phase2X Slice 1 — ownership, PD16 branch auth, orphan audit, SessionId honesty, lifecycle honesty.</summary>
public class Phase2XFollowupSlice1Tests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly FollowupListService _list;
    private readonly FollowupBranchAccessService _branchAccess;
    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _otherTenant = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private readonly Guid _branchA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _branchB = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private readonly Guid _branchUnauthorized = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private readonly Guid _userSingle = Guid.Parse("c0000001-0000-0000-0000-000000000001");
    private readonly Guid _userMulti = Guid.Parse("c0000002-0000-0000-0000-000000000002");
    private readonly Guid _userOtherTenant = Guid.Parse("c0000003-0000-0000-0000-000000000003");
    private readonly Guid _counselorKnown = Guid.Parse("c00000aa-0000-0000-0000-0000000000aa");
    private readonly Guid _counselorMissing = Guid.Parse("c00000bb-0000-0000-0000-0000000000bb");
    private readonly Guid _sessionOwned = Guid.Parse("b00000a1-0000-0000-0000-0000000000a1");
    private readonly Guid _sessionUnowned = Guid.Parse("b00000a2-0000-0000-0000-0000000000a2");
    private readonly Guid _patient1 = Guid.Parse("a00000a1-0000-0000-0000-0000000000a1");
    private readonly Guid _patient2 = Guid.Parse("a00000a2-0000-0000-0000-0000000000a2");

    public Phase2XFollowupSlice1Tests()
    {
        _db = TestDbContextFactory.CreateInMemory();
        _list = new FollowupListService(_db);
        _branchAccess = new FollowupBranchAccessService(_db);
        Seed();
    }

    public void Dispose() => _db.Dispose();

    private void Seed()
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
        _db.Users.Add(new AppUser
        {
            Id = _userMulti,
            TenantId = _tenant,
            UserName = "multi@test",
            NormalizedUserName = "MULTI@TEST",
            Email = "multi@test",
            NormalizedEmail = "MULTI@TEST",
            FirstName = "Multi",
            LastName = "User",
            BranchId = _branchA,
        });
        _db.Users.Add(new AppUser
        {
            Id = _userOtherTenant,
            TenantId = _otherTenant,
            UserName = "other@test",
            NormalizedUserName = "OTHER@TEST",
            Email = "other@test",
            NormalizedEmail = "OTHER@TEST",
            FirstName = "Other",
            LastName = "Tenant",
            BranchId = _branchA,
        });
        _db.Users.Add(new AppUser
        {
            Id = _counselorKnown,
            TenantId = _tenant,
            UserName = "counselor@test",
            NormalizedUserName = "COUNSELOR@TEST",
            Email = "counselor@test",
            NormalizedEmail = "COUNSELOR@TEST",
            FirstName = "Priya",
            LastName = "Counselor",
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
        _db.UserBranches.Add(new UserBranch
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            UserId = _userMulti,
            BranchId = _branchA,
            Status = "active",
            EffectiveFrom = DateTime.UtcNow.AddDays(-30),
        });
        _db.UserBranches.Add(new UserBranch
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            UserId = _userMulti,
            BranchId = _branchB,
            Status = "active",
            EffectiveFrom = DateTime.UtcNow.AddDays(-30),
        });
        _db.UserBranches.Add(new UserBranch
        {
            Id = Guid.NewGuid(),
            TenantId = _otherTenant,
            UserId = _userOtherTenant,
            BranchId = _branchA,
            Status = "active",
            EffectiveFrom = DateTime.UtcNow.AddDays(-30),
        });

        _db.Patients.Add(new Patient
        {
            Id = _patient1,
            TenantId = _tenant,
            FirstName = "Owned",
            LastName = "Patient",
            MedicalRecordNumber = "UHID-OWN",
            ContactNumber = "9000000099",
            DateOfBirth = new DateTime(1980, 1, 1),
            Gender = "Female",
        });
        _db.Patients.Add(new Patient
        {
            Id = _patient2,
            TenantId = _tenant,
            FirstName = "Unowned",
            LastName = "Patient",
            MedicalRecordNumber = "UHID-UNO",
            ContactNumber = "9000000088",
            DateOfBirth = new DateTime(1981, 1, 1),
            Gender = "Male",
        });

        _db.CounselingSession.Add(new CounselingSession
        {
            Id = _sessionOwned,
            TenantId = _tenant,
            BranchId = _branchA,
            PatientId = _patient1,
            CounselorId = _counselorKnown,
            ReferredByDoctorId = Guid.NewGuid(),
            SessionDate = DateTime.UtcNow.Date.AddDays(-2),
            PatientType = "Cash",
            PatientIntention = "WillingWeek",
            ContactAttemptCount = 1,
            EscalationStatus = "Normal",
            CreatedAt = DateTime.UtcNow.AddDays(-2),
            UpdatedAt = DateTime.UtcNow,
        });
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = _sessionUnowned,
            TenantId = _tenant,
            BranchId = _branchB,
            PatientId = _patient2,
            CounselorId = _counselorMissing,
            ReferredByDoctorId = Guid.NewGuid(),
            SessionDate = DateTime.UtcNow.Date.AddDays(-1),
            PatientType = "Cash",
            PatientIntention = "Undecided",
            ContactAttemptCount = 0,
            EscalationStatus = "Normal",
            CreatedAt = DateTime.UtcNow.AddDays(-1),
            UpdatedAt = DateTime.UtcNow,
        });

        // Orphan historical record — must remain, not Active
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = Guid.Parse("b00000a3-0000-0000-0000-0000000000a3"),
            TenantId = _tenant,
            BranchId = _branchA,
            PatientId = _patient1,
            ReferredByDoctorId = Guid.NewGuid(),
            SessionDate = DateTime.UtcNow.Date.AddDays(-5),
            PatientType = "Cash",
            PatientIntention = "WillingTwoWeeks",
            ContactAttemptCount = 0,
            EscalationStatus = "Normal",
            CreatedAt = DateTime.UtcNow.AddDays(-5),
            UpdatedAt = DateTime.UtcNow,
        });

        // Branch B active + orphan for multi-branch stats
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = Guid.Parse("b00000a4-0000-0000-0000-0000000000a4"),
            TenantId = _tenant,
            BranchId = _branchB,
            PatientId = _patient2,
            ReferredByDoctorId = Guid.NewGuid(),
            SessionDate = DateTime.UtcNow.Date,
            PatientType = "Cash",
            PatientIntention = "SecondOpinion",
            ContactAttemptCount = 0,
            EscalationStatus = "Normal",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });

        // Other tenant session — isolation
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = Guid.Parse("b00000a5-0000-0000-0000-0000000000a5"),
            TenantId = _otherTenant,
            BranchId = _branchA,
            PatientId = _patient1,
            ReferredByDoctorId = Guid.NewGuid(),
            SessionDate = DateTime.UtcNow.Date,
            PatientType = "Cash",
            PatientIntention = "WillingWeek",
            ContactAttemptCount = 0,
            EscalationStatus = "Normal",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });

        _db.PatientJourneys.Add(new PatientJourneyReadOnly
        {
            Id = Guid.Parse("d00000a1-0000-0000-0000-0000000000a1"),
            TenantId = _tenant,
            PatientId = _patient1,
            BranchId = _branchA,
            IsDischarged = true,
            DischargedAt = DateTime.UtcNow.AddDays(-3),
            ProcedureName = "Cataract OD",
            ClinicalState = "Discharged",
            CreatedAt = DateTime.UtcNow.AddDays(-10),
        });

        _db.SaveChanges();
    }

    // ── Ownership ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Ownership_CounselorIdAndNameReturned_WhenKnown()
    {
        var result = await _list.GetActiveAsync(_tenant, new[] { _branchA }, null, null, 1, 50);
        var owned = Assert.Single(result.Items, i => i.SessionId == _sessionOwned);
        Assert.Equal(_counselorKnown, owned.CounselorId);
        Assert.Equal("Priya Counselor", owned.CounselorName);
    }

    [Fact]
    public async Task Ownership_NullName_WhenCounselorUnknown_DoesNotAlterPopulation()
    {
        var result = await _list.GetActiveAsync(_tenant, new[] { _branchB }, null, null, 1, 50);
        var row = Assert.Single(result.Items, i => i.SessionId == _sessionUnowned);
        Assert.Equal(_counselorMissing, row.CounselorId);
        Assert.Null(row.CounselorName);
        Assert.Equal("Undecided", row.PatientIntention);
    }

    [Fact]
    public async Task Ownership_DoesNotChangeActiveMembership()
    {
        var before = await _list.GetActiveAsync(_tenant, new[] { _branchA, _branchB }, null, null, 1, 50);
        Assert.Equal(2, before.Total);
        Assert.All(before.Items, i => Assert.True(FollowupQueryContracts.IsActiveIntention(i.PatientIntention)));
    }

    // ── Orphan discrepancy ───────────────────────────────────────────────────

    [Fact]
    public async Task Orphan_HistoricalRecord_NotInActive_CountedInAudit()
    {
        var active = await _list.GetActiveAsync(_tenant, new[] { _branchA, _branchB }, null, null, 1, 50);
        Assert.DoesNotContain(active.Items, i => i.PatientIntention == "WillingTwoWeeks");
        Assert.DoesNotContain(active.Items, i => i.PatientIntention == "SecondOpinion");

        var stats = await _list.GetStatsAsync(_tenant, new[] { _branchA, _branchB }, null, null, null);
        Assert.Equal(2, stats.OrphanIntentions.Total);
        Assert.Equal(1, stats.OrphanIntentions.WillingTwoWeeks);
        Assert.Equal(1, stats.OrphanIntentions.SecondOpinion);
        Assert.Equal(0, stats.OrphanIntentions.WillingNow);
    }

    [Fact]
    public async Task Orphan_DoesNotEnterActive_WhenPresentInDb()
    {
        foreach (var orphan in FollowupQueryContracts.OrphanIntentions)
        {
            Assert.False(FollowupQueryContracts.IsActiveIntention(orphan));
        }

        var active = await _list.GetActiveAsync(_tenant, new[] { _branchA }, null, null, 1, 50);
        Assert.DoesNotContain(active.Items, i => FollowupQueryContracts.IsOrphanIntention(i.PatientIntention));
    }

    // ── PD16 branch authorization ────────────────────────────────────────────

    [Fact]
    public async Task BranchAccess_SingleBranch_AuthorizedOnly()
    {
        var scope = await _branchAccess.ResolveAccessibleBranchesAsync(_tenant, _userSingle, null);
        Assert.Equal(new[] { _branchA }, scope.OrderBy(x => x).ToArray());

        var active = await _list.GetActiveAsync(_tenant, scope, null, null, 1, 50);
        Assert.All(active.Items, i => Assert.Equal(_branchA, i.BranchId));
        Assert.DoesNotContain(active.Items, i => i.BranchId == _branchB);
    }

    [Fact]
    public async Task BranchAccess_MultiBranch_OmittedBranchId_UsesAuthorizedSet()
    {
        var scope = await _branchAccess.ResolveAccessibleBranchesAsync(_tenant, _userMulti, null);
        Assert.Equal(2, scope.Count);
        Assert.Contains(_branchA, scope);
        Assert.Contains(_branchB, scope);

        var active = await _list.GetActiveAsync(_tenant, scope, null, null, 1, 50);
        Assert.Equal(2, active.Total);
    }

    [Fact]
    public async Task BranchAccess_UnauthorizedBranchId_Throws()
    {
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _branchAccess.ResolveAccessibleBranchesAsync(_tenant, _userSingle, _branchUnauthorized));

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _branchAccess.ResolveAccessibleBranchesAsync(_tenant, _userSingle, _branchB));
    }

    [Fact]
    public async Task BranchAccess_AuthorizedBranchId_NarrowsToThatBranch()
    {
        var scope = await _branchAccess.ResolveAccessibleBranchesAsync(_tenant, _userMulti, _branchB);
        Assert.Equal(new[] { _branchB }, scope.ToArray());
    }

    [Fact]
    public async Task BranchAccess_EmptyAccessible_ReturnsEmptyLists_NotTenantWide()
    {
        var emptyUser = Guid.Parse("c00000ff-0000-0000-0000-0000000000ff");
        _db.Users.Add(new AppUser
        {
            Id = emptyUser,
            TenantId = _tenant,
            UserName = "empty@test",
            NormalizedUserName = "EMPTY@TEST",
            Email = "empty@test",
            NormalizedEmail = "EMPTY@TEST",
            FirstName = "Empty",
            LastName = "Access",
        });
        await _db.SaveChangesAsync();

        var scope = await _branchAccess.ResolveAccessibleBranchesAsync(_tenant, emptyUser, null);
        Assert.Empty(scope);

        var active = await _list.GetActiveAsync(_tenant, scope, null, null, 1, 50);
        Assert.Equal(0, active.Total);
        Assert.Empty(active.Items);
    }

    [Fact]
    public async Task TenantIsolation_OtherTenantSessionsExcluded()
    {
        var scope = await _branchAccess.ResolveAccessibleBranchesAsync(_tenant, _userMulti, null);
        var active = await _list.GetActiveAsync(_tenant, scope, null, null, 1, 50);
        Assert.DoesNotContain(active.Items, i => i.SessionId == Guid.Parse("b00000a5-0000-0000-0000-0000000000a5"));

        var otherScope = await _branchAccess.ResolveAccessibleBranchesAsync(_otherTenant, _userOtherTenant, null);
        var otherActive = await _list.GetActiveAsync(_otherTenant, otherScope, null, null, 1, 50);
        Assert.Contains(otherActive.Items, i => i.SessionId == Guid.Parse("b00000a5-0000-0000-0000-0000000000a5"));
        Assert.DoesNotContain(otherActive.Items, i => i.SessionId == _sessionOwned);
    }

    // ── Post-Surgery SessionId honesty ───────────────────────────────────────

    [Fact]
    public async Task PostSurgery_SessionId_IsNull_WithoutAuthoritativeLink()
    {
        // Even though patient1 has counselling sessions, opportunistic link must not be used.
        var result = await _list.GetPostSurgeryAsync(_tenant, new[] { _branchA }, null, 1, 50);
        Assert.Equal(1, result.Total);
        Assert.All(result.Items, i => Assert.Null(i.SessionId));
    }

    // ── Lifecycle honesty (no incorrect Active exit) ─────────────────────────

    [Fact]
    public async Task LifecycleHonesty_AgreeAndBookFlags_DoNotRemoveFromActive()
    {
        var session = await _db.CounselingSession.FirstAsync(s => s.Id == _sessionOwned);
        var intentionBefore = session.PatientIntention;

        session.PatientAgreedToSurgery = true;
        session.PendingDecision = false;
        session.DecisionDate = DateTime.UtcNow;
        // Simulate booking linkage without clearing intention (QuickBook behavior)
        await _db.SaveChangesAsync();

        var after = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == _sessionOwned);
        Assert.Equal(intentionBefore, after.PatientIntention);
        Assert.True(FollowupQueryContracts.IsActiveIntention(after.PatientIntention));

        var list = await _list.GetActiveAsync(_tenant, new[] { _branchA }, null, null, 1, 50);
        Assert.Contains(list.Items, i => i.SessionId == _sessionOwned);
    }

    [Fact]
    public async Task LifecycleHonesty_ContactLogFields_DoNotRemoveFromActive()
    {
        var session = await _db.CounselingSession.FirstAsync(s => s.Id == _sessionOwned);
        session.LastContactDate = DateTime.UtcNow;
        session.LastContactOutcome = "Answered";
        session.ContactAttemptCount += 1;
        await _db.SaveChangesAsync();

        var list = await _list.GetActiveAsync(_tenant, new[] { _branchA }, null, null, 1, 50);
        Assert.Contains(list.Items, i => i.SessionId == _sessionOwned);
        Assert.Equal("WillingWeek", list.Items.Single(i => i.SessionId == _sessionOwned).PatientIntention);
    }

    [Fact]
    public void LifecycleHonesty_UnknownIntention_CannotBeWritten()
    {
        Assert.Throws<ArgumentException>(() =>
            FollowupQueryContracts.EnsureWritablePatientIntention("FakeIntentionXYZ"));
    }

    [Fact]
    public async Task Populations_RemainDistinct_ActiveColdPostOrphan()
    {
        var branches = new[] { _branchA, _branchB };
        var active = await _list.GetActiveAsync(_tenant, branches, null, null, 1, 50);
        var cold = await _list.GetColdLeadsAsync(_tenant, branches, null, 1, 50);
        var post = await _list.GetPostSurgeryAsync(_tenant, branches, null, 1, 50);
        var stats = await _list.GetStatsAsync(_tenant, branches, null, null, null);

        Assert.All(active.Items, i => Assert.True(FollowupQueryContracts.IsActiveIntention(i.PatientIntention)));
        Assert.All(cold.Items, i => Assert.True(FollowupQueryContracts.IsColdIntention(i.PatientIntention)));
        Assert.True(post.Total >= 1);
        Assert.True(stats.OrphanIntentions.Total >= 1);
        Assert.Empty(active.Items.Select(i => i.SessionId).Intersect(cold.Items.Select(i => i.SessionId)));
    }
}
