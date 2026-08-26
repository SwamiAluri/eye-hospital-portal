using CcmsApi.Models.Domain;
using CcmsApi.Services;
using CcmsApi.Tests.Fixtures;
using FluentAssertions;
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

    private CcmsCoverageCase SeedWaitingCase(
        string caseNumber, string patient, string insurer, string state)
    {
        var c = _fix.SeedCase(state: state, caseNumber: caseNumber);
        c.PatientName = patient;
        c.InsurerName = insurer;
        _fix.Db.SaveChanges();
        return c;
    }
}
