using CcmsApi.Data;
using CcmsApi.Models.Domain;
using CcmsApi.Services;
using CcmsApi.Tests.Fixtures;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace CcmsApi.Tests.ServiceTests;

public sealed class PreAuthOpsQueueTests : IDisposable
{
    private readonly InMemoryDbFixture _fix = new();
    private readonly PreAuthOpsQueueService _svc;

    public PreAuthOpsQueueTests()
    {
        _svc = new PreAuthOpsQueueService(_fix.Db);
    }

    public void Dispose() => _fix.Dispose();

    [Fact]
    public async Task Queue_IncludesActiveAuth_WhenCaseIsWaitingApproval()
    {
        var c = SeedWaitingCase("CC-WAIT", "Meena Iyer", "Star Health", "WAITING_APPROVAL");
        var auth = _fix.SeedAuthorization(c.Id, requestedAmount: 42_000m, status: "active");
        auth.SubmittedAt = DateTime.UtcNow.AddDays(-3);
        _fix.Db.SaveChanges();

        var queue = await _svc.GetQueueAsync(_fix.TenantId);

        queue.Should().ContainSingle(i => i.AuthId == auth.Id);
        var item = queue.Single(i => i.AuthId == auth.Id);
        item.Status.Should().Be("WAITING_APPROVAL");
        item.CaseState.Should().Be("WAITING_APPROVAL");
        item.CaseNumber.Should().Be("CC-WAIT");
        item.PatientName.Should().Be("Meena Iyer");
        item.InsurerName.Should().Be("Star Health");
        item.RequestedAmount.Should().Be(42_000m);
        item.DaysWaiting.Should().BeGreaterThanOrEqualTo(2);
    }

    [Fact]
    public async Task Queue_ExcludesActiveAuth_WhenCaseIsApproved()
    {
        var c = SeedWaitingCase("CC-OK", "Done", "Star", "APPROVED");
        _fix.SeedAuthorization(c.Id, status: "active");

        var queue = await _svc.GetQueueAsync(_fix.TenantId);

        queue.Should().BeEmpty();
    }

    [Fact]
    public async Task Queue_DoesNotMatchAuthorizationLifecycleStatus_ToWorkflowCodes()
    {
        // Old bug: filter a.Status IN (PREAUTH_SENT, …) so this row appeared even when
        // the case was not waiting. Case is CASE_OPEN; auth.Status is the workflow code.
        var c = SeedWaitingCase("CC-OPEN", "Wrong", "Star", "CASE_OPEN");
        _fix.SeedAuthorization(c.Id, status: "PREAUTH_SENT");

        var queue = await _svc.GetQueueAsync(_fix.TenantId);

        queue.Should().BeEmpty();
    }

    [Fact]
    public async Task Queue_IncludesClarificationAndResubmitted()
    {
        var wait = SeedWaitingCase("CC-1", "A", "Star", "WAITING_APPROVAL");
        var query = SeedWaitingCase("CC-2", "B", "Niva", "CLARIFICATION_REQUIRED");
        var sent = SeedWaitingCase("CC-3", "C", "Star", "PREAUTH_SENT");
        _fix.SeedAuthorization(wait.Id, status: "active");
        _fix.SeedAuthorization(query.Id, status: "active");
        _fix.SeedAuthorization(sent.Id, status: "active");

        var queue = await _svc.GetQueueAsync(_fix.TenantId);

        queue.Select(i => i.Status).Should().BeEquivalentTo(
            "WAITING_APPROVAL", "CLARIFICATION_REQUIRED", "PREAUTH_SENT");
    }

    [Fact]
    public async Task Summary_CountsByCaseCurrentState_NotAuthLifecycle()
    {
        var wait = SeedWaitingCase("CC-W", "A", "Star", "WAITING_APPROVAL");
        var query = SeedWaitingCase("CC-Q", "B", "Star", "CLARIFICATION_REQUIRED");
        _fix.SeedAuthorization(wait.Id, status: "active");
        _fix.SeedAuthorization(query.Id, status: "active");

        var summary = await _svc.GetSummaryAsync(_fix.TenantId);

        summary.Total.Should().Be(2);
        summary.WaitingApproval.Should().Be(1);
        summary.ClarificationDue.Should().Be(1);
        summary.ByStatus.Should().Contain(s => s.Status == "WAITING_APPROVAL" && s.Count == 1);
    }

