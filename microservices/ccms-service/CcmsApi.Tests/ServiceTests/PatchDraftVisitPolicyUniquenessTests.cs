using CcmsApi.Models.Dtos;
using CcmsApi.Services;
using CcmsApi.Tests.Fixtures;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;

namespace CcmsApi.Tests.ServiceTests;

/// <summary>
/// Phase 3G — PatchDraft must not insert a second active row for the same
/// case-scoped policy number. In-memory EF covers sequential/repeated saves;
/// true parallel DB concurrency is not asserted here.
/// </summary>
public class PatchDraftVisitPolicyUniquenessTests : IDisposable
{
    private readonly InMemoryDbFixture _fx = new();
    private readonly CoverageCaseService _svc;

    public PatchDraftVisitPolicyUniquenessTests()
    {
        _svc = new CoverageCaseService(
            _fx.Db,
            workflow: null!,
            fyService: null!,
            authClient: null!,
            NullLogger<CoverageCaseService>.Instance);
    }

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
