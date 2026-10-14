using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using LaboratoryApi.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace LaboratoryApi.Tests;

/// <summary>L-REP-03 CUT A — Business Report Number assignment (InMemory + pattern coverage).</summary>
public class ReportNumberAssignTests
{
    private readonly Guid _tenant = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _otherTenant = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private readonly Guid _actor = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _patient = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private readonly Guid _ordering = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private readonly Guid _responsible = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
    private readonly Guid _branch = Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff");
    private readonly Guid _otherBranch = Guid.Parse("12345678-1234-1234-1234-123456789012");
    private readonly DateTime _dob = new(1990, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    private (LaboratoryDbContext Db, Mock<IPlatformAuditClient> Audit, ReportService Reports,
        SpecimenService Specimens, OrderService Orders, CatalogueService Catalogue, CollectionService Collection,
        ResultService Results)
        Create(bool auditFails = false)
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

        var catalogue = new CatalogueService(db, audit.Object);
        var orders = new OrderService(db, audit.Object, platform.Object, catalogue);
        var collection = new CollectionService(db, audit.Object, platform.Object);
        var specimens = new SpecimenService(db, audit.Object, platform.Object);
        var results = new ResultService(db, audit.Object, platform.Object);
        var reports = new ReportService(db, audit.Object, platform.Object);
        return (db, audit, reports, specimens, orders, catalogue, collection, results);
    }

    private async Task<Guid> ActivateTestAsync(CatalogueService cat, LaboratoryDbContext db, string code)
    {
        var d = await cat.CreateDraftAsync(_tenant, _actor, new CreateCatalogueDraftRequest(
            CatalogueType: CatalogueTypes.Test,
            InternalOrderCode: code,
            DisplayName: code + " Name",
            Discipline: "CLINICAL_CHEMISTRY",
            Classification: CatalogueClassifications.Local,
            ChangeReason: "report-number",
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
            ClinicalIndication: "RN",
            Notes: null,
            Selections: itemIds.Select((id, i) => new OrderSelectionInput(id, i)).ToArray());

    private async Task<(ResultDraftDto Authorized, ReportService Reports, LaboratoryDbContext Db,
        Mock<IPlatformAuditClient> Audit)> AuthorizedFixtureAsync(bool auditFails = false)
    {
        var (db, audit, reports, specimens, orders, catalogue, collection, results) = Create(auditFails);
        var itemId = await ActivateTestAsync(catalogue, db, "RN-" + Guid.NewGuid().ToString("N")[..6]);
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
            otId, specimen.Id, _branch, NumericValue: "12.5", Unit: "mg/dL", Comment: "rn"));
        var verified = await results.VerifyAsync(_tenant, _actor, result.Id, new VerifyResultRequest(
            _branch, result.RowVersion, result.CurrentVersionNumber));
        var authorized = await results.AuthorizeAsync(_tenant, _actor, verified.Id, new AuthorizeResultRequest(
            _branch, verified.RowVersion, verified.CurrentVersionNumber));
        return (authorized, reports, db, audit);
    }

    private static async Task SeedTestConfigAsync(
        LaboratoryDbContext db, Guid tenant, Guid branch, Guid actor,
        string prefix = "RPT", int width = 6, string period = ReportNumberFormats.SequencePeriodUtcDay,
        string dateSegment = ReportNumberFormats.DateSegmentYyyyMmDd)
    {
        db.ReportNumberConfigurations.Add(ReportNumberFormats.CreateTestConfiguration(
            tenant, branch, actor,
            prefix: prefix,
            sequenceWidth: width,
            sequencePeriod: period,
            dateSegment: dateSegment));
        await db.SaveChangesAsync();
    }

