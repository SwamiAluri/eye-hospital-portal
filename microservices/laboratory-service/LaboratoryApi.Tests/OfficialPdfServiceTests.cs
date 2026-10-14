using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using LaboratoryApi.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using UglyToad.PdfPig;
using Xunit;

namespace LaboratoryApi.Tests;

/// <summary>L-REP-03 CUT B / B1 Official PDF + CUT C staff download (InMemory + renderer).</summary>
public class OfficialPdfServiceTests
{
    private readonly Guid _tenant = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _actor = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _patient = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private readonly Guid _ordering = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private readonly Guid _responsible = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
    private readonly Guid _branch = Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff");
    private readonly Guid _otherBranch = Guid.Parse("12345678-1234-1234-1234-123456789012");
    private readonly DateTime _dob = new(1990, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    private (
        LaboratoryDbContext Db,
        Mock<IPlatformAuditClient> Audit,
        Mock<IPlatformCanonicalDocumentClient> Canonical,
        OfficialPdfService Pdf,
        ReportService Reports,
        SpecimenService Specimens,
        OrderService Orders,
        CatalogueService Catalogue,
        CollectionService Collection,
        ResultService Results)
        Create(bool auditFails = false, bool canonicalFails = false)
    {
        var db = new LaboratoryDbContext(new DbContextOptionsBuilder<LaboratoryDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options);

        var audit = new Mock<IPlatformAuditClient>();
        if (auditFails)
        {
            audit.Setup(a => a.WriteAsync(
                    It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                    It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("audit down"));
        }
        else
        {
            audit.Setup(a => a.WriteAsync(
                    It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                    It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
        }

        var platform = new Mock<IPlatformReferenceClient>();
        platform.Setup(p => p.ValidatePatientAsync(_tenant, _patient, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformPatientRef(_patient, "MRN-1", "Test Patient", _dob));
        platform.Setup(p => p.ValidateUserAsync(_tenant, _ordering, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserRef(_ordering, "Dr Ordering", "active"));
        platform.Setup(p => p.ValidateUserAsync(_tenant, _responsible, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserRef(_responsible, "Dr Responsible", "active"));
        platform.Setup(p => p.ValidateUserAsync(_tenant, _actor, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserRef(_actor, "Authorizer One", "active"));
        platform.Setup(p => p.ValidateUserWithPermissionAsync(
                _tenant, _actor, LaboratoryAuthz.CollectionCollect, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserRef(_actor, "Collector One", "active"));
        platform.Setup(p => p.ValidateUserBranchAsync(
                _tenant, _actor, _branch, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserBranchRef(_actor, _branch, true));
        platform.Setup(p => p.ValidateUserBranchAsync(
                _tenant, _actor, _otherBranch, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OrderDomainException(
                "User is not authorized for the branch.",
                statusCode: 403, code: "branch_unauthorized"));
        foreach (var (code, label) in SpecimenRejectionReasons.Approved)
        {
            platform.Setup(p => p.ValidateMasterValueAsync(
                    _tenant, SpecimenRejectionReasonMaster.EntityType, code, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new PlatformMasterValueRef(
                    SpecimenRejectionReasonMaster.EntityType, code, label, true, 1));
        }

        var canonical = new Mock<IPlatformCanonicalDocumentClient>();
        if (canonicalFails)
        {
            canonical.Setup(c => c.RegisterOfficialPdfAsync(
                    It.IsAny<RegisterLmsOfficialPdfDocumentRequest>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new TestingDomainException(
                    "Canonical unavailable.", statusCode: 503, code: "platform_unavailable"));
            canonical.Setup(c => c.OpenOfficialPdfContentAsync(
                    It.IsAny<OpenLmsOfficialPdfContentRequest>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new TestingDomainException(
                    "Official PDF content unavailable.", statusCode: 503, code: "platform_unavailable"));
        }
        else
        {
            canonical.Setup(c => c.RegisterOfficialPdfAsync(
                    It.IsAny<RegisterLmsOfficialPdfDocumentRequest>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((RegisterLmsOfficialPdfDocumentRequest req, CancellationToken _) =>
                    new RegisterLmsOfficialPdfDocumentResponse(Guid.NewGuid(), true, Guid.NewGuid()));
            canonical.Setup(c => c.OpenOfficialPdfContentAsync(
                    It.IsAny<OpenLmsOfficialPdfContentRequest>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((OpenLmsOfficialPdfContentRequest req, CancellationToken _) =>
                {
                    var bytes = Encoding.ASCII.GetBytes("%PDF-1.4 official-download-test");
                    var http = new HttpResponseMessage(System.Net.HttpStatusCode.OK)
                    {
                        Content = new ByteArrayContent(bytes),
                    };
                    http.Content.Headers.ContentType =
                        new System.Net.Http.Headers.MediaTypeHeaderValue("application/pdf");
                    return new LmsOfficialPdfContentStream(
                        http,
                        new MemoryStream(bytes),
                        "application/pdf",
                        $"{req.ArtifactId:N}.pdf",
                        bytes.Length);
                });
        }

        var catalogue = new CatalogueService(db, audit.Object);
        var orders = new OrderService(db, audit.Object, platform.Object, catalogue);
        var collection = new CollectionService(db, audit.Object, platform.Object);
        var specimens = new SpecimenService(db, audit.Object, platform.Object);
        var results = new ResultService(db, audit.Object, platform.Object);
        var reports = new ReportService(db, audit.Object, platform.Object);
        var pdf = new OfficialPdfService(
            db, audit.Object, platform.Object, new OfficialPdfRenderer(), canonical.Object);
        return (db, audit, canonical, pdf, reports, specimens, orders, catalogue, collection, results);
    }

    private async Task<Guid> ActivateTestAsync(
        CatalogueService cat, LaboratoryDbContext db, string code, string displayName)
    {
        var d = await cat.CreateDraftAsync(_tenant, _actor, new CreateCatalogueDraftRequest(
            CatalogueType: CatalogueTypes.Test,
            InternalOrderCode: code,
            DisplayName: displayName,
            Discipline: "CLINICAL_CHEMISTRY",
            Classification: CatalogueClassifications.Local,
            ChangeReason: "official-pdf",
            BranchIds: null));
        d = await cat.SubmitForReviewAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        d = await cat.ApproveAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        d = await cat.ActivateAsync(_tenant, _actor, d.Id, new LifecycleActionRequest(
            EffectiveFrom: DateTime.UtcNow.AddDays(-1)));
        var version = await db.CatalogueVersions
            .Where(v => v.CatalogueItemId == d.Id && v.TenantId == _tenant)
            .OrderByDescending(v => v.VersionNumber)
            .FirstAsync();
        version.ResultDatatype = "Numeric";
        version.PermittedUnits = "mg/dL";
        await db.SaveChangesAsync();
        return d.Id;
    }

    private CreateOrderDraftRequest DraftReq(params Guid[] itemIds) =>
        new(
            PatientId: _patient,
            VisitId: null,
            OrderingProviderUserId: _ordering,
            ResponsibleClinicianUserId: _responsible,
            OperatingBranchId: _branch,
            OrderSource: OrderSources.Clinician,
            Priority: OrderPriorities.Routine,
            PriorityReason: null,
            ClinicalIndication: "PDF",
            Notes: null,
            Selections: itemIds.Select((id, i) => new OrderSelectionInput(id, i)).ToArray());

    private static async Task SeedNumberConfigAsync(LaboratoryDbContext db, Guid tenant, Guid branch, Guid actor)
    {
        db.ReportNumberConfigurations.Add(ReportNumberFormats.CreateTestConfiguration(tenant, branch, actor));
        await db.SaveChangesAsync();
    }

    private static async Task SeedPdfConfigAsync(LaboratoryDbContext db, Guid tenant, Guid actor)
    {
        db.ReportPdfTemplateVersions.Add(OfficialPdfTestAssets.CreateTestTemplate(tenant, actor));
        db.ReportPdfSignatories.Add(OfficialPdfTestAssets.CreateTestSignatory(tenant, actor));
        await db.SaveChangesAsync();
    }

    private async Task<(ReportDetailDto Numbered, OfficialPdfService Pdf, ReportService Reports,
        LaboratoryDbContext Db, Mock<IPlatformAuditClient> Audit, Mock<IPlatformCanonicalDocumentClient> Canonical,
        string ExactDisplayName, Guid CatalogueVersionId)>
        NumberedReleasedFixtureAsync(bool auditFails = false, bool seedPdfConfig = true, bool canonicalFails = false)
    {
        var (db, audit, canonical, pdf, reports, specimens, orders, catalogue, collection, results) =
            Create(auditFails, canonicalFails);
        var displayName = "Exact CV Name " + Guid.NewGuid().ToString("N")[..6];
        var itemId = await ActivateTestAsync(catalogue, db, "PDF-" + Guid.NewGuid().ToString("N")[..6], displayName);
        var cvId = await db.CatalogueVersions
            .Where(v => v.CatalogueItemId == itemId && v.TenantId == _tenant)
            .Select(v => v.Id)
            .FirstAsync();

        var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
        var order = await orders.SubmitAsync(_tenant, _actor, draft.Id, new SubmitOrderRequest(draft.RowVersion));
        var otId = order.CurrentVersion!.Tests.Single().Id;
        var planned = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, new[] { otId }, LocationText: "Bay 1"));
        planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
            new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.Ready));
        planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
            new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.InProgress));
        planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
            new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.Completed));
        var specimen = await specimens.CompleteCollectionAsync(_tenant, _actor, planned.Id,
            new CompleteCollectionRequest(planned.RowVersion, true));
        specimen = await specimens.ReceiveAsync(_tenant, _actor, specimen.Id, new ReceiveSpecimenRequest(
            specimen.RowVersion, _branch, true, specimen.PatientMrnSnapshot!, specimen.PatientNameSnapshot!,
            specimen.PatientDateOfBirthSnapshot!.Value, "Bench"));
        var result = await results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
            otId, specimen.Id, _branch, NumericValue: "12.5", Unit: "mg/dL", Comment: "ok comment"));
        var verified = await results.VerifyAsync(_tenant, _actor, result.Id, new VerifyResultRequest(
            _branch, result.RowVersion, result.CurrentVersionNumber));
        var authorized = await results.AuthorizeAsync(_tenant, _actor, verified.Id, new AuthorizeResultRequest(
            _branch, verified.RowVersion, verified.CurrentVersionNumber));

        await SeedNumberConfigAsync(db, _tenant, _branch, _actor);
        if (seedPdfConfig)
            await SeedPdfConfigAsync(db, _tenant, _actor);

        var reportDraft = await reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
            _branch, "pdf-d-" + Guid.NewGuid().ToString("N"),
            new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) }));
        var finalized = await reports.FinalizeAsync(_tenant, _actor, reportDraft.Id, new FinalizeReportRequest(
            _branch, "pdf-f-" + Guid.NewGuid().ToString("N"), reportDraft.RowVersion));
        var released = await reports.ReleaseAsync(_tenant, _actor, reportDraft.Id, new ReleaseReportRequest(
            _branch, "pdf-r-" + Guid.NewGuid().ToString("N"), finalized.RowVersion));
        var numbered = await reports.AssignNumberAsync(_tenant, _actor, reportDraft.Id, new AssignReportNumberRequest(
            _branch, "pdf-n-" + Guid.NewGuid().ToString("N"), released.RowVersion));

        return (numbered, pdf, reports, db, audit, canonical, displayName, cvId);
    }

    [Fact]
    public async Task Missing_Template_And_Signatory_Denied()
    {
        var (numbered, pdf, _, db, _, _, _, _) = await NumberedReleasedFixtureAsync(seedPdfConfig: false);
        db.ReportPdfTemplateVersions.RemoveRange(db.ReportPdfTemplateVersions);
        db.ReportPdfSignatories.RemoveRange(db.ReportPdfSignatories);
        await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
                _branch, "idem-cfg-" + Guid.NewGuid().ToString("N"))));
        Assert.Equal(409, ex.StatusCode);
        Assert.Contains("configuration", ex.Code);
    }

    [Fact]
    public async Task Draft_And_Final_Cannot_Generate()
    {
        var (db, audit, canonical, pdf, reports, specimens, orders, catalogue, collection, results) = Create();
        var itemId = await ActivateTestAsync(catalogue, db, "PDF-D", "Draft Name");
        await SeedNumberConfigAsync(db, _tenant, _branch, _actor);
        await SeedPdfConfigAsync(db, _tenant, _actor);
        var draftOrder = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
        var order = await orders.SubmitAsync(_tenant, _actor, draftOrder.Id, new SubmitOrderRequest(draftOrder.RowVersion));
        var otId = order.CurrentVersion!.Tests.Single().Id;
        var planned = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, new[] { otId }, LocationText: "Bay 1"));
        planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
            new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.Ready));
        planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
            new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.InProgress));
        planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
            new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.Completed));
        var specimen = await specimens.CompleteCollectionAsync(_tenant, _actor, planned.Id,
            new CompleteCollectionRequest(planned.RowVersion, true));
        specimen = await specimens.ReceiveAsync(_tenant, _actor, specimen.Id, new ReceiveSpecimenRequest(
            specimen.RowVersion, _branch, true, specimen.PatientMrnSnapshot!, specimen.PatientNameSnapshot!,
            specimen.PatientDateOfBirthSnapshot!.Value, "Bench"));
        var result = await results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
            otId, specimen.Id, _branch, NumericValue: "1", Unit: "mg/dL"));
        var verified = await results.VerifyAsync(_tenant, _actor, result.Id, new VerifyResultRequest(
            _branch, result.RowVersion, result.CurrentVersionNumber));
        var authorized = await results.AuthorizeAsync(_tenant, _actor, verified.Id, new AuthorizeResultRequest(
            _branch, verified.RowVersion, verified.CurrentVersionNumber));

        var draft = await reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
            _branch, "d1", new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) }));
        var exDraft = await Assert.ThrowsAsync<TestingDomainException>(() =>
            pdf.GenerateAsync(_tenant, _actor, draft.Id, new GenerateOfficialPdfRequest(_branch, "g-d")));
        Assert.Equal("invalid_state", exDraft.Code);

        var finalized = await reports.FinalizeAsync(_tenant, _actor, draft.Id, new FinalizeReportRequest(
            _branch, "f1", draft.RowVersion));
        var exFinal = await Assert.ThrowsAsync<TestingDomainException>(() =>
            pdf.GenerateAsync(_tenant, _actor, draft.Id, new GenerateOfficialPdfRequest(_branch, "g-f")));
        Assert.Equal("invalid_state", exFinal.Code);
        Assert.Equal(ReportStatuses.Final, finalized.Status);
    }

    [Fact]
    public async Task Released_Without_Number_Denied()
    {
        var (numbered, pdf, reports, _, _, _, _, _) = await NumberedReleasedFixtureAsync();
        // Create another released without number
        var (db2, _, _, pdf2, reports2, specimens, orders, catalogue, collection, results) = Create();
        await SeedNumberConfigAsync(db2, _tenant, _branch, _actor);
        await SeedPdfConfigAsync(db2, _tenant, _actor);
        var itemId = await ActivateTestAsync(catalogue, db2, "PDF-RN", "No Number");
        var draftOrder = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
        var order = await orders.SubmitAsync(_tenant, _actor, draftOrder.Id, new SubmitOrderRequest(draftOrder.RowVersion));
        var otId = order.CurrentVersion!.Tests.Single().Id;
        var planned = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, new[] { otId }, LocationText: "Bay 1"));
        planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
            new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.Ready));
        planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
            new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.InProgress));
        planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
            new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.Completed));
        var specimen = await specimens.CompleteCollectionAsync(_tenant, _actor, planned.Id,
            new CompleteCollectionRequest(planned.RowVersion, true));
        specimen = await specimens.ReceiveAsync(_tenant, _actor, specimen.Id, new ReceiveSpecimenRequest(
            specimen.RowVersion, _branch, true, specimen.PatientMrnSnapshot!, specimen.PatientNameSnapshot!,
            specimen.PatientDateOfBirthSnapshot!.Value, "Bench"));
        var result = await results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
            otId, specimen.Id, _branch, NumericValue: "1", Unit: "mg/dL"));
        var verified = await results.VerifyAsync(_tenant, _actor, result.Id, new VerifyResultRequest(
            _branch, result.RowVersion, result.CurrentVersionNumber));
        var authorized = await results.AuthorizeAsync(_tenant, _actor, verified.Id, new AuthorizeResultRequest(
            _branch, verified.RowVersion, verified.CurrentVersionNumber));
        var rd = await reports2.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
            _branch, "rn-d", new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) }));
        var fin = await reports2.FinalizeAsync(_tenant, _actor, rd.Id, new FinalizeReportRequest(_branch, "rn-f", rd.RowVersion));
        var rel = await reports2.ReleaseAsync(_tenant, _actor, rd.Id, new ReleaseReportRequest(_branch, "rn-r", fin.RowVersion));
        Assert.Null(rel.BusinessReportNumber);

        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            pdf2.GenerateAsync(_tenant, _actor, rd.Id, new GenerateOfficialPdfRequest(_branch, "rn-g")));
        Assert.Equal("report_number_required", ex.Code);
        _ = numbered;
        _ = pdf;
        _ = reports;
    }

    [Fact]
    public async Task Wrong_Branch_Denied()
    {
        var (numbered, pdf, _, _, _, _, _, _) = await NumberedReleasedFixtureAsync();
        var ex = await Assert.ThrowsAsync<OrderDomainException>(() =>
            pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
                _otherBranch, "br-" + Guid.NewGuid().ToString("N"))));
        Assert.Equal(403, ex.StatusCode);
    }

    [Fact]
    public async Task Generate_Creates_Pending_Job_And_Drain_Succeeds_With_Invariants()
    {
        var (numbered, pdf, reports, db, audit, _, exactName, cvId) = await NumberedReleasedFixtureAsync();
        var versionBefore = numbered.CurrentVersionNumber;
        var numberBefore = numbered.BusinessReportNumber;
        var statusBefore = numbered.Status;

        var resp = await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "gen-" + Guid.NewGuid().ToString("N")));
        Assert.Equal(OfficialPdfJobStatuses.Pending, resp.Job.Status);
        Assert.False(resp.ExistingActiveJob);

        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, ReportAuditActions.RequestOfficialPdf, ReportAuditResources.LmsReport,
            numbered.Id, It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);

        var processed = await pdf.ProcessPendingJobsAsync();
        Assert.Equal(1, processed);

        var job = await db.ReportOfficialPdfJobs.SingleAsync(j => j.Id == resp.Job.JobId);
        Assert.Equal(OfficialPdfJobStatuses.Succeeded, job.Status);
        Assert.NotNull(job.ArtifactId);

        var artifact = await db.ReportOfficialPdfArtifacts.SingleAsync(a => a.Id == job.ArtifactId);
        Assert.Equal(1, artifact.ArtifactVersion);
        Assert.Equal(OfficialPdfArtifactStatuses.Succeeded, artifact.Status);
        Assert.Equal("application/pdf", artifact.MimeType);
        Assert.True(artifact.SizeBytes > 0);
        Assert.False(string.IsNullOrWhiteSpace(artifact.ContentHash));
        Assert.NotNull(artifact.CanonicalDocumentId);

        var report = await db.Reports.SingleAsync(r => r.Id == numbered.Id);
        Assert.Equal(artifact.Id, report.CurrentOfficialArtifactId);
        Assert.Equal(statusBefore, report.Status);
        Assert.Equal(numberBefore, report.BusinessReportNumber);
        Assert.Equal(versionBefore, report.CurrentVersionNumber);

        var template = await db.ReportPdfTemplateVersions.SingleAsync();
        Assert.True(template.IsLocked);
        Assert.Throws<InvalidOperationException>(() => OfficialPdfTemplateRules.EnsureMutable(template));

        var reportVersion = await db.ReportVersions.SingleAsync(v =>
            v.ReportId == numbered.Id && v.VersionNumber == versionBefore);
        var source = await db.ReportVersionSources.SingleAsync(s => s.ReportVersionId == reportVersion.Id);
        Assert.Equal(cvId, source.CatalogueVersionId);
        var cat = await db.CatalogueVersions.SingleAsync(c => c.Id == cvId);
        Assert.Equal(exactName, cat.DisplayName);

        // Content contract: approved model fields only (PDF streams are compressed — assert model + PDF header).
        var model = new OfficialPdfRenderModel(
            template.HospitalLaboratoryName, template.LogoContent, template.LogoMimeType,
            numberBefore!, "MRN-1", "Test Patient",
            new[]
            {
                new OfficialPdfLineItem(cat.InternalOrderCode, exactName, "12.5", "mg/dL", "ok comment",
                    source.SpecimenId, "Authorizer One"),
            },
            "UAT Signatory", "MBBS, Pathologist");
        AssertApprovedPdfModel(model);
        var bytes = new OfficialPdfRenderer().Render(model);
        AssertPdfContainsApprovedContent(bytes, model);

        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, ReportAuditActions.OfficialPdfGenerated, ReportAuditResources.LmsReport,
            numbered.Id, It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);

        var detail = await reports.GetAsync(_tenant, _actor, numbered.Id, _branch);
        Assert.NotNull(detail.CurrentOfficialArtifact);
        Assert.Equal(1, detail.CurrentOfficialArtifact!.ArtifactVersion);
    }

    [Fact]
    public async Task Idempotency_Replay_And_Hash_Conflict()
    {
        var (numbered, pdf, _, db, _, _, _, _) = await NumberedReleasedFixtureAsync();
        var key = "idem-" + Guid.NewGuid().ToString("N");
        var first = await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(_branch, key));
        var second = await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(_branch, key));
        Assert.True(second.Replayed);
        Assert.Equal(first.Job.JobId, second.Job.JobId);

        db.ReportIdempotencyRecords.Add(new LmsReportIdempotencyRecord
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            IdempotencyKey = "conflict-key",
            Operation = ReportIdempotencyOperations.GenerateOfficialPdf,
            RequestHash = "aaaa",
            ReportId = numbered.Id,
            ResponseJson = "{}",
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();
        var conflict = await Assert.ThrowsAsync<TestingDomainException>(() =>
            pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(_branch, "conflict-key")));
        Assert.Equal(409, conflict.StatusCode);
        Assert.Equal("idempotency_conflict", conflict.Code);
    }

    [Fact]
    public async Task Active_Job_Returned_Without_Second_Job()
    {
        var (numbered, pdf, _, db, _, _, _, _) = await NumberedReleasedFixtureAsync();
        var first = await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "act-" + Guid.NewGuid().ToString("N")));
        var second = await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "act2-" + Guid.NewGuid().ToString("N")));
        Assert.True(second.ExistingActiveJob);
        Assert.Equal(first.Job.JobId, second.Job.JobId);
        Assert.Equal(1, await db.ReportOfficialPdfJobs.CountAsync(j => j.ReportId == numbered.Id));
    }

    [Fact]
    public async Task Failed_Generation_Preserves_Previous_Current_And_Invariants()
    {
        var (numbered, pdf, _, db, _, _, _, _) = await NumberedReleasedFixtureAsync();
        var first = await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "ok-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();
        var report = await db.Reports.SingleAsync(r => r.Id == numbered.Id);
        var current = report.CurrentOfficialArtifactId;
        Assert.NotNull(current);
        var number = report.BusinessReportNumber;
        var status = report.Status;
        var ver = report.CurrentVersionNumber;

        // Force failure on next job by removing signatory after request
        var second = await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "fail-" + Guid.NewGuid().ToString("N")));
        db.ReportPdfSignatories.RemoveRange(db.ReportPdfSignatories);
        await db.SaveChangesAsync();
        await pdf.ProcessPendingJobsAsync();

        var job = await db.ReportOfficialPdfJobs.SingleAsync(j => j.Id == second.Job.JobId);
        Assert.Equal(OfficialPdfJobStatuses.Failed, job.Status);
        report = await db.Reports.SingleAsync(r => r.Id == numbered.Id);
        Assert.Equal(current, report.CurrentOfficialArtifactId);
        Assert.Equal(number, report.BusinessReportNumber);
        Assert.Equal(status, report.Status);
        Assert.Equal(ver, report.CurrentVersionNumber);
        _ = first;
    }

    [Fact]
    public async Task Regeneration_Increments_Artifact_Version()
    {
        var (numbered, pdf, _, db, _, _, _, _) = await NumberedReleasedFixtureAsync();
        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "v1-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();
        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "v2-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();

        var versions = await db.ReportOfficialPdfArtifacts
            .Where(a => a.ReportId == numbered.Id && a.Status == OfficialPdfArtifactStatuses.Succeeded)
            .Select(a => a.ArtifactVersion)
            .OrderBy(v => v)
            .ToListAsync();
        Assert.Equal(new[] { 1, 2 }, versions);
        var report = await db.Reports.SingleAsync(r => r.Id == numbered.Id);
        var current = await db.ReportOfficialPdfArtifacts.SingleAsync(a => a.Id == report.CurrentOfficialArtifactId);
        Assert.Equal(2, current.ArtifactVersion);
    }

    [Fact]
    public async Task Exact_CatalogueVersion_Not_Current_Catalogue()
    {
        var (numbered, pdf, _, db, _, _, exactName, cvId) = await NumberedReleasedFixtureAsync();
        // Mutate a *different* catalogue version display name that is "current" active — must not affect PDF
        var cat = await db.CatalogueVersions.SingleAsync(c => c.Id == cvId);
        var decoy = new LmsCatalogueVersion
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            CatalogueItemId = cat.CatalogueItemId,
            VersionNumber = cat.VersionNumber + 10,
            Status = CatalogueStatuses.Active,
            InternalOrderCode = cat.InternalOrderCode,
            DisplayName = "DECOY CURRENT NAME",
            Discipline = cat.Discipline,
            Classification = cat.Classification,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = _actor,
            RowVersion = 1,
        };
        db.CatalogueVersions.Add(decoy);
        await db.SaveChangesAsync();

        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "cv-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();

        var reportVersion = await db.ReportVersions.SingleAsync(v =>
            v.ReportId == numbered.Id && v.VersionNumber == numbered.CurrentVersionNumber);
        var source = await db.ReportVersionSources.SingleAsync(s => s.ReportVersionId == reportVersion.Id);
        Assert.Equal(cvId, source.CatalogueVersionId);
        Assert.NotEqual(decoy.Id, source.CatalogueVersionId);
        var exact = await db.CatalogueVersions.SingleAsync(c => c.Id == cvId);
        Assert.Equal(exactName, exact.DisplayName);
        Assert.NotEqual("DECOY CURRENT NAME", exact.DisplayName);
    }

    [Fact]
    public void Permission_Constant_Is_Generate()
    {
        Assert.Equal("lms.reports.generate", LaboratoryAuthz.ReportsGenerate);
        Assert.Equal("generate_official_pdf", ReportIdempotencyOperations.GenerateOfficialPdf);
        Assert.Equal("REQUEST_OFFICIAL_PDF", ReportAuditActions.RequestOfficialPdf);
        Assert.Equal("OFFICIAL_PDF_GENERATED", ReportAuditActions.OfficialPdfGenerated);
        Assert.Equal("OFFICIAL_PDF_FAILED", ReportAuditActions.OfficialPdfFailed);
    }

    [Fact]
    public void Pdf_Renderer_Produces_Pdf_Bytes_For_Approved_Model()
    {
        var model = new OfficialPdfRenderModel(
            "UAT Laboratory", OfficialPdfTestAssets.TinyPng, "image/png",
            "RPT-20261012-000001", "MRN-1", "Test Patient",
            new[]
            {
                new OfficialPdfLineItem("GLU", "Glucose", "5.0", "mmol/L", "note", Guid.NewGuid(), "Dr A"),
            },
            "Sig", "MD");
        AssertApprovedPdfModel(model);
        var a = new OfficialPdfRenderer().Render(model);
        AssertPdfContainsApprovedContent(a, model);
        _ = SHA256.HashData(a);
    }

    private static void AssertApprovedPdfModel(OfficialPdfRenderModel model)
    {
        Assert.False(string.IsNullOrWhiteSpace(model.BusinessReportNumber));
        Assert.False(string.IsNullOrWhiteSpace(model.PatientMrn));
        Assert.False(string.IsNullOrWhiteSpace(model.PatientName));
        Assert.False(string.IsNullOrWhiteSpace(model.HospitalLaboratoryName));
        Assert.NotEmpty(model.LogoContent);
        Assert.False(string.IsNullOrWhiteSpace(model.SignatoryName));
        Assert.NotEmpty(model.Lines);
        foreach (var line in model.Lines)
        {
            Assert.False(string.IsNullOrWhiteSpace(line.TestDisplayName));
            Assert.False(string.IsNullOrWhiteSpace(line.ResultText));
        }
        Assert.DoesNotContain("DOB", typeof(OfficialPdfRenderModel).GetProperties().Select(p => p.Name));
        Assert.DoesNotContain("ReferenceRange", typeof(OfficialPdfLineItem).GetProperties().Select(p => p.Name));
        Assert.DoesNotContain("Diagnosis", typeof(OfficialPdfLineItem).GetProperties().Select(p => p.Name));
        Assert.DoesNotContain("Interpretation", typeof(OfficialPdfLineItem).GetProperties().Select(p => p.Name));
        Assert.DoesNotContain("Barcode", typeof(OfficialPdfLineItem).GetProperties().Select(p => p.Name));
    }

    private static void AssertPdfContainsApprovedContent(byte[] pdfBytes, OfficialPdfRenderModel model)
    {
        Assert.True(pdfBytes.Length > 100);
        Assert.StartsWith("%PDF", Encoding.ASCII.GetString(pdfBytes.AsSpan(0, 4)));
        using var doc = PdfDocument.Open(pdfBytes);
        var text = string.Join('\n', doc.GetPages().Select(p => p.Text));
        Assert.Contains(model.BusinessReportNumber, text);
        Assert.Contains(model.PatientMrn, text);
        Assert.Contains(model.PatientName, text);
        Assert.Contains(model.HospitalLaboratoryName, text);
        Assert.Contains(model.SignatoryName, text);
        Assert.Contains(model.SignatoryCredentialsText, text);
        foreach (var line in model.Lines)
        {
            Assert.Contains(line.TestDisplayName, text);
            Assert.Contains(line.ResultText, text);
            if (!string.IsNullOrWhiteSpace(line.Unit))
                Assert.Contains(line.Unit!, text);
            if (!string.IsNullOrWhiteSpace(line.Comment))
                Assert.Contains(line.Comment!, text);
            if (!string.IsNullOrWhiteSpace(line.AuthorizedByDisplayName))
                Assert.Contains(line.AuthorizedByDisplayName!, text);
            Assert.Contains(line.SpecimenId.ToString("D"), text);
        }
        Assert.DoesNotContain("reference range", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("diagnosis", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("interpretation", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("1990-01-01", text);
        Assert.DoesNotContain("barcode", text, StringComparison.OrdinalIgnoreCase);
    }

    // --- L-REP-03 CUT C staff download ---

    [Fact]
    public async Task Download_Eligible_Succeeds_And_Audits()
    {
        var (numbered, pdf, _, _, audit, canonical, _, _) = await NumberedReleasedFixtureAsync();
        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "dl-ok-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();

        await using var result = await pdf.DownloadAsync(_tenant, _actor, numbered.Id, _branch);
        Assert.Equal($"{numbered.BusinessReportNumber}.pdf", result.FileName);
        Assert.Equal("application/pdf", result.ContentType);
        using var ms = new MemoryStream();
        await result.Content.Content.CopyToAsync(ms);
        Assert.True(ms.Length > 0);
        Assert.StartsWith("%PDF", Encoding.ASCII.GetString(ms.ToArray().AsSpan(0, 4)));

        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, ReportAuditActions.DownloadOfficialPdf, ReportAuditResources.LmsReport,
            numbered.Id, It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
        canonical.Verify(c => c.OpenOfficialPdfContentAsync(
            It.Is<OpenLmsOfficialPdfContentRequest>(r =>
                r.TenantId == _tenant && r.ArtifactId != Guid.Empty && r.CanonicalDocumentId != null),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Download_Wrong_Branch_Denied()
    {
        var (numbered, pdf, _, _, _, _, _, _) = await NumberedReleasedFixtureAsync();
        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "dl-br-" + Guid.NewGuid().ToString("N")));

        var ex = await Assert.ThrowsAsync<OrderDomainException>(() =>
            pdf.DownloadAsync(_tenant, _actor, numbered.Id, _otherBranch));
        Assert.Equal(403, ex.StatusCode);
        Assert.Equal("branch_unauthorized", ex.Code);
    }

    [Fact]
    public async Task Download_Draft_And_Unnumbered_Denied()
    {
        var (db, _, _, pdf, reports, specimens, orders, catalogue, collection, results) = Create();
        var itemId = await ActivateTestAsync(catalogue, db, "DL-D-" + Guid.NewGuid().ToString("N")[..6], "DL Draft");
        var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
        var order = await orders.SubmitAsync(_tenant, _actor, draft.Id, new SubmitOrderRequest(draft.RowVersion));
        var otId = order.CurrentVersion!.Tests.Single().Id;
        var planned = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, new[] { otId }, LocationText: "Bay 1"));
        planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
            new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.Ready));
        planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
            new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.InProgress));
        planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
            new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.Completed));
        var specimen = await specimens.CompleteCollectionAsync(_tenant, _actor, planned.Id,
            new CompleteCollectionRequest(planned.RowVersion, true));
        specimen = await specimens.ReceiveAsync(_tenant, _actor, specimen.Id, new ReceiveSpecimenRequest(
            specimen.RowVersion, _branch, true, specimen.PatientMrnSnapshot!, specimen.PatientNameSnapshot!,
            specimen.PatientDateOfBirthSnapshot!.Value, "Bench"));
        var result = await results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
            otId, specimen.Id, _branch, NumericValue: "1", Unit: "mg/dL"));
        var verified = await results.VerifyAsync(_tenant, _actor, result.Id, new VerifyResultRequest(
            _branch, result.RowVersion, result.CurrentVersionNumber));
        var authorized = await results.AuthorizeAsync(_tenant, _actor, verified.Id, new AuthorizeResultRequest(
            _branch, verified.RowVersion, verified.CurrentVersionNumber));
        await SeedNumberConfigAsync(db, _tenant, _branch, _actor);
        await SeedPdfConfigAsync(db, _tenant, _actor);
        var reportDraft = await reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
            _branch, "dl-draft-" + Guid.NewGuid().ToString("N"),
            new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) }));

        var draftEx = await Assert.ThrowsAsync<TestingDomainException>(() =>
            pdf.DownloadAsync(_tenant, _actor, reportDraft.Id, _branch));
        Assert.Equal(409, draftEx.StatusCode);
        Assert.Equal("invalid_state", draftEx.Code);

        var finalized = await reports.FinalizeAsync(_tenant, _actor, reportDraft.Id, new FinalizeReportRequest(
            _branch, "dl-f-" + Guid.NewGuid().ToString("N"), reportDraft.RowVersion));
        var released = await reports.ReleaseAsync(_tenant, _actor, reportDraft.Id, new ReleaseReportRequest(
            _branch, "dl-r-" + Guid.NewGuid().ToString("N"), finalized.RowVersion));

        var unnumberedEx = await Assert.ThrowsAsync<TestingDomainException>(() =>
            pdf.DownloadAsync(_tenant, _actor, reportDraft.Id, _branch));
        Assert.Equal(409, unnumberedEx.StatusCode);
        Assert.Equal("report_number_required", unnumberedEx.Code);
        _ = released;
    }

    [Fact]
    public async Task Download_Without_Current_Artifact_Denied()
    {
        var (numbered, pdf, _, _, _, _, _, _) = await NumberedReleasedFixtureAsync();
        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            pdf.DownloadAsync(_tenant, _actor, numbered.Id, _branch));
        Assert.Equal(409, ex.StatusCode);
        Assert.Equal("invalid_state", ex.Code);
    }

    [Fact]
    public async Task Download_Audit_Failure_Prevents_Content_Open()
    {
        var (numbered, pdfOk, _, db, audit, canonical, _, _) = await NumberedReleasedFixtureAsync();
        await pdfOk.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "dl-audit-gen-" + Guid.NewGuid().ToString("N")));
        await pdfOk.ProcessPendingJobsAsync();

        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), ReportAuditActions.DownloadOfficialPdf,
                It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("audit down"));

        var platform = new Mock<IPlatformReferenceClient>();
        platform.Setup(p => p.ValidateUserBranchAsync(
                _tenant, _actor, _branch, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserBranchRef(_actor, _branch, true));

        var pdf = new OfficialPdfService(
            db, audit.Object, platform.Object, new OfficialPdfRenderer(), canonical.Object);

        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            pdf.DownloadAsync(_tenant, _actor, numbered.Id, _branch));
        Assert.Equal(503, ex.StatusCode);
        Assert.Equal("audit_unavailable", ex.Code);
        canonical.Verify(c => c.OpenOfficialPdfContentAsync(
            It.IsAny<OpenLmsOfficialPdfContentRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Download_Failed_Artifact_Denied()
    {
        var (numbered, pdf, _, db, _, _, _, _) = await NumberedReleasedFixtureAsync();
        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "dl-fail-art-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();

        var report = await db.Reports.SingleAsync(r => r.Id == numbered.Id);
        var artifact = await db.ReportOfficialPdfArtifacts.SingleAsync(a => a.Id == report.CurrentOfficialArtifactId);
        artifact.Status = OfficialPdfArtifactStatuses.Failed;
        await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            pdf.DownloadAsync(_tenant, _actor, numbered.Id, _branch));
        Assert.Equal(409, ex.StatusCode);
        Assert.Equal("invalid_state", ex.Code);
    }

    [Fact]
    public async Task Download_Repeated_Audits_Each_Time()
    {
        var (numbered, pdf, _, _, audit, _, _, _) = await NumberedReleasedFixtureAsync();
        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "dl-rep-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();

        await using (var first = await pdf.DownloadAsync(_tenant, _actor, numbered.Id, _branch))
        {
            Assert.Equal($"{numbered.BusinessReportNumber}.pdf", first.FileName);
        }

        await using (var second = await pdf.DownloadAsync(_tenant, _actor, numbered.Id, _branch))
        {
            Assert.Equal($"{numbered.BusinessReportNumber}.pdf", second.FileName);
        }

        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, ReportAuditActions.DownloadOfficialPdf, ReportAuditResources.LmsReport,
            numbered.Id, It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task List_Projects_OfficialPdfDownloadEligible()
    {
        var (numbered, pdf, reports, _, _, _, _, _) = await NumberedReleasedFixtureAsync();
        var before = await reports.ListAsync(
            _tenant, _actor, new ReportListQuery(_branch, null, null, null, 1, 50));
        Assert.Contains(before.Items, i => i.Id == numbered.Id && !i.OfficialPdfDownloadEligible);

        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "dl-list-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();

        var after = await reports.ListAsync(
            _tenant, _actor, new ReportListQuery(_branch, null, null, null, 1, 50));
        var row = Assert.Single(after.Items, i => i.Id == numbered.Id);
        Assert.True(row.OfficialPdfDownloadEligible);
    }

    [Fact]
    public async Task Download_Auth_Unavailable_Is_Controlled_Failure()
    {
        var (numbered, pdfOk, _, db, audit, _, _, _) = await NumberedReleasedFixtureAsync();
        await pdfOk.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "dl-auth-fail-" + Guid.NewGuid().ToString("N")));
        await pdfOk.ProcessPendingJobsAsync();

        var canonical = new Mock<IPlatformCanonicalDocumentClient>();
        canonical.Setup(c => c.OpenOfficialPdfContentAsync(
                It.IsAny<OpenLmsOfficialPdfContentRequest>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new TestingDomainException(
                "Official PDF content unavailable.", statusCode: 503, code: "platform_unavailable"));

        var platform = new Mock<IPlatformReferenceClient>();
        platform.Setup(p => p.ValidateUserBranchAsync(
                _tenant, _actor, _branch, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserBranchRef(_actor, _branch, true));

        var pdf = new OfficialPdfService(
            db, audit.Object, platform.Object, new OfficialPdfRenderer(), canonical.Object);

        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            pdf.DownloadAsync(_tenant, _actor, numbered.Id, _branch));
        Assert.Equal(503, ex.StatusCode);
        Assert.Equal("platform_unavailable", ex.Code);
    }

    [Fact]
    public async Task Download_Uses_Current_Pointer_Not_Historical_Artifact()
    {
        var (numbered, pdf, _, db, _, _, _, _) = await NumberedReleasedFixtureAsync();
        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "dl-hist-1-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();
        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "dl-hist-2-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();

        var report = await db.Reports.SingleAsync(r => r.Id == numbered.Id);
        var current = await db.ReportOfficialPdfArtifacts.SingleAsync(a => a.Id == report.CurrentOfficialArtifactId);
        Assert.Equal(2, current.ArtifactVersion);
        var historical = await db.ReportOfficialPdfArtifacts.SingleAsync(a =>
            a.ReportId == numbered.Id && a.ArtifactVersion == 1);
        Assert.NotEqual(historical.Id, current.Id);

        await using var result = await pdf.DownloadAsync(_tenant, _actor, numbered.Id, _branch);
        Assert.Equal($"{numbered.BusinessReportNumber}.pdf", result.FileName);
        // Download path never accepts artifactId; only CurrentOfficialArtifactId is used.
        Assert.Equal(2, (await db.Reports.AsNoTracking().SingleAsync(r => r.Id == numbered.Id))
            .CurrentOfficialArtifactId == current.Id ? 2 : 0);
    }

    // --- L-REP-03 CUT D-B Patient 360 current Official PDF projection ---

    [Fact]
    public async Task PatientProjection_Eligible_Current_Official_Pdf_Is_Projected()
    {
        var (numbered, pdf, _, _, _, _, _, _) = await NumberedReleasedFixtureAsync();
        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "p360-ok-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();

        var items = await pdf.ListPatientCurrentOfficialPdfsAsync(_tenant, _actor, _patient);
        var row = Assert.Single(items);
        Assert.Equal(numbered.Id, row.ReportId);
        Assert.Equal(_patient, row.PatientId);
        Assert.Equal(_branch, row.OperatingBranchId);
        Assert.Equal(numbered.BusinessReportNumber, row.BusinessReportNumber);
        Assert.Equal("enterprise_lms", row.SourceDomain);
        Assert.Equal("LmsReportOfficialPdfArtifact", row.SourceEntityType);
        Assert.NotEqual(Guid.Empty, row.CanonicalDocumentId);
        Assert.Equal("application/pdf", row.MimeType);
    }

    [Fact]
    public async Task PatientProjection_Other_Patient_Report_Not_Returned()
    {
        var (numbered, pdf, _, _, _, _, _, _) = await NumberedReleasedFixtureAsync();
        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "p360-other-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();

        var otherPatient = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
        var items = await pdf.ListPatientCurrentOfficialPdfsAsync(_tenant, _actor, otherPatient);
        Assert.Empty(items);
        Assert.Single(await pdf.ListPatientCurrentOfficialPdfsAsync(_tenant, _actor, _patient));
        _ = numbered;
    }

    [Fact]
    public async Task PatientProjection_No_Current_Artifact_Produces_Empty()
    {
        var (numbered, pdf, _, _, _, _, _, _) = await NumberedReleasedFixtureAsync();
        var items = await pdf.ListPatientCurrentOfficialPdfsAsync(_tenant, _actor, _patient);
        Assert.Empty(items);
        _ = numbered;
    }

    [Fact]
    public async Task PatientProjection_Excludes_Historical_Artifacts()
    {
        var (numbered, pdf, _, db, _, _, _, _) = await NumberedReleasedFixtureAsync();
        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "p360-h1-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();
        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "p360-h2-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();

        var report = await db.Reports.AsNoTracking().SingleAsync(r => r.Id == numbered.Id);
        var current = await db.ReportOfficialPdfArtifacts.AsNoTracking()
            .SingleAsync(a => a.Id == report.CurrentOfficialArtifactId);
        Assert.Equal(2, current.ArtifactVersion);
        Assert.Equal(2, await db.ReportOfficialPdfArtifacts.CountAsync(a => a.ReportId == numbered.Id));

        var items = await pdf.ListPatientCurrentOfficialPdfsAsync(_tenant, _actor, _patient);
        var row = Assert.Single(items);
        Assert.Equal(current.Id, row.ArtifactId);
        Assert.Equal(2, row.ArtifactVersion);
        Assert.Equal(current.CanonicalDocumentId, row.CanonicalDocumentId);
    }

    [Fact]
    public async Task PatientProjection_Successful_Regeneration_Exposes_Only_New_Current()
    {
        var (numbered, pdf, _, db, _, _, _, _) = await NumberedReleasedFixtureAsync();
        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "p360-r1-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();
        var firstPointer = (await db.Reports.AsNoTracking().SingleAsync(r => r.Id == numbered.Id))
            .CurrentOfficialArtifactId;

        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "p360-r2-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();
        var secondPointer = (await db.Reports.AsNoTracking().SingleAsync(r => r.Id == numbered.Id))
            .CurrentOfficialArtifactId;
        Assert.NotEqual(firstPointer, secondPointer);

        var items = await pdf.ListPatientCurrentOfficialPdfsAsync(_tenant, _actor, _patient);
        var row = Assert.Single(items);
        Assert.Equal(secondPointer, row.ArtifactId);
    }

    [Fact]
    public async Task PatientProjection_Failed_Regeneration_Keeps_Prior_Current()
    {
        var (numbered, pdf, _, db, _, _, _, _) = await NumberedReleasedFixtureAsync();
        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "p360-f1-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();
        var priorPointer = (await db.Reports.AsNoTracking().SingleAsync(r => r.Id == numbered.Id))
            .CurrentOfficialArtifactId;
        Assert.NotNull(priorPointer);

        // Enqueue a job then fail it without advancing the current pointer.
        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "p360-f2-" + Guid.NewGuid().ToString("N")));
        var job = await db.ReportOfficialPdfJobs.SingleAsync(j =>
            j.ReportId == numbered.Id && j.Status == OfficialPdfJobStatuses.Pending);
        job.Status = OfficialPdfJobStatuses.Failed;
        job.CompletedAtUtc = DateTime.UtcNow;
        job.FailureCode = "generation_failed";
        job.FailureMessage = "forced failure for projection test";
        await db.SaveChangesAsync();

        var after = await db.Reports.AsNoTracking().SingleAsync(r => r.Id == numbered.Id);
        Assert.Equal(priorPointer, after.CurrentOfficialArtifactId);

        var items = await pdf.ListPatientCurrentOfficialPdfsAsync(_tenant, _actor, _patient);
        var row = Assert.Single(items);
        Assert.Equal(priorPointer, row.ArtifactId);
    }

    [Fact]
    public async Task PatientProjection_Cross_Tenant_Denied()
    {
        var (numbered, pdf, _, _, _, _, _, _) = await NumberedReleasedFixtureAsync();
        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "p360-tenant-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();

        var otherTenant = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var items = await pdf.ListPatientCurrentOfficialPdfsAsync(otherTenant, _actor, _patient);
        Assert.Empty(items);
    }

    [Fact]
    public async Task PatientProjection_Unauthorized_Branch_Excluded_Option_B()
    {
        var (numbered, pdf, _, db, _, _, _, _) = await NumberedReleasedFixtureAsync();
        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "p360-br-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();

        var report = await db.Reports.SingleAsync(r => r.Id == numbered.Id);
        report.OperatingBranchId = _otherBranch;
        await db.SaveChangesAsync();

        var items = await pdf.ListPatientCurrentOfficialPdfsAsync(_tenant, _actor, _patient);
        Assert.Empty(items);
    }

    [Fact]
    public async Task PatientProjection_Does_Not_Accept_Client_Branch_Bypass()
    {
        // ListPatientCurrentOfficialPdfsAsync has no operatingBranchId parameter — Option B resolves
        // report.OperatingBranchId server-side. Wrong-branch reports remain excluded even if a client
        // would have supplied an authorized branch id on a different API.
        var method = typeof(IOfficialPdfService).GetMethod(nameof(IOfficialPdfService.ListPatientCurrentOfficialPdfsAsync));
        Assert.NotNull(method);
        Assert.DoesNotContain(method!.GetParameters(), p =>
            p.Name != null && p.Name.Contains("branch", StringComparison.OrdinalIgnoreCase));

        var (numbered, pdf, _, db, _, _, _, _) = await NumberedReleasedFixtureAsync();
        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "p360-bypass-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();
        var report = await db.Reports.SingleAsync(r => r.Id == numbered.Id);
        report.OperatingBranchId = _otherBranch;
        await db.SaveChangesAsync();

        var items = await pdf.ListPatientCurrentOfficialPdfsAsync(_tenant, _actor, _patient);
        Assert.Empty(items);

        // CUT C download still rejects client branch ≠ report.OperatingBranchId (server equality).
        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            pdf.DownloadAsync(_tenant, _actor, numbered.Id, _branch));
        Assert.Equal(403, ex.StatusCode);
        Assert.Equal("branch_unauthorized", ex.Code);
    }

    [Fact]
    public async Task PatientProjection_Missing_Canonical_Association_Excluded()
    {
        var (numbered, pdf, _, db, _, _, _, _) = await NumberedReleasedFixtureAsync();
        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "p360-canon-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();

        var report = await db.Reports.SingleAsync(r => r.Id == numbered.Id);
        var artifact = await db.ReportOfficialPdfArtifacts.SingleAsync(a => a.Id == report.CurrentOfficialArtifactId);
        artifact.CanonicalDocumentId = null;
        await db.SaveChangesAsync();

        var items = await pdf.ListPatientCurrentOfficialPdfsAsync(_tenant, _actor, _patient);
        Assert.Empty(items);
    }

    [Fact]
    public async Task PatientProjection_CutC_Download_Behavior_Unchanged()
    {
        var (numbered, pdf, _, _, audit, canonical, _, _) = await NumberedReleasedFixtureAsync();
        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "p360-cutc-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();

        _ = await pdf.ListPatientCurrentOfficialPdfsAsync(_tenant, _actor, _patient);

        await using var result = await pdf.DownloadAsync(_tenant, _actor, numbered.Id, _branch);
        Assert.Equal($"{numbered.BusinessReportNumber}.pdf", result.FileName);
        Assert.Equal("application/pdf", result.ContentType);

        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, ReportAuditActions.DownloadOfficialPdf, ReportAuditResources.LmsReport,
            numbered.Id, It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
        canonical.Verify(c => c.OpenOfficialPdfContentAsync(
            It.IsAny<OpenLmsOfficialPdfContentRequest>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Download_Audit_Failure_Still_Fail_Closed_After_Projection()
    {
        var (numbered, pdfOk, _, db, audit, canonical, _, _) = await NumberedReleasedFixtureAsync();
        await pdfOk.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "p360-audit-" + Guid.NewGuid().ToString("N")));
        await pdfOk.ProcessPendingJobsAsync();
        Assert.Single(await pdfOk.ListPatientCurrentOfficialPdfsAsync(_tenant, _actor, _patient));

        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), ReportAuditActions.DownloadOfficialPdf,
                It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("audit down"));

        var platform = new Mock<IPlatformReferenceClient>();
        platform.Setup(p => p.ValidateUserBranchAsync(
                _tenant, _actor, _branch, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserBranchRef(_actor, _branch, true));

        var pdf = new OfficialPdfService(
            db, audit.Object, platform.Object, new OfficialPdfRenderer(), canonical.Object);

        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            pdf.DownloadAsync(_tenant, _actor, numbered.Id, _branch));
        Assert.Equal(503, ex.StatusCode);
        Assert.Equal("audit_unavailable", ex.Code);
        canonical.Verify(c => c.OpenOfficialPdfContentAsync(
            It.IsAny<OpenLmsOfficialPdfContentRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // --- L-REP-03 CUT D-C currentness / regeneration validation ---

    [Fact]
    public async Task Currentness_ReportDetail_Worklist_Patient360_And_Download_Resolve_Same_Current_After_Regeneration()
    {
        var (numbered, pdf, reports, db, _, canonical, _, _) = await NumberedReleasedFixtureAsync();
        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "dc-c1-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();
        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "dc-c2-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();

        var report = await db.Reports.AsNoTracking().SingleAsync(r => r.Id == numbered.Id);
        var currentId = report.CurrentOfficialArtifactId;
        Assert.NotNull(currentId);
        Assert.Equal(2, await db.ReportOfficialPdfArtifacts.CountAsync(a =>
            a.ReportId == numbered.Id && a.Status == OfficialPdfArtifactStatuses.Succeeded));

        var detail = await reports.GetAsync(_tenant, _actor, numbered.Id, _branch);
        Assert.Equal(currentId, detail.CurrentOfficialArtifactId);
        Assert.NotNull(detail.CurrentOfficialArtifact);
        Assert.Equal(currentId, detail.CurrentOfficialArtifact!.ArtifactId);
        Assert.Equal(2, detail.CurrentOfficialArtifact.ArtifactVersion);

        var list = await reports.ListAsync(
            _tenant, _actor, new ReportListQuery(_branch, null, null, null, 1, 50));
        var worklistRow = Assert.Single(list.Items, i => i.Id == numbered.Id);
        Assert.True(worklistRow.OfficialPdfDownloadEligible);

        var projected = Assert.Single(await pdf.ListPatientCurrentOfficialPdfsAsync(_tenant, _actor, _patient));
        Assert.Equal(currentId, projected.ArtifactId);
        Assert.Equal(2, projected.ArtifactVersion);

        await using var download = await pdf.DownloadAsync(_tenant, _actor, numbered.Id, _branch);
        Assert.Equal($"{numbered.BusinessReportNumber}.pdf", download.FileName);
        canonical.Verify(c => c.OpenOfficialPdfContentAsync(
            It.Is<OpenLmsOfficialPdfContentRequest>(r => r.ArtifactId == currentId),
            It.IsAny<CancellationToken>()), Times.AtLeastOnce);
    }

    [Fact]
    public async Task Currentness_ContentHash_Does_Not_Override_Current_Pointer()
    {
        var (numbered, pdf, _, db, _, _, _, _) = await NumberedReleasedFixtureAsync();
        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "dc-hash-1-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();
        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "dc-hash-2-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();

        var report = await db.Reports.SingleAsync(r => r.Id == numbered.Id);
        var currentId = report.CurrentOfficialArtifactId;
        Assert.NotNull(currentId);

        var current = await db.ReportOfficialPdfArtifacts.SingleAsync(a => a.Id == currentId);
        var prior = await db.ReportOfficialPdfArtifacts.SingleAsync(a =>
            a.ReportId == numbered.Id && a.Id != currentId);
        Assert.Equal(1, prior.ArtifactVersion);
        Assert.Equal(2, current.ArtifactVersion);

        // PD-D-HASH-REUSE: copying the current ContentHash onto the superseded artifact must not
        // make the superseded artifact appear as current in Patient 360 or Download.
        prior.ContentHash = current.ContentHash;
        prior.GeneratedAtUtc = current.GeneratedAtUtc.AddMinutes(5);
        await db.SaveChangesAsync();

        Assert.Equal(currentId, (await db.Reports.AsNoTracking().SingleAsync(r => r.Id == numbered.Id))
            .CurrentOfficialArtifactId);

        var projected = Assert.Single(await pdf.ListPatientCurrentOfficialPdfsAsync(_tenant, _actor, _patient));
        Assert.Equal(currentId, projected.ArtifactId);
        Assert.Equal(2, projected.ArtifactVersion);
        Assert.NotEqual(prior.Id, projected.ArtifactId);

        await using var download = await pdf.DownloadAsync(_tenant, _actor, numbered.Id, _branch);
        Assert.Equal($"{numbered.BusinessReportNumber}.pdf", download.FileName);
    }

    // --- L-REP-03 CUT D-D P1 automated coverage ---

    [Fact]
    public async Task PatientProjection_Failed_Current_Artifact_Is_Not_Projected()
    {
        var (numbered, pdf, _, db, _, _, _, _) = await NumberedReleasedFixtureAsync();
        await pdf.GenerateAsync(_tenant, _actor, numbered.Id, new GenerateOfficialPdfRequest(
            _branch, "dd-fail-cur-" + Guid.NewGuid().ToString("N")));
        await pdf.ProcessPendingJobsAsync();

        var report = await db.Reports.SingleAsync(r => r.Id == numbered.Id);
        var pointerBefore = report.CurrentOfficialArtifactId;
        Assert.NotNull(pointerBefore);
        Assert.Single(await pdf.ListPatientCurrentOfficialPdfsAsync(_tenant, _actor, _patient));

        var artifact = await db.ReportOfficialPdfArtifacts.SingleAsync(a => a.Id == pointerBefore);
        artifact.Status = OfficialPdfArtifactStatuses.Failed;
        await db.SaveChangesAsync();

        var items = await pdf.ListPatientCurrentOfficialPdfsAsync(_tenant, _actor, _patient);
        Assert.Empty(items);

        var reportAfter = await db.Reports.AsNoTracking().SingleAsync(r => r.Id == numbered.Id);
        Assert.Equal(pointerBefore, reportAfter.CurrentOfficialArtifactId);
    }
}
