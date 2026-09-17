using CcmsApi.Models.Dtos;
using CcmsApi.Services;
using CcmsApi.Tests.Fixtures;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace CcmsApi.Tests.ServiceTests;

public class CoverageCaseServiceTests : IDisposable
{
    private readonly InMemoryDbFixture _fx = new();
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

        var fySvc = new FinancialYearService(_fx.Db);

        _svc = new CoverageCaseService(
            _fx.Db,
            _workflowMock.Object,
            fySvc,
            NullLogger<CoverageCaseService>.Instance);
    }

    // ── GetByIdAsync ─────────────────────────────────────────────────────────

    [Fact]
    public async Task GetByIdAsync_ExistingCase_ReturnsCoverageCaseDetailDto()
    {
        var seeded = _fx.SeedCase(caseNumber: "CCMS-DETAIL-01");

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
        var seeded = _fx.SeedCase();
        seeded.DeletedAt = DateTime.UtcNow;
        await _fx.Db.SaveChangesAsync();

        var dto = await _svc.GetByIdAsync(seeded.Id);
        dto.Should().BeNull();
    }

    // ── ListAsync ────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListAsync_ReturnsPagedSummariesOfCorrectType()
    {
        _fx.SeedCase(caseNumber: "CCMS-LIST-A");
        _fx.SeedCase(caseNumber: "CCMS-LIST-B");

        var result = await _svc.ListAsync(
            tenantId: _fx.TenantId,
            page: 1, pageSize: 10);

        result.Items.Should().HaveCountGreaterThanOrEqualTo(2);
        result.Items.Should().AllSatisfy(dto =>
            dto.Should().BeOfType<CoverageCaseSummaryDto>());
    }

    [Fact]
    public async Task ListAsync_FilterByState_ReturnsOnlyMatchingCases()
    {
        _fx.SeedCase(state: "PREAUTH_SENT",  caseNumber: "CCMS-FILTER-PA");
        _fx.SeedCase(state: "CASE_OPEN",     caseNumber: "CCMS-FILTER-OP");

        var result = await _svc.ListAsync(
            tenantId: _fx.TenantId,
            state: "PREAUTH_SENT",
            page: 1, pageSize: 10);

        result.Items.Should().OnlyContain(dto => dto.CurrentState == "PREAUTH_SENT");
    }

    [Fact]
    public async Task ListAsync_Pagination_ReturnsDistinctPages()
    {
        for (var i = 1; i <= 5; i++)
            _fx.SeedCase(caseNumber: $"CCMS-PAGE-{i:D2}");

        var page1 = await _svc.ListAsync(_fx.TenantId, page: 1, pageSize: 2);
        var page2 = await _svc.ListAsync(_fx.TenantId, page: 2, pageSize: 2);

        page1.Items.Count.Should().Be(2);
        page2.Items.Count.Should().BeGreaterThanOrEqualTo(2);
        page1.Items.Select(i => i.Id).Should().NotIntersectWith(
            page2.Items.Select(i => i.Id));
    }

    [Fact]
    public async Task ListAsync_SearchByPatientName_FiltersCorrectly()
    {
        _fx.SeedCase(caseNumber: "CCMS-SRCH-A");

        var result = await _svc.ListAsync(
            _fx.TenantId,
            search: "CCMS-SRCH-A",
            page: 1, pageSize: 10);

        result.Items.Should().ContainSingle(dto => dto.CaseNumber == "CCMS-SRCH-A");
    }

    // ── PatchDraftAsync visit-policy uniqueness (Phase 3G) ───────────────────
    // Limitation: in-memory EF does not prove true DB concurrency under parallel
    // writers; these tests cover repeated/sequential SaveDraft idempotence.

    private static PatchCoverageCaseRequest DraftWithPolicy(
        string policyNumber,
        string? insuredName = "Samuel Paul") =>
        new(
            InsurerName: "Star Health",
            InsuranceProviderId: null,
            PolicyNumber: policyNumber,
            MembershipNumber: null,
            InsuredName: insuredName,
            RelationshipToInsured: "self",
            SumInsured: null,
            CoPay: null,
            RoomClassEntitlement: null,
            NetworkHospitalConfirmed: null,
            PolicyExpiry: null,
            FinancialYearId: null,
            CoverageNotes: null,
            SurgeryDate: null,
            DiagnosisCode: null,
            ProcedureCode: null,
            UrgencyLevel: null,
            EstimatedSurgery: null,
            EstimatedRoom: null,
            EstimatedMedicines: null,
            EstimatedLab: null,
            EstimatedOther: null,
            EstimatedAmount: null,
            TpaContactPerson: null,
            TpaContactEmail: null,
            TpaContactPhone: null,
            ClinicalNotes: null,
            PaymentType: "Insurance",
            IsDraft: true,
            CounsellorDraftJson: null);

    [Fact]
    public async Task PatchDraft_WhenNoPolicies_CreatesPrimaryOnce()
    {
        var c = _fx.SeedCase();

        await _svc.PatchDraftAsync(c.Id, _fx.ActorId, DraftWithPolicy("56/B7890/2026/98765"));

        var policies = _fx.Db.VisitInsurancePolicies
            .Where(p => p.CoverageCase_Id == c.Id && p.DeletedAt == null)
            .ToList();
        policies.Should().ContainSingle();
        policies[0].PolicyNumber.Should().Be("56/B7890/2026/98765");
        policies[0].IsPrimary.Should().BeTrue();
    }

    [Fact]
    public async Task PatchDraft_TwiceWithSamePolicyNumber_DoesNotDuplicate()
    {
        var c = _fx.SeedCase();
        var req = DraftWithPolicy("POL-SAME");

        await _svc.PatchDraftAsync(c.Id, _fx.ActorId, req);
        await _svc.PatchDraftAsync(c.Id, _fx.ActorId, req);

        _fx.Db.VisitInsurancePolicies
            .Count(p => p.CoverageCase_Id == c.Id && p.DeletedAt == null)
            .Should().Be(1);
    }

    [Fact]
    public async Task PatchDraft_AfterExistingNonPrimarySameNumber_ReusesRow_NoInsert()
    {
        var c = _fx.SeedCase();
        var existing = _fx.SeedPolicy(c.Id, "POL-EXIST", isPrimary: false);

        await _svc.PatchDraftAsync(c.Id, _fx.ActorId, DraftWithPolicy("pol-exist", "Updated Name"));

        var policies = _fx.Db.VisitInsurancePolicies
            .Where(p => p.CoverageCase_Id == c.Id && p.DeletedAt == null)
            .ToList();
        policies.Should().ContainSingle();
        policies[0].Id.Should().Be(existing.Id);
        policies[0].InsuredName.Should().Be("Updated Name");
        policies[0].IsPrimary.Should().BeTrue();
    }

    [Fact]
    public async Task PatchDraft_AfterExistingPrimary_UpdatesPrimary_NoInsert()
    {
        var c = _fx.SeedCase();
        var primary = _fx.SeedPolicy(c.Id, "POL-OLD", isPrimary: true);

        await _svc.PatchDraftAsync(c.Id, _fx.ActorId, DraftWithPolicy("POL-NEW", "Primary Insured"));

        var policies = _fx.Db.VisitInsurancePolicies
            .Where(p => p.CoverageCase_Id == c.Id && p.DeletedAt == null)
            .ToList();
        policies.Should().ContainSingle();
        policies[0].Id.Should().Be(primary.Id);
        policies[0].PolicyNumber.Should().Be("POL-NEW");
        policies[0].InsuredName.Should().Be("Primary Insured");
    }

    [Fact]
    public async Task PatchDraft_MatchingNumberAmongMultiple_UpdatesMatch_DoesNotInsert()
    {
        var c = _fx.SeedCase();
        var primary = _fx.SeedPolicy(c.Id, "POL-A", isPrimary: true);
        var secondary = _fx.SeedPolicy(c.Id, "POL-B", isPrimary: false);

        await _svc.PatchDraftAsync(c.Id, _fx.ActorId, DraftWithPolicy("POL-B", "Sec Insured"));

        var policies = _fx.Db.VisitInsurancePolicies
            .Where(p => p.CoverageCase_Id == c.Id && p.DeletedAt == null)
            .OrderBy(p => p.PolicyNumber)
            .ToList();
        policies.Should().HaveCount(2);
        policies.Should().ContainSingle(p => p.Id == secondary.Id && p.InsuredName == "Sec Insured");
        policies.Should().ContainSingle(p => p.Id == primary.Id && p.PolicyNumber == "POL-A");
    }

    [Fact]
    public async Task PatchDraft_SoftDeletedSameNumber_AllowsNewActivePolicy()
    {
        var c = _fx.SeedCase();
        var deleted = _fx.SeedPolicy(c.Id, "POL-REVIVE", isPrimary: true);
        deleted.DeletedAt = DateTime.UtcNow;
        deleted.Status = "deleted";
        deleted.IsPrimary = false;
        await _fx.Db.SaveChangesAsync();

        await _svc.PatchDraftAsync(c.Id, _fx.ActorId, DraftWithPolicy("POL-REVIVE"));

        var active = _fx.Db.VisitInsurancePolicies
            .Where(p => p.CoverageCase_Id == c.Id && p.DeletedAt == null)
            .ToList();
        active.Should().ContainSingle();
        active[0].Id.Should().NotBe(deleted.Id);
        active[0].IsPrimary.Should().BeTrue();
    }

    [Fact]
    public async Task PatchDraft_UnchangedPolicy_RepeatedSave_StaysSingle()
    {
        var c = _fx.SeedCase();
        _fx.SeedPolicy(c.Id, "POL-STABLE", isPrimary: true);
        var req = DraftWithPolicy("POL-STABLE");

        await _svc.PatchDraftAsync(c.Id, _fx.ActorId, req);
        await _svc.PatchDraftAsync(c.Id, _fx.ActorId, req);
        await _svc.PatchDraftAsync(c.Id, _fx.ActorId, req);

        _fx.Db.VisitInsurancePolicies
            .Count(p => p.CoverageCase_Id == c.Id && p.DeletedAt == null)
            .Should().Be(1);
    }

    public void Dispose() => _fx.Dispose();
}
