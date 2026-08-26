using CcmsApi.Models.Domain;
using CcmsApi.Services;
using CcmsApi.Tests.Fixtures;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace CcmsApi.Tests.ServiceTests;

public sealed class PreAuthDocumentGateTests : IDisposable
{
    private readonly InMemoryDbFixture _fix = new();
    private readonly PreAuthorizationService _svc;
    private readonly Mock<IWorkflowEngine> _workflowMock = new();

    public PreAuthDocumentGateTests()
    {
        _workflowMock
            .Setup(w => w.FireAsync(It.IsAny<Guid>(), It.IsAny<string>(),
                It.IsAny<Guid>(), It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TransitionResult(true, "PREAUTH_GENERATED", "WAITING_APPROVAL", "SEND_PREAUTH"));

        var authClient = new AuthServiceClient(new HttpClient(), NullLogger<AuthServiceClient>.Instance);
        _svc = new PreAuthorizationService(
            _fix.Db,
            _workflowMock.Object,
            new ClarificationService(_fix.Db, _workflowMock.Object, authClient, NullLogger<ClarificationService>.Instance),
            authClient,
            NullLogger<PreAuthorizationService>.Instance);
    }

    public void Dispose() => _fix.Dispose();

    [Fact]
    public async Task MarkSent_WithoutRequiredDoc_Throws()
    {
        var c = _fix.SeedCase(state: "PREAUTH_GENERATED");
        SeedRequirement("surgeon_advice", "Surgeon advice", required: true);
        var auth = _fix.SeedAuthorization(c.Id, status: "active");

        var act = () => _svc.MarkSentAsync(auth.Id, _fix.ActorId);

        var ex = await act.Should().ThrowAsync<InvalidOperationException>();
        ex.Which.Message.Should().Contain("Surgeon advice");
        _fix.Db.CoverageAuthorizations.Find(auth.Id)!.SubmittedAt.Should().BeNull();
    }

    [Fact]
    public async Task MarkSent_WithRequiredDoc_Succeeds()
    {
        var c = _fix.SeedCase(state: "PREAUTH_GENERATED");
        SeedRequirement("surgeon_advice", "Surgeon advice", required: true);
        SeedRequirement("biometry_print", "Biometry print", required: true);
        SeedDocument(c.Id, "surgeon_advice");
        SeedDocument(c.Id, "biometry_print");
        var auth = _fix.SeedAuthorization(c.Id, status: "active");

        var dto = await _svc.MarkSentAsync(auth.Id, _fix.ActorId, tpaReferenceNumber: "TPA-1");

        dto.SubmittedAt.Should().NotBeNull();
        dto.TpaReferenceNumber.Should().Be("TPA-1");
    }

    [Fact]
    public async Task MarkSent_EmptyMaster_AllowsSubmit()
    {
        var c = _fix.SeedCase(state: "PREAUTH_GENERATED");
        var auth = _fix.SeedAuthorization(c.Id, status: "active");

        var dto = await _svc.MarkSentAsync(auth.Id, _fix.ActorId);

        dto.SubmittedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task MarkSent_OptionalOnly_AllowsSubmit()
    {
        var c = _fix.SeedCase(state: "PREAUTH_GENERATED");
        SeedRequirement("oct_fundus", "OCT / fundus", required: false);
        var auth = _fix.SeedAuthorization(c.Id, status: "active");

        var dto = await _svc.MarkSentAsync(auth.Id, _fix.ActorId);

        dto.SubmittedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task MarkSent_OtherPayerRequirement_DoesNotBlock()
    {
        var c = _fix.SeedCase(state: "PREAUTH_GENERATED");
        c.InsuranceProviderId = Guid.NewGuid();
        _fix.Db.SaveChanges();
        SeedRequirement("star_form", "Star form", required: true, insuranceProviderId: Guid.NewGuid());
        var auth = _fix.SeedAuthorization(c.Id, status: "active");

        var dto = await _svc.MarkSentAsync(auth.Id, _fix.ActorId);

        dto.SubmittedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task MarkSent_AlreadySubmitted_SkipsGate()
    {
        var c = _fix.SeedCase(state: "WAITING_APPROVAL");
        SeedRequirement("surgeon_advice", "Surgeon advice", required: true);
        var auth = _fix.SeedAuthorization(c.Id, status: "active");
        auth.SubmittedAt = DateTime.UtcNow.AddHours(-1);
        _fix.Db.SaveChanges();

        var dto = await _svc.MarkSentAsync(auth.Id, _fix.ActorId);

        dto.SubmittedAt.Should().NotBeNull();
    }

    [Fact]
    public void FormatBlockMessage_JoinsMissingNames()
    {
        var missing = new List<CcmsDocumentRequirement>
        {
            new() { DocumentType = "surgeon_advice", DocumentName = "Surgeon advice" },
            new() { DocumentType = "biometry_print", DocumentName = "Biometry print" },
        };

        PreAuthDocumentGate.FormatBlockMessage(missing)
            .Should().Be("Pre-authorization cannot be sent until Surgeon advice and Biometry print are attached.");
    }

    private void SeedRequirement(
        string type, string name, bool required, Guid? insuranceProviderId = null)
    {
        _fix.Db.DocumentRequirements.Add(new CcmsDocumentRequirement
        {
            Id = Guid.NewGuid(),
            TenantId = _fix.TenantId,
            DocumentType = type,
            DocumentName = name,
            IsRequired = required,
            AppliesAt = "preauth",
            InsuranceProviderId = insuranceProviderId,
            Status = "active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = _fix.ActorId,
            UpdatedByUserId = _fix.ActorId,
        });
        _fix.Db.SaveChanges();
    }

    private void SeedDocument(Guid caseId, string type)
    {
        _fix.Db.Documents.Add(new CcmsDocument
        {
            Id = Guid.NewGuid(),
            TenantId = _fix.TenantId,
            CoverageCase_Id = caseId,
            DocumentCategory = "preauth",
            DocumentType = type,
            DocumentName = type + ".pdf",
            Status = "active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = _fix.ActorId,
            UpdatedByUserId = _fix.ActorId,
            UploadedAt = DateTime.UtcNow,
        });
        _fix.Db.SaveChanges();
    }
}
