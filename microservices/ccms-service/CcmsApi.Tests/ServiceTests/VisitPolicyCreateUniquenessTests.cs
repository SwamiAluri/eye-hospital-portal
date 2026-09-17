using CcmsApi.Models.Domain;
using CcmsApi.Services;
using CcmsApi.Tests.Fixtures;
using FluentAssertions;

namespace CcmsApi.Tests.ServiceTests;

/// <summary>Phase 3G — VisitPolicyService CreateAsync case-scoped uniqueness (enabled suite).</summary>
public class VisitPolicyCreateUniquenessTests : IDisposable
{
    private readonly InMemoryDbFixture _fx = new();
    private readonly VisitPolicyService _svc;

    public VisitPolicyCreateUniquenessTests()
    {
        _svc = new VisitPolicyService(_fx.Db);
    }

    [Fact]
    public async Task CreateAsync_DuplicatePolicyNumberOnSameCase_Throws()
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

    public void Dispose() => _fx.Dispose();
}
