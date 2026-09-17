using CcmsApi.Models.Domain;
using CcmsApi.Models.Dtos;
using CcmsApi.Services;
using CcmsApi.Tests.Fixtures;
using FluentAssertions;

namespace CcmsApi.Tests.ServiceTests;

public class VisitPolicyServiceTests : IDisposable
{
    private readonly InMemoryDbFixture _fix = new();
    private readonly VisitPolicyService _svc;

    public VisitPolicyServiceTests()
    {
        _svc = new VisitPolicyService(_fix.Db);
    }

    // ── GetByCaseAsync ───────────────────────────────────────────────────────

    [Fact]
    public async Task GetByCaseAsync_ReturnsDtos_NotRawEntities()
    {
        var c = _fix.SeedCase();
        _fix.SeedPolicy(c.Id, "POL-A");
        _fix.SeedPolicy(c.Id, "POL-B", isPrimary: false);

        var result = await _svc.GetByCaseAsync(c.Id);

        result.Should().HaveCount(2);
        result.Should().AllSatisfy(dto => dto.Should().BeOfType<VisitPolicyDto>());
        result.Should().ContainSingle(dto => dto.PolicyNumber == "POL-A");
    }

    [Fact]
    public async Task GetByCaseAsync_ExcludesSoftDeleted()
    {
        var c = _fix.SeedCase();
        var p = _fix.SeedPolicy(c.Id, "POL-DELETED");
        p.DeletedAt = DateTime.UtcNow;
        await _fix.Db.SaveChangesAsync();

        var result = await _svc.GetByCaseAsync(c.Id);
        result.Should().BeEmpty();
    }

    // ── GetByIdAsync ─────────────────────────────────────────────────────────

    [Fact]
    public async Task GetByIdAsync_ExistingPolicy_ReturnsVisitPolicyDto()
    {
        var c = _fix.SeedCase();
        var p = _fix.SeedPolicy(c.Id, "POL-SINGLE");

        var dto = await _svc.GetByIdAsync(p.Id);

        dto.Should().NotBeNull();
        dto!.Id.Should().Be(p.Id);
        dto.PolicyNumber.Should().Be("POL-SINGLE");
        dto.IsPrimary.Should().BeTrue();
        dto.Should().BeOfType<VisitPolicyDto>();
    }

    [Fact]
    public async Task GetByIdAsync_UnknownId_ReturnsNull()
    {
        var result = await _svc.GetByIdAsync(Guid.NewGuid());
        result.Should().BeNull();
    }

    // ── CreateAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_ReturnsVisitPolicyDto()
    {
        var c = _fix.SeedCase();
        var entity = new CcmsVisitInsurancePolicy
        {
            TenantId        = _fix.TenantId,
            CoverageCase_Id = c.Id,
            PolicyNumber    = "NEW-POL-001",
            IsPrimary       = true,
            SortOrder       = 1,
            Status          = "active",
        };

        var dto = await _svc.CreateAsync(entity, _fix.ActorId);

        dto.Should().NotBeNull();
        dto.PolicyNumber.Should().Be("NEW-POL-001");
        dto.Should().BeOfType<VisitPolicyDto>();
        dto.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public async Task CreateAsync_NoCaseOrSession_ThrowsArgumentException()
    {
        var entity = new CcmsVisitInsurancePolicy
        {
            TenantId     = _fix.TenantId,
            PolicyNumber = "BAD-POL",
            Status       = "active",
            // CoverageCase_Id and SessionId both null
        };

        Func<Task> act = async () => await _svc.CreateAsync(entity, _fix.ActorId);
        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task CreateAsync_DuplicatePolicyNumberOnSameCase_ThrowsConflict()
    {
        var c = _fx.SeedCase();
        _fx.SeedPolicy(c.Id, "DUP-POL", isPrimary: true);

        var entity = new CcmsVisitInsurancePolicy
        {
            TenantId        = _fx.TenantId,
            CoverageCase_Id = c.Id,
            PolicyNumber    = "  dup-pol  ",
            IsPrimary       = false,
            SortOrder       = 2,
            Status          = "active",
        };

        Func<Task> act = async () => await _svc.CreateAsync(entity, _fx.ActorId);
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*already exists*");
    }

    // ── SetPrimaryAsync ──────────────────────────────────────────────────────

    [Fact]
    public async Task SetPrimaryAsync_ClearsOtherPrimaries_ForSameCase()
    {
        var c  = _fix.SeedCase();
        var p1 = _fix.SeedPolicy(c.Id, "POL-PRIMARY",    isPrimary: true);
        var p2 = _fix.SeedPolicy(c.Id, "POL-SECONDARY",  isPrimary: false);

        var dto = await _svc.SetPrimaryAsync(p2.Id, _fix.ActorId);

        dto.Should().NotBeNull();
        dto.IsPrimary.Should().BeTrue();

        // p1 should no longer be primary
        var p1Updated = await _svc.GetByIdAsync(p1.Id);
        p1Updated!.IsPrimary.Should().BeFalse();
    }

    // ── UpdateAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateAsync_ChangesFieldsAndReturnsDto()
    {
        var c   = _fix.SeedCase();
        var pol = _fix.SeedPolicy(c.Id, "POL-ORIG");

        var patch = new CcmsVisitInsurancePolicy
        {
            PolicyNumber    = "POL-UPDATED",
            InsuredName     = "Dr Test Insured",
            SortOrder       = 2,
            IsPrimary       = true,
            Status          = "active",
        };

        var dto = await _svc.UpdateAsync(pol.Id, patch, _fix.ActorId);

        dto.PolicyNumber.Should().Be("POL-UPDATED");
        dto.InsuredName.Should().Be("Dr Test Insured");
        dto.Should().BeOfType<VisitPolicyDto>();
    }

    // ── DeleteAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteAsync_SoftDeletesPolicy()
    {
        var c   = _fix.SeedCase();
        var pol = _fix.SeedPolicy(c.Id, "POL-TO-DELETE");

        await _svc.DeleteAsync(pol.Id, _fix.ActorId);

        var afterDelete = await _svc.GetByIdAsync(pol.Id);
        afterDelete.Should().BeNull();
    }

    public void Dispose() => _fix.Dispose();
}
