using CcmsApi.Services;
using CcmsApi.Tests.Fixtures;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace CcmsApi.Tests.ServiceTests;

public class PacsDocumentAttachTests : IDisposable
{
    private readonly InMemoryDbFixture _fix = new();

    [Fact]
    public async Task AttachPacsStudy_IsIdempotentOnStudyUid()
    {
        var c = _fix.SeedCase();
        var svc = new DocumentEngineService(
            _fix.Db, new ConfigurationBuilder().Build(), NullLogger<DocumentEngineService>.Instance);

        var first = await svc.AttachPacsStudyAsync(c.Id, _fix.ActorId, "1.2.840.study.1", "ACC-1");
        var second = await svc.AttachPacsStudyAsync(c.Id, _fix.ActorId, "1.2.840.study.1", "ACC-1");

        first.Id.Should().Be(second.Id);
        first.DocumentType.Should().Be("dicom_study");
        first.BlobUrl.Should().Be("pacs://study/1.2.840.study.1");
        _fix.Db.Documents.Should().HaveCount(1);
    }

    [Fact]
    public async Task AttachPacsStudy_EmptyUid_Throws()
    {
        var c = _fix.SeedCase();
        var svc = new DocumentEngineService(
            _fix.Db, new ConfigurationBuilder().Build(), NullLogger<DocumentEngineService>.Instance);
        var act = () => svc.AttachPacsStudyAsync(c.Id, _fix.ActorId, "  ");
        await act.Should().ThrowAsync<ArgumentException>();
    }

    public void Dispose() => _fix.Dispose();
}
