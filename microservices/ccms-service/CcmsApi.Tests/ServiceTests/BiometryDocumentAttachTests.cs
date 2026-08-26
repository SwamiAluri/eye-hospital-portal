using CcmsApi.Services;
using CcmsApi.Tests.Fixtures;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace CcmsApi.Tests.ServiceTests;

public class BiometryDocumentAttachTests : IDisposable
{
    private readonly InMemoryDbFixture _fix = new();

    [Fact]
    public async Task AttachBiometry_IsIdempotentOnRecordId()
    {
        var c = _fix.SeedCase();
        var svc = new DocumentEngineService(
            _fix.Db, new ConfigurationBuilder().Build(), NullLogger<DocumentEngineService>.Instance);
        var recordId = Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");

        var first = await svc.AttachBiometryRecordAsync(
            c.Id, _fix.ActorId, recordId, "OD", new DateTime(2026, 8, 24), 21.00m, "IOLMaster");
        var second = await svc.AttachBiometryRecordAsync(
            c.Id, _fix.ActorId, recordId, "OD", new DateTime(2026, 8, 24), 21.00m, "IOLMaster");

        first.Id.Should().Be(second.Id);
        first.DocumentType.Should().Be("biometry_record");
        first.DocumentCategory.Should().Be("preauth");
        first.BlobUrl.Should().Be($"biometry://record/{recordId:D}");
        first.DocumentName.Should().Be("Biometry print · OD · 24 Aug 2026 · +21.00 D · IOLMaster");
        _fix.Db.Documents.Should().HaveCount(1);
    }

    [Fact]
    public async Task AttachBiometry_EmptyId_Throws()
    {
        var c = _fix.SeedCase();
        var svc = new DocumentEngineService(
            _fix.Db, new ConfigurationBuilder().Build(), NullLogger<DocumentEngineService>.Instance);
        var act = () => svc.AttachBiometryRecordAsync(c.Id, _fix.ActorId, Guid.Empty);
        await act.Should().ThrowAsync<ArgumentException>();
    }

    public void Dispose() => _fix.Dispose();
}