    [Fact]
    public async Task Queue_ExcludesDeletedAuthAndOtherTenant()
    {
        var c = SeedWaitingCase("CC-DEL", "A", "Star", "WAITING_APPROVAL");
        var deleted = _fix.SeedAuthorization(c.Id, status: "active");
        deleted.DeletedAt = DateTime.UtcNow;
        var other = new CcmsCoverageAuthorization
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.NewGuid(),
            CoverageCase_Id = c.Id,
            AuthorizationType = "preauth",
            RequestedAmount = 1m,
            Status = "active",
            ProcessStatus = "pending",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = _fix.ActorId,
            UpdatedByUserId = _fix.ActorId,
        };
        _fix.Db.CoverageAuthorizations.Add(other);
        _fix.Db.SaveChanges();

        var queue = await _svc.GetQueueAsync(_fix.TenantId);

        queue.Should().BeEmpty();
    }

    [Fact]
    public async Task Queue_DetectsInboundDraft_WhenMetadataContainsDraftReady()
    {
        var c = SeedWaitingCase("CC-DR", "Draft", "Star", "WAITING_APPROVAL");
        var auth = _fix.SeedAuthorization(c.Id, status: "active");
        SeedInboundLog(c.Id, """{"reviewStatus":"draft_ready","parseDraft":{}}""");

        var queue = await _svc.GetQueueAsync(_fix.TenantId);

        var item = queue.Should().ContainSingle(i => i.AuthId == auth.Id).Subject;
        item.HasInboundDraft.Should().BeTrue();
        item.Status.Should().Be("WAITING_APPROVAL");
    }

    [Fact]
    public async Task Queue_DoesNotDetectInboundDraft_WhenMetadataLacksDraftReady()
    {
        var c = SeedWaitingCase("CC-ND", "NoDraft", "Star", "WAITING_APPROVAL");
        var auth = _fix.SeedAuthorization(c.Id, status: "active");
        SeedInboundLog(c.Id, """{"reviewStatus":"needs_review"}""");

        var queue = await _svc.GetQueueAsync(_fix.TenantId);

        queue.Should().ContainSingle(i => i.AuthId == auth.Id)
            .Which.HasInboundDraft.Should().BeFalse();
    }

    [Fact]
    public async Task Queue_NullMetadata_DoesNotThrow_AndIsNotDetected()
    {
        var c = SeedWaitingCase("CC-NULL", "NullMeta", "Star", "WAITING_APPROVAL");
        var auth = _fix.SeedAuthorization(c.Id, status: "active");
        SeedInboundLog(c.Id, metadataJson: null);

        var queue = await _svc.GetQueueAsync(_fix.TenantId);

        queue.Should().ContainSingle(i => i.AuthId == auth.Id)
            .Which.HasInboundDraft.Should().BeFalse();
    }

    [Fact]
    public async Task Queue_MultipleInboundLogs_DoesNotDuplicateQueueRows()
    {
        var c = SeedWaitingCase("CC-DUP", "Dup", "Star", "WAITING_APPROVAL");
        var auth = _fix.SeedAuthorization(c.Id, status: "active");
        SeedInboundLog(c.Id, """{"reviewStatus":"draft_ready"}""");
        SeedInboundLog(c.Id, """{"reviewStatus":"draft_ready","note":"second"}""");

        var queue = await _svc.GetQueueAsync(_fix.TenantId);

        queue.Should().ContainSingle(i => i.AuthId == auth.Id);
        queue.Single(i => i.AuthId == auth.Id).HasInboundDraft.Should().BeTrue();
    }

    [Fact]
    public async Task Summary_InboundToReview_CountsDistinctCasesWithDraftReady()
    {
        var withDraft = SeedWaitingCase("CC-S1", "A", "Star", "WAITING_APPROVAL");
        var without = SeedWaitingCase("CC-S2", "B", "Star", "PREAUTH_SENT");
        _fix.SeedAuthorization(withDraft.Id, status: "active");
        _fix.SeedAuthorization(without.Id, status: "active");
        SeedInboundLog(withDraft.Id, """{"reviewStatus":"draft_ready"}""");
        SeedInboundLog(withDraft.Id, """{"reviewStatus":"draft_ready"}""");
        SeedInboundLog(without.Id, """{"reviewStatus":"needs_review"}""");

        var summary = await _svc.GetSummaryAsync(_fix.TenantId);

        summary.Total.Should().Be(2);
        summary.InboundToReview.Should().Be(1);
        summary.ByStatus.Should().Contain(s => s.Status == "WAITING_APPROVAL" && s.Count == 1);
        summary.ByStatus.Should().Contain(s => s.Status == "PREAUTH_SENT" && s.Count == 1);
    }

    [Fact]
    public async Task Queue_StatusComesFromCaseCurrentState_NotAuthorizationStatus()
    {
        var c = SeedWaitingCase("CC-ST", "State", "Star", "CLARIFICATION_REQUIRED");
        var auth = _fix.SeedAuthorization(c.Id, status: "active");
        auth.Status = "active";
        _fix.Db.SaveChanges();

        var queue = await _svc.GetQueueAsync(_fix.TenantId);

        var item = queue.Should().ContainSingle(i => i.AuthId == auth.Id).Subject;
        item.Status.Should().Be("CLARIFICATION_REQUIRED");
        item.CaseState.Should().Be("CLARIFICATION_REQUIRED");
    }

    [Fact]
    public void InboundDraftCandidateQuery_DoesNotEmitJsonbLike()
    {
        // Regression for PostgreSQL 42883: operator does not exist: jsonb ~~ unknown.
        // string.Contains on MetadataJson must not be translated into the SQL candidate query.
        var options = new DbContextOptionsBuilder<CcmsDbContext>()
            .UseNpgsql("Host=127.0.0.1;Database=ccms_query_shape;Username=x;Password=x")
            .Options;
        using var db = new CcmsDbContext(options);
        var tenantId = Guid.NewGuid();
        var caseIds = new List<Guid> { Guid.NewGuid() };

        var sql = PreAuthOpsQueueService
            .BuildInboundDraftCandidateQuery(db, tenantId, caseIds)
            .Select(l => l.CoverageCase_Id)
            .ToQueryString();

        sql.Should().NotContain(" LIKE ", because: "jsonb LIKE is invalid in PostgreSQL");
        sql.Should().NotContain("~~", because: "~~ is PostgreSQL LIKE");
        sql.Should().NotContain("draft_ready",
            because: "draft_ready matching is evaluated after materialization, not via SQL LIKE");
    }

    [Theory]
    [InlineData("""{"reviewStatus":"draft_ready"}""", true)]
    [InlineData("""{"reviewStatus":"needs_review"}""", false)]
    [InlineData(null, false)]
    [InlineData("", false)]
    public void IsInboundDraftReadyMetadata_MatchesExpected(string? json, bool expected)
    {
        PreAuthOpsQueueService.IsInboundDraftReadyMetadata(json).Should().Be(expected);
    }

    private CcmsCoverageCase SeedWaitingCase(
        string caseNumber, string patient, string insurer, string state)
    {
        var c = _fix.SeedCase(state: state, caseNumber: caseNumber);
        c.PatientName = patient;
        c.InsurerName = insurer;
        _fix.Db.SaveChanges();
        return c;
    }

    private void SeedInboundLog(Guid caseId, string? metadataJson)
    {
        _fix.Db.CommunicationLogs.Add(new CcmsCommunicationLog
        {
            Id = Guid.NewGuid(),
            TenantId = _fix.TenantId,
            CoverageCase_Id = caseId,
            CommunicationType = "email",
            Direction = "inbound",
            RecipientType = "tpa",
            DeliveryStatus = "received",
            SentAt = DateTime.UtcNow,
            MetadataJson = metadataJson,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = _fix.ActorId,
            UpdatedByUserId = _fix.ActorId,
            Status = "active",
        });
        _fix.Db.SaveChanges();
    }
}
