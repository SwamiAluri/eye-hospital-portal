using CcmsApi.Models.Domain;
using CcmsApi.Services;
using CcmsApi.Tests.Fixtures;
using FluentAssertions;
using Xunit;

namespace CcmsApi.Tests.ServiceTests;

public sealed class MasterDataDocumentRequirementsTests : IDisposable
{
    private readonly InMemoryDbFixture _fix = new();
    private readonly MasterDataService _svc;

    public MasterDataDocumentRequirementsTests()
    {
        _svc = new MasterDataService(_fix.Db);
    }

    public void Dispose() => _fix.Dispose();

    [Fact]
    public async Task ListDocumentRequirements_EmptyMaster_ReturnsEmpty()
    {
        var list = await _svc.ListDocumentRequirementsAsync(
            _fix.TenantId,
            payerType: "insurance",
            stage: "preauth",
            caseScoped: true);

        list.Should().BeEmpty();
    }

    [Fact]
    public async Task ListDocumentRequirements_GlobalPreauthRows_ApplyWithCaseScoped()
    {
        SeedGlobalRequirement("id_proof", "Patient ID Proof", required: true);
        SeedGlobalRequirement("policy_document", "Policy", required: true);

        var list = await _svc.ListDocumentRequirementsAsync(
            _fix.TenantId,
            payerType: "insurance",
            stage: "preauth",
            insuranceProviderId: Guid.NewGuid(),
            caseScoped: true);

        list.Should().HaveCount(2);
        list.Select(r => r.DocumentType).Should().BeEquivalentTo(["id_proof", "policy_document"]);
    }

    [Fact]
    public async Task ListDocumentRequirements_PayerScoped_RequiresMatchingProvider()
    {
        var payerId = Guid.NewGuid();
        _fix.Db.DocumentRequirements.Add(new CcmsDocumentRequirement
        {
            Id = Guid.NewGuid(),
            TenantId = _fix.TenantId,
            InsuranceProviderId = payerId,
            DocumentType = "insurance_card_front",
            DocumentName = "Insurance Card — Front",
            IsRequired = true,
            AppliesAt = "preauth",
            Status = "active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await _fix.Db.SaveChangesAsync();

        var matching = await _svc.ListDocumentRequirementsAsync(
            _fix.TenantId,
            payerType: "insurance",
            stage: "preauth",
            insuranceProviderId: payerId,
            caseScoped: true);
        matching.Should().ContainSingle(r => r.DocumentType == "insurance_card_front");

        var wrongPayer = await _svc.ListDocumentRequirementsAsync(
            _fix.TenantId,
            payerType: "insurance",
            stage: "preauth",
            insuranceProviderId: Guid.NewGuid(),
            caseScoped: true);
        wrongPayer.Should().BeEmpty();
    }

    private void SeedGlobalRequirement(string documentType, string documentName, bool required)
    {
        _fix.Db.DocumentRequirements.Add(new CcmsDocumentRequirement
        {
            Id = Guid.NewGuid(),
            TenantId = _fix.TenantId,
            DocumentType = documentType,
            DocumentName = documentName,
            IsRequired = required,
            AppliesAt = "preauth",
            Status = "active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        _fix.Db.SaveChanges();
    }
}
