using CcmsApi.Models.Dtos;
using CcmsApi.Services;
using CcmsApi.Tests.Fixtures;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace CcmsApi.Tests.ServiceTests;

public class CoverageCaseServiceTests : IDisposable
{
    private readonly InMemoryDbFixture _fix = new();
    private readonly CoverageCaseService _svc;
    private readonly Mock<IWorkflowEngine> _workflowMock = new();

    public CoverageCaseServiceTests()
    {
        _workflowMock
            .Setup(w => w.StartAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(),
                It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CcmsApi.Models.Domain.CcmsWorkflowInstance
            {
                Id           = Guid.NewGuid(),
                TenantId     = Guid.NewGuid(),
                EntityId     = Guid.NewGuid(),
                EntityType   = "coverage_case",
                CurrentState = "CASE_OPEN",
                Status       = "active",
                CreatedAt    = DateTime.UtcNow,
                UpdatedAt    = DateTime.UtcNow,
            });

        _workflowMock
            .Setup(w => w.FireAsync(It.IsAny<Guid>(), It.IsAny<string>(),
                                    It.IsAny<Guid>(), It.IsAny<string?>(),
                                    It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TransitionResult(true, "CASE_OPEN", "CASE_OPEN", "NOOP"));

        var fySvc = new FinancialYearService(_fix.Db);

        _svc = new CoverageCaseService(
            _fix.Db,
            _workflowMock.Object,
            fySvc,
            NullLogger<CoverageCaseService>.Instance);
    }

    // ── GetByIdAsync ─────────────────────────────────────────────────────────

    [Fact]
    public async Task GetByIdAsync_ExistingCase_ReturnsCoverageCaseDetailDto()
    {
        var seeded = _fix.SeedCase(caseNumber: "CCMS-DETAIL-01");

        var dto = await _svc.GetByIdAsync(seeded.Id);

        dto.Should().NotBeNull();
        dto!.Id.Should().Be(seeded.Id);
        dto.CaseNumber.Should().Be("CCMS-DETAIL-01");
        dto.CurrentState.Should().Be("CASE_OPEN");
        dto.Should().BeOfType<CoverageCaseDetailDto>();
    }

    [Fact]
    public async Task GetByIdAsync_UnknownId_ReturnsNull()
    {
        var dto = await _svc.GetByIdAsync(Guid.NewGuid());
        dto.Should().BeNull();
    }

    [Fact]
    public async Task GetByIdAsync_SoftDeletedCase_ReturnsNull()
    {
        var seeded = _fix.SeedCase();
        seeded.DeletedAt = DateTime.UtcNow;
        await _fix.Db.SaveChangesAsync();

        var dto = await _svc.GetByIdAsync(seeded.Id);
        dto.Should().BeNull();
    }

    // ── ListAsync ────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListAsync_ReturnsPagedSummariesOfCorrectType()
    {
        _fix.SeedCase(caseNumber: "CCMS-LIST-A");
        _fix.SeedCase(caseNumber: "CCMS-LIST-B");

        var result = await _svc.ListAsync(
            tenantId: _fix.TenantId,
            page: 1, pageSize: 10);

        result.Items.Should().HaveCountGreaterThanOrEqualTo(2);
        result.Items.Should().AllSatisfy(dto =>
            dto.Should().BeOfType<CoverageCaseSummaryDto>());
    }

    [Fact]
    public async Task ListAsync_FilterByState_ReturnsOnlyMatchingCases()
    {
        _fix.SeedCase(state: "PREAUTH_SENT",  caseNumber: "CCMS-FILTER-PA");
        _fix.SeedCase(state: "CASE_OPEN",     caseNumber: "CCMS-FILTER-OP");

        var result = await _svc.ListAsync(
            tenantId: _fix.TenantId,
            state: "PREAUTH_SENT",
            page: 1, pageSize: 10);

        result.Items.Should().OnlyContain(dto => dto.CurrentState == "PREAUTH_SENT");
    }

    [Fact]
    public async Task ListAsync_Pagination_ReturnsDistinctPages()
    {
        for (var i = 1; i <= 5; i++)
            _fix.SeedCase(caseNumber: $"CCMS-PAGE-{i:D2}");

        var page1 = await _svc.ListAsync(_fix.TenantId, page: 1, pageSize: 2);
        var page2 = await _svc.ListAsync(_fix.TenantId, page: 2, pageSize: 2);

        page1.Items.Count.Should().Be(2);
        page2.Items.Count.Should().BeGreaterThanOrEqualTo(2);
        page1.Items.Select(i => i.Id).Should().NotIntersectWith(
            page2.Items.Select(i => i.Id));
    }

    [Fact]
    public async Task ListAsync_SearchByPatientName_FiltersCorrectly()
    {
        _fix.SeedCase(caseNumber: "CCMS-SRCH-A");

        var result = await _svc.ListAsync(
            _fix.TenantId,
            search: "CCMS-SRCH-A",
            page: 1, pageSize: 10);

        result.Items.Should().ContainSingle(dto => dto.CaseNumber == "CCMS-SRCH-A");
    }

    public void Dispose() => _fix.Dispose();
}
