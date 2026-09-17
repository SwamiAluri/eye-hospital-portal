using System;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models;
using AuthService.Models.Domain;
using AuthService.Services;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace AuthService.Tests;

public class FollowupListServiceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly FollowupListService _svc;
    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _otherTenant = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private readonly Guid _branchA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _branchB = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private Guid[] _allBranches => new[] { _branchA, _branchB };

    public FollowupListServiceTests()
    {
        _db = TestDbContextFactory.CreateInMemory();
        _svc = new FollowupListService(_db);
        Seed();
    }

    public void Dispose() => _db.Dispose();

    private void Seed()
    {
        // Patients (hex-only GUIDs)
        AddPatient(Guid.Parse("a0000001-0000-0000-0000-000000000001"), "Alice", "Active", "UHID-ALICE", "9000000001");
        AddPatient(Guid.Parse("a0000002-0000-0000-0000-000000000002"), "Bob", "Cold", "UHID-BOB", "9000000002");
        AddPatient(Guid.Parse("a0000003-0000-0000-0000-000000000003"), "Carol", "Post", "UHID-CAROL", "9000000003");
        AddPatient(Guid.Parse("a0000004-0000-0000-0000-000000000004"), "Dan", "Orphan", "UHID-DAN", "9000000004");
        AddPatient(Guid.Parse("a0000005-0000-0000-0000-000000000005"), "Eve", "Escalated", "UHID-EVE", "9000000005");
        AddPatient(Guid.Parse("a0000006-0000-0000-0000-000000000006"), "Frank", "BranchB", "UHID-FRANK", "9000000006");
        AddPatient(Guid.Parse("a0000007-0000-0000-0000-000000000007"), "Grace", "PhoneOnly", "UHID-GRACE", "9111222333");
        AddPatient(Guid.Parse("a0000008-0000-0000-0000-000000000008"), "Hank", "Phaco", "UHID-HANK", "9000000008");

        // Active allowlist
        AddSession(Guid.Parse("b0000001-0000-0000-0000-000000000001"),
            Guid.Parse("a0000001-0000-0000-0000-000000000001"),
            "WillingWeek", _branchA, lastContact: null, attempts: 0, escalation: "Normal",
            surgery: "SICS");
        AddSession(Guid.Parse("b0000002-0000-0000-0000-000000000002"),
            Guid.Parse("a0000005-0000-0000-0000-000000000005"),
            "Undecided", _branchA, lastContact: DateTime.UtcNow.Date.AddDays(-3), attempts: 4,
            escalation: "Escalated", surgery: "Phaco");
        AddSession(Guid.Parse("b0000003-0000-0000-0000-000000000003"),
            Guid.Parse("a0000006-0000-0000-0000-000000000006"),
            "WaitingFear", _branchB, lastContact: DateTime.UtcNow.Date, attempts: 1,
            escalation: "Normal", surgery: "Vitrectomy");
        AddSession(Guid.Parse("b0000004-0000-0000-0000-000000000004"),
            Guid.Parse("a0000007-0000-0000-0000-000000000007"),
            "WaitingFinancial", _branchA, lastContact: DateTime.UtcNow.Date, attempts: 2,
            escalation: "SupervisorAlert", surgery: "LASIK");
        AddSession(Guid.Parse("b0000005-0000-0000-0000-000000000005"),
            Guid.Parse("a0000008-0000-0000-0000-000000000008"),
            "WillingMonth", _branchA, lastContact: DateTime.UtcNow.Date, attempts: 1,
            escalation: "Normal", surgery: "Phacoemulsification");

        // Orphan intention — must NOT appear in Active
        AddSession(Guid.Parse("b0000006-0000-0000-0000-000000000006"),
            Guid.Parse("a0000004-0000-0000-0000-000000000004"),
            "WillingNow", _branchA, lastContact: null, attempts: 0, escalation: "Normal");

        // Cold
        AddSession(Guid.Parse("b0000007-0000-0000-0000-000000000007"),
            Guid.Parse("a0000002-0000-0000-0000-000000000002"),
            "Declined", _branchA, lastContact: DateTime.UtcNow.Date, attempts: 3, escalation: "Normal");
        AddSession(Guid.Parse("b0000008-0000-0000-0000-000000000008"),
            Guid.Parse("a0000004-0000-0000-0000-000000000004"),
            "ReferredElsewhere", _branchA, lastContact: DateTime.UtcNow.Date, attempts: 1, escalation: "Normal");

        // Soft-deleted active — excluded
        AddSession(Guid.Parse("b0000009-0000-0000-0000-000000000009"),
            Guid.Parse("a0000001-0000-0000-0000-000000000001"),
            "Undecided", _branchA, lastContact: null, attempts: 0, escalation: "Normal",
            deletedAt: DateTime.UtcNow);

        // Other tenant — excluded
        AddSession(Guid.Parse("b000000a-0000-0000-0000-00000000000a"),
            Guid.Parse("a0000001-0000-0000-0000-000000000001"),
            "Undecided", _branchA, lastContact: null, attempts: 0, escalation: "Normal",
            tenantId: _otherTenant);

        // Post-surgery journeys
        _db.PatientJourneys.Add(new PatientJourneyReadOnly
        {
            Id = Guid.Parse("d0000001-0000-0000-0000-000000000001"),
            TenantId = _tenant,
            PatientId = Guid.Parse("a0000003-0000-0000-0000-000000000003"),
            BranchId = _branchA,
            IsDischarged = true,
            DischargedAt = DateTime.UtcNow.AddDays(-40),
            ProcedureName = "Cataract OS",
            Uhid = "UHID-CAROL",
            ClinicalState = "Discharged",
            CreatedAt = DateTime.UtcNow.AddDays(-50),
        });
        _db.PatientJourneys.Add(new PatientJourneyReadOnly
        {
            Id = Guid.Parse("d0000002-0000-0000-0000-000000000002"),
            TenantId = _tenant,
            PatientId = Guid.Parse("a0000001-0000-0000-0000-000000000001"),
            BranchId = _branchB,
            IsDischarged = true,
            DischargedAt = DateTime.UtcNow.AddDays(-5),
            ProcedureName = "Retina repair",
            ClinicalState = "Discharged",
            CreatedAt = DateTime.UtcNow.AddDays(-10),
        });
        // Not discharged
        _db.PatientJourneys.Add(new PatientJourneyReadOnly
        {
            Id = Guid.Parse("d0000003-0000-0000-0000-000000000003"),
            TenantId = _tenant,
            PatientId = Guid.Parse("a0000005-0000-0000-0000-000000000005"),
            BranchId = _branchA,
            IsDischarged = false,
            ProcedureName = "Not discharged",
            ClinicalState = "Admitted",
            CreatedAt = DateTime.UtcNow,
        });

        var scheduleId = Guid.Parse("e0000001-0000-0000-0000-000000000001");
        _db.PostOpCareSchedules.Add(new PostOpCareSchedule
        {
            Id = scheduleId,
            TenantId = _tenant,
            PatientId = Guid.Parse("a0000003-0000-0000-0000-000000000003"),
            SurgeryType = "Cataract",
            SurgeryDate = DateTime.UtcNow.AddDays(-45),
            SurgeryEye = "OS",
        });
        _db.PostOpVisits.Add(new PostOpVisit
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            PostOpCareScheduleId = scheduleId,
            VisitName = "Day 1",
            ScheduledDate = DateTime.UtcNow.AddDays(-39),
            Completed = false,
        });
        _db.PostOpVisits.Add(new PostOpVisit
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            PostOpCareScheduleId = scheduleId,
            VisitName = "Week 1",
            ScheduledDate = DateTime.UtcNow.AddDays(-33),
            Completed = true,
        });

        _db.SaveChanges();
    }

    private void AddPatient(Guid id, string first, string last, string mrn, string phone)
    {
        _db.Patients.Add(new Patient
        {
            Id = id,
            TenantId = _tenant,
            FirstName = first,
            LastName = last,
            MedicalRecordNumber = mrn,
            ContactNumber = phone,
            DateOfBirth = new DateTime(1980, 1, 1),
            Gender = "Female",
        });
    }

    private void AddSession(
        Guid id,
        Guid patientId,
        string intention,
        Guid branchId,
        DateTime? lastContact,
        int attempts,
        string escalation,
        string? surgery = null,
        DateTime? deletedAt = null,
        Guid? tenantId = null)
    {
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = id,
            TenantId = tenantId ?? _tenant,
            BranchId = branchId,
            PatientId = patientId,
            ReferredByDoctorId = Guid.NewGuid(),
            SessionDate = DateTime.UtcNow.Date.AddDays(-10),
            PatientType = "Cash",
            PatientIntention = intention,
            LastContactDate = lastContact,
            ContactAttemptCount = attempts,
            EscalationStatus = escalation,
            RecommendedSurgery = surgery,
            CreatedAt = DateTime.UtcNow.AddDays(-10),
            UpdatedAt = DateTime.UtcNow.AddDays(-1),
            DeletedAt = deletedAt,
        });
    }

    // ── Population predicates unchanged ──────────────────────────────────────

    [Fact]
    public async Task Active_Population_ExcludesOrphansColdAndDeleted()
    {
        var result = await _svc.GetActiveAsync(_tenant, _allBranches, null, null, 1, 50);
        Assert.Equal(5, result.Total);
        Assert.All(result.Items, i => Assert.Contains(i.PatientIntention!, FollowupQueryContracts.ActiveIntentions));
        Assert.DoesNotContain(result.Items, i => i.PatientIntention == "WillingNow");
        Assert.DoesNotContain(result.Items, i => i.PatientIntention == "Declined");
    }

    [Fact]
    public async Task Cold_Population_OnlyDeclinedAndReferred()
    {
        var result = await _svc.GetColdLeadsAsync(_tenant, _allBranches, null, 1, 50);
        Assert.Equal(2, result.Total);
        Assert.All(result.Items, i => Assert.Contains(i.PatientIntention!, FollowupQueryContracts.ColdIntentions));
    }

    [Fact]
    public async Task PostSurgery_OnlyDischargedJourneys()
    {
        var result = await _svc.GetPostSurgeryAsync(_tenant, _allBranches, null, 1, 50);
        Assert.Equal(2, result.Total);
        Assert.DoesNotContain(result.Items, i => i.SurgeryType == "Not discharged");
    }

    // ── Search ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Search_ByPatientName_IsCaseInsensitive()
    {
        var result = await _svc.GetActiveAsync(_tenant, _allBranches, null, "alice", 1, 20);
        Assert.Equal(1, result.Total);
        Assert.Single(result.Items);
        Assert.Contains("Alice", result.Items[0].PatientName);
    }

    [Fact]
    public async Task Search_ByUhidMrn()
    {
        var result = await _svc.GetActiveAsync(_tenant, _allBranches, null, "UHID-EVE", 1, 20);
        Assert.Equal(1, result.Total);
        Assert.Equal("UHID-EVE", result.Items[0].Uhid);
    }

    [Fact]
    public async Task Search_ByPhone()
    {
        var result = await _svc.GetActiveAsync(_tenant, _allBranches, null, "9111222333", 1, 20);
        Assert.Equal(1, result.Total);
        Assert.Equal("9111222333", result.Items[0].Phone);
    }

    [Fact]
    public async Task Search_ByRecommendedSurgery()
    {
        var result = await _svc.GetActiveAsync(_tenant, _allBranches, null, "phacoemulsification", 1, 20);
        Assert.Equal(1, result.Total);
        Assert.Equal("Phacoemulsification", result.Items[0].RecommendedSurgery);
    }

    [Fact]
    public async Task Search_EmptyResult_TotalZero()
    {
        var result = await _svc.GetActiveAsync(_tenant, _allBranches, null, "ZZZ-NO-MATCH", 1, 20);
        Assert.Empty(result.Items);
        Assert.Equal(0, result.Total);
    }

    [Fact]
    public async Task Search_PlusPagination_FilteredTotal()
    {
        // Seed enough matching actives? We have 5 actives; search "UHID" matches all with UHID-
        var page1 = await _svc.GetActiveAsync(_tenant, _allBranches, null, "uhid", 1, 2);
        Assert.True(page1.Total >= 5);
        Assert.Equal(2, page1.Items.Count);
        Assert.True(page1.Items.Count <= page1.Total);

        var page2 = await _svc.GetActiveAsync(_tenant, _allBranches, null, "uhid", 2, 2);
        Assert.Equal(page1.Total, page2.Total);
        Assert.Equal(2, page2.Items.Count);
        Assert.DoesNotContain(page2.Items, i => page1.Items.Any(p => p.SessionId == i.SessionId));
    }

    // ── Branch / intention / combined ────────────────────────────────────────

    [Fact]
    public async Task BranchFilter_Active()
    {
        var result = await _svc.GetActiveAsync(_tenant, new[] { _branchB }, null, null, 1, 50);
        Assert.Equal(1, result.Total);
        Assert.All(result.Items, i => Assert.Equal(_branchB, i.BranchId));
    }

    [Fact]
    public async Task IntentionFilter_Active()
    {
        var result = await _svc.GetActiveAsync(_tenant, _allBranches, "Undecided", null, 1, 50);
        Assert.Equal(1, result.Total);
        Assert.All(result.Items, i => Assert.Equal("Undecided", i.PatientIntention));
    }

    [Fact]
    public async Task Combined_BranchIntentionAndQ()
    {
        var result = await _svc.GetActiveAsync(_tenant, new[] { _branchA }, "WaitingFinancial", "grace", 1, 20);
        Assert.Equal(1, result.Total);
        Assert.Single(result.Items);
        Assert.Equal("WaitingFinancial", result.Items[0].PatientIntention);
        Assert.Equal(_branchA, result.Items[0].BranchId);
    }

    [Fact]
    public async Task BranchFilter_ColdAndPost()
    {
        var cold = await _svc.GetColdLeadsAsync(_tenant, new[] { _branchA }, null, 1, 50);
        Assert.Equal(2, cold.Total);

        var postA = await _svc.GetPostSurgeryAsync(_tenant, new[] { _branchA }, null, 1, 50);
        Assert.Equal(1, postA.Total);
        var postB = await _svc.GetPostSurgeryAsync(_tenant, new[] { _branchB }, null, 1, 50);
        Assert.Equal(1, postB.Total);
    }

    [Fact]
    public async Task PostSurgery_SearchByProcedure()
    {
        var result = await _svc.GetPostSurgeryAsync(_tenant, _allBranches, "cataract", 1, 20);
        Assert.Equal(1, result.Total);
        Assert.Contains("Cataract", result.Items[0].SurgeryType!);
    }

    // ── Pagination clamp ─────────────────────────────────────────────────────

    [Fact]
    public async Task PageSize_ClampedToMax100()
    {
        var result = await _svc.GetActiveAsync(_tenant, _allBranches, null, null, 1, 500);
        Assert.Equal(100, result.PageSize);
    }

    [Fact]
    public async Task Page_LessThanOne_BecomesOne()
    {
        var result = await _svc.GetActiveAsync(_tenant, _allBranches, null, null, 0, 20);
        Assert.Equal(1, result.Page);
    }

    // ── Stats ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Stats_MatchActiveListTotal_AndAreNotPageScoped()
    {
        var listPage = await _svc.GetActiveAsync(_tenant, _allBranches, null, null, 1, 1);
        Assert.Equal(1, listPage.Items.Count);
        Assert.True(listPage.Total > 1);

        var stats = await _svc.GetStatsAsync(_tenant, _allBranches, null, null, null);
        Assert.Equal(listPage.Total, stats.Active.Total);
        Assert.Equal("filtered", stats.Filters.Scope);

        // Urgent = Escalated + SupervisorAlert (Eve + Grace) = 2
        Assert.Equal(2, stats.Active.UrgentHigh);
        // Never contacted includes Alice (and only Alice among actives with null LCD)
        Assert.Equal(1, stats.Active.NeverContacted);
        Assert.NotNull(stats.Active.AverageAttempts);
    }

    [Fact]
    public async Task Stats_HonorSearchFilter_SameAsList()
    {
        var list = await _svc.GetActiveAsync(_tenant, _allBranches, null, "eve", 1, 20);
        var stats = await _svc.GetStatsAsync(_tenant, _allBranches, null, null, "eve");
        Assert.Equal(list.Total, stats.Active.Total);
        Assert.Equal(1, stats.Active.UrgentHigh);
        Assert.Equal(0, stats.Active.NeverContacted);
    }

    [Fact]
    public async Task Stats_ColdBreakdown_AndPostAggregates()
    {
        var stats = await _svc.GetStatsAsync(_tenant, _allBranches, null, null, null);
        Assert.Equal(2, stats.Cold.Total);
        Assert.Equal(1, stats.Cold.Declined);
        Assert.Equal(1, stats.Cold.ReferredElsewhere);

        Assert.Equal(2, stats.PostSurgery.Total);
        Assert.Equal(1, stats.PostSurgery.Over30Days);
        Assert.Equal(1, stats.PostSurgery.PendingPostOpVisits);
        Assert.NotNull(stats.PostSurgery.AverageDaysSinceDischarge);
    }

    [Fact]
    public async Task Stats_IntentionAppliesToActiveOnly()
    {
        var stats = await _svc.GetStatsAsync(_tenant, _allBranches, null, "Undecided", null);
        Assert.Equal(1, stats.Active.Total);
        // Cold/post unchanged by intention
        Assert.Equal(2, stats.Cold.Total);
        Assert.Equal(2, stats.PostSurgery.Total);
    }

    [Fact]
    public async Task NoDueDateFields_OnDtos()
    {
        var active = await _svc.GetActiveAsync(_tenant, _allBranches, null, null, 1, 1);
        var props = active.Items[0].GetType().GetProperties().Select(p => p.Name).ToHashSet();
        Assert.DoesNotContain("DueDate", props);
        Assert.DoesNotContain("FollowUpDueDate", props);
        Assert.DoesNotContain("NextDueDate", props);

        var statsProps = typeof(AuthService.Models.Counselor.FollowupStatsDto)
            .GetProperties().Select(p => p.Name);
        Assert.DoesNotContain("DueDate", statsProps);
    }

    [Fact]
    public async Task Stats_OrphanAudit_CountsKnownOrphansOutsideActive()
    {
        var stats = await _svc.GetStatsAsync(_tenant, _allBranches, null, null, null);
        Assert.True(stats.OrphanIntentions.Total >= 1);
        Assert.Equal(1, stats.OrphanIntentions.WillingNow);
        Assert.DoesNotContain(
            (await _svc.GetActiveAsync(_tenant, _allBranches, null, null, 1, 50)).Items,
            i => i.PatientIntention == "WillingNow");
    }

    [Fact]
    public async Task EmptyBranchScope_ReturnsEmpty_NotTenantWide()
    {
        var result = await _svc.GetActiveAsync(_tenant, Array.Empty<Guid>(), null, null, 1, 50);
        Assert.Equal(0, result.Total);
        Assert.Empty(result.Items);
    }

    // ── Authorization attributes ─────────────────────────────────────────────

    [Theory]
    [InlineData(nameof(CounselingController.GetActiveFollowups))]
    [InlineData(nameof(CounselingController.GetColdLeads))]
    [InlineData(nameof(CounselingController.GetPostSurgeryFollowups))]
    [InlineData(nameof(CounselingController.GetFollowupStats))]
    public void FollowupReadEndpoints_RequireCounselingSessionsRead(string methodName)
    {
        var method = typeof(CounselingController).GetMethod(methodName);
        Assert.NotNull(method);
        var attr = method!.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(attr);
        Assert.Equal("counseling_sessions.read", attr!.PermissionCode);
    }

    [Fact]
    public void FollowupStats_HasHttpGetRoute()
    {
        var method = typeof(CounselingController).GetMethod(nameof(CounselingController.GetFollowupStats));
        var httpGet = method!.GetCustomAttribute<HttpGetAttribute>();
        Assert.NotNull(httpGet);
        Assert.Equal("followups/stats", httpGet!.Template);
    }
}
