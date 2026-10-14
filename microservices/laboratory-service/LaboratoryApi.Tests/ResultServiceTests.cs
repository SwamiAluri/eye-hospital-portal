using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using LaboratoryApi.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace LaboratoryApi.Tests;

public class ResultServiceTests
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

    private (LaboratoryDbContext Db, Mock<IPlatformAuditClient> Audit, Mock<IPlatformReferenceClient> Platform,
        ResultService Results, SpecimenService Specimens, OrderService Orders, CatalogueService Catalogue,
        CollectionService Collection)
        Create(bool actorAuthorizedForBranch = true)
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

        if (actorAuthorizedForBranch)
        {
            platform.Setup(p => p.ValidateUserBranchAsync(
                    _tenant, _actor, _branch, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new PlatformUserBranchRef(_actor, _branch, true));
        }
        else
        {
            platform.Setup(p => p.ValidateUserBranchAsync(
                    _tenant, _actor, _branch, It.IsAny<CancellationToken>()))
                .ThrowsAsync(new OrderDomainException(
                    "User is not authorized for the branch.",
                    statusCode: 403, code: "branch_unauthorized"));
        }

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
        return (db, audit, platform, results, specimens, orders, catalogue, collection);
    }

    private async Task<Guid> ActivateTestAsync(
        CatalogueService cat, LaboratoryDbContext db, string code, string? datatype = "Numeric",
        string? units = "mg/dL", string classification = CatalogueClassifications.Local,
        string type = CatalogueTypes.Test)
    {
        var d = await cat.CreateDraftAsync(_tenant, _actor, new CreateCatalogueDraftRequest(
            CatalogueType: type,
            InternalOrderCode: code,
            DisplayName: code + " Name",
            Discipline: "CLINICAL_CHEMISTRY",
            Classification: classification,
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
        version.ResultDatatype = datatype;
        version.PermittedUnits = units;
        version.Classification = classification;
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
            ClinicalIndication: "Testing UAT",
            Notes: null,
            Selections: catalogueItemIds.Select((id, i) => new OrderSelectionInput(id, i)).ToArray());

    private async Task<(SpecimenDetailDto Specimen, OrderDetailDto Order, Guid OrderTestId, ResultService Results,
            SpecimenService Specimens, LaboratoryDbContext Db, Mock<IPlatformAuditClient> Audit)>
        ReceivedFixtureAsync(string? datatype = "Numeric")
    {
        var (db, audit, _, results, specimens, orders, catalogue, collection) = Create();
        var itemId = await ActivateTestAsync(catalogue, db, "TST-" + Guid.NewGuid().ToString("N")[..6], datatype);
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
        return (specimen, order, otId, results, specimens, db, audit);
    }

    [Fact]
    public async Task Eligible_Received_Appears_In_Work_Queue()
    {
        var (specimen, order, otId, results, _, _, _) = await ReceivedFixtureAsync();
        var page = await results.ListWorkQueueAsync(_tenant, _actor, new TestingWorkQueueQuery(_branch));
        Assert.Contains(page.Items, i => i.OrderTestId == otId && i.SpecimenId == specimen.Id);
        Assert.Equal(order.OrderNumber, page.Items.First(i => i.OrderTestId == otId).OrderNumber);
        Assert.Null(page.Items.First(i => i.OrderTestId == otId).ResultId);
    }

    [Fact]
    public async Task Collected_Only_Excluded_From_Queue()
    {
        var (db, audit, _, results, specimens, orders, catalogue, collection) = Create();
        var itemId = await ActivateTestAsync(catalogue, db, "COL-" + Guid.NewGuid().ToString("N")[..6]);
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
        Assert.Equal(SpecimenStatuses.Collected, specimen.Status);

        var page = await results.ListWorkQueueAsync(_tenant, _actor, new TestingWorkQueueQuery(_branch));
        Assert.DoesNotContain(page.Items, i => i.SpecimenId == specimen.Id);
    }

    [Fact]
    public async Task Rejected_Excluded_And_Cannot_Create_Draft()
    {
        var (db, audit, _, results, specimens, orders, catalogue, collection) = Create();
        var itemId = await ActivateTestAsync(catalogue, db, "REJ-" + Guid.NewGuid().ToString("N")[..6]);
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
        specimen = await specimens.RejectAsync(_tenant, _actor, specimen.Id, new RejectSpecimenRequest(
            specimen.RowVersion, _branch, SpecimenRejectionReasons.Approved[0].Code, true,
            specimen.PatientMrnSnapshot!, specimen.PatientNameSnapshot!,
            specimen.PatientDateOfBirthSnapshot!.Value));

        var page = await results.ListWorkQueueAsync(_tenant, _actor, new TestingWorkQueueQuery(_branch));
        Assert.DoesNotContain(page.Items, i => i.SpecimenId == specimen.Id);

        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
                otId, specimen.Id, _branch, NumericValue: "1.2")));
        Assert.Equal("specimen_rejected", ex.Code);
    }

    [Fact]
    public async Task Cancelled_Order_Excluded()
    {
        var (specimen, order, otId, results, _, db, _) = await ReceivedFixtureAsync();
        var entity = await db.Orders.FirstAsync(o => o.Id == order.Id);
        entity.Status = OrderStatuses.Cancelled;
        await db.SaveChangesAsync();

        var page = await results.ListWorkQueueAsync(_tenant, _actor, new TestingWorkQueueQuery(_branch));
        Assert.DoesNotContain(page.Items, i => i.OrderTestId == otId);
    }

    [Fact]
    public async Task Wrong_Tenant_Denied()
    {
        var (specimen, _, otId, results, _, _, _) = await ReceivedFixtureAsync();
        var page = await results.ListWorkQueueAsync(_otherTenant, _actor, new TestingWorkQueueQuery(_branch));
        Assert.Empty(page.Items);

        await Assert.ThrowsAsync<TestingDomainException>(() =>
            results.CreateDraftAsync(_otherTenant, _actor, new CreateResultDraftRequest(
                otId, specimen.Id, _branch, NumericValue: "1")));
    }

    [Fact]
    public async Task Unauthorized_Branch_Denied()
    {
        var (_, _, _, results, _, _, _) = await ReceivedFixtureAsync();
        var (_, audit, platform, results2, _, _, _, _) = Create(actorAuthorizedForBranch: false);
        _ = (audit, platform);
        var ex = await Assert.ThrowsAsync<OrderDomainException>(() =>
            results2.ListWorkQueueAsync(_tenant, _actor, new TestingWorkQueueQuery(_branch)));
        Assert.Equal(403, ex.StatusCode);
        _ = results;
    }

    [Fact]
    public async Task Create_And_Update_Draft_Keep_OrderTest_Ordered()
    {
        var (specimen, _, otId, results, _, db, audit) = await ReceivedFixtureAsync();
        var created = await results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
            otId, specimen.Id, _branch, NumericValue: "5.5", Unit: "mg/dL", Comment: "ok",
            IdempotencyKey: "create-1"));
        Assert.Equal(ResultStatuses.Draft, created.Status);
        Assert.Equal(1, created.CurrentVersionNumber);

        var ot = await db.OrderTests.AsNoTracking().FirstAsync(t => t.Id == otId);
        Assert.Equal(OrderTestStatuses.Ordered, ot.Status);

        var updated = await results.UpdateDraftAsync(_tenant, _actor, created.Id, new UpdateResultDraftRequest(
            _branch, created.RowVersion, NumericValue: "6.0", Unit: "mg/dL", Comment: "revised",
            IdempotencyKey: "update-1"));
        Assert.Equal(2, updated.CurrentVersionNumber);
        Assert.Equal("6.0", updated.NumericValue);

        ot = await db.OrderTests.AsNoTracking().FirstAsync(t => t.Id == otId);
        Assert.Equal(OrderTestStatuses.Ordered, ot.Status);

        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, ResultAuditActions.CreateResultDraft, ResultAuditResources.LmsResult,
            created.Id, It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, ResultAuditActions.UpdateResultDraft, ResultAuditResources.LmsResult,
            created.Id, It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Qualitative_Value_Supported()
    {
        var (specimen, _, otId, results, _, _, _) = await ReceivedFixtureAsync("Qualitative");
        var created = await results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
            otId, specimen.Id, _branch, QualitativeValue: "Positive", Comment: "note"));
        Assert.Equal("Positive", created.QualitativeValue);
        Assert.Equal(ResultDatatypes.Qualitative, created.ResultDatatype);
    }

    [Fact]
    public async Task Unsupported_Datatype_Rejected()
    {
        var (specimen, _, otId, results, _, _, _) = await ReceivedFixtureAsync(datatype: null);
        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
                otId, specimen.Id, _branch, NumericValue: "1")));
        Assert.Equal("unsupported_datatype", ex.Code);
    }

    [Fact]
    public async Task No_Hardcoded_Flag_Or_Interpretation_Fields()
    {
        var (specimen, _, otId, results, _, _, _) = await ReceivedFixtureAsync();
        var created = await results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
            otId, specimen.Id, _branch, NumericValue: "999"));
        var json = System.Text.Json.JsonSerializer.Serialize(created);
        Assert.DoesNotContain("abnormal", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("critical", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("referenceInterval", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("interpretation", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Audit_Failure_Fail_Closed_On_Create()
    {
        var (specimen, _, otId, results, _, db, audit) = await ReceivedFixtureAsync();
        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), ResultAuditActions.CreateResultDraft,
                It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new CatalogueDomainException("audit fail", 503, "audit_unavailable"));

        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
                otId, specimen.Id, _branch, NumericValue: "1.0")));
        Assert.Equal("audit_unavailable", ex.Code);
        Assert.Empty(await db.Results.Where(r => r.OrderTestId == otId).ToListAsync());
    }

    [Fact]
    public async Task Idempotent_Create_Replays_And_Hash_Conflict_Is_409()
    {
        var (specimen, _, otId, results, _, db, _) = await ReceivedFixtureAsync();
        var key = "idem-create-" + Guid.NewGuid().ToString("N");
        var first = await results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
            otId, specimen.Id, _branch, NumericValue: "2.0", IdempotencyKey: key));
        var second = await results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
            otId, specimen.Id, _branch, NumericValue: "2.0", IdempotencyKey: key));
        Assert.Equal(first.Id, second.Id);
        Assert.Equal(1, await db.Results.CountAsync(r => r.OrderTestId == otId));

        var conflict = await Assert.ThrowsAsync<TestingDomainException>(() =>
            results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
                otId, specimen.Id, _branch, NumericValue: "3.0", IdempotencyKey: key)));
        Assert.Equal("idempotency_conflict", conflict.Code);
    }

    [Fact]
    public async Task Duplicate_Draft_Prevented()
    {
        var (specimen, _, otId, results, _, _, _) = await ReceivedFixtureAsync();
        await results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
            otId, specimen.Id, _branch, NumericValue: "1"));
        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
                otId, specimen.Id, _branch, NumericValue: "2")));
        Assert.Equal("draft_exists", ex.Code);
    }

    [Fact]
    public async Task Stale_RowVersion_Returns_409()
    {
        var (specimen, _, otId, results, _, _, _) = await ReceivedFixtureAsync();
        var created = await results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
            otId, specimen.Id, _branch, NumericValue: "1"));
        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            results.UpdateDraftAsync(_tenant, _actor, created.Id, new UpdateResultDraftRequest(
                _branch, ExpectedRowVersion: 999, NumericValue: "2")));
        Assert.Equal("concurrency_conflict", ex.Code);
    }

    [Fact]
    public async Task Referral_Catalogue_Not_Eligible()
    {
        var (db, _, _, results, specimens, orders, catalogue, collection) = Create();
        var itemId = await ActivateTestAsync(
            catalogue, db, "REF-" + Guid.NewGuid().ToString("N")[..6],
            classification: CatalogueClassifications.Referral, type: CatalogueTypes.ReferralTest);
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

        var page = await results.ListWorkQueueAsync(_tenant, _actor, new TestingWorkQueueQuery(_branch));
        Assert.DoesNotContain(page.Items, i => i.OrderTestId == otId);
    }

    [Fact]
    public async Task Upstream_Lifecycles_Unchanged_After_Draft()
    {
        var (specimen, order, otId, results, _, db, _) = await ReceivedFixtureAsync();
        var accessionBefore = specimen.Accession;
        var barcodeCountBefore = await db.SpecimenBarcodes.CountAsync();
        var collectionCountBefore = await db.CollectionTasks.CountAsync();

        await results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
            otId, specimen.Id, _branch, NumericValue: "1.1"));

        Assert.Equal(OrderStatuses.Submitted, (await db.Orders.FirstAsync(o => o.Id == order.Id)).Status);
        Assert.Equal(OrderTestStatuses.Ordered, (await db.OrderTests.FirstAsync(t => t.Id == otId)).Status);
        var specimenAfter = await db.Specimens.FirstAsync(s => s.Id == specimen.Id);
        Assert.Equal(SpecimenStatuses.Received, specimenAfter.Status);
        Assert.Equal(accessionBefore, specimenAfter.Accession);
        Assert.Equal(barcodeCountBefore, await db.SpecimenBarcodes.CountAsync());
        Assert.Equal(collectionCountBefore, await db.CollectionTasks.CountAsync());
        Assert.DoesNotContain(
            db.Model.GetEntityTypes(),
            e => e.GetTableName()?.StartsWith("laboratory_", StringComparison.Ordinal) == true);
    }

    [Fact]
    public async Task Audit_Failure_Fail_Closed_On_Update_Restores_Persisted_State()
    {
        var (specimen, _, otId, results, _, db, audit) = await ReceivedFixtureAsync();
        var created = await results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
            otId, specimen.Id, _branch, NumericValue: "1.0", Unit: "mg/dL", Comment: "v1"));
        Assert.Equal(1, await db.ResultVersions.CountAsync(v => v.ResultId == created.Id));

        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), ResultAuditActions.UpdateResultDraft,
                It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new CatalogueDomainException("audit fail", 503, "audit_unavailable"));

        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            results.UpdateDraftAsync(_tenant, _actor, created.Id, new UpdateResultDraftRequest(
                _branch, created.RowVersion, NumericValue: "9.9", Unit: "mg/dL", Comment: "should-not-stick")));
        Assert.Equal(503, ex.StatusCode);
        Assert.Equal("audit_unavailable", ex.Code);

        var persisted = await db.Results.AsNoTracking().SingleAsync(r => r.Id == created.Id);
        Assert.Equal("1.0", persisted.NumericValue);
        Assert.Equal("v1", persisted.Comment);
        Assert.Equal(1, persisted.CurrentVersionNumber);
        Assert.Equal(created.RowVersion, persisted.RowVersion);
        Assert.Equal(ResultStatuses.Draft, persisted.Status);
        Assert.Equal(1, await db.ResultVersions.CountAsync(v => v.ResultId == created.Id));
        Assert.False(await db.ResultVersions.AnyAsync(v =>
            v.ResultId == created.Id && v.NumericValue == "9.9"));

        // Audit recovery: retry succeeds with prior RowVersion.
        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), ResultAuditActions.UpdateResultDraft,
                It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var recovered = await results.UpdateDraftAsync(_tenant, _actor, created.Id, new UpdateResultDraftRequest(
            _branch, persisted.RowVersion, NumericValue: "2.0", Unit: "mg/dL", Comment: "recovered"));
        Assert.Equal("2.0", recovered.NumericValue);
        Assert.Equal(2, recovered.CurrentVersionNumber);
        Assert.Equal(2, await db.ResultVersions.CountAsync(v => v.ResultId == created.Id));
        Assert.Equal(OrderTestStatuses.Ordered,
            (await db.OrderTests.AsNoTracking().FirstAsync(t => t.Id == otId)).Status);
    }

    [Fact]
    public async Task Create_Idempotency_Replay_Does_Not_Duplicate_Version()
    {
        var (specimen, _, otId, results, _, db, audit) = await ReceivedFixtureAsync();
        var key = "idem-create-ver-" + Guid.NewGuid().ToString("N");
        var first = await results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
            otId, specimen.Id, _branch, NumericValue: "2.0", IdempotencyKey: key));
        var second = await results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
            otId, specimen.Id, _branch, NumericValue: "2.0", IdempotencyKey: key));
        Assert.Equal(first.Id, second.Id);
        Assert.Equal(1, await db.Results.CountAsync(r => r.OrderTestId == otId));
        Assert.Equal(1, await db.ResultVersions.CountAsync(v => v.ResultId == first.Id));
        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, ResultAuditActions.CreateResultDraft, ResultAuditResources.LmsResult,
            first.Id, It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);

        var conflict = await Assert.ThrowsAsync<TestingDomainException>(() =>
            results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
                otId, specimen.Id, _branch, NumericValue: "3.0", IdempotencyKey: key)));
        Assert.Equal("idempotency_conflict", conflict.Code);
        Assert.Equal(1, await db.Results.CountAsync(r => r.OrderTestId == otId));
        Assert.Equal(1, await db.ResultVersions.CountAsync(v => v.ResultId == first.Id));
    }

    [Fact]
    public async Task Update_Idempotency_Replay_And_Hash_Conflict()
    {
        var (specimen, _, otId, results, _, db, audit) = await ReceivedFixtureAsync();
        var created = await results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
            otId, specimen.Id, _branch, NumericValue: "1.0"));
        var key = "idem-update-" + Guid.NewGuid().ToString("N");
        var first = await results.UpdateDraftAsync(_tenant, _actor, created.Id, new UpdateResultDraftRequest(
            _branch, created.RowVersion, NumericValue: "2.0", Comment: "u1", IdempotencyKey: key));
        Assert.Equal(2, first.CurrentVersionNumber);
        Assert.Equal(2, await db.ResultVersions.CountAsync(v => v.ResultId == created.Id));

        var replay = await results.UpdateDraftAsync(_tenant, _actor, created.Id, new UpdateResultDraftRequest(
            _branch, created.RowVersion, NumericValue: "2.0", Comment: "u1", IdempotencyKey: key));
        Assert.Equal(first.Id, replay.Id);
        Assert.Equal(first.CurrentVersionNumber, replay.CurrentVersionNumber);
        Assert.Equal(2, await db.ResultVersions.CountAsync(v => v.ResultId == created.Id));
        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, ResultAuditActions.UpdateResultDraft, ResultAuditResources.LmsResult,
            created.Id, It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);

        var conflict = await Assert.ThrowsAsync<TestingDomainException>(() =>
            results.UpdateDraftAsync(_tenant, _actor, created.Id, new UpdateResultDraftRequest(
                _branch, created.RowVersion, NumericValue: "3.0", Comment: "u2", IdempotencyKey: key)));
        Assert.Equal("idempotency_conflict", conflict.Code);
        var persisted = await db.Results.AsNoTracking().SingleAsync(r => r.Id == created.Id);
        Assert.Equal("2.0", persisted.NumericValue);
        Assert.Equal(2, persisted.CurrentVersionNumber);
        Assert.Equal(2, await db.ResultVersions.CountAsync(v => v.ResultId == created.Id));
    }

    [Fact]
    public async Task Tenant_Cannot_Read_Or_Mutate_Other_Tenant_Result()
    {
        var (specimen, _, otId, results, _, db, audit) = await ReceivedFixtureAsync();
        var created = await results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
            otId, specimen.Id, _branch, NumericValue: "1.0"));

        // Branch check passes for other tenant so isolation is proven at data scope.
        var platformOther = new Mock<IPlatformReferenceClient>();
        platformOther.Setup(p => p.ValidateUserBranchAsync(
                _otherTenant, _actor, _branch, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserBranchRef(_actor, _branch, true));
        var resultsOther = new ResultService(db, audit.Object, platformOther.Object);

        var page = await resultsOther.ListWorkQueueAsync(_otherTenant, _actor, new TestingWorkQueueQuery(_branch));
        Assert.Empty(page.Items);

        var getEx = await Assert.ThrowsAsync<TestingDomainException>(() =>
            resultsOther.GetDraftAsync(_otherTenant, created.Id));
        Assert.Equal(404, getEx.StatusCode);

        var workEx = await Assert.ThrowsAsync<TestingDomainException>(() =>
            resultsOther.GetWorkItemAsync(_otherTenant, _actor, otId, specimen.Id, _branch));
        Assert.Equal(404, workEx.StatusCode);

        var createEx = await Assert.ThrowsAsync<TestingDomainException>(() =>
            resultsOther.CreateDraftAsync(_otherTenant, _actor, new CreateResultDraftRequest(
                otId, specimen.Id, _branch, NumericValue: "9")));
        Assert.Equal(404, createEx.StatusCode);

        var updateEx = await Assert.ThrowsAsync<TestingDomainException>(() =>
            resultsOther.UpdateDraftAsync(_otherTenant, _actor, created.Id, new UpdateResultDraftRequest(
                _branch, created.RowVersion, NumericValue: "8")));
        Assert.Equal(404, updateEx.StatusCode);
    }

    [Fact]
    public async Task Unauthorized_Branch_Denies_WorkItem_Create_And_Update()
    {
        var (specimen, _, otId, resultsOk, _, db, audit) = await ReceivedFixtureAsync();
        var created = await resultsOk.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
            otId, specimen.Id, _branch, NumericValue: "1"));

        var platformDenied = new Mock<IPlatformReferenceClient>();
        platformDenied.Setup(p => p.ValidateUserBranchAsync(
                _tenant, _actor, _branch, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OrderDomainException(
                "User is not authorized for the branch.",
                statusCode: 403, code: "branch_unauthorized"));
        var resultsDenied = new ResultService(db, audit.Object, platformDenied.Object);

        var queueEx = await Assert.ThrowsAsync<OrderDomainException>(() =>
            resultsDenied.ListWorkQueueAsync(_tenant, _actor, new TestingWorkQueueQuery(_branch)));
        Assert.Equal(403, queueEx.StatusCode);

        var detailEx = await Assert.ThrowsAsync<OrderDomainException>(() =>
            resultsDenied.GetWorkItemAsync(_tenant, _actor, otId, specimen.Id, _branch));
        Assert.Equal(403, detailEx.StatusCode);

        var createEx = await Assert.ThrowsAsync<OrderDomainException>(() =>
            resultsDenied.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
                otId, specimen.Id, _branch, NumericValue: "2")));
        Assert.Equal(403, createEx.StatusCode);

        var updateEx = await Assert.ThrowsAsync<OrderDomainException>(() =>
            resultsDenied.UpdateDraftAsync(_tenant, _actor, created.Id, new UpdateResultDraftRequest(
                _branch, created.RowVersion, NumericValue: "2")));
        Assert.Equal(403, updateEx.StatusCode);

        // Persisted draft unchanged after denied update.
        var persisted = await db.Results.AsNoTracking().SingleAsync(r => r.Id == created.Id);
        Assert.Equal("1", persisted.NumericValue);
        Assert.Equal(created.RowVersion, persisted.RowVersion);
    }

    [Fact]
    public async Task Client_Other_Branch_Still_Server_Authorized()
    {
        var (specimen, _, otId, results, _, _, _) = await ReceivedFixtureAsync();
        // Actor authorized for _branch only; requesting _otherBranch must fail server-side.
        var ex = await Assert.ThrowsAsync<OrderDomainException>(() =>
            results.ListWorkQueueAsync(_tenant, _actor, new TestingWorkQueueQuery(_otherBranch)));
        Assert.Equal(403, ex.StatusCode);

        var createEx = await Assert.ThrowsAsync<OrderDomainException>(() =>
            results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
                otId, specimen.Id, _otherBranch, NumericValue: "1")));
        Assert.Equal(403, createEx.StatusCode);
    }

    [Fact]
    public async Task Comment_Is_Ancillary_Not_A_Catalogue_Datatype()
    {
        var (specimen, _, otId, results, _, _, _) = await ReceivedFixtureAsync("Numeric");
        var created = await results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
            otId, specimen.Id, _branch, Comment: "ancillary only"));
        Assert.Equal(ResultDatatypes.Numeric, created.ResultDatatype);
        Assert.Equal("ancillary only", created.Comment);
        Assert.Null(created.NumericValue);
    }

    [Fact]
    public async Task Unknown_Catalogue_Datatype_Rejected_Honestly()
    {
        var (specimen, _, otId, results, _, _, _) = await ReceivedFixtureAsync(datatype: "StructuredBlob");
        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
                otId, specimen.Id, _branch, NumericValue: "1")));
        Assert.Equal("unsupported_datatype", ex.Code);
    }

    [Fact]
    public async Task Result_Versions_Are_Append_Only_And_Not_Overwritten()
    {
        var (specimen, _, otId, results, _, db, _) = await ReceivedFixtureAsync();
        var created = await results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
            otId, specimen.Id, _branch, NumericValue: "1.0", Comment: "first"));
        var v1 = await db.ResultVersions.AsNoTracking()
            .SingleAsync(v => v.ResultId == created.Id && v.VersionNumber == 1);
        Assert.Equal("1.0", v1.NumericValue);

        var updated = await results.UpdateDraftAsync(_tenant, _actor, created.Id, new UpdateResultDraftRequest(
            _branch, created.RowVersion, NumericValue: "2.0", Comment: "second"));
        Assert.Equal(2, updated.CurrentVersionNumber);

        var versions = await db.ResultVersions.AsNoTracking()
            .Where(v => v.ResultId == created.Id).OrderBy(v => v.VersionNumber).ToListAsync();
        Assert.Equal(2, versions.Count);
        Assert.Equal("1.0", versions[0].NumericValue);
        Assert.Equal("first", versions[0].Comment);
        Assert.Equal("2.0", versions[1].NumericValue);
        Assert.Equal("second", versions[1].Comment);
    }

    [Fact]
    public async Task Empty_Work_Queue_Returns_Empty_Page_Not_Error()
    {
        var (_, _, _, results, _, _, _, _) = Create();
        var page = await results.ListWorkQueueAsync(_tenant, _actor, new TestingWorkQueueQuery(_branch));
        Assert.Empty(page.Items);
        Assert.Equal(0, page.TotalCount);
        Assert.Equal(1, page.Page);
    }

    [Fact]
    public async Task Work_Queue_Allows_Null_Or_Unsupported_ResultDatatype_Without_Crash()
    {
        var (specimenNull, _, otNull, resultsNull, _, _, _) = await ReceivedFixtureAsync(datatype: null);
        var pageNull = await resultsNull.ListWorkQueueAsync(
            _tenant, _actor, new TestingWorkQueueQuery(_branch));
        Assert.Contains(pageNull.Items, i => i.OrderTestId == otNull && i.SpecimenId == specimenNull.Id);
        Assert.Null(pageNull.Items.First(i => i.OrderTestId == otNull).ResultDatatype);

        var (specimenBad, _, otBad, resultsBad, _, _, _) = await ReceivedFixtureAsync(datatype: "StructuredBlob");
        var pageBad = await resultsBad.ListWorkQueueAsync(
            _tenant, _actor, new TestingWorkQueueQuery(_branch));
        Assert.Contains(pageBad.Items, i => i.OrderTestId == otBad && i.SpecimenId == specimenBad.Id);
        Assert.Equal("StructuredBlob", pageBad.Items.First(i => i.OrderTestId == otBad).ResultDatatype);
    }

    [Fact]
    public async Task Work_Queue_HasDraft_Filter_And_Draft_Enrichment()
    {
        var (specimen, _, otId, results, _, _, _) = await ReceivedFixtureAsync();
        var emptyDraftFilter = await results.ListWorkQueueAsync(
            _tenant, _actor, new TestingWorkQueueQuery(_branch, HasDraft: true));
        Assert.DoesNotContain(emptyDraftFilter.Items, i => i.OrderTestId == otId);

        var created = await results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
            otId, specimen.Id, _branch, NumericValue: "1.5"));

        var withDraft = await results.ListWorkQueueAsync(
            _tenant, _actor, new TestingWorkQueueQuery(_branch, HasDraft: true));
        var row = Assert.Single(withDraft.Items, i => i.OrderTestId == otId);
        Assert.Equal(created.Id, row.ResultId);
        Assert.Equal(ResultStatuses.Draft, row.ResultStatus);

        var withoutDraft = await results.ListWorkQueueAsync(
            _tenant, _actor, new TestingWorkQueueQuery(_branch, HasDraft: false));
        Assert.DoesNotContain(withoutDraft.Items, i => i.OrderTestId == otId);
    }
}
