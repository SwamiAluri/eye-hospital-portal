using CcmsApi.Models.Dtos;
using CcmsApi.Services;
using CcmsApi.Tests.Fixtures;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace CcmsApi.Tests.ServiceTests;

public class EnhancementServiceTests : IDisposable
{
    private readonly InMemoryDbFixture _fix = new();
    private readonly EnhancementService _svc;
    private readonly Mock<AuthServiceClient> _authMock;

    public EnhancementServiceTests()
    {
        var workflowMock = new Mock<IWorkflowEngine>();
        workflowMock
            .Setup(w => w.FireAsync(It.IsAny<Guid>(), It.IsAny<string>(),
                                    It.IsAny<Guid>(), It.IsAny<string?>(),
                                    It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TransitionResult(true, "CASE_OPEN", "ENHANCEMENT_REQUESTED", "REQUEST_ENHANCEMENT"));

        _authMock = new Mock<AuthServiceClient>(
            MockBehavior.Loose,
            new HttpClient(),
            NullLogger<AuthServiceClient>.Instance);
        _authMock
            .Setup(a => a.NotifyDepartmentAsync(
                It.IsAny<Guid>(), It.IsAny<Guid?>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _svc = new EnhancementService(
            _fix.Db, workflowMock.Object, _authMock.Object,
            NullLogger<EnhancementService>.Instance);
    }

    [Fact]
    public void EvaluateGap_WhenEligibleExceedsApproved_RecommendsRequest()
    {
        var gap = EnhancementService.EvaluateGap(10_000m, 15_000m, hasOpenEnhancement: false);
        gap.NeedsEnhancement.Should().BeTrue();
        gap.GapAmount.Should().Be(5_000m);
        gap.Recommendation.Should().Be("request_enhancement");
    }

    [Fact]
    public void EvaluateGap_WhenOpenExists_RecommendsAwait()
    {
        var gap = EnhancementService.EvaluateGap(10_000m, 15_000m, hasOpenEnhancement: true);
        gap.Recommendation.Should().Be("await_open_enhancement");
    }

    [Fact]
    public async Task CreateAsync_ReturnsEnhancementRequestDto()
    {
        var c = _fix.SeedCase();
        c.ApprovedAmount = 20_000m;
        await _fix.Db.SaveChangesAsync();

        var req = new CreateEnhancementRequest(
            EnhancementType: "amount",
            RequestedAmount: 15_000m,
            Reason: "Patient room upgrade");

        var dto = await _svc.CreateAsync(c.Id, _fix.ActorId, req);

        dto.Should().NotBeNull();
        dto.Should().BeOfType<EnhancementRequestDto>();
        dto.RequestedAmount.Should().Be(15_000m);
        dto.EnhancementType.Should().Be("amount");
        dto.Status.Should().Be("active");
        dto.CoverageCase_Id.Should().Be(c.Id);
        dto.SubmittedAt.Should().BeNull();

        var events = await _fix.Db.EnhancementEvents
            .Where(e => e.EnhancementRequestId == dto.Id)
            .Select(e => e.EventType)
            .ToListAsync();
        events.Should().Contain("COVERAGE_ENHANCEMENT_REQUIRED");
        events.Should().Contain("ENHANCEMENT_CREATED");
    }

    [Fact]
    public async Task CreateAsync_SecondOpen_ThrowsConflict()
    {
        var c = _fix.SeedCase();
        await _svc.CreateAsync(c.Id, _fix.ActorId, new CreateEnhancementRequest("amount", 1_000m, "first"));
        Func<Task> act = () => _svc.CreateAsync(c.Id, _fix.ActorId, new CreateEnhancementRequest("amount", 2_000m, "second"));
        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task CreateAsync_UnknownCase_ThrowsKeyNotFoundException()
    {
        var req = new CreateEnhancementRequest("amount", 10_000m, null);
        Func<Task> act = () => _svc.CreateAsync(Guid.NewGuid(), _fix.ActorId, req);
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task GetByCaseIdAsync_ReturnsDtos_OrderedDescending()
    {
        var c = _fix.SeedCase();
        _fix.SeedEnhancement(c.Id, 5_000m);
        _fix.SeedEnhancement(c.Id, 10_000m);

        var dtos = await _svc.GetByCaseIdAsync(c.Id);

        dtos.Should().HaveCount(2);
        dtos.Should().AllSatisfy(dto => dto.Should().BeOfType<EnhancementRequestDto>());
        dtos[0].RequestedAmount.Should().BeGreaterThanOrEqualTo(dtos[1].RequestedAmount);
    }

    [Fact]
    public async Task GetByCaseIdAsync_EmptyCase_ReturnsEmptyList()
    {
        var c = _fix.SeedCase();
        var dtos = await _svc.GetByCaseIdAsync(c.Id);
        dtos.Should().BeEmpty();
    }

    [Fact]
    public async Task SubmitToTpaAsync_MovesActiveToSubmitted()
    {
        var c = _fix.SeedCase();
        var created = await _svc.CreateAsync(
            c.Id, _fix.ActorId,
            new CreateEnhancementRequest("amount", 5_000m, "gap"));

        var dto = await _svc.SubmitToTpaAsync(
            created.Id, _fix.ActorId,
            new SubmitEnhancementRequest("TPA-REF-1", "sent via email"));

        dto.Status.Should().Be("submitted");
        dto.SubmittedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task DecideAsync_WhileActive_WithoutOverride_Throws()
    {
        var c = _fix.SeedCase();
        var created = await _svc.CreateAsync(
            c.Id, _fix.ActorId,
            new CreateEnhancementRequest("amount", 5_000m, "gap"));

        Func<Task> act = () => _svc.DecideAsync(
            created.Id, _fix.ActorId,
            new DecideEnhancementRequest(true, 5_000m));

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Submit*");
    }

    [Fact]
    public async Task DecideAsync_Approved_AfterSubmit_UpdatesCaseApprovedAmount()
    {
        var c = _fix.SeedCase();
        c.ApprovedAmount = 10_000m;
        await _fix.Db.SaveChangesAsync();

        var created = await _svc.CreateAsync(
            c.Id, _fix.ActorId,
            new CreateEnhancementRequest("amount", 5_000m, "consumables"));
        await _svc.SubmitToTpaAsync(
            created.Id, _fix.ActorId,
            new SubmitEnhancementRequest("TPA-99", null));

        var decision = new DecideEnhancementRequest(
            Approved: true,
            ApprovedAmount: 4_000m,
            TpaReferenceNumber: "TPA-99");
        var dto = await _svc.DecideAsync(created.Id, _fix.ActorId, decision);

        dto.Status.Should().Be("approved");
        dto.ApprovedAmount.Should().Be(4_000m);
        dto.DecisionBy.Should().Be(_fix.ActorId);
        dto.DecidedAt.Should().NotBeNull();

        var reloaded = await _fix.Db.CoverageCases.FindAsync(c.Id);
        reloaded!.ApprovedAmount.Should().Be(14_000m); // original 10k + additional 4k
    }

    [Fact]
    public async Task DecideAsync_HospitalOverride_RequiresReason_AndUpdatesProjection()
    {
        var c = _fix.SeedCase();
        c.ApprovedAmount = 10_000m;
        await _fix.Db.SaveChangesAsync();

        var created = await _svc.CreateAsync(
            c.Id, _fix.ActorId,
            new CreateEnhancementRequest("amount", 3_000m, "urgent"));

        Func<Task> missingReason = () => _svc.DecideAsync(
            created.Id, _fix.ActorId,
            new DecideEnhancementRequest(true, 3_000m, HospitalOverride: true));
        await missingReason.Should().ThrowAsync<ArgumentException>();

        var dto = await _svc.DecideAsync(
            created.Id, _fix.ActorId,
            new DecideEnhancementRequest(
                true, 3_000m,
                HospitalOverride: true,
                OverrideReason: "Emergency FC desk confirmation"));

        dto.Status.Should().Be("approved");
        var reloaded = await _fix.Db.CoverageCases.FindAsync(c.Id);
        reloaded!.ApprovedAmount.Should().Be(13_000m);
    }

    [Fact]
    public async Task DecideAsync_Rejected_AfterSubmit_DoesNotChangeCaseApprovedAmount()
    {
        var c = _fix.SeedCase();
        c.ApprovedAmount = 10_000m;
        await _fix.Db.SaveChangesAsync();

        var created = await _svc.CreateAsync(
            c.Id, _fix.ActorId,
            new CreateEnhancementRequest("amount", 5_000m, "upgrade"));
        await _svc.SubmitToTpaAsync(created.Id, _fix.ActorId, new SubmitEnhancementRequest(null, null));

        await _svc.DecideAsync(created.Id, _fix.ActorId, new DecideEnhancementRequest(false, 0m));

        var reloaded = await _fix.Db.CoverageCases.FindAsync(c.Id);
        reloaded!.ApprovedAmount.Should().Be(10_000m);
    }

    [Fact]
    public async Task DecideAsync_Rejected_SetsStatusRejected()
    {
        var c = _fix.SeedCase();
        var created = await _svc.CreateAsync(
            c.Id, _fix.ActorId,
            new CreateEnhancementRequest("amount", 10_000m, "x"));
        await _svc.SubmitToTpaAsync(created.Id, _fix.ActorId, new SubmitEnhancementRequest(null, null));

        var dto = await _svc.DecideAsync(
            created.Id, _fix.ActorId,
            new DecideEnhancementRequest(Approved: false, ApprovedAmount: 0m));

        dto.Status.Should().Be("rejected");
    }

    [Fact]
    public async Task DecideAsync_UnknownEnhancement_ThrowsKeyNotFoundException()
    {
        var decision = new DecideEnhancementRequest(true, 5_000m);
        Func<Task> act = () => _svc.DecideAsync(Guid.NewGuid(), _fix.ActorId, decision);
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task ListAsync_ReturnsPendingAcrossCases()
    {
        var c1 = _fix.SeedCase(caseNumber: "CCMS-A");
        var c2 = _fix.SeedCase(caseNumber: "CCMS-B");
        await _svc.CreateAsync(c1.Id, _fix.ActorId, new CreateEnhancementRequest("amount", 1_000m, "a"));
        await _svc.CreateAsync(c2.Id, _fix.ActorId, new CreateEnhancementRequest("amount", 2_000m, "b"));

        var list = await _svc.ListAsync(_fix.TenantId, status: "active");
        list.Should().HaveCount(2);
        list.Should().OnlyContain(x => x.Enhancement.Status == "active");
    }

    [Fact]
    public async Task SuggestFromEligibleAmountAsync_CreatesWhenGap_WithBillSource()
    {
        var c = _fix.SeedCase();
        c.ApprovedAmount = 8_000m;
        await _fix.Db.SaveChangesAsync();

        var drafted = await _svc.SuggestFromEligibleAmountAsync(
            c.Id, eligibleAmount: 12_000m, _fix.ActorId, "bill_finalized");

        drafted.Should().NotBeNull();
        drafted!.RequestedAmount.Should().Be(4_000m);

        var entity = await _fix.Db.EnhancementRequests.FindAsync(drafted.Id);
        entity!.ReasonJson.Should().Contain("bill_finalized");

        var again = await _svc.SuggestFromEligibleAmountAsync(
            c.Id, eligibleAmount: 12_000m, _fix.ActorId, "bill_finalized");
        again.Should().BeNull(); // open enhancement exists
    }

    public void Dispose() => _fix.Dispose();
}