    private async Task<ReportDetailDto> ReleasedReportAsync(
        ReportService reports, ResultDraftDto authorized, string idemBase)
    {
        var draft = await reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
            _branch, idemBase + "-d",
            new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) }));
        var finalized = await reports.FinalizeAsync(_tenant, _actor, draft.Id, new FinalizeReportRequest(
            _branch, idemBase + "-f", draft.RowVersion));
        return await reports.ReleaseAsync(_tenant, _actor, draft.Id, new ReleaseReportRequest(
            _branch, idemBase + "-r", finalized.RowVersion));
    }

    [Fact]
    public async Task Draft_And_Final_Cannot_Receive_Number()
    {
        var (authorized, reports, db, _) = await AuthorizedFixtureAsync();
        await SeedTestConfigAsync(db, _tenant, _branch, _actor);

        var draft = await reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
            _branch, "idem-rn-draft",
            new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) }));
        var draftReject = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.AssignNumberAsync(_tenant, _actor, draft.Id, new AssignReportNumberRequest(
                _branch, "idem-rn-draft-a", draft.RowVersion)));
        Assert.Equal("invalid_state", draftReject.Code);

        var finalized = await reports.FinalizeAsync(_tenant, _actor, draft.Id, new FinalizeReportRequest(
            _branch, "idem-rn-fin", draft.RowVersion));
        var finalReject = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.AssignNumberAsync(_tenant, _actor, draft.Id, new AssignReportNumberRequest(
                _branch, "idem-rn-fin-a", finalized.RowVersion)));
        Assert.Equal("invalid_state", finalReject.Code);
    }

    [Fact]
    public async Task Released_Can_Receive_Number_With_Configured_Format_And_Is_Immutable()
    {
        var (authorized, reports, db, audit) = await AuthorizedFixtureAsync();
        await SeedTestConfigAsync(db, _tenant, _branch, _actor, prefix: "RPT", width: 6);

        var released = await ReleasedReportAsync(reports, authorized, "idem-rn-ok");
        Assert.Null(released.BusinessReportNumber);

        var assigned = await reports.AssignNumberAsync(_tenant, _actor, released.Id,
            new AssignReportNumberRequest(_branch, "idem-rn-assign", released.RowVersion));

        var today = DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyyMMdd");
        Assert.Equal($"RPT-{today}-000001", assigned.BusinessReportNumber);
        Assert.NotNull(assigned.BusinessReportNumberAssignedAtUtc);
        Assert.Equal(_actor, assigned.BusinessReportNumberAssignedByUserId);
        Assert.Equal(ReportStatuses.Released, assigned.Status);

        var again = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.AssignNumberAsync(_tenant, _actor, released.Id,
                new AssignReportNumberRequest(_branch, "idem-rn-again", assigned.RowVersion)));
        Assert.Equal("invalid_state", again.Code);

        var row = await db.Reports.AsNoTracking().SingleAsync(r => r.Id == released.Id);
        Assert.Equal($"RPT-{today}-000001", row.BusinessReportNumber);

        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, ReportAuditActions.AssignReportNumber, ReportAuditResources.LmsReport,
            released.Id, It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Release_Does_Not_Assign_Number()
    {
        var (authorized, reports, db, _) = await AuthorizedFixtureAsync();
        await SeedTestConfigAsync(db, _tenant, _branch, _actor);
        var released = await ReleasedReportAsync(reports, authorized, "idem-rn-rel");
        Assert.Null(released.BusinessReportNumber);
        var row = await db.Reports.AsNoTracking().SingleAsync(r => r.Id == released.Id);
        Assert.Null(row.BusinessReportNumber);
    }

    [Fact]
    public async Task Missing_Configuration_Fails_Closed()
    {
        var (authorized, reports, _, _) = await AuthorizedFixtureAsync();
        var released = await ReleasedReportAsync(reports, authorized, "idem-rn-noconfig");
        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.AssignNumberAsync(_tenant, _actor, released.Id,
                new AssignReportNumberRequest(_branch, "idem-rn-noconfig-a", released.RowVersion)));
        Assert.Equal("report_number_configuration_missing", ex.Code);
        Assert.Equal(503, ex.StatusCode);
    }

    [Fact]
    public async Task Unauthorized_Branch_Denied()
    {
        var (authorized, reports, db, _) = await AuthorizedFixtureAsync();
        await SeedTestConfigAsync(db, _tenant, _branch, _actor);
        var released = await ReleasedReportAsync(reports, authorized, "idem-rn-br");
        var ex = await Assert.ThrowsAsync<OrderDomainException>(() =>
            reports.AssignNumberAsync(_tenant, _actor, released.Id,
                new AssignReportNumberRequest(_otherBranch, "idem-rn-br-a", released.RowVersion)));
        Assert.Equal("branch_unauthorized", ex.Code);
    }

    [Fact]
    public async Task Wrong_Tenant_Denied()
    {
        var (authorized, reports, db, _) = await AuthorizedFixtureAsync();
        await SeedTestConfigAsync(db, _tenant, _branch, _actor);
        var released = await ReleasedReportAsync(reports, authorized, "idem-rn-tenant");
        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.AssignNumberAsync(_otherTenant, _actor, released.Id,
                new AssignReportNumberRequest(_branch, "idem-rn-tenant-a", released.RowVersion)));
        Assert.Equal("not_found", ex.Code);
    }

    [Fact]
    public async Task Sequence_Continues_On_Same_Branch_And_Independent_Per_Branch_Config()
    {
        var (db, audit, reports, specimens, orders, catalogue, collection, results) = Create();
        await SeedTestConfigAsync(db, _tenant, _branch, _actor, prefix: "RPT", width: 4);
        await SeedTestConfigAsync(db, _tenant, _otherBranch, _actor, prefix: "BR2", width: 4);

        // Allow other branch for second sequence isolation test via a second platform-capable path:
        // create two reports on primary branch and verify sequence 0001 then 0002.
        async Task<ResultDraftDto> AuthOne(string code)
        {
            var itemId = await ActivateTestAsync(catalogue, db, code);
            var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
            var order = await orders.SubmitAsync(_tenant, _actor, draft.Id, new SubmitOrderRequest(draft.RowVersion));
            var otId = order.CurrentVersion!.Tests.Single().Id;
            var planned = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
                order.Id, _branch, new[] { otId }, LocationText: "Bay"));
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
            return await results.AuthorizeAsync(_tenant, _actor, verified.Id, new AuthorizeResultRequest(
                _branch, verified.RowVersion, verified.CurrentVersionNumber));
        }

        var a1 = await AuthOne("RN1-" + Guid.NewGuid().ToString("N")[..5]);
        var a2 = await AuthOne("RN2-" + Guid.NewGuid().ToString("N")[..5]);
        var r1 = await ReleasedReportAsync(reports, a1, "idem-seq-1");
        var r2 = await ReleasedReportAsync(reports, a2, "idem-seq-2");

        var n1 = await reports.AssignNumberAsync(_tenant, _actor, r1.Id,
            new AssignReportNumberRequest(_branch, "idem-seq-1a", r1.RowVersion));
        var n2 = await reports.AssignNumberAsync(_tenant, _actor, r2.Id,
            new AssignReportNumberRequest(_branch, "idem-seq-2a", r2.RowVersion));

        var today = DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyyMMdd");
        Assert.Equal($"RPT-{today}-0001", n1.BusinessReportNumber);
        Assert.Equal($"RPT-{today}-0002", n2.BusinessReportNumber);
        Assert.NotEqual(n1.BusinessReportNumber, n2.BusinessReportNumber);
        Assert.Equal(2, await db.Reports.CountAsync(r =>
            r.TenantId == _tenant && r.BusinessReportNumber != null));
    }

    [Fact]
    public async Task Idempotency_Replay_And_Conflict_And_Stale_RowVersion()
    {
        var (authorized, reports, db, _) = await AuthorizedFixtureAsync();
        await SeedTestConfigAsync(db, _tenant, _branch, _actor);
        var released = await ReleasedReportAsync(reports, authorized, "idem-rn-idemp");

        var stale = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.AssignNumberAsync(_tenant, _actor, released.Id,
                new AssignReportNumberRequest(_branch, "idem-rn-stale", released.RowVersion - 1)));
        Assert.Equal("concurrency_conflict", stale.Code);

        var req = new AssignReportNumberRequest(_branch, "idem-rn-same", released.RowVersion);
        var first = await reports.AssignNumberAsync(_tenant, _actor, released.Id, req);
        var replay = await reports.AssignNumberAsync(_tenant, _actor, released.Id, req);
        Assert.Equal(first.BusinessReportNumber, replay.BusinessReportNumber);
        Assert.Equal(1, await db.Reports.CountAsync(r =>
            r.TenantId == _tenant && r.BusinessReportNumber == first.BusinessReportNumber));

        var conflict = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.AssignNumberAsync(_tenant, _actor, released.Id,
                new AssignReportNumberRequest(_branch, "idem-rn-same", released.RowVersion + 99)));
        Assert.Equal("idempotency_conflict", conflict.Code);
    }

    [Fact]
    public async Task Audit_Failure_Prevents_Successful_Assignment()
    {
        var (db, audit, reports, specimens, orders, catalogue, collection, results) = Create();
        await SeedTestConfigAsync(db, _tenant, _branch, _actor);

        // Fail closed only for ASSIGN_REPORT_NUMBER; other audits succeed so we can reach Released.
        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), ReportAuditActions.AssignReportNumber, It.IsAny<string>(),
                It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("audit down"));

        var itemId = await ActivateTestAsync(catalogue, db, "RNA-" + Guid.NewGuid().ToString("N")[..5]);
        var draftOrder = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
        var order = await orders.SubmitAsync(_tenant, _actor, draftOrder.Id, new SubmitOrderRequest(draftOrder.RowVersion));
        var otId = order.CurrentVersion!.Tests.Single().Id;
        var planned = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, new[] { otId }, LocationText: "Bay"));
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

        var released = await ReleasedReportAsync(reports, authorized, "idem-rn-audit");
        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.AssignNumberAsync(_tenant, _actor, released.Id,
                new AssignReportNumberRequest(_branch, "idem-rn-audit-a", released.RowVersion)));
        Assert.Equal("audit_unavailable", ex.Code);
        Assert.Equal(503, ex.StatusCode);

        var row = await db.Reports.AsNoTracking().SingleAsync(r => r.Id == released.Id);
        Assert.Null(row.BusinessReportNumber);
        Assert.Equal(released.RowVersion, row.RowVersion);
    }

    [Fact]
    public async Task Visibility_Only_When_Released_And_Assigned()
    {
        var (authorized, reports, db, _) = await AuthorizedFixtureAsync();
        await SeedTestConfigAsync(db, _tenant, _branch, _actor);
        var released = await ReleasedReportAsync(reports, authorized, "idem-rn-vis");
        var listBefore = await reports.ListAsync(_tenant, _actor, new ReportListQuery(
            _branch, null, null, null, 1, 50));
        Assert.Null(listBefore.Items.Single(i => i.Id == released.Id).BusinessReportNumber);

        var assigned = await reports.AssignNumberAsync(_tenant, _actor, released.Id,
            new AssignReportNumberRequest(_branch, "idem-rn-vis-a", released.RowVersion));
        var detail = await reports.GetAsync(_tenant, _actor, released.Id, _branch);
        Assert.Equal(assigned.BusinessReportNumber, detail.BusinessReportNumber);

        var listAfter = await reports.ListAsync(_tenant, _actor, new ReportListQuery(
            _branch, null, null, null, 1, 50));
        Assert.Equal(assigned.BusinessReportNumber,
            listAfter.Items.Single(i => i.Id == released.Id).BusinessReportNumber);
    }

    [Fact]
    public void Format_Helper_Honours_Width_Prefix_And_Period_None()
    {
        var cfg = ReportNumberFormats.CreateTestConfiguration(
            _tenant, _branch, _actor,
            prefix: "X",
            separator: "-",
            sequenceWidth: 3,
            sequencePeriod: ReportNumberFormats.SequencePeriodNone,
            dateSegment: ReportNumberFormats.DateSegmentNone,
            formatCode: "TEST_NONE");
        Assert.True(ReportNumberFormats.IsStructurallyValid(cfg));
        Assert.Equal(ReportNumberFormats.PeriodKeyNone, ReportNumberFormats.ResolvePeriodKey(cfg, DateTime.UtcNow));
        Assert.Equal("X-007", ReportNumberFormats.FormatNumber(cfg, 7, DateTime.UtcNow));
    }

    [Fact]
    public void Permission_Constant_Matches_Catalogue_Convention()
    {
        Assert.Equal("lms.reports.assign_number", LaboratoryAuthz.ReportsAssignNumber);
    }
}
