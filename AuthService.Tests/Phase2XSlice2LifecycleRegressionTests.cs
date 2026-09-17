using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Phase2X Slice 2 (Option A) — lifecycle regression matrix + Active query safety.
/// SurgeryCompleted clinical signal is documented as NOT approved for Follow-up Active EXIT.
/// </summary>
public class Phase2XSlice2LifecycleRegressionTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly FollowupListService _list;
    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _branch = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _patient = Guid.Parse("a00000d1-0000-0000-0000-0000000000d1");
    private readonly Guid _session = Guid.Parse("b00000d1-0000-0000-0000-0000000000d1");
    private Guid[] Scope => new[] { _branch };

    public Phase2XSlice2LifecycleRegressionTests()
    {
        _db = TestDbContextFactory.CreateInMemory();
        _list = new FollowupListService(_db);
        Seed();
    }

    public void Dispose() => _db.Dispose();

    private void Seed()
    {
        _db.Patients.Add(new Patient
        {
            Id = _patient,
            TenantId = _tenant,
            FirstName = "Lifecycle",
            LastName = "Probe",
            MedicalRecordNumber = "UHID-LC",
            ContactNumber = "9000000777",
            DateOfBirth = new DateTime(1982, 3, 1),
            Gender = "Female",
        });
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = _session,
            TenantId = _tenant,
            BranchId = _branch,
            PatientId = _patient,
            ReferredByDoctorId = Guid.NewGuid(),
            SessionDate = DateTime.UtcNow.Date.AddDays(-40),
            PatientType = "Cash",
            PatientIntention = "WillingWeek",
            Status = "Scheduled",
            ContactAttemptCount = 0,
            EscalationStatus = "Normal",
            CreatedAt = DateTime.UtcNow.AddDays(-40),
            UpdatedAt = DateTime.UtcNow,
        });
        _db.SaveChanges();
    }

    private async Task AssertStillActiveAsync()
    {
        var active = await _list.GetActiveAsync(_tenant, Scope, null, null, 1, 50);
        Assert.Contains(active.Items, i => i.SessionId == _session);
        Assert.DoesNotContain(
            (await _list.GetColdLeadsAsync(_tenant, Scope, null, 1, 50)).Items,
            i => i.SessionId == _session);
    }

    // ── Matrix: STAY Active ──────────────────────────────────────────────────

    [Fact]
    public async Task Matrix_OpenSessionStatusInProgress_StaysActive()
    {
        var s = await _db.CounselingSession.FirstAsync(x => x.Id == _session);
        s.Status = "InProgress";
        s.SessionStartTime = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await AssertStillActiveAsync();
    }

    [Fact]
    public async Task Matrix_ContactLogged_StaysActive()
    {
        var s = await _db.CounselingSession.FirstAsync(x => x.Id == _session);
        s.LastContactDate = DateTime.UtcNow;
        s.LastContactOutcome = "Answered";
        s.ContactAttemptCount = 3;
        await _db.SaveChangesAsync();
        await AssertStillActiveAsync();
    }

    [Fact]
    public async Task Matrix_ReminderLoggedFields_StaysActive()
    {
        // Reminder attaches a MessageSent-style outcome to session denorm when present;
        // population must remain intention-driven.
        var s = await _db.CounselingSession.FirstAsync(x => x.Id == _session);
        s.LastContactDate = DateTime.UtcNow;
        s.LastContactOutcome = "MessageSent";
        s.ContactAttemptCount += 1;
        await _db.SaveChangesAsync();
        await AssertStillActiveAsync();
    }

    [Fact]
    public async Task Matrix_CallbackCreated_DoesNotClearIntention_StaysActive()
    {
        // Callback is a separate table; Center Active membership ignores callback rows.
        _db.CounselorCallbackRequests.Add(new CounselorCallbackRequest
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            SessionId = _session,
            PatientId = _patient,
            BranchId = _branch,
            AssignedToUserId = Guid.NewGuid(),
            CallbackType = "General",
            Channel = "Phone",
            CallbackDate = DateTime.UtcNow.Date.AddDays(2),
            CallbackStatus = "Scheduled",
            Priority = 2,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = Guid.NewGuid(),
            UpdatedByUserId = Guid.NewGuid(),
            Status = "active",
        });
        await _db.SaveChangesAsync();
        await AssertStillActiveAsync();
    }

    [Fact]
    public async Task Matrix_SurgeryAgreed_StaysActive()
    {
        var s = await _db.CounselingSession.FirstAsync(x => x.Id == _session);
        s.PatientAgreedToSurgery = true;
        s.PendingDecision = false;
        s.DecisionDate = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await AssertStillActiveAsync();
        Assert.Equal("WillingWeek", s.PatientIntention);
    }

    [Fact]
    public async Task Matrix_SurgeryBookedFlags_StaysActive()
    {
        var s = await _db.CounselingSession.FirstAsync(x => x.Id == _session);
        s.PatientAgreedToSurgery = true;
        s.PendingDecision = false;
        s.SurgeryTentativeDate = DateTime.UtcNow.Date.AddDays(7);
        s.CurrentStage = "6"; // finalize-adjacent stage string — not an Active exit
        await _db.SaveChangesAsync();
        await AssertStillActiveAsync();
    }

    [Fact]
    public async Task Matrix_OtPreparedAdjacentSessionState_StaysActive()
    {
        var s = await _db.CounselingSession.FirstAsync(x => x.Id == _session);
        s.Status = "Completed"; // counselling session complete ≠ Active exit
        s.PatientAgreedToSurgery = true;
        s.CurrentStage = "OTPrepared";
        await _db.SaveChangesAsync();
        await AssertStillActiveAsync();
    }

    /// <summary>
    /// Clinical SurgeryCompleted exists on patient_journey but is NOT approved as Follow-up Active EXIT.
    /// Guard: Active membership must remain intention-only even if a discharged journey row exists for the patient.
    /// </summary>
    [Fact]
    public async Task Matrix_ClinicalSurgeryCompletedSignal_DoesNotExitActive_UntilProductSoTAuthorized()
    {
        // Simulate presence of a journey that would clinically be post-surgery / discharged.
        // Follow-up Active query must not consume clinical_state / SurgeryCompleted.
        _db.PatientJourneys.Add(new PatientJourneyReadOnly
        {
            Id = Guid.Parse("d00000d1-0000-0000-0000-0000000000d1"),
            TenantId = _tenant,
            PatientId = _patient,
            BranchId = _branch,
            IsDischarged = true,
            DischargedAt = DateTime.UtcNow.AddDays(-1),
            ProcedureName = "Cataract",
            ClinicalState = "SurgeryCompleted",
            CreatedAt = DateTime.UtcNow.AddDays(-5),
        });
        await _db.SaveChangesAsync();

        await AssertStillActiveAsync();

        // Patient may also appear in Post-Surgery (discharge) WITHOUT leaving Active while intention remains allowlisted.
        var post = await _list.GetPostSurgeryAsync(_tenant, Scope, null, 1, 50);
        Assert.Contains(post.Items, i => i.PatientId == _patient);
    }

    // ── Matrix: EXIT / transitions ───────────────────────────────────────────

    [Theory]
    [InlineData("Declined")]
    [InlineData("ReferredElsewhere")]
    public async Task Matrix_DeclinedOrReferred_ExitsActiveToCold(string coldIntention)
    {
        var s = await _db.CounselingSession.FirstAsync(x => x.Id == _session);
        s.PatientIntention = FollowupQueryContracts.NormalizeWritablePatientIntention(coldIntention);
        await _db.SaveChangesAsync();

        Assert.True(FollowupQueryContracts.IsColdIntention(s.PatientIntention));
        Assert.False(FollowupQueryContracts.IsActiveIntention(s.PatientIntention));

        var active = await _list.GetActiveAsync(_tenant, Scope, null, null, 1, 50);
        Assert.DoesNotContain(active.Items, i => i.SessionId == _session);

        var cold = await _list.GetColdLeadsAsync(_tenant, Scope, null, 1, 50);
        Assert.Contains(cold.Items, i => i.SessionId == _session && i.PatientIntention == coldIntention);
    }

    [Theory]
    [InlineData("WillingNow")]
    [InlineData("WillingTwoWeeks")]
    [InlineData("WillingSixMonths")]
    [InlineData("SecondOpinion")]
    public async Task Matrix_OrphanIntention_NeverActive(string orphan)
    {
        var s = await _db.CounselingSession.FirstAsync(x => x.Id == _session);
        s.PatientIntention = FollowupQueryContracts.NormalizeWritablePatientIntention(orphan);
        await _db.SaveChangesAsync();

        Assert.Equal(PatientIntentionKind.Orphan, FollowupQueryContracts.ClassifyPatientIntention(orphan));
        var active = await _list.GetActiveAsync(_tenant, Scope, null, null, 1, 50);
        Assert.DoesNotContain(active.Items, i => i.SessionId == _session);
        var cold = await _list.GetColdLeadsAsync(_tenant, Scope, null, 1, 50);
        Assert.DoesNotContain(cold.Items, i => i.SessionId == _session);
    }

    [Fact]
    public void Matrix_UnknownIntention_RejectedAtWriteBoundary()
    {
        Assert.Throws<ArgumentException>(() =>
            FollowupQueryContracts.EnsureWritablePatientIntention("NotARealIntention"));
        Assert.Equal(PatientIntentionKind.Unknown,
            FollowupQueryContracts.ClassifyPatientIntention("NotARealIntention"));
    }

    [Fact]
    public async Task Matrix_SoftDelete_ExitsActive()
    {
        var s = await _db.CounselingSession.FirstAsync(x => x.Id == _session);
        s.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var active = await _list.GetActiveAsync(_tenant, Scope, null, null, 1, 50);
        Assert.DoesNotContain(active.Items, i => i.SessionId == _session);
    }

    // ── Active query safety (no silent heuristics) ───────────────────────────

    [Fact]
    public async Task ActiveQuery_IgnoresAgreementBookingAgeAndContactHeuristics()
    {
        var s = await _db.CounselingSession.FirstAsync(x => x.Id == _session);
        s.PatientAgreedToSurgery = true;
        s.PendingDecision = false;
        s.Status = "Completed";
        s.SessionDate = DateTime.UtcNow.Date.AddDays(-400);
        s.LastContactDate = DateTime.UtcNow.Date.AddDays(-90);
        s.ContactAttemptCount = 20;
        s.DecisionDate = DateTime.UtcNow.Date.AddDays(-60);
        s.OverdueSinceDate = DateTime.UtcNow.Date.AddDays(-30);
        await _db.SaveChangesAsync();

        await AssertStillActiveAsync();
    }

    [Fact]
    public void ActiveQuerySource_DoesNotFilterByClinicalSurgeryCompletedOrDateHeuristics()
    {
        // Regression guard: prevent accidental wiring of clinical surgery-completion / due heuristics into Active SoT.
        var path = LocateFollowupListServiceSource();
        Assert.True(File.Exists(path), $"Expected source at {path}");
        var src = File.ReadAllText(path);

        const string marker = "internal IQueryable<CounselingSession> BuildActiveSessionQuery";
        var activeBuilderStart = src.IndexOf(marker, StringComparison.Ordinal);
        Assert.True(activeBuilderStart >= 0, "BuildActiveSessionQuery method not found");
        var nextBuilder = src.IndexOf(
            "internal IQueryable<CounselingSession> BuildColdSessionQuery",
            activeBuilderStart,
            StringComparison.Ordinal);
        Assert.True(nextBuilder > activeBuilderStart);
        var activeBuilder = src.Substring(activeBuilderStart, nextBuilder - activeBuilderStart);

        Assert.DoesNotContain("SurgeryCompleted", activeBuilder, StringComparison.Ordinal);
        Assert.DoesNotContain("PatientAgreedToSurgery", activeBuilder, StringComparison.Ordinal);
        Assert.DoesNotContain("AddDays(", activeBuilder, StringComparison.Ordinal);
        Assert.DoesNotContain("IsDischarged", activeBuilder, StringComparison.Ordinal);
        Assert.Contains("activeIntentions", activeBuilder, StringComparison.Ordinal);
        Assert.Contains("PatientIntention", activeBuilder, StringComparison.Ordinal);
    }

    [Fact]
    public void FollowupContracts_ActiveAllowlist_DoesNotIncludeSurgeryCompletedOrClinicalExitCodes()
    {
        Assert.DoesNotContain("SurgeryCompleted", FollowupQueryContracts.ActiveIntentions);
        Assert.False(FollowupQueryContracts.IsActiveIntention("SurgeryCompleted"));
        Assert.True(FollowupQueryContracts.IsActiveIntention("WillingWeek"));

        // Contracts documentation may mention the clinical signal as NOT wired; allowlist must stay intention-only.
        Assert.Equal(7, FollowupQueryContracts.ActiveIntentions.Length);
    }

    private static string LocateFollowupListServiceSource()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            var candidate = Path.Combine(
                dir.FullName,
                "microservices", "auth-service", "AuthService", "Services", "FollowupListService.cs");
            if (File.Exists(candidate)) return candidate;
            dir = dir.Parent;
        }

        return Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "..", "..", "..", "..",
            "microservices", "auth-service", "AuthService", "Services", "FollowupListService.cs"));
    }
}
