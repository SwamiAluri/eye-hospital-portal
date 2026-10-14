using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using LaboratoryApi.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace LaboratoryApi.Tests;

public class SpecimenServiceTests
{
    private readonly Guid _tenant = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _otherTenant = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private readonly Guid _actor = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _actor2 = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab");
    private readonly Guid _patient = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private readonly Guid _ordering = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private readonly Guid _responsible = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
    private readonly Guid _branch = Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff");
    private readonly Guid _otherBranch = Guid.Parse("12345678-1234-1234-1234-123456789012");

    private (LaboratoryDbContext Db, Mock<IPlatformAuditClient> Audit, Mock<IPlatformReferenceClient> Platform,
        CatalogueService Catalogue, OrderService Orders, CollectionService Collection, SpecimenService Specimens)
        Create(bool actorAuthorizedForTaskBranch = true)
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
            .ReturnsAsync(new PlatformPatientRef(_patient, "MRN-1", "Test Patient",
                new DateTime(1990, 1, 1, 0, 0, 0, DateTimeKind.Utc)));
        platform.Setup(p => p.ValidateUserAsync(_tenant, _ordering, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserRef(_ordering, "Dr Ordering", "active"));
        platform.Setup(p => p.ValidateUserAsync(_tenant, _responsible, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserRef(_responsible, "Dr Responsible", "active"));
        platform.Setup(p => p.ValidateUserWithPermissionAsync(
                _tenant, _actor2, LaboratoryAuthz.CollectionCollect, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserRef(_actor2, "Collector Two", "active"));
        platform.Setup(p => p.ValidateUserWithPermissionAsync(
                _tenant, _actor, LaboratoryAuthz.CollectionCollect, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserRef(_actor, "Collector One", "active"));

        if (actorAuthorizedForTaskBranch)
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
                    "User is not authorized for the collection branch.",
                    statusCode: 403, code: "branch_unauthorized"));
        }

        // Default: unauthorized for otherBranch unless explicitly set
        platform.Setup(p => p.ValidateUserBranchAsync(
                _tenant, _actor, _otherBranch, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OrderDomainException(
                "User is not authorized for the collection branch.",
                statusCode: 403, code: "branch_unauthorized"));

        var catalogue = new CatalogueService(db, audit.Object);
        var orders = new OrderService(db, audit.Object, platform.Object, catalogue);
        var collection = new CollectionService(db, audit.Object, platform.Object);
        var specimens = new SpecimenService(db, audit.Object, platform.Object);
        return (db, audit, platform, catalogue, orders, collection, specimens);
    }

    private async Task<Guid> ActivateTestAsync(CatalogueService cat, string code)
    {
        var d = await cat.CreateDraftAsync(_tenant, _actor, new CreateCatalogueDraftRequest(
            CatalogueType: CatalogueTypes.Test,
            InternalOrderCode: code,
            DisplayName: code + " Name",
            Discipline: "CLINICAL_CHEMISTRY",
            ChangeReason: "specimen test",
            BranchIds: null));
        d = await cat.SubmitForReviewAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        d = await cat.ApproveAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        d = await cat.ActivateAsync(_tenant, _actor, d.Id, new LifecycleActionRequest(
            EffectiveFrom: DateTime.UtcNow.AddDays(-1)));
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
            ClinicalIndication: "Specimen Complete Collection UAT",
            Notes: null,
            Selections: catalogueItemIds.Select((id, i) => new OrderSelectionInput(id, i)).ToArray());

    private async Task<(CollectionTaskDetailDto Task, SpecimenService Specimens, CollectionService Collection,
            Mock<IPlatformAuditClient> Audit, Mock<IPlatformReferenceClient> Platform, LaboratoryDbContext Db,
            OrderDetailDto Order)>
        CompletedTaskAsync(string? locationText = "Phlebotomy bay A", bool actorAuthorizedForTaskBranch = true)
    {
        var (db, audit, platform, cat, orders, collection, specimens) = Create(actorAuthorizedForTaskBranch);
        var itemId = await ActivateTestAsync(cat, "SPC-" + Guid.NewGuid().ToString("N")[..6]);
        var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
        var order = await orders.SubmitAsync(_tenant, _actor, draft.Id, new SubmitOrderRequest(draft.RowVersion));
        var otIds = order.CurrentVersion!.Tests.Select(t => t.Id).ToArray();
        var planned = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, otIds, LocationText: locationText));
        planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
            new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.Ready));
        planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
            new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.InProgress));
        planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
            new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.Completed));
        return (planned, specimens, collection, audit, platform, db, order);
    }

    [Fact]
    public async Task CompleteCollection_Creates_Specimen_Collected_Without_Changing_Task_Order_Or_OrderTest()
    {
        var (task, specimens, collection, audit, platform, db, order) = await CompletedTaskAsync();
        var beforeUtc = DateTime.UtcNow.AddSeconds(-2);

        var specimen = await specimens.CompleteCollectionAsync(
            _tenant, _actor, task.Id,
            new CompleteCollectionRequest(task.RowVersion, PatientIdentityConfirmed: true));

        platform.Verify(p => p.ValidateUserBranchAsync(
            _tenant, _actor, _branch, It.IsAny<CancellationToken>()), Times.Once);
        Assert.Equal(SpecimenStatuses.Collected, specimen.Status);
        Assert.Equal(task.Id, specimen.CollectionTaskId);
        Assert.Equal(order.Id, specimen.OrderId);
        Assert.Equal(_patient, specimen.PatientId);
        Assert.Equal("MRN-1", specimen.PatientMrnSnapshot);
        Assert.Equal("Test Patient", specimen.PatientNameSnapshot);
        Assert.NotNull(specimen.PatientDateOfBirthSnapshot);
        Assert.Equal(_branch, specimen.CollectionBranchId);
        Assert.Equal("Phlebotomy bay A", specimen.LocationText);
        Assert.Equal(_actor, specimen.CollectedByUserId);
        Assert.True(specimen.CollectedAt >= beforeUtc);
        Assert.Equal(DateTimeKind.Utc, specimen.CollectedAt.Kind);
        Assert.NotEmpty(specimen.OrderTests);
        Assert.All(specimen.OrderTests, ot => Assert.Equal(OrderTestStatuses.Ordered, ot.OrderTestStatus));

        var taskAfter = await collection.GetAsync(_tenant, task.Id);
        Assert.Equal(CollectionTaskStatuses.Completed, taskAfter.Status);
        Assert.Equal(task.RowVersion, taskAfter.RowVersion);

        var orderEntity = await db.Orders.AsNoTracking().SingleAsync(o => o.Id == order.Id);
        Assert.Equal(OrderStatuses.Submitted, orderEntity.Status);
        Assert.All(await db.OrderTests.AsNoTracking()
                .Where(t => t.OrderVersionId == order.CurrentVersion!.Id).ToListAsync(),
            t => Assert.Equal(OrderTestStatuses.Ordered, t.Status));

        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, SpecimenAuditActions.CreateSpecimen,
            SpecimenAuditResourceTypes.Specimen, specimen.Id,
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, SpecimenAuditActions.CompleteCollection,
            SpecimenAuditResourceTypes.Specimen, specimen.Id,
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);

        // No accession / barcode fields exist on entity
        var entity = await db.Specimens.AsNoTracking().SingleAsync(s => s.Id == specimen.Id);
        Assert.Equal(SpecimenStatuses.Collected, entity.Status);
        Assert.Null(entity.GetType().GetProperty("AccessionNumber"));
        Assert.Null(entity.GetType().GetProperty("Barcode"));
    }

    [Fact]
    public async Task CompleteCollection_Historical_Completed_Task_Without_Specimen_Succeeds()
    {
        var (task, specimens, _, _, _, _, _) = await CompletedTaskAsync();
        Assert.Null(await specimens.GetByCollectionTaskAsync(_tenant, task.Id));
        var specimen = await specimens.CompleteCollectionAsync(
            _tenant, _actor, task.Id,
            new CompleteCollectionRequest(task.RowVersion, true));
        Assert.Equal(SpecimenStatuses.Collected, specimen.Status);
    }

    [Fact]
    public async Task CompleteCollection_Duplicate_Prevented()
    {
        var (task, specimens, _, _, _, _, _) = await CompletedTaskAsync();
        await specimens.CompleteCollectionAsync(
            _tenant, _actor, task.Id, new CompleteCollectionRequest(task.RowVersion, true));
        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            specimens.CompleteCollectionAsync(
                _tenant, _actor, task.Id, new CompleteCollectionRequest(task.RowVersion, true)));
        Assert.Equal("specimen_already_exists", ex.Code);
        Assert.Equal(409, ex.StatusCode);
    }

    [Fact]
    public async Task CompleteCollection_Idempotent_Replay()
    {
        var (task, specimens, _, _, _, _, _) = await CompletedTaskAsync();
        const string key = "spc-idem-1";
        var first = await specimens.CompleteCollectionAsync(
            _tenant, _actor, task.Id,
            new CompleteCollectionRequest(task.RowVersion, true, IdempotencyKey: key));
        var second = await specimens.CompleteCollectionAsync(
            _tenant, _actor, task.Id,
            new CompleteCollectionRequest(task.RowVersion, true, IdempotencyKey: key));
        Assert.Equal(first.Id, second.Id);
    }

    [Fact]
    public async Task CompleteCollection_Idempotency_Key_Conflict_Same_Store()
    {
        var (task, specimens, collection, audit, platformMock, db, order) = await CompletedTaskAsync();
        const string key = "spc-idem-conflict-same";
        await specimens.CompleteCollectionAsync(
            _tenant, _actor, task.Id,
            new CompleteCollectionRequest(task.RowVersion, true, IdempotencyKey: key));

        var itemId = await ActivateTestAsync(
            new CatalogueService(db, audit.Object), "SPC3-" + Guid.NewGuid().ToString("N")[..4]);
        var orders = new OrderService(db, audit.Object, platformMock.Object, new CatalogueService(db, audit.Object));
        var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
        var order2 = await orders.SubmitAsync(_tenant, _actor, draft.Id, new SubmitOrderRequest(draft.RowVersion));
        var otIds = order2.CurrentVersion!.Tests.Select(t => t.Id).ToArray();
        var planned = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order2.Id, _branch, otIds));
        planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
            new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.Ready));
        planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
            new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.InProgress));
        planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
            new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.Completed));

        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            specimens.CompleteCollectionAsync(
                _tenant, _actor, planned.Id,
                new CompleteCollectionRequest(planned.RowVersion, false, IdempotencyKey: key)));
        Assert.Equal("idempotency_conflict", ex.Code);
        Assert.Equal(409, ex.StatusCode);
        _ = order;
    }

    [Fact]
    public void Specimen_CollectionTask_Uniqueness_Is_Modeled_For_Concurrency()
    {
        var options = new DbContextOptionsBuilder<LaboratoryDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        using var db = new LaboratoryDbContext(options);
        var unique = db.Model.FindEntityType(typeof(LmsSpecimen))!
            .GetIndexes()
            .Where(i => i.IsUnique)
            .Select(i => string.Join(",", i.Properties.Select(p => p.Name)))
            .ToList();
        Assert.Contains("TenantId,CollectionTaskId", unique);
    }

    [Fact]
    public async Task CompleteCollection_Stale_Task_RowVersion_Conflicts()
    {
        var (task, specimens, _, _, _, _, _) = await CompletedTaskAsync();
        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            specimens.CompleteCollectionAsync(
                _tenant, _actor, task.Id,
                new CompleteCollectionRequest(task.RowVersion - 1, true)));
        Assert.Equal("concurrency_conflict", ex.Code);
        Assert.Equal(409, ex.StatusCode);
    }

    [Fact]
    public async Task CompleteCollection_Wrong_Tenant_Not_Found()
    {
        var (task, specimens, _, _, _, _, _) = await CompletedTaskAsync();
        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            specimens.CompleteCollectionAsync(
                _otherTenant, _actor, task.Id,
                new CompleteCollectionRequest(task.RowVersion, true)));
        Assert.Equal(404, ex.StatusCode);
    }

    [Fact]
    public async Task CompleteCollection_NonCompleted_Task_Rejected()
    {
        var (db, audit, _, cat, orders, collection, specimens) = Create();
        var itemId = await ActivateTestAsync(cat, "SPC-NC");
        var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
        var order = await orders.SubmitAsync(_tenant, _actor, draft.Id, new SubmitOrderRequest(draft.RowVersion));
        var otIds = order.CurrentVersion!.Tests.Select(t => t.Id).ToArray();
        var planned = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, otIds));
        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            specimens.CompleteCollectionAsync(
                _tenant, _actor, planned.Id,
                new CompleteCollectionRequest(planned.RowVersion, true)));
        Assert.Equal("task_not_completed", ex.Code);
        _ = db;
        _ = audit;
    }

    [Fact]
    public async Task CompleteCollection_Missing_Task_Not_Found()
    {
        var (_, _, _, _, _, _, specimens) = Create();
        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            specimens.CompleteCollectionAsync(
                _tenant, _actor, Guid.NewGuid(),
                new CompleteCollectionRequest(1, true)));
        Assert.Equal(404, ex.StatusCode);
    }

    [Fact]
    public async Task CompleteCollection_Requires_Patient_Confirmation()
    {
        var (task, specimens, _, _, _, _, _) = await CompletedTaskAsync();
        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            specimens.CompleteCollectionAsync(
                _tenant, _actor, task.Id,
                new CompleteCollectionRequest(task.RowVersion, false)));
        Assert.Equal("patient_identity_not_confirmed", ex.Code);
    }

    [Fact]
    public async Task CompleteCollection_LocationText_Copies_From_CollectionTask_Only()
    {
        var (task, specimens, _, _, _, _, _) = await CompletedTaskAsync("Bay 1");
        var specimen = await specimens.CompleteCollectionAsync(
            _tenant, _actor, task.Id,
            new CompleteCollectionRequest(task.RowVersion, true));
        Assert.Equal("Bay 1", specimen.LocationText);
        Assert.Equal(task.LocationText, specimen.LocationText);
    }

    [Fact]
    public async Task CompleteCollection_Rejects_Unauthorized_Branch_Even_With_Both_Permissions()
    {
        // Actor has manage+collect at API layer (tested separately); service rejects wrong branch.
        var (task, specimens, _, _, platform, _, _) =
            await CompletedTaskAsync(actorAuthorizedForTaskBranch: false);

        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            specimens.CompleteCollectionAsync(
                _tenant, _actor, task.Id,
                new CompleteCollectionRequest(task.RowVersion, true)));
        Assert.Equal("branch_unauthorized", ex.Code);
        Assert.Equal(403, ex.StatusCode);
        platform.Verify(p => p.ValidateUserBranchAsync(
            _tenant, _actor, _branch, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CompleteCollection_Authorized_Tenant_Branch_And_Permissions_Succeeds()
    {
        var (task, specimens, _, _, platform, _, _) = await CompletedTaskAsync();
        var specimen = await specimens.CompleteCollectionAsync(
            _tenant, _actor, task.Id,
            new CompleteCollectionRequest(task.RowVersion, true));
        Assert.Equal(SpecimenStatuses.Collected, specimen.Status);
        Assert.Equal(_branch, specimen.CollectionBranchId);
        platform.Verify(p => p.ValidateUserBranchAsync(
            _tenant, _actor, _branch, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CompleteCollection_Audit_Fail_Closed()
    {
        var (task, specimens, _, audit, _, db, _) = await CompletedTaskAsync();
        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new CatalogueDomainException("audit down", statusCode: 503, code: "audit_unavailable"));

        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            specimens.CompleteCollectionAsync(
                _tenant, _actor, task.Id,
                new CompleteCollectionRequest(task.RowVersion, true)));
        Assert.Equal("audit_unavailable", ex.Code);
        Assert.Equal(503, ex.StatusCode);
        Assert.Empty(await db.Specimens.Where(s => s.CollectionTaskId == task.Id).ToListAsync());
    }

    [Fact]
    public async Task Get_Wrong_Tenant_Not_Found()
    {
        var (task, specimens, _, _, _, _, _) = await CompletedTaskAsync();
        var created = await specimens.CompleteCollectionAsync(
            _tenant, _actor, task.Id, new CompleteCollectionRequest(task.RowVersion, true));
        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            specimens.GetAsync(_otherTenant, created.Id));
        Assert.Equal(404, ex.StatusCode);
    }

    [Fact]
    public void Authz_CompleteCollection_Requires_Manage_And_Collect()
    {
        Assert.Equal("lms.specimens.manage", LaboratoryAuthz.SpecimensManage);
        Assert.Equal("lms.collection.collect", LaboratoryAuthz.CollectionCollect);
        Assert.True(LaboratoryAuthz.HasAll(
            new JwtClaims(_actor, _tenant, new[] { "lms.specimens.manage", "lms.collection.collect" }),
            LaboratoryAuthz.SpecimensManage, LaboratoryAuthz.CollectionCollect));
        Assert.False(LaboratoryAuthz.HasAll(
            new JwtClaims(_actor, _tenant, new[] { "lms.specimens.manage" }),
            LaboratoryAuthz.SpecimensManage, LaboratoryAuthz.CollectionCollect));
        Assert.False(LaboratoryAuthz.HasAll(
            new JwtClaims(_actor, _tenant, new[] { "lms.collection.collect" }),
            LaboratoryAuthz.SpecimensManage, LaboratoryAuthz.CollectionCollect));
        Assert.True(LaboratoryAuthz.HasAny(
            new JwtClaims(_actor, _tenant, new[] { "lms.specimens.view" }),
            LaboratoryAuthz.SpecimensView, LaboratoryAuthz.SpecimensManage));
        Assert.True(LaboratoryAuthz.HasAny(
            new JwtClaims(_actor, _tenant, new[] { "lms.specimens.manage" }),
            LaboratoryAuthz.SpecimensView, LaboratoryAuthz.SpecimensManage));
        Assert.False(LaboratoryAuthz.HasAny(
            new JwtClaims(_actor, _tenant, new[] { "lms.specimens.receive" }),
            LaboratoryAuthz.SpecimensView, LaboratoryAuthz.SpecimensManage));
    }

    [Fact]
    public async Task Transition_To_Completed_Does_Not_Create_Specimen()
    {
        var (db, audit, _, cat, orders, collection, specimens) = Create();
        var itemId = await ActivateTestAsync(cat, "SPC-NOAUTO");
        var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
        var order = await orders.SubmitAsync(_tenant, _actor, draft.Id, new SubmitOrderRequest(draft.RowVersion));
        var otIds = order.CurrentVersion!.Tests.Select(t => t.Id).ToArray();
        var planned = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, otIds));
        planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
            new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.Ready));
        planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
            new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.InProgress));
        planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
            new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.Completed));
        Assert.Equal(CollectionTaskStatuses.Completed, planned.Status);
        Assert.Null(await specimens.GetByCollectionTaskAsync(_tenant, planned.Id));
        Assert.Empty(await db.Specimens.ToListAsync());
        _ = audit;
        _ = _otherBranch;
        _ = _actor2;
    }

    [Fact]
    public async Task Specimen_OrderTest_Link_Is_MN_Capable_Schema()
    {
        var (task, specimens, _, _, _, db, _) = await CompletedTaskAsync();
        var specimen = await specimens.CompleteCollectionAsync(
            _tenant, _actor, task.Id, new CompleteCollectionRequest(task.RowVersion, true));
        Assert.True(specimen.OrderTests.Count >= 1);
        // Schema allows same OrderTestId on different specimens (no unique on OrderTestId alone)
        var indexes = db.Model.FindEntityType(typeof(LmsSpecimenOrderTest))!
            .GetIndexes()
            .Select(i => string.Join(",", i.Properties.Select(p => p.Name)))
            .ToList();
        Assert.Contains("SpecimenId,OrderTestId", indexes);
        Assert.DoesNotContain(indexes, i => i == "OrderTestId");
    }
}
