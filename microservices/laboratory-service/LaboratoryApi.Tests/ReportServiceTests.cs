using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using LaboratoryApi.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace LaboratoryApi.Tests;

/// <summary>L-REP-01 — Report Foundation (Draft + immutable ReportVersion snapshots).</summary>
public class ReportServiceTests
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

    private (LaboratoryDbContext Db, Mock<IPlatformAuditClient> Audit, ResultService Results,
        ReportService Reports, SpecimenService Specimens, OrderService Orders, CatalogueService Catalogue,
        CollectionService Collection)
        Create()
    {
        var db = new LaboratoryDbContext(new DbContextOptionsBuilder<LaboratoryDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options);
        var audit = new Mock<IPlatformAuditClient>();
        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

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
        return (db, audit, results, reports, specimens, orders, catalogue, collection);
    }

    private async Task<Guid> ActivateTestAsync(CatalogueService cat, LaboratoryDbContext db, string code)
    {
        var d = await cat.CreateDraftAsync(_tenant, _actor, new CreateCatalogueDraftRequest(
            CatalogueType: CatalogueTypes.Test,
            InternalOrderCode: code,
            DisplayName: code + " Name",
            Discipline: "CLINICAL_CHEMISTRY",
            Classification: CatalogueClassifications.Local,
            ChangeReason: "testing",
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

    private CreateOrderDraftRequest DraftReq(params Guid[] catalogueItemIds) =>
        new(
            PatientId: _patient,
            VisitId: null,
            OrderingProviderUserId: _ordering,
            ResponsibleClinicianUserId: _responsible,
            OperatingBranchId: _branch,
            OrderSource: OrderSources.Clinician,
            Priority: OrderPriorities.Routine,
            PriorityReason: null,
            ClinicalIndication: "Report UAT",
            Notes: null,
            Selections: catalogueItemIds.Select((id, i) => new OrderSelectionInput(id, i)).ToArray());

    private async Task<(ResultDraftDto Authorized, ReportService Reports, ResultService Results,
            LaboratoryDbContext Db, Mock<IPlatformAuditClient> Audit, Guid OrderTestId, Guid SpecimenId)>
        AuthorizedFixtureAsync()
    {
        var (db, audit, results, reports, specimens, orders, catalogue, collection) = Create();
        var itemId = await ActivateTestAsync(catalogue, db, "REP-" + Guid.NewGuid().ToString("N")[..6]);
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
            otId, specimen.Id, _branch, NumericValue: "12.5", Unit: "mg/dL", Comment: "draft"));
        var verified = await results.VerifyAsync(_tenant, _actor, result.Id, new VerifyResultRequest(
            _branch, result.RowVersion, result.CurrentVersionNumber));
        var authorized = await results.AuthorizeAsync(_tenant, _actor, verified.Id, new AuthorizeResultRequest(
            _branch, verified.RowVersion, verified.CurrentVersionNumber));
        return (authorized, reports, results, db, audit, otId, specimen.Id);
    }

    [Fact]
    public async Task Create_Draft_Report_From_One_ClinicallyAuthorized_ResultVersion()
    {
        var (authorized, reports, _, db, audit, otId, _) = await AuthorizedFixtureAsync();
        var report = await reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
            _branch, "idem-rep-1", new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) }));

        Assert.Equal(ReportStatuses.Draft, report.Status);
        Assert.Equal(1, report.CurrentVersionNumber);
        Assert.Single(report.Versions);
        var src = Assert.Single(report.Versions[0].Sources);
        Assert.Equal(authorized.Id, src.ResultId);
        Assert.Equal(authorized.CurrentVersionNumber, src.ResultVersionNumber);
        Assert.Equal("12.5", src.NumericValue);
        Assert.Equal(ResultStatuses.ClinicallyAuthorized, src.ResultStatusAtSnapshot);

        var result = await db.Results.AsNoTracking().FirstAsync(r => r.Id == authorized.Id);
        Assert.Equal(ResultStatuses.ClinicallyAuthorized, result.Status);
        var ot = await db.OrderTests.AsNoTracking().FirstAsync(t => t.Id == otId);
        Assert.Equal(OrderTestStatuses.Ordered, ot.Status);

        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, ReportAuditActions.CreateReportDraft, ReportAuditResources.LmsReport,
            report.Id, It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Create_Draft_Report_From_Multiple_Compatible_ResultVersions()
    {
        var (db, _, results, reports, specimens, orders, catalogue, collection) = Create();
        var itemA = await ActivateTestAsync(catalogue, db, "RA-" + Guid.NewGuid().ToString("N")[..6]);
        var itemB = await ActivateTestAsync(catalogue, db, "RB-" + Guid.NewGuid().ToString("N")[..6]);
        var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemA, itemB));
        var order = await orders.SubmitAsync(_tenant, _actor, draft.Id, new SubmitOrderRequest(draft.RowVersion));
        var otIds = order.CurrentVersion!.Tests.Select(t => t.Id).ToArray();
        var planned = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, otIds, LocationText: "Bay 1"));
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

        var authorized = new List<ResultDraftDto>();
        foreach (var otId in otIds)
        {
            var r = await results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
                otId, specimen.Id, _branch, NumericValue: "1.1", Unit: "mg/dL"));
            r = await results.VerifyAsync(_tenant, _actor, r.Id, new VerifyResultRequest(
                _branch, r.RowVersion, r.CurrentVersionNumber));
            r = await results.AuthorizeAsync(_tenant, _actor, r.Id, new AuthorizeResultRequest(
                _branch, r.RowVersion, r.CurrentVersionNumber));
            authorized.Add(r);
        }

        var report = await reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
            _branch, "idem-multi",
            authorized.Select(a => new ReportSourceResultRef(a.Id, a.CurrentVersionNumber)).ToList()));

        Assert.Equal(2, report.Versions[0].Sources.Count);
        Assert.Equal(ReportStatuses.Draft, report.Status);
    }

    [Fact]
    public async Task Reject_Draft_Result()
    {
        var (db, _, results, reports, specimens, orders, catalogue, collection) = Create();
        var itemId = await ActivateTestAsync(catalogue, db, "DR-" + Guid.NewGuid().ToString("N")[..6]);
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

        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
                _branch, "idem-draft", new[] { new ReportSourceResultRef(result.Id, result.CurrentVersionNumber) })));
        Assert.Equal("invalid_state", ex.Code);
    }

    [Fact]
    public async Task Reject_TechnicalVerified_Result()
    {
        var (db, _, results, reports, specimens, orders, catalogue, collection) = Create();
        var itemId = await ActivateTestAsync(catalogue, db, "TV-" + Guid.NewGuid().ToString("N")[..6]);
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

        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
                _branch, "idem-tv", new[] { new ReportSourceResultRef(verified.Id, verified.CurrentVersionNumber) })));
        Assert.Equal("invalid_state", ex.Code);
    }

    [Fact]
    public async Task Reject_NonAuthorized_Version_Number()
    {
        var (authorized, reports, _, _, _, _, _) = await AuthorizedFixtureAsync();
        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
                _branch, "idem-ver", new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber + 5) })));
        Assert.Equal("version_not_authorized", ex.Code);
    }

    [Fact]
    public async Task Reject_Missing_Result_As_Pathology_Or_Unknown()
    {
        var (_, reports, _, _, _, _, _) = await AuthorizedFixtureAsync();
        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
                _branch, "idem-miss", new[] { new ReportSourceResultRef(Guid.NewGuid(), 1) })));
        Assert.Equal("not_found", ex.Code);
        Assert.Contains("Legacy Pathology", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Reject_Unauthorized_Branch()
    {
        var (authorized, reports, _, _, _, _, _) = await AuthorizedFixtureAsync();
        var ex = await Assert.ThrowsAsync<OrderDomainException>(() =>
            reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
                _otherBranch, "idem-br", new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) })));
        Assert.Equal("branch_unauthorized", ex.Code);
    }

    [Fact]
    public async Task Reject_Cross_Tenant_Source()
    {
        var (authorized, reports, _, db, _, _, _) = await AuthorizedFixtureAsync();
        var row = await db.Results.FirstAsync(r => r.Id == authorized.Id);
        row.TenantId = _otherTenant;
        await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
                _branch, "idem-tenant", new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) })));
        Assert.Equal("not_found", ex.Code);
    }

    [Fact]
    public async Task Atomic_Failure_When_One_Of_Several_Sources_Invalid()
    {
        var (authorized, reports, _, db, _, _, _) = await AuthorizedFixtureAsync();
        var before = await db.Reports.CountAsync();
        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
                _branch, "idem-atomic",
                new[]
                {
                    new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber),
                    new ReportSourceResultRef(Guid.NewGuid(), 1),
                })));
        Assert.Equal("not_found", ex.Code);
        Assert.Equal(before, await db.Reports.CountAsync());
    }

    [Fact]
    public async Task Snapshot_Preserves_Exact_Binding_And_Is_Immutable_When_Result_Read_Later()
    {
        var (authorized, reports, _, db, _, _, _) = await AuthorizedFixtureAsync();
        var report = await reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
            _branch, "idem-snap", new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) }));
        var snap = report.Versions[0].Sources[0];
        var versionRow = await db.ResultVersions.AsNoTracking()
            .FirstAsync(v => v.ResultId == authorized.Id && v.VersionNumber == authorized.CurrentVersionNumber);
        Assert.Equal(versionRow.Id, snap.ResultVersionId);
        Assert.Equal(versionRow.NumericValue, snap.NumericValue);

        // Mutate live Result current fields — historical ReportVersion must not change.
        var live = await db.Results.FirstAsync(r => r.Id == authorized.Id);
        live.NumericValue = "999.9";
        live.Comment = "mutated-live";
        await db.SaveChangesAsync();

        var again = await reports.GetVersionAsync(
            _tenant, _actor, report.Id, 1, _branch);
        Assert.Equal("12.5", again.Sources[0].NumericValue);
        Assert.Equal(snap.ResultVersionId, again.Sources[0].ResultVersionId);
        Assert.DoesNotContain("mutated", again.Sources[0].Comment ?? string.Empty);
    }

    [Fact]
    public async Task Append_Creates_Distinct_Version_With_Concurrency()
    {
        var (authorized, reports, _, _, _, _, _) = await AuthorizedFixtureAsync();
        var report = await reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
            _branch, "idem-a1", new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) }));

        var stale = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.AppendVersionAsync(_tenant, _actor, report.Id, new AppendReportVersionRequest(
                _branch, "idem-a2", ExpectedRowVersion: report.RowVersion - 1,
                Sources: new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) })));
        Assert.Equal("concurrency_conflict", stale.Code);

        var appended = await reports.AppendVersionAsync(_tenant, _actor, report.Id, new AppendReportVersionRequest(
            _branch, "idem-a3", report.RowVersion,
            new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) }));
        Assert.Equal(2, appended.CurrentVersionNumber);
        Assert.Equal(2, appended.Versions.Count);
        Assert.Equal(ReportStatuses.Draft, appended.Status);
        Assert.NotEqual(appended.Versions[0].Id, appended.Versions[1].Id);
    }

    [Fact]
    public async Task Idempotency_Replay_And_Conflict()
    {
        var (authorized, reports, _, _, _, _, _) = await AuthorizedFixtureAsync();
        var req = new CreateReportDraftRequest(
            _branch, "idem-same", new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) });
        var first = await reports.CreateDraftAsync(_tenant, _actor, req);
        var replay = await reports.CreateDraftAsync(_tenant, _actor, req);
        Assert.Equal(first.Id, replay.Id);

        var conflict = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
                _branch, "idem-same",
                new[] { new ReportSourceResultRef(Guid.NewGuid(), 1) })));
        Assert.Equal("idempotency_conflict", conflict.Code);
    }

    [Fact]
    public async Task Duplicate_Exact_ResultVersion_Rejected_With_Different_Idempotency_Key()
    {
        var (authorized, reports, _, db, audit, _, _) = await AuthorizedFixtureAsync();
        var first = await reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
            _branch, "idem-uniq-1",
            new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) }));
        Assert.Equal(ReportStatuses.Draft, first.Status);

        var versionRow = await db.ResultVersions.AsNoTracking()
            .FirstAsync(v => v.ResultId == authorized.Id && v.VersionNumber == authorized.CurrentVersionNumber);
        Assert.Equal(1, await db.ReportDraftSourceClaims.CountAsync(c =>
            c.TenantId == _tenant && c.ResultVersionId == versionRow.Id));

        var duplicate = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
                _branch, "idem-uniq-2",
                new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) })));
        Assert.Equal("report_source_already_in_draft", duplicate.Code);
        Assert.Equal(409, duplicate.StatusCode);
        Assert.Equal(1, await db.Reports.CountAsync(r => r.TenantId == _tenant));

        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, ReportAuditActions.CreateReportDraft, ReportAuditResources.LmsReport,
            It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Eligible_Sources_Exclude_ResultVersion_Already_In_Draft()
    {
        var (authorized, reports, _, _, _, _, _) = await AuthorizedFixtureAsync();
        var before = await reports.ListEligibleSourcesAsync(_tenant, _actor, _branch);
        Assert.Contains(before.Items, i => i.ResultId == authorized.Id);

        await reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
            _branch, "idem-elig-1",
            new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) }));

        var after = await reports.ListEligibleSourcesAsync(_tenant, _actor, _branch);
        Assert.DoesNotContain(after.Items, i => i.ResultId == authorized.Id);
    }

    [Fact]
    public async Task Append_Same_ResultVersion_On_Same_Draft_Does_Not_Conflict()
    {
        var (authorized, reports, _, db, _, _, _) = await AuthorizedFixtureAsync();
        var report = await reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
            _branch, "idem-append-same-1",
            new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) }));

        var appended = await reports.AppendVersionAsync(_tenant, _actor, report.Id, new AppendReportVersionRequest(
            _branch, "idem-append-same-2", report.RowVersion,
            new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) }));
        Assert.Equal(2, appended.CurrentVersionNumber);

        var versionRow = await db.ResultVersions.AsNoTracking()
            .FirstAsync(v => v.ResultId == authorized.Id && v.VersionNumber == authorized.CurrentVersionNumber);
        Assert.Equal(1, await db.ReportDraftSourceClaims.CountAsync(c =>
            c.TenantId == _tenant && c.ResultVersionId == versionRow.Id && c.ReportId == report.Id));
    }

    [Fact]
    public async Task Audit_Failure_Fails_Closed()
    {
        var (authorized, reports, _, db, audit, _, _) = await AuthorizedFixtureAsync();
        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("audit down"));

        var before = await db.Reports.CountAsync();
        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
                _branch, "idem-audit", new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) })));
        Assert.Equal("audit_unavailable", ex.Code);
        Assert.Equal(before, await db.Reports.CountAsync());
        Assert.Equal(0, await db.ReportDraftSourceClaims.CountAsync(c => c.TenantId == _tenant));
    }

    [Fact]
    public void ResultStatuses_Unchanged_And_ReportStatuses_Separate()
    {
        Assert.Equal("Draft", ResultStatuses.Draft);
        Assert.Equal("TechnicalVerified", ResultStatuses.TechnicalVerified);
        Assert.Equal("ClinicallyAuthorized", ResultStatuses.ClinicallyAuthorized);
        Assert.Equal(
            new[] { ResultStatuses.Draft, ResultStatuses.TechnicalVerified, ResultStatuses.ClinicallyAuthorized },
            new[] { ResultStatuses.Draft, ResultStatuses.TechnicalVerified, ResultStatuses.ClinicallyAuthorized });
        Assert.Equal(ReportStatuses.Draft, "Draft");
        Assert.NotEqual(typeof(ResultStatuses), typeof(ReportStatuses));
    }

    [Fact]
    public async Task List_And_Get_Respect_Branch()
    {
        var (authorized, reports, _, _, _, _, _) = await AuthorizedFixtureAsync();
        var report = await reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
            _branch, "idem-list", new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) }));

        var page = await reports.ListAsync(_tenant, _actor, new ReportListQuery(_branch, null, null, null, 1, 25));
        Assert.Contains(page.Items, i => i.Id == report.Id);

        var detail = await reports.GetAsync(_tenant, _actor, report.Id, _branch);
        Assert.Equal(report.Id, detail.Id);
        Assert.Equal(ReportStatuses.Draft, detail.Status);
    }

    [Fact]
    public async Task Finalize_Draft_To_Final_Preserves_Version_And_Blocks_Append()
    {
        var (authorized, reports, _, db, audit, _, _) = await AuthorizedFixtureAsync();
        var draft = await reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
            _branch, "idem-fin-1",
            new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) }));
        var versionCountBefore = await db.ReportVersions.CountAsync(v => v.ReportId == draft.Id);

        var finalized = await reports.FinalizeAsync(_tenant, _actor, draft.Id, new FinalizeReportRequest(
            _branch, "idem-fin-ok", draft.RowVersion));

        Assert.Equal(ReportStatuses.Final, finalized.Status);
        Assert.Equal(draft.CurrentVersionNumber, finalized.CurrentVersionNumber);
        Assert.Equal(versionCountBefore, await db.ReportVersions.CountAsync(v => v.ReportId == draft.Id));
        Assert.NotNull(finalized.FinalizedAtUtc);
        Assert.Equal(_actor, finalized.FinalizedByUserId);
        Assert.True(
            finalized.FinalizedAtUtc!.Value.Kind is DateTimeKind.Utc or DateTimeKind.Unspecified);

        var result = await db.Results.AsNoTracking().FirstAsync(r => r.Id == authorized.Id);
        Assert.Equal(ResultStatuses.ClinicallyAuthorized, result.Status);

        var append = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.AppendVersionAsync(_tenant, _actor, draft.Id, new AppendReportVersionRequest(
                _branch, "idem-fin-append", finalized.RowVersion,
                new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) })));
        Assert.Equal("invalid_state", append.Code);

        var again = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.FinalizeAsync(_tenant, _actor, draft.Id, new FinalizeReportRequest(
                _branch, "idem-fin-again", finalized.RowVersion)));
        Assert.Equal("invalid_state", again.Code);

        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, ReportAuditActions.FinalizeReport, ReportAuditResources.LmsReport,
            draft.Id, It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Finalize_Idempotency_Replay_And_Conflict_And_Stale_RowVersion()
    {
        var (authorized, reports, _, _, _, _, _) = await AuthorizedFixtureAsync();
        var draft = await reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
            _branch, "idem-fin-base",
            new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) }));

        var stale = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.FinalizeAsync(_tenant, _actor, draft.Id, new FinalizeReportRequest(
                _branch, "idem-fin-stale", draft.RowVersion - 1)));
        Assert.Equal("concurrency_conflict", stale.Code);

        var req = new FinalizeReportRequest(_branch, "idem-fin-same", draft.RowVersion);
        var first = await reports.FinalizeAsync(_tenant, _actor, draft.Id, req);
        var replay = await reports.FinalizeAsync(_tenant, _actor, draft.Id, req);
        Assert.Equal(first.Id, replay.Id);
        Assert.Equal(ReportStatuses.Final, replay.Status);

        var conflict = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.FinalizeAsync(_tenant, _actor, draft.Id, new FinalizeReportRequest(
                _branch, "idem-fin-same", draft.RowVersion + 99)));
        Assert.Equal("idempotency_conflict", conflict.Code);
    }

    [Fact]
    public async Task Finalize_Audit_Failure_Fails_Closed_And_Claims_Remain()
    {
        var (authorized, reports, _, db, audit, _, _) = await AuthorizedFixtureAsync();
        var draft = await reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
            _branch, "idem-fin-audit-prep",
            new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) }));

        var claimsBefore = await db.ReportDraftSourceClaims.CountAsync(c => c.ReportId == draft.Id);
        Assert.True(claimsBefore >= 1);

        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), ReportAuditActions.FinalizeReport,
                It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("audit down"));

        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.FinalizeAsync(_tenant, _actor, draft.Id, new FinalizeReportRequest(
                _branch, "idem-fin-audit", draft.RowVersion)));
        Assert.Equal("audit_unavailable", ex.Code);

        var row = await db.Reports.AsNoTracking().FirstAsync(r => r.Id == draft.Id);
        Assert.Equal(ReportStatuses.Draft, row.Status);
        Assert.Null(row.FinalizedAtUtc);
        Assert.Null(row.FinalizedByUserId);
        Assert.Equal(claimsBefore, await db.ReportDraftSourceClaims.CountAsync(c => c.ReportId == draft.Id));

        var eligible = await reports.ListEligibleSourcesAsync(_tenant, _actor, _branch);
        Assert.DoesNotContain(eligible.Items, i => i.ResultId == authorized.Id);
    }

    [Fact]
    public async Task Finalize_Keeps_Claim_Blocking_New_Draft()
    {
        var (authorized, reports, _, _, _, _, _) = await AuthorizedFixtureAsync();
        var draft = await reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
            _branch, "idem-fin-claim-1",
            new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) }));
        await reports.FinalizeAsync(_tenant, _actor, draft.Id, new FinalizeReportRequest(
            _branch, "idem-fin-claim-2", draft.RowVersion));

        var duplicate = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
                _branch, "idem-fin-claim-3",
                new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) })));
        Assert.Equal("report_source_already_in_draft", duplicate.Code);
    }

    [Fact]
    public async Task Release_Draft_Rejected_And_Final_Succeeds_Without_New_Version()
    {
        var (authorized, reports, _, db, audit, _, _) = await AuthorizedFixtureAsync();
        var draft = await reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
            _branch, "idem-rel-draft",
            new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) }));

        var draftReject = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.ReleaseAsync(_tenant, _actor, draft.Id, new ReleaseReportRequest(
                _branch, "idem-rel-draft-key", draft.RowVersion)));
        Assert.Equal("invalid_state", draftReject.Code);

        var finalized = await reports.FinalizeAsync(_tenant, _actor, draft.Id, new FinalizeReportRequest(
            _branch, "idem-rel-fin", draft.RowVersion));
        var versionCountBefore = await db.ReportVersions.CountAsync(v => v.ReportId == draft.Id);
        var claimsBefore = await db.ReportDraftSourceClaims.CountAsync(c => c.ReportId == draft.Id);
        var sourceSnapshot = (await reports.GetAsync(_tenant, _actor, draft.Id, _branch))
            .Versions.Single().Sources.Single();

        var released = await reports.ReleaseAsync(_tenant, _actor, draft.Id, new ReleaseReportRequest(
            _branch, "idem-rel-ok", finalized.RowVersion));

        Assert.Equal(ReportStatuses.Released, released.Status);
        Assert.Equal(finalized.CurrentVersionNumber, released.CurrentVersionNumber);
        Assert.Equal(versionCountBefore, await db.ReportVersions.CountAsync(v => v.ReportId == draft.Id));
        Assert.NotNull(released.ReleasedAtUtc);
        Assert.Equal(_actor, released.ReleasedByUserId);
        Assert.True(
            released.ReleasedAtUtc!.Value.Kind is DateTimeKind.Utc or DateTimeKind.Unspecified);
        Assert.Equal(finalized.FinalizedAtUtc, released.FinalizedAtUtc);
        Assert.Equal(finalized.FinalizedByUserId, released.FinalizedByUserId);

        var after = await reports.GetAsync(_tenant, _actor, draft.Id, _branch);
        var afterSource = after.Versions.Single().Sources.Single();
        Assert.Equal(sourceSnapshot.ResultVersionId, afterSource.ResultVersionId);
        Assert.Equal(sourceSnapshot.NumericValue, afterSource.NumericValue);
        Assert.Equal(sourceSnapshot.ResultStatusAtSnapshot, afterSource.ResultStatusAtSnapshot);

        var result = await db.Results.AsNoTracking().FirstAsync(r => r.Id == authorized.Id);
        Assert.Equal(ResultStatuses.ClinicallyAuthorized, result.Status);
        Assert.Equal(claimsBefore, await db.ReportDraftSourceClaims.CountAsync(c => c.ReportId == draft.Id));
        Assert.Equal(0, await db.CriticalResultEvents.CountAsync(e => e.TenantId == _tenant));

        var again = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.ReleaseAsync(_tenant, _actor, draft.Id, new ReleaseReportRequest(
                _branch, "idem-rel-again", released.RowVersion)));
        Assert.Equal("invalid_state", again.Code);

        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, ReportAuditActions.ReleaseReport, ReportAuditResources.LmsReport,
            draft.Id, It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Release_Idempotency_Replay_And_Conflict_And_Stale_RowVersion()
    {
        var (authorized, reports, _, _, _, _, _) = await AuthorizedFixtureAsync();
        var draft = await reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
            _branch, "idem-rel-base",
            new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) }));
        var finalized = await reports.FinalizeAsync(_tenant, _actor, draft.Id, new FinalizeReportRequest(
            _branch, "idem-rel-base-fin", draft.RowVersion));

        var stale = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.ReleaseAsync(_tenant, _actor, draft.Id, new ReleaseReportRequest(
                _branch, "idem-rel-stale", finalized.RowVersion - 1)));
        Assert.Equal("concurrency_conflict", stale.Code);

        var req = new ReleaseReportRequest(_branch, "idem-rel-same", finalized.RowVersion);
        var first = await reports.ReleaseAsync(_tenant, _actor, draft.Id, req);
        var replay = await reports.ReleaseAsync(_tenant, _actor, draft.Id, req);
        Assert.Equal(first.Id, replay.Id);
        Assert.Equal(ReportStatuses.Released, replay.Status);

        var conflict = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.ReleaseAsync(_tenant, _actor, draft.Id, new ReleaseReportRequest(
                _branch, "idem-rel-same", finalized.RowVersion + 99)));
        Assert.Equal("idempotency_conflict", conflict.Code);
    }

    [Fact]
    public async Task Release_Audit_Failure_Fails_Closed_And_Claims_Remain()
    {
        var (authorized, reports, _, db, audit, _, _) = await AuthorizedFixtureAsync();
        var draft = await reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
            _branch, "idem-rel-audit-prep",
            new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) }));
        var finalized = await reports.FinalizeAsync(_tenant, _actor, draft.Id, new FinalizeReportRequest(
            _branch, "idem-rel-audit-fin", draft.RowVersion));

        var claimsBefore = await db.ReportDraftSourceClaims.CountAsync(c => c.ReportId == draft.Id);
        Assert.True(claimsBefore >= 1);

        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), ReportAuditActions.ReleaseReport,
                It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("audit down"));

        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.ReleaseAsync(_tenant, _actor, draft.Id, new ReleaseReportRequest(
                _branch, "idem-rel-audit", finalized.RowVersion)));
        Assert.Equal("audit_unavailable", ex.Code);

        var row = await db.Reports.AsNoTracking().FirstAsync(r => r.Id == draft.Id);
        Assert.Equal(ReportStatuses.Final, row.Status);
        Assert.Null(row.ReleasedAtUtc);
        Assert.Null(row.ReleasedByUserId);
        Assert.NotNull(row.FinalizedAtUtc);
        Assert.Equal(claimsBefore, await db.ReportDraftSourceClaims.CountAsync(c => c.ReportId == draft.Id));
    }

    [Fact]
    public async Task Release_Keeps_Claim_Blocking_New_Draft()
    {
        var (authorized, reports, _, _, _, _, _) = await AuthorizedFixtureAsync();
        var draft = await reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
            _branch, "idem-rel-claim-1",
            new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) }));
        var finalized = await reports.FinalizeAsync(_tenant, _actor, draft.Id, new FinalizeReportRequest(
            _branch, "idem-rel-claim-2", draft.RowVersion));
        await reports.ReleaseAsync(_tenant, _actor, draft.Id, new ReleaseReportRequest(
            _branch, "idem-rel-claim-3", finalized.RowVersion));

        var duplicate = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
                _branch, "idem-rel-claim-4",
                new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) })));
        Assert.Equal("report_source_already_in_draft", duplicate.Code);
    }

    [Fact]
    public async Task Release_Rejects_Wrong_Branch_Wrong_Tenant_And_Cross_Branch()
    {
        var (authorized, reports, _, db, _, _, _) = await AuthorizedFixtureAsync();
        var draft = await reports.CreateDraftAsync(_tenant, _actor, new CreateReportDraftRequest(
            _branch, "idem-rel-auth-1",
            new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) }));
        var finalized = await reports.FinalizeAsync(_tenant, _actor, draft.Id, new FinalizeReportRequest(
            _branch, "idem-rel-auth-2", draft.RowVersion));

        var wrongBranch = await Assert.ThrowsAsync<OrderDomainException>(() =>
            reports.ReleaseAsync(_tenant, _actor, draft.Id, new ReleaseReportRequest(
                _otherBranch, "idem-rel-auth-br", finalized.RowVersion)));
        Assert.Equal("branch_unauthorized", wrongBranch.Code);

        var missing = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.ReleaseAsync(_otherTenant, _actor, draft.Id, new ReleaseReportRequest(
                _branch, "idem-rel-auth-tenant", finalized.RowVersion)));
        Assert.Equal("not_found", missing.Code);

        var row = await db.Reports.FirstAsync(r => r.Id == draft.Id);
        row.OperatingBranchId = _otherBranch;
        await db.SaveChangesAsync();

        var crossBranch = await Assert.ThrowsAsync<TestingDomainException>(() =>
            reports.ReleaseAsync(_tenant, _actor, draft.Id, new ReleaseReportRequest(
                _branch, "idem-rel-auth-mismatch", finalized.RowVersion)));
        Assert.Equal("branch_unauthorized", crossBranch.Code);
    }

    [Fact]
    public void Release_Permission_Constant_And_Endpoint_Gate_Are_Wired()
    {
        Assert.Equal("lms.reports.release", LaboratoryAuthz.ReportsRelease);
        Assert.Equal("release_report", ReportIdempotencyOperations.ReleaseReport);
        Assert.Equal("RELEASE_REPORT", ReportAuditActions.ReleaseReport);

        var functionsPath = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory, "..", "..", "..", "..", "LaboratoryApi", "Functions", "ReportFunctions.cs"));
        Assert.True(File.Exists(functionsPath), functionsPath);
        var src = File.ReadAllText(functionsPath);
        Assert.Contains("lms/reports/{id:guid}/release", src);
        Assert.Contains("LaboratoryAuthz.ReportsRelease", src);
        Assert.Contains("ReleaseAsync", src);

        var claimsMissing = new JwtClaims(_actor, _tenant, new[] { LaboratoryAuthz.ReportsFinalize });
        Assert.False(LaboratoryAuthz.HasAny(claimsMissing, LaboratoryAuthz.ReportsRelease));

        var claimsOk = new JwtClaims(_actor, _tenant, new[] { LaboratoryAuthz.ReportsRelease });
        Assert.True(LaboratoryAuthz.HasAny(claimsOk, LaboratoryAuthz.ReportsRelease));
    }

    [Fact]
    public async Task Authorize_Does_Not_Auto_Create_Report()
    {
        var (db, _, results, _, specimens, orders, catalogue, collection) = Create();
        var itemId = await ActivateTestAsync(catalogue, db, "AU-" + Guid.NewGuid().ToString("N")[..6]);
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
            otId, specimen.Id, _branch, NumericValue: "3", Unit: "mg/dL"));
        result = await results.VerifyAsync(_tenant, _actor, result.Id, new VerifyResultRequest(
            _branch, result.RowVersion, result.CurrentVersionNumber));
        await results.AuthorizeAsync(_tenant, _actor, result.Id, new AuthorizeResultRequest(
            _branch, result.RowVersion, result.CurrentVersionNumber));

        Assert.Equal(0, await db.Reports.CountAsync());
    }
}
