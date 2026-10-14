using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using LaboratoryApi.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace LaboratoryApi.Tests;

public class CollectionServiceTests
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
        CatalogueService Catalogue, OrderService Orders, CollectionService Collection)
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
            .ReturnsAsync(new PlatformPatientRef(_patient, "MRN-1", "Test Patient", new DateTime(1990, 1, 1, 0, 0, 0, DateTimeKind.Utc)));
        platform.Setup(p => p.ValidateUserAsync(_tenant, _ordering, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserRef(_ordering, "Dr Ordering", "active"));
        platform.Setup(p => p.ValidateUserAsync(_tenant, _responsible, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserRef(_responsible, "Dr Responsible", "active"));
        platform.Setup(p => p.ValidateUserAsync(_tenant, _actor2, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserRef(_actor2, "Collector Two", "active"));
        platform.Setup(p => p.ValidateUserAsync(_tenant, It.Is<Guid>(g =>
                g != _ordering && g != _responsible && g != _actor2), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OrderDomainException("User not found", code: "user_not_found"));

        // PD-COL-OWN-05 — collectors for Assign
        platform.Setup(p => p.ValidateUserWithPermissionAsync(
                _tenant, _actor2, LaboratoryAuthz.CollectionCollect, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserRef(_actor2, "Collector Two", "active"));
        platform.Setup(p => p.ValidateUserWithPermissionAsync(
                _tenant, _actor, LaboratoryAuthz.CollectionCollect, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserRef(_actor, "Collector One", "active"));
        platform.Setup(p => p.ValidateUserWithPermissionAsync(
                _tenant, It.Is<Guid>(g => g != _actor && g != _actor2),
                LaboratoryAuthz.CollectionCollect, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OrderDomainException(
                "User is not authorized for the required Collection capability.",
                statusCode: 400, code: "user_lacks_permission"));

        var catalogue = new CatalogueService(db, audit.Object);
        var orders = new OrderService(db, audit.Object, platform.Object, catalogue);
        var collection = new CollectionService(db, audit.Object, platform.Object);
        return (db, audit, platform, catalogue, orders, collection);
    }

    private async Task<Guid> ActivateTestAsync(CatalogueService cat, string code)
    {
        var d = await cat.CreateDraftAsync(_tenant, _actor, new CreateCatalogueDraftRequest(
            CatalogueType: CatalogueTypes.Test,
            InternalOrderCode: code,
            DisplayName: code + " Name",
            Discipline: "CLINICAL_CHEMISTRY",
            ChangeReason: "collection test",
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
            ClinicalIndication: "Collection planning UAT",
            Notes: null,
            Selections: catalogueItemIds.Select((id, i) => new OrderSelectionInput(id, i)).ToArray());

    private async Task<(OrderDetailDto Order, CollectionService Collection, Mock<IPlatformAuditClient> Audit, LaboratoryDbContext Db)>
        SubmittedOrderAsync(params string[] codes)
    {
        var (db, audit, _, cat, orders, collection) = Create();
        var ids = new List<Guid>();
        foreach (var c in codes)
            ids.Add(await ActivateTestAsync(cat, c));
        var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(ids.ToArray()));
        var submitted = await orders.SubmitAsync(_tenant, _actor, draft.Id, new SubmitOrderRequest(draft.RowVersion));
        return (submitted, collection, audit, db);
    }

    [Fact]
    public async Task Create_Task_From_Submitted_Order_Audits_And_Does_Not_Mutate_Order()
    {
        var (order, collection, audit, db) = await SubmittedOrderAsync("COL-T01");
        var otIds = order.CurrentVersion!.Tests.Select(t => t.Id).ToList();
        var orderRv = order.RowVersion;
        var orderStatus = order.Status;

        var task = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, otIds));

        Assert.Equal(CollectionTaskStatuses.Planned, task.Status);
        Assert.StartsWith("COL-", task.TaskNumber);
        Assert.Null(task.ClaimedByUserId);
        Assert.Equal(otIds.Count, task.OrderTests.Count);
        Assert.Equal(orderStatus, db.Orders.Single().Status);
        Assert.Equal(orderRv, db.Orders.Single().RowVersion);
        Assert.All(db.OrderTests, t => Assert.Equal(OrderTestStatuses.Ordered, t.Status));
        Assert.Single(db.CollectionTasks);
        Assert.Equal(otIds.Count, db.CollectionTaskOrderTests.Count());
        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, CollectionAuditActions.CreateTask, CollectionAuditResourceTypes.CollectionTask,
            task.Id, It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Create_Rejects_Draft_And_Cancelled_Orders()
    {
        var (db, _, _, cat, orders, collection) = Create();
        var itemId = await ActivateTestAsync(cat, "COL-T02");
        var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
        var exDraft = await Assert.ThrowsAsync<CollectionDomainException>(() =>
            collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
                draft.Id, _branch, new[] { Guid.NewGuid() })));
        Assert.Equal("order_not_submitted", exDraft.Code);

        var submitted = await orders.SubmitAsync(_tenant, _actor, draft.Id, new SubmitOrderRequest(draft.RowVersion));
        var cancelled = await orders.CancelAsync(_tenant, _actor, submitted.Id,
            new CancelOrderRequest(submitted.RowVersion, "stop"));
        var otId = cancelled.CurrentVersion!.Tests[0].Id;
        var exCancel = await Assert.ThrowsAsync<CollectionDomainException>(() =>
            collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
                cancelled.Id, _branch, new[] { otId })));
        Assert.Equal("order_cancelled", exCancel.Code);
        Assert.Empty(db.CollectionTasks);
    }

    [Fact]
    public async Task Create_Rejects_Cross_Tenant_And_Mismatched_OrderTests()
    {
        var (order, collection, _, _) = await SubmittedOrderAsync("COL-T03");
        var otId = order.CurrentVersion!.Tests[0].Id;

        var exTenant = await Assert.ThrowsAsync<CollectionDomainException>(() =>
            collection.CreateAsync(_otherTenant, _actor, new CreateCollectionTaskRequest(
                order.Id, _branch, new[] { otId })));
        Assert.Equal("not_found", exTenant.Code);

        var exMismatch = await Assert.ThrowsAsync<CollectionDomainException>(() =>
            collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
                order.Id, _branch, new[] { Guid.NewGuid() })));
        Assert.Equal("order_test_mismatch", exMismatch.Code);
    }

    [Fact]
    public async Task Create_Groups_Multiple_OrderTests_And_Blocks_Duplicate_Planning()
    {
        var (order, collection, _, _) = await SubmittedOrderAsync("COL-T04a", "COL-T04b");
        var otIds = order.CurrentVersion!.Tests.Select(t => t.Id).ToList();
        Assert.Equal(2, otIds.Count);

        var task = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, otIds, LocationText: "Phlebotomy bay A"));
        Assert.Equal(2, task.OrderTests.Count);
        Assert.Equal("Phlebotomy bay A", task.LocationText);

        var ex = await Assert.ThrowsAsync<CollectionDomainException>(() =>
            collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
                order.Id, _branch, new[] { otIds[0] })));
        Assert.Equal("order_test_already_planned", ex.Code);
    }

    [Fact]
    public async Task Create_Requires_Branch_And_Explicit_Selection()
    {
        var (order, collection, _, _) = await SubmittedOrderAsync("COL-T05");
        var otId = order.CurrentVersion!.Tests[0].Id;

        var exBranch = await Assert.ThrowsAsync<CollectionDomainException>(() =>
            collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
                order.Id, Guid.Empty, new[] { otId })));
        Assert.Equal("branch_required", exBranch.Code);

        var exEmpty = await Assert.ThrowsAsync<CollectionDomainException>(() =>
            collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
                order.Id, _branch, Array.Empty<Guid>())));
        Assert.Equal("order_tests_required", exEmpty.Code);
    }

    [Fact]
    public async Task List_Filters_By_Branch_And_Tenant()
    {
        var (order, collection, _, db) = await SubmittedOrderAsync("COL-T06");
        var otId = order.CurrentVersion!.Tests[0].Id;
        await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, new[] { otId }));

        // Other-tenant task cannot appear
        var otherList = await collection.ListAsync(_otherTenant, new CollectionTaskListQuery());
        Assert.Empty(otherList.Items);

        var branchA = await collection.ListAsync(_tenant, new CollectionTaskListQuery(CollectionBranchId: _branch));
        Assert.Single(branchA.Items);

        var branchB = await collection.ListAsync(_tenant, new CollectionTaskListQuery(CollectionBranchId: _otherBranch));
        Assert.Empty(branchB.Items);
        Assert.Single(db.CollectionTasks.Where(t => t.TenantId == _tenant));
    }

    [Fact]
    public async Task Get_Does_Not_Claim()
    {
        var (order, collection, _, _) = await SubmittedOrderAsync("COL-T07");
        var otId = order.CurrentVersion!.Tests[0].Id;
        var created = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, new[] { otId }));
        var got = await collection.GetAsync(_tenant, created.Id);
        Assert.Null(got.ClaimedByUserId);
        Assert.Equal(created.RowVersion, got.RowVersion);
    }

    [Fact]
    public async Task State_Machine_Transitions_And_Terminal_Protection()
    {
        var (order, collection, _, _) = await SubmittedOrderAsync("COL-T08");
        var otId = order.CurrentVersion!.Tests[0].Id;
        var task = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, new[] { otId }));

        var ready = await collection.TransitionAsync(_tenant, _actor, task.Id,
            new TransitionCollectionTaskRequest(task.RowVersion, CollectionTaskStatuses.Ready));
        Assert.Equal(CollectionTaskStatuses.Ready, ready.Status);

        var invalid = await Assert.ThrowsAsync<CollectionDomainException>(() =>
            collection.TransitionAsync(_tenant, _actor, ready.Id,
                new TransitionCollectionTaskRequest(ready.RowVersion, CollectionTaskStatuses.Completed)));
        Assert.Equal("invalid_transition", invalid.Code);

        var inProgress = await collection.TransitionAsync(_tenant, _actor, ready.Id,
            new TransitionCollectionTaskRequest(ready.RowVersion, CollectionTaskStatuses.InProgress));
        var completed = await collection.TransitionAsync(_tenant, _actor, inProgress.Id,
            new TransitionCollectionTaskRequest(inProgress.RowVersion, CollectionTaskStatuses.Completed));
        Assert.Equal(CollectionTaskStatuses.Completed, completed.Status);

        var terminal = await Assert.ThrowsAsync<CollectionDomainException>(() =>
            collection.TransitionAsync(_tenant, _actor, completed.Id,
                new TransitionCollectionTaskRequest(completed.RowVersion, CollectionTaskStatuses.Cancelled, "x")));
        Assert.Equal("terminal_state", terminal.Code);
    }

    [Fact]
    public async Task Cancel_From_Planned_Requires_Reason()
    {
        var (order, collection, _, _) = await SubmittedOrderAsync("COL-T09");
        var otId = order.CurrentVersion!.Tests[0].Id;
        var task = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, new[] { otId }));

        var ex = await Assert.ThrowsAsync<CollectionDomainException>(() =>
            collection.TransitionAsync(_tenant, _actor, task.Id,
                new TransitionCollectionTaskRequest(task.RowVersion, CollectionTaskStatuses.Cancelled)));
        Assert.Equal("cancel_reason_required", ex.Code);

        var cancelled = await collection.TransitionAsync(_tenant, _actor, task.Id,
            new TransitionCollectionTaskRequest(task.RowVersion, CollectionTaskStatuses.Cancelled, "Patient left"));
        Assert.Equal(CollectionTaskStatuses.Cancelled, cancelled.Status);
        Assert.Equal("Patient left", cancelled.CancelReason);
    }

    [Fact]
    public async Task Stale_RowVersion_Returns_409()
    {
        var (order, collection, _, _) = await SubmittedOrderAsync("COL-T10");
        var otId = order.CurrentVersion!.Tests[0].Id;
        var task = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, new[] { otId }));

        // ExpectedRowVersion 0 skips the check (same convention as Orders); use a stale non-zero.
        var ex = await Assert.ThrowsAsync<CollectionDomainException>(() =>
            collection.TransitionAsync(_tenant, _actor, task.Id,
                new TransitionCollectionTaskRequest(999, CollectionTaskStatuses.Ready)));
        Assert.Equal(409, ex.StatusCode);
        Assert.Equal("concurrency_conflict", ex.Code);
    }

    [Fact]
    public async Task Claim_Concurrency_And_Does_Not_Overwrite()
    {
        var (order, collection, _, _) = await SubmittedOrderAsync("COL-T11");
        var otId = order.CurrentVersion!.Tests[0].Id;
        var task = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, new[] { otId }));

        var claimed = await collection.ClaimAsync(_tenant, _actor, task.Id,
            new ClaimCollectionTaskRequest(task.RowVersion));
        Assert.Equal(_actor, claimed.ClaimedByUserId);

        var conflict = await Assert.ThrowsAsync<CollectionDomainException>(() =>
            collection.ClaimAsync(_tenant, _actor2, claimed.Id,
                new ClaimCollectionTaskRequest(claimed.RowVersion)));
        Assert.Equal("claim_conflict", conflict.Code);
        Assert.Equal(409, conflict.StatusCode);
    }

    [Fact]
    public async Task Assign_Validates_User_And_Audits()
    {
        var (order, collection, audit, _) = await SubmittedOrderAsync("COL-T12");
        var otId = order.CurrentVersion!.Tests[0].Id;
        var task = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, new[] { otId }));

        var assigned = await collection.AssignAsync(_tenant, _actor, task.Id,
            new AssignCollectionTaskRequest(task.RowVersion, _actor2));
        Assert.Equal(_actor2, assigned.AssignedToUserId);
        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, CollectionAuditActions.AssignTask, CollectionAuditResourceTypes.CollectionTask,
            task.Id, It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Assign_Empty_Guid_Returns_Assignee_Required_Without_Mutation_Or_Audit()
    {
        var (order, collection, audit, _) = await SubmittedOrderAsync("COL-INV-EMPTY");
        var otId = order.CurrentVersion!.Tests[0].Id;
        var task = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, new[] { otId }));
        var before = await collection.GetAsync(_tenant, task.Id);

        var ex = await Assert.ThrowsAsync<CollectionDomainException>(() =>
            collection.AssignAsync(_tenant, _actor, task.Id,
                new AssignCollectionTaskRequest(before.RowVersion, Guid.Empty)));
        Assert.Equal(400, ex.StatusCode);
        Assert.Equal("assignee_required", ex.Code);

        var after = await collection.GetAsync(_tenant, task.Id);
        Assert.Null(after.AssignedToUserId);
        Assert.Null(after.AssignedAt);
        Assert.Equal(before.ClaimedByUserId, after.ClaimedByUserId);
        Assert.Equal(before.ClaimedAt, after.ClaimedAt);
        Assert.Equal(before.RowVersion, after.RowVersion);

        audit.Verify(a => a.WriteAsync(
            It.IsAny<Guid>(), It.IsAny<Guid>(), CollectionAuditActions.AssignTask,
            It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Idempotency_Replay_And_Conflict()
    {
        var (order, collection, _, db) = await SubmittedOrderAsync("COL-T13");
        var otId = order.CurrentVersion!.Tests[0].Id;
        var key = "col-create-1";

        var first = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, new[] { otId }, IdempotencyKey: key));
        var replay = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, new[] { otId }, IdempotencyKey: key));
        Assert.Equal(first.Id, replay.Id);
        Assert.Single(db.CollectionTasks);

        // Same key, different request body → conflict
        var item2 = order; // need second order for different hash with same key on another create path
        var (order2, collection2, _, _) = await SubmittedOrderAsync("COL-T13b");
        var ot2 = order2.CurrentVersion!.Tests[0].Id;
        // Use same CollectionService instance store — different Create fixture. Test conflict on transition instead.
        var key2 = "col-trans-1";
        var t1 = await collection.TransitionAsync(_tenant, _actor, first.Id,
            new TransitionCollectionTaskRequest(first.RowVersion, CollectionTaskStatuses.Ready, IdempotencyKey: key2));
        var conflict = await Assert.ThrowsAsync<CollectionDomainException>(() =>
            collection.TransitionAsync(_tenant, _actor, t1.Id,
                new TransitionCollectionTaskRequest(t1.RowVersion, CollectionTaskStatuses.InProgress, IdempotencyKey: key2)));
        Assert.Equal("idempotency_conflict", conflict.Code);
        _ = ot2;
        _ = collection2;
        _ = item2;
    }

    [Fact]
    public async Task Audit_Fail_Closed_Rolls_Back_Create()
    {
        var (db, audit, platform, cat, orders, collection) = Create();
        var itemId = await ActivateTestAsync(cat, "COL-T14");
        var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
        var submitted = await orders.SubmitAsync(_tenant, _actor, draft.Id, new SubmitOrderRequest(draft.RowVersion));
        var otId = submitted.CurrentVersion!.Tests[0].Id;

        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), CollectionAuditActions.CreateTask, It.IsAny<string>(),
                It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new CatalogueDomainException("audit down", statusCode: 503, code: "audit_unavailable"));

        var ex = await Assert.ThrowsAsync<CollectionDomainException>(() =>
            collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
                submitted.Id, _branch, new[] { otId })));
        Assert.Equal("audit_unavailable", ex.Code);
        Assert.Equal(503, ex.StatusCode);
        Assert.Empty(db.CollectionTasks);
        _ = platform;
    }

    [Fact]
    public async Task PlanContext_Shows_Eligibility_Flags()
    {
        var (order, collection, _, _) = await SubmittedOrderAsync("COL-T15a", "COL-T15b");
        var otIds = order.CurrentVersion!.Tests.Select(t => t.Id).ToList();
        await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, new[] { otIds[0] }));

        var ctx = await collection.GetPlanContextAsync(_tenant, order.Id);
        Assert.Equal(OrderStatuses.Submitted, ctx.OrderStatus);
        Assert.Equal(2, ctx.OrderTests.Count);
        Assert.True(ctx.OrderTests.Single(t => t.OrderTestId == otIds[0]).AlreadyPlanned);
        Assert.False(ctx.OrderTests.Single(t => t.OrderTestId == otIds[1]).AlreadyPlanned);
    }

    [Fact]
    public void LaboratoryAuthz_Collection_Codes_Defined()
    {
        Assert.Equal("lms.collection.view", LaboratoryAuthz.CollectionView);
        Assert.Equal("lms.collection.manage", LaboratoryAuthz.CollectionManage);
        Assert.Equal("lms.collection.collect", LaboratoryAuthz.CollectionCollect);
        Assert.True(LaboratoryAuthz.HasAny(
            new JwtClaims(_actor, _tenant, new[] { "lms.collection.view" }),
            LaboratoryAuthz.CollectionView));
        Assert.False(LaboratoryAuthz.HasAny(
            new JwtClaims(_actor, _tenant, new[] { "lms.orders.view" }),
            LaboratoryAuthz.CollectionView));
        Assert.True(LaboratoryAuthz.HasAny(
            new JwtClaims(_actor, _tenant, new[] { "*" }),
            LaboratoryAuthz.CollectionManage));
        // Assign endpoint requires manage; collect-only actor is unauthorized at API layer.
        Assert.False(LaboratoryAuthz.HasAny(
            new JwtClaims(_actor, _tenant, new[] { "lms.collection.collect" }),
            LaboratoryAuthz.CollectionManage));
    }

    [Fact]
    public async Task List_Search_TaskNumber_Is_Case_Insensitive_And_TaskNumber_Only()
    {
        var (order, collection, _, _) = await SubmittedOrderAsync("COL-SRCH");
        var otId = order.CurrentVersion!.Tests[0].Id;
        var task = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, new[] { otId }));

        var exact = await collection.ListAsync(_tenant, new CollectionTaskListQuery(Search: task.TaskNumber));
        Assert.Contains(exact.Items, i => i.Id == task.Id);

        var lower = await collection.ListAsync(_tenant, new CollectionTaskListQuery(Search: task.TaskNumber.ToLowerInvariant()));
        Assert.Contains(lower.Items, i => i.Id == task.Id);

        var mixed = await collection.ListAsync(_tenant, new CollectionTaskListQuery(
            Search: char.ToLowerInvariant(task.TaskNumber[0]) + task.TaskNumber[1..]));
        Assert.Contains(mixed.Items, i => i.Id == task.Id);

        var unrelated = await collection.ListAsync(_tenant, new CollectionTaskListQuery(Search: "COL-NOMATCH-999999"));
        Assert.DoesNotContain(unrelated.Items, i => i.Id == task.Id);

        // OrderNumber must not match TaskNumber search scope (PD-COL-SEARCH-01).
        var byOrderNumber = await collection.ListAsync(_tenant, new CollectionTaskListQuery(Search: order.OrderNumber));
        Assert.DoesNotContain(byOrderNumber.Items, i => i.Id == task.Id);
    }

    [Fact]
    public async Task Claim_Unassigned_And_Assigned_To_Self_Allowed()
    {
        var (order, collection, _, _) = await SubmittedOrderAsync("COL-OWN1", "COL-OWN1b");
        var otIds = order.CurrentVersion!.Tests.Select(t => t.Id).ToList();

        var unassigned = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, new[] { otIds[0] }));
        var claimed = await collection.ClaimAsync(_tenant, _actor, unassigned.Id,
            new ClaimCollectionTaskRequest(unassigned.RowVersion));
        Assert.Equal(_actor, claimed.ClaimedByUserId);
        Assert.Null(claimed.AssignedToUserId);

        var forSelf = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, new[] { otIds[1] }));
        var assignedSelf = await collection.AssignAsync(_tenant, _actor, forSelf.Id,
            new AssignCollectionTaskRequest(forSelf.RowVersion, _actor));
        var claimedSelf = await collection.ClaimAsync(_tenant, _actor, assignedSelf.Id,
            new ClaimCollectionTaskRequest(assignedSelf.RowVersion));
        Assert.Equal(_actor, claimedSelf.AssignedToUserId);
        Assert.Equal(_actor, claimedSelf.ClaimedByUserId);
    }

    [Fact]
    public async Task Claim_Assigned_To_Other_Returns_Claim_Conflict()
    {
        var (order, collection, _, _) = await SubmittedOrderAsync("COL-OWN2");
        var otId = order.CurrentVersion!.Tests[0].Id;
        var task = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, new[] { otId }));
        var assigned = await collection.AssignAsync(_tenant, _actor, task.Id,
            new AssignCollectionTaskRequest(task.RowVersion, _actor2));

        var ex = await Assert.ThrowsAsync<CollectionDomainException>(() =>
            collection.ClaimAsync(_tenant, _actor, assigned.Id,
                new ClaimCollectionTaskRequest(assigned.RowVersion)));
        Assert.Equal(409, ex.StatusCode);
        Assert.Equal("claim_conflict", ex.Code);
        Assert.Equal(_actor2, assigned.AssignedToUserId);
        Assert.Null((await collection.GetAsync(_tenant, assigned.Id)).ClaimedByUserId);
    }

    [Fact]
    public async Task Assign_While_Claimed_By_Other_Returns_Assign_Conflict()
    {
        var (order, collection, _, _) = await SubmittedOrderAsync("COL-OWN3");
        var otId = order.CurrentVersion!.Tests[0].Id;
        var task = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, new[] { otId }));
        var claimed = await collection.ClaimAsync(_tenant, _actor, task.Id,
            new ClaimCollectionTaskRequest(task.RowVersion));

        var ex = await Assert.ThrowsAsync<CollectionDomainException>(() =>
            collection.AssignAsync(_tenant, _actor2, claimed.Id,
                new AssignCollectionTaskRequest(claimed.RowVersion, _actor2)));
        Assert.Equal(409, ex.StatusCode);
        Assert.Equal("assign_conflict", ex.Code);
        var got = await collection.GetAsync(_tenant, claimed.Id);
        Assert.Equal(_actor, got.ClaimedByUserId);
        Assert.Null(got.AssignedToUserId);
    }

    [Fact]
    public async Task Assign_By_Claimer_To_Self_Preserves_Claim_Valid_Dual_State()
    {
        var (order, collection, _, _) = await SubmittedOrderAsync("COL-OWN4");
        var otId = order.CurrentVersion!.Tests[0].Id;
        var task = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, new[] { otId }));
        var claimed = await collection.ClaimAsync(_tenant, _actor, task.Id,
            new ClaimCollectionTaskRequest(task.RowVersion));

        var assigned = await collection.AssignAsync(_tenant, _actor, claimed.Id,
            new AssignCollectionTaskRequest(claimed.RowVersion, _actor));
        Assert.Equal(_actor, assigned.ClaimedByUserId);
        Assert.Equal(_actor, assigned.AssignedToUserId);
    }

    [Fact]
    public async Task Release_Clears_Claim_Only_Preserves_Assignment_NonClaimer_Forbidden()
    {
        var (order, collection, _, _) = await SubmittedOrderAsync("COL-OWN5");
        var otId = order.CurrentVersion!.Tests[0].Id;
        var task = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, new[] { otId }));
        var assigned = await collection.AssignAsync(_tenant, _actor, task.Id,
            new AssignCollectionTaskRequest(task.RowVersion, _actor));
        var claimed = await collection.ClaimAsync(_tenant, _actor, assigned.Id,
            new ClaimCollectionTaskRequest(assigned.RowVersion));

        var forbidden = await Assert.ThrowsAsync<CollectionDomainException>(() =>
            collection.ReleaseAsync(_tenant, _actor2, claimed.Id,
                new ReleaseCollectionTaskRequest(claimed.RowVersion)));
        Assert.Equal(403, forbidden.StatusCode);
        Assert.Equal("release_forbidden", forbidden.Code);

        var released = await collection.ReleaseAsync(_tenant, _actor, claimed.Id,
            new ReleaseCollectionTaskRequest(claimed.RowVersion));
        Assert.Null(released.ClaimedByUserId);
        Assert.Null(released.ClaimedAt);
        Assert.Equal(_actor, released.AssignedToUserId);
        Assert.NotNull(released.AssignedAt);
    }

    [Fact]
    public async Task Assign_Rejects_Ineligible_Inactive_SoftDeleted_And_CrossTenant_Assignees()
    {
        var (db, audit, platform, cat, orders, collection) = Create();
        var itemId = await ActivateTestAsync(cat, "COL-OWN6");
        var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
        var submitted = await orders.SubmitAsync(_tenant, _actor, draft.Id, new SubmitOrderRequest(draft.RowVersion));
        var otId = submitted.CurrentVersion!.Tests[0].Id;
        var task = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            submitted.Id, _branch, new[] { otId }));

        var noCollect = Guid.Parse("99999999-9999-9999-9999-999999999901");
        platform.Setup(p => p.ValidateUserWithPermissionAsync(
                _tenant, noCollect, LaboratoryAuthz.CollectionCollect, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OrderDomainException(
                "User is not authorized for the required Collection capability.",
                statusCode: 400, code: "user_lacks_permission"));
        var lack = await Assert.ThrowsAsync<CollectionDomainException>(() =>
            collection.AssignAsync(_tenant, _actor, task.Id,
                new AssignCollectionTaskRequest(task.RowVersion, noCollect)));
        Assert.Equal(400, lack.StatusCode);
        Assert.Equal("user_lacks_permission", lack.Code);

        var inactive = Guid.Parse("99999999-9999-9999-9999-999999999902");
        platform.Setup(p => p.ValidateUserWithPermissionAsync(
                _tenant, inactive, LaboratoryAuthz.CollectionCollect, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OrderDomainException("User is not active.", statusCode: 400, code: "user_inactive"));
        var inactiveEx = await Assert.ThrowsAsync<CollectionDomainException>(() =>
            collection.AssignAsync(_tenant, _actor, task.Id,
                new AssignCollectionTaskRequest(task.RowVersion, inactive)));
        Assert.Equal("user_inactive", inactiveEx.Code);

        var deleted = Guid.Parse("99999999-9999-9999-9999-999999999903");
        platform.Setup(p => p.ValidateUserWithPermissionAsync(
                _tenant, deleted, LaboratoryAuthz.CollectionCollect, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OrderDomainException("User not found in tenant.", statusCode: 400, code: "platform_not_found"));
        var deletedEx = await Assert.ThrowsAsync<CollectionDomainException>(() =>
            collection.AssignAsync(_tenant, _actor, task.Id,
                new AssignCollectionTaskRequest(task.RowVersion, deleted)));
        Assert.Equal("platform_not_found", deletedEx.Code);

        var cross = Guid.Parse("99999999-9999-9999-9999-999999999904");
        platform.Setup(p => p.ValidateUserWithPermissionAsync(
                _tenant, cross, LaboratoryAuthz.CollectionCollect, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OrderDomainException("User not found in tenant.", statusCode: 400, code: "platform_not_found"));
        var crossEx = await Assert.ThrowsAsync<CollectionDomainException>(() =>
            collection.AssignAsync(_tenant, _actor, task.Id,
                new AssignCollectionTaskRequest(task.RowVersion, cross)));
        Assert.Equal("platform_not_found", crossEx.Code);

        _ = audit;
        _ = db;
    }

    [Fact]
    public async Task Claim_Does_Not_Modify_AssignedTo_And_Assign_Does_Not_Clear_Claim()
    {
        var (order, collection, _, _) = await SubmittedOrderAsync("COL-OWN7");
        var otId = order.CurrentVersion!.Tests[0].Id;
        var task = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
            order.Id, _branch, new[] { otId }));
        var assigned = await collection.AssignAsync(_tenant, _actor, task.Id,
            new AssignCollectionTaskRequest(task.RowVersion, _actor));
        var claimed = await collection.ClaimAsync(_tenant, _actor, assigned.Id,
            new ClaimCollectionTaskRequest(assigned.RowVersion));
        Assert.Equal(_actor, claimed.AssignedToUserId);
        Assert.Equal(_actor, claimed.ClaimedByUserId);

        // Re-assign to self while claimed — claim preserved
        var again = await collection.AssignAsync(_tenant, _actor, claimed.Id,
            new AssignCollectionTaskRequest(claimed.RowVersion, _actor));
        Assert.Equal(_actor, again.ClaimedByUserId);
        Assert.Equal(_actor, again.AssignedToUserId);
    }
}
