using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using LaboratoryApi.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace LaboratoryApi.Tests;

public class OrderServiceTests
{
    private readonly Guid _tenant = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _otherTenant = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private readonly Guid _actor = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _patient = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private readonly Guid _visit = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private readonly Guid _ordering = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private readonly Guid _responsible = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
    private readonly Guid _branch = Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff");
    private readonly Guid _otherBranch = Guid.Parse("12345678-1234-1234-1234-123456789012");

    private (LaboratoryDbContext Db, Mock<IPlatformAuditClient> Audit, Mock<IPlatformReferenceClient> Platform, CatalogueService Catalogue, OrderService Orders)
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
        platform.Setup(p => p.ValidatePatientAsync(_otherTenant, It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OrderDomainException("Patient not found", code: "patient_not_found"));
        platform.Setup(p => p.ValidatePatientAsync(_tenant, It.Is<Guid>(g => g != _patient), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OrderDomainException("Patient not found", code: "patient_not_found"));

        platform.Setup(p => p.ValidateVisitAsync(_tenant, _visit, _patient, _branch, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformVisitRef(_visit, _patient, _branch, "checked_in"));
        platform.Setup(p => p.ValidateVisitAsync(_tenant, _visit, It.Is<Guid>(g => g != _patient), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OrderDomainException("Visit patient mismatch", code: "visit_patient_mismatch"));
        platform.Setup(p => p.ValidateVisitAsync(_tenant, _visit, _patient, _otherBranch, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OrderDomainException("Visit branch mismatch", code: "visit_branch_mismatch"));

        platform.Setup(p => p.ValidateUserAsync(_tenant, _ordering, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserRef(_ordering, "Dr Ordering", "active"));
        platform.Setup(p => p.ValidateUserAsync(_tenant, _responsible, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserRef(_responsible, "Dr Responsible", "active"));
        platform.Setup(p => p.ValidateUserAsync(_tenant, It.Is<Guid>(g => g != _ordering && g != _responsible), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OrderDomainException("User not found", code: "user_not_found"));

        var catalogue = new CatalogueService(db, audit.Object);
        var orders = new OrderService(db, audit.Object, platform.Object, catalogue);
        return (db, audit, platform, catalogue, orders);
    }

    private async Task<Guid> ActivateTestAsync(CatalogueService cat, string code, Guid? branchId = null)
    {
        var d = await cat.CreateDraftAsync(_tenant, _actor, new CreateCatalogueDraftRequest(
            CatalogueType: CatalogueTypes.Test,
            InternalOrderCode: code,
            DisplayName: code + " Name",
            Discipline: "CLINICAL_CHEMISTRY",
            ChangeReason: "order test",
            BranchIds: branchId is null ? null : new[] { branchId.Value }));
        d = await cat.SubmitForReviewAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        d = await cat.ApproveAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        d = await cat.ActivateAsync(_tenant, _actor, d.Id, new LifecycleActionRequest(
            EffectiveFrom: DateTime.UtcNow.AddDays(-1)));
        return d.Id;
    }

    private CreateOrderDraftRequest DraftReq(Guid catalogueItemId, string? source = null, string? priority = null, string? reason = null, string? ack = null, Guid? visitId = null) =>
        new(
            PatientId: _patient,
            VisitId: visitId,
            OrderingProviderUserId: _ordering,
            ResponsibleClinicianUserId: _responsible,
            OperatingBranchId: _branch,
            OrderSource: source ?? OrderSources.Clinician,
            Priority: priority ?? OrderPriorities.Routine,
            PriorityReason: reason,
            ClinicalIndication: "Suspected anemia",
            Notes: null,
            Selections: new[] { new OrderSelectionInput(catalogueItemId) },
            AcknowledgementEvidence: ack);

    [Fact]
    public async Task Create_Draft_Generates_OrderNumber_And_Audits()
    {
        var (db, audit, _, cat, orders) = Create();
        var itemId = await ActivateTestAsync(cat, "ORD-T01");
        var detail = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));

        Assert.Equal(OrderStatuses.Draft, detail.Status);
        Assert.StartsWith("LAB-", detail.OrderNumber);
        Assert.Matches(@"^LAB-\d{8}-\d{6}$", detail.OrderNumber);
        Assert.Equal(1, detail.RowVersion);
        Assert.Null(detail.CurrentVersion!.PatientMrnSnapshot);
        // CreateDraft must leave CurrentVersionId pointing at the persisted version
        // (two-phase save on PostgreSQL for circular FK with lms_order_versions).
        Assert.Equal(detail.CurrentVersion.Id, db.Orders.Single().CurrentVersionId);
        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, OrderAuditActions.CreateDraft, OrderAuditResourceTypes.Order,
            detail.Id, It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
        Assert.Single(db.Orders);
    }

    [Fact]
    public async Task Client_OrderNumber_Rejected()
    {
        var (_, _, _, cat, orders) = Create();
        var itemId = await ActivateTestAsync(cat, "ORD-T02");
        var ex = await Assert.ThrowsAsync<OrderDomainException>(() =>
            orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId) with { ClientOrderNumber = "LAB-20261009-000099" }));
        Assert.Equal("order_number_client_forbidden", ex.Code);
    }

    [Fact]
    public async Task Submit_Pins_Catalogue_And_Captures_Snapshots()
    {
        var (db, audit, _, cat, orders) = Create();
        var itemId = await ActivateTestAsync(cat, "ORD-T03");
        var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
        var submitted = await orders.SubmitAsync(_tenant, _actor, draft.Id, new SubmitOrderRequest(draft.RowVersion));

        Assert.Equal(OrderStatuses.Submitted, submitted.Status);
        Assert.Equal("MRN-1", submitted.CurrentVersion!.PatientMrnSnapshot);
        Assert.Equal("Test Patient", submitted.CurrentVersion.PatientNameSnapshot);
        Assert.Single(submitted.CurrentVersion.Tests);
        Assert.Equal(OrderTestStatuses.Ordered, submitted.CurrentVersion.Tests[0].Status);
        Assert.NotNull(submitted.CurrentVersion.Selections[0].CatalogueVersionId);

        var pinned = submitted.CurrentVersion.Tests[0].CatalogueVersionId;
        // Activate a superseding version — submitted pin must remain
        var item = await cat.GetAsync(_tenant, itemId);
        await cat.SupersedeAsync(_tenant, _actor, itemId, new LifecycleActionRequest(Reason: "new"));
        var after = await orders.GetAsync(_tenant, submitted.Id);
        Assert.Equal(pinned, after.CurrentVersion!.Tests[0].CatalogueVersionId);

        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, OrderAuditActions.SubmitOrder, OrderAuditResourceTypes.Order,
            submitted.Id, It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
        Assert.Equal(OrderStatuses.Submitted, db.Orders.Single().Status);
    }

    [Fact]
    public async Task Submitted_Cannot_Update_Draft()
    {
        var (_, _, _, cat, orders) = Create();
        var itemId = await ActivateTestAsync(cat, "ORD-T04");
        var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
        var submitted = await orders.SubmitAsync(_tenant, _actor, draft.Id, new SubmitOrderRequest(draft.RowVersion));
        var ex = await Assert.ThrowsAsync<OrderDomainException>(() =>
            orders.UpdateDraftAsync(_tenant, _actor, submitted.Id, new UpdateOrderDraftRequest(
                submitted.RowVersion, _patient, null, _ordering, _responsible, _branch,
                OrderSources.Clinician, OrderPriorities.Routine, null, "x", null,
                new[] { new OrderSelectionInput(itemId) })));
        Assert.Equal("invalid_state", ex.Code);
    }

    [Fact]
    public async Task Priority_Urgent_Requires_Reason()
    {
        var (_, _, _, cat, orders) = Create();
        var itemId = await ActivateTestAsync(cat, "ORD-T05");
        await Assert.ThrowsAsync<OrderDomainException>(() =>
            orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId, priority: OrderPriorities.Urgent)));
        var ok = await orders.CreateDraftAsync(_tenant, _actor,
            DraftReq(itemId, priority: OrderPriorities.STAT, reason: "Critical bleeding"));
        Assert.Equal(OrderPriorities.STAT, ok.CurrentVersion!.Priority);
    }

    [Fact]
    public async Task SelfRequested_Requires_Acknowledgement()
    {
        var (_, _, _, cat, orders) = Create();
        var itemId = await ActivateTestAsync(cat, "ORD-T06");
        await Assert.ThrowsAsync<OrderDomainException>(() =>
            orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId, source: OrderSources.SelfRequested)));
        var ok = await orders.CreateDraftAsync(_tenant, _actor,
            DraftReq(itemId, source: OrderSources.SelfRequested, ack: "Patient signed self-request form v1"));
        Assert.Equal(OrderSources.SelfRequested, ok.CurrentVersion!.OrderSource);
    }

    [Fact]
    public async Task Unknown_Source_Rejected()
    {
        var (_, _, _, cat, orders) = Create();
        var itemId = await ActivateTestAsync(cat, "ORD-T07");
        var ex = await Assert.ThrowsAsync<OrderDomainException>(() =>
            orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId, source: "WalkIn")));
        Assert.Equal("order_source_invalid", ex.Code);
    }

    [Fact]
    public async Task Visit_Wrong_Patient_Rejected()
    {
        var (_, _, platform, cat, orders) = Create();
        var itemId = await ActivateTestAsync(cat, "ORD-T08");
        platform.Setup(p => p.ValidateVisitAsync(_tenant, _visit, _patient, _branch, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OrderDomainException("Visit patient mismatch", code: "visit_patient_mismatch"));
        await Assert.ThrowsAsync<OrderDomainException>(() =>
            orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId, visitId: _visit)));
    }

    [Fact]
    public async Task Inactive_Catalogue_Rejected_On_Submit()
    {
        var (_, _, _, cat, orders) = Create();
        var d = await cat.CreateDraftAsync(_tenant, _actor, new CreateCatalogueDraftRequest(
            CatalogueTypes.Test, "ORD-DRAFT-ONLY", "Draft Only", "CLINICAL_CHEMISTRY", ChangeReason: "x"));
        var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(d.Id));
        await Assert.ThrowsAsync<CatalogueDomainException>(() =>
            orders.SubmitAsync(_tenant, _actor, draft.Id, new SubmitOrderRequest(draft.RowVersion)));
    }

    [Fact]
    public async Task Branch_Mismatch_Rejected_On_Submit()
    {
        var (_, _, _, cat, orders) = Create();
        var itemId = await ActivateTestAsync(cat, "ORD-BR", _otherBranch);
        var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
        await Assert.ThrowsAsync<CatalogueDomainException>(() =>
            orders.SubmitAsync(_tenant, _actor, draft.Id, new SubmitOrderRequest(draft.RowVersion)));
    }

    [Fact]
    public async Task Orderables_Only_Active_Effective_Orderable()
    {
        var (_, _, _, cat, _) = Create();
        await ActivateTestAsync(cat, "ORD-OK");
        var future = await cat.CreateDraftAsync(_tenant, _actor, new CreateCatalogueDraftRequest(
            CatalogueTypes.Test, "ORD-FUT", "Future", "CLINICAL_CHEMISTRY", ChangeReason: "x"));
        future = await cat.SubmitForReviewAsync(_tenant, _actor, future.Id, new LifecycleActionRequest());
        future = await cat.ApproveAsync(_tenant, _actor, future.Id, new LifecycleActionRequest());
        await cat.ActivateAsync(_tenant, _actor, future.Id, new LifecycleActionRequest(
            EffectiveFrom: DateTime.UtcNow.AddDays(30)));

        var list = await cat.ListOrderablesAsync(_tenant, new OrderablesQuery(_branch));
        Assert.Contains(list.Items, i => i.InternalOrderCode == "ORD-OK");
        Assert.DoesNotContain(list.Items, i => i.InternalOrderCode == "ORD-FUT");
    }

    [Fact]
    public async Task Panel_Explodes_Components_With_Traceability()
    {
        var (db, _, _, cat, orders) = Create();
        db.ChangeTracker.Clear();
        var c1 = await ActivateTestAsync(cat, "ORD-C1B");
        var c2 = await ActivateTestAsync(cat, "ORD-C2");
        var c1Detail = await cat.GetAsync(_tenant, c1);
        var c2Detail = await cat.GetAsync(_tenant, c2);
        var panel2 = await cat.CreateDraftAsync(_tenant, _actor, new CreateCatalogueDraftRequest(
            CatalogueTypes.Panel, "ORD-PANEL2", "Panel2", "CLINICAL_CHEMISTRY", ChangeReason: "x",
            PanelComponents: new[]
            {
                new PanelComponentInput(c1, c1Detail.CurrentVersion!.Id, 1, true),
                new PanelComponentInput(c2, c2Detail.CurrentVersion!.Id, 2, true),
            }));
        panel2 = await cat.SubmitForReviewAsync(_tenant, _actor, panel2.Id, new LifecycleActionRequest());
        panel2 = await cat.ApproveAsync(_tenant, _actor, panel2.Id, new LifecycleActionRequest());
        panel2 = await cat.ActivateAsync(_tenant, _actor, panel2.Id, new LifecycleActionRequest(
            EffectiveFrom: DateTime.UtcNow.AddDays(-1)));

        var ok = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(panel2.Id));
        var submitted = await orders.SubmitAsync(_tenant, _actor, ok.Id, new SubmitOrderRequest(ok.RowVersion));
        Assert.Equal(2, submitted.CurrentVersion!.Tests.Count);
        Assert.All(submitted.CurrentVersion.Tests, t => Assert.NotNull(t.PanelCatalogueItemId));
        Assert.Equal(panel2.Id, submitted.CurrentVersion.Tests[0].PanelCatalogueItemId);
    }

    [Fact]
    public async Task Panel_Inactive_Component_Blocks_Submit()
    {
        var (db, _, _, cat, orders) = Create();
        var c1 = await ActivateTestAsync(cat, "ORD-C1");
        var c1Detail = await cat.GetAsync(_tenant, c1);
        var draftComp = await cat.CreateDraftAsync(_tenant, _actor, new CreateCatalogueDraftRequest(
            CatalogueTypes.Test, "ORD-C2-DRAFT", "Not Active", "CLINICAL_CHEMISTRY", ChangeReason: "x"));

        var panel = await cat.CreateDraftAsync(_tenant, _actor, new CreateCatalogueDraftRequest(
            CatalogueTypes.Panel, "ORD-PANEL", "Panel", "CLINICAL_CHEMISTRY", ChangeReason: "x",
            PanelComponents: new[]
            {
                new PanelComponentInput(c1, c1Detail.CurrentVersion!.Id, 1, true),
                new PanelComponentInput(draftComp.Id, draftComp.CurrentVersion!.Id, 2, true),
            }));
        panel = await cat.SubmitForReviewAsync(_tenant, _actor, panel.Id, new LifecycleActionRequest());
        panel = await cat.ApproveAsync(_tenant, _actor, panel.Id, new LifecycleActionRequest());
        panel = await cat.ActivateAsync(_tenant, _actor, panel.Id, new LifecycleActionRequest(
            EffectiveFrom: DateTime.UtcNow.AddDays(-1)));

        db.ChangeTracker.Clear();
        var order = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(panel.Id));
        await Assert.ThrowsAsync<CatalogueDomainException>(() =>
            orders.SubmitAsync(_tenant, _actor, order.Id, new SubmitOrderRequest(order.RowVersion)));
    }

    [Fact]
    public async Task Amend_Creates_New_Version_Cancel_Terminal()
    {
        var (_, audit, _, cat, orders) = Create();
        var itemId = await ActivateTestAsync(cat, "ORD-AMD");
        var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
        var submitted = await orders.SubmitAsync(_tenant, _actor, draft.Id, new SubmitOrderRequest(draft.RowVersion));

        var amended = await orders.AmendAsync(_tenant, _actor, submitted.Id, new AmendOrderRequest(
            submitted.RowVersion, "Add indication clarification",
            _patient, null, _ordering, _responsible, _branch,
            OrderSources.Clinician, OrderPriorities.Routine, null, "Updated indication", null,
            new[] { new OrderSelectionInput(itemId) }));

        Assert.Equal(2, amended.CurrentVersionNumber);
        Assert.Equal(OrderStatuses.Submitted, amended.Status);
        var versions = await orders.GetVersionsAsync(_tenant, amended.Id);
        Assert.Equal(2, versions.Count);
        Assert.Equal(1, versions[0].VersionNumber);

        var cancelled = await orders.CancelAsync(_tenant, _actor, amended.Id,
            new CancelOrderRequest(amended.RowVersion, "Patient left"));
        Assert.Equal(OrderStatuses.Cancelled, cancelled.Status);

        await Assert.ThrowsAsync<OrderDomainException>(() =>
            orders.AmendAsync(_tenant, _actor, cancelled.Id, new AmendOrderRequest(
                cancelled.RowVersion, "nope",
                _patient, null, _ordering, _responsible, _branch,
                OrderSources.Clinician, OrderPriorities.Routine, null, "x", null,
                new[] { new OrderSelectionInput(itemId) })));

        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, OrderAuditActions.AmendOrder, OrderAuditResourceTypes.Order,
            amended.Id, It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, OrderAuditActions.CancelOrder, OrderAuditResourceTypes.Order,
            cancelled.Id, It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Stale_RowVersion_Returns_409()
    {
        var (_, _, _, cat, orders) = Create();
        var itemId = await ActivateTestAsync(cat, "ORD-CONC");
        var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
        var updated = await orders.UpdateDraftAsync(_tenant, _actor, draft.Id, new UpdateOrderDraftRequest(
            draft.RowVersion, _patient, null, _ordering, _responsible, _branch,
            OrderSources.Clinician, OrderPriorities.Routine, null, "updated", null,
            new[] { new OrderSelectionInput(itemId) }));
        Assert.True(updated.RowVersion > draft.RowVersion);

        var ex = await Assert.ThrowsAsync<OrderDomainException>(() =>
            orders.SubmitAsync(_tenant, _actor, draft.Id, new SubmitOrderRequest(draft.RowVersion)));
        Assert.Equal(409, ex.StatusCode);
        Assert.Equal("concurrency_conflict", ex.Code);
    }

    [Fact]
    public async Task Idempotent_Create_Does_Not_Duplicate()
    {
        var (db, _, _, cat, orders) = Create();
        var itemId = await ActivateTestAsync(cat, "ORD-IDEM");
        var req = DraftReq(itemId) with { IdempotencyKey = "idem-1" };
        var a = await orders.CreateDraftAsync(_tenant, _actor, req);
        var b = await orders.CreateDraftAsync(_tenant, _actor, req);
        Assert.Equal(a.Id, b.Id);
        Assert.Equal(1, db.Orders.Count());

        await Assert.ThrowsAsync<OrderDomainException>(() =>
            orders.CreateDraftAsync(_tenant, _actor, req with { ClinicalIndication = "Different" }));
    }

    [Fact]
    public async Task Tenant_Isolation_On_Get()
    {
        var (_, _, _, cat, orders) = Create();
        var itemId = await ActivateTestAsync(cat, "ORD-TEN");
        var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
        var ex = await Assert.ThrowsAsync<OrderDomainException>(() =>
            orders.GetAsync(_otherTenant, draft.Id));
        Assert.Equal(404, ex.StatusCode);
    }

    [Fact]
    public async Task Audit_Fail_Closed_On_Create()
    {
        var (db, audit, platform, cat, _) = Create();
        var itemId = await ActivateTestAsync(cat, "ORD-AUD");

        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), OrderAuditActions.CreateDraft, OrderAuditResourceTypes.Order,
                It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new CatalogueDomainException("audit down", 503, "audit_unavailable"));

        var orders = new OrderService(db, audit.Object, platform.Object, cat);
        var before = db.Orders.Count();
        var ex = await Assert.ThrowsAsync<OrderDomainException>(() =>
            orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId)));
        Assert.Equal(503, ex.StatusCode);
        Assert.Equal(before, db.Orders.Count());
    }

    [Fact]
    public async Task OrderNumbers_Unique_Within_Tenant()
    {
        var numbers = new HashSet<string>();
        var shared = new LaboratoryDbContext(new DbContextOptionsBuilder<LaboratoryDbContext>()
            .UseInMemoryDatabase("ord-num-" + Guid.NewGuid().ToString("N"))
            .Options);
        var audit = new Mock<IPlatformAuditClient>();
        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        var platform = new Mock<IPlatformReferenceClient>();
        platform.Setup(p => p.ValidatePatientAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformPatientRef(_patient, "MRN", "P", DateTime.UtcNow.AddYears(-30)));
        platform.Setup(p => p.ValidateUserAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserRef(_ordering, "U", "active"));
        var cat = new CatalogueService(shared, audit.Object);
        var itemId = await ActivateTestAsync(cat, "ORD-NUM");
        var svc = new OrderService(shared, audit.Object, platform.Object, cat);

        for (var i = 0; i < 5; i++)
        {
            var d = await svc.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
            Assert.True(numbers.Add(d.OrderNumber));
            Assert.Matches(@"^LAB-\d{8}-\d{6}$", d.OrderNumber);
        }
        Assert.Equal(5, numbers.Count);
    }

    [Fact]
    public async Task Draft_Cancel_Allowed()
    {
        var (_, _, _, cat, orders) = Create();
        var itemId = await ActivateTestAsync(cat, "ORD-CXL");
        var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
        var cancelled = await orders.CancelAsync(_tenant, _actor, draft.Id,
            new CancelOrderRequest(draft.RowVersion, "Abandoned"));
        Assert.Equal(OrderStatuses.Cancelled, cancelled.Status);
    }

    [Fact]
    public void Authz_Orders_Distinct_From_Pathology_And_Catalogue_Admin()
    {
        var claimsLabOnly = new JwtClaims(_actor, _tenant, new[] { LaboratoryAuthz.LegacyLaboratoryView });
        Assert.False(LaboratoryAuthz.HasAny(claimsLabOnly, LaboratoryAuthz.OrdersCreate));
        var claimsCat = new JwtClaims(_actor, _tenant, new[] { LaboratoryAuthz.CatalogueManage });
        Assert.False(LaboratoryAuthz.HasAny(claimsCat, LaboratoryAuthz.OrdersCreate));
        var claimsOrder = new JwtClaims(_actor, _tenant, new[] { LaboratoryAuthz.OrdersCreate });
        Assert.True(LaboratoryAuthz.HasAny(claimsOrder, LaboratoryAuthz.OrdersCreate));
        var admin = new JwtClaims(_actor, _tenant, new[] { "*" });
        Assert.True(LaboratoryAuthz.HasAny(admin, LaboratoryAuthz.OrdersManage));
    }

    [Fact]
    public async Task Concurrent_Cancel_Same_ExpectedRowVersion_One_Succeeds_One_409()
    {
        var dbName = "ord-conc-rv-" + Guid.NewGuid().ToString("N");
        var opts = new DbContextOptionsBuilder<LaboratoryDbContext>().UseInMemoryDatabase(dbName).Options;

        await using (var seedDb = new LaboratoryDbContext(opts))
        {
            var (audit, platform, cat, orders) = BuildServices(seedDb);
            var itemId = await ActivateTestAsync(cat, "ORD-RV2");
            var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
            var rowVersion = draft.RowVersion;
            var orderId = draft.Id;

            await using var dbA = new LaboratoryDbContext(opts);
            await using var dbB = new LaboratoryDbContext(opts);
            var (_, _, _, ordersA) = BuildServices(dbA, audit, platform);
            var (_, _, _, ordersB) = BuildServices(dbB, audit, platform);

            var t1 = ordersA.CancelAsync(_tenant, _actor, orderId, new CancelOrderRequest(rowVersion, "A"));
            var t2 = ordersB.CancelAsync(_tenant, _actor, orderId, new CancelOrderRequest(rowVersion, "B"));

            var results = await Task.WhenAll(
                WrapResult(t1),
                WrapResult(t2));

            Assert.Equal(1, results.Count(r => r.Ok));
            Assert.Equal(1, results.Count(r => !r.Ok && r.Exception is OrderDomainException ex
                && ex.StatusCode == 409 && ex.Code == "concurrency_conflict"));

            await using var verify = new LaboratoryDbContext(opts);
            var order = await verify.Orders.AsNoTracking().SingleAsync(o => o.Id == orderId);
            Assert.Equal(OrderStatuses.Cancelled, order.Status);
            Assert.Equal(rowVersion + 1, order.RowVersion);
            Assert.True(order.CancelReason is "A" or "B");
        }
    }

    [Fact]
    public async Task Concurrent_Create_Produces_Distinct_OrderNumbers()
    {
        var dbName = "ord-conc-num-" + Guid.NewGuid().ToString("N");
        var opts = new DbContextOptionsBuilder<LaboratoryDbContext>().UseInMemoryDatabase(dbName).Options;
        Guid itemId;
        Mock<IPlatformAuditClient> audit;
        Mock<IPlatformReferenceClient> platform;
        await using (var seedDb = new LaboratoryDbContext(opts))
        {
            (audit, platform, var cat, _) = BuildServices(seedDb);
            itemId = await ActivateTestAsync(cat, "ORD-NUM2");
        }

        var tasks = Enumerable.Range(0, 8).Select(async i =>
        {
            await using var db = new LaboratoryDbContext(opts);
            var (_, _, _, orders) = BuildServices(db, audit, platform);
            return await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
        });

        var created = await Task.WhenAll(tasks);
        Assert.Equal(8, created.Select(c => c.OrderNumber).Distinct().Count());
        Assert.Equal(8, created.Select(c => c.Id).Distinct().Count());
    }

    [Fact]
    public async Task Concurrent_Idempotent_Create_Single_Logical_Order()
    {
        var dbName = "ord-conc-idem-" + Guid.NewGuid().ToString("N");
        var opts = new DbContextOptionsBuilder<LaboratoryDbContext>().UseInMemoryDatabase(dbName).Options;
        Guid itemId;
        Mock<IPlatformAuditClient> audit;
        Mock<IPlatformReferenceClient> platform;
        await using (var seedDb = new LaboratoryDbContext(opts))
        {
            (audit, platform, var cat, _) = BuildServices(seedDb);
            itemId = await ActivateTestAsync(cat, "ORD-IDEM2");
        }

        var req = DraftReq(itemId) with { IdempotencyKey = "idem-race-1" };
        var tasks = Enumerable.Range(0, 6).Select(async _ =>
        {
            await using var db = new LaboratoryDbContext(opts);
            var (_, _, _, orders) = BuildServices(db, audit, platform);
            return await orders.CreateDraftAsync(_tenant, _actor, req);
        });

        var results = await Task.WhenAll(tasks);
        Assert.Equal(1, results.Select(r => r.Id).Distinct().Count());
        await using var verify = new LaboratoryDbContext(opts);
        Assert.Equal(1, await verify.Orders.CountAsync(o => o.TenantId == _tenant));
    }

    [Fact]
    public async Task Idempotency_Key_Scoped_Per_Tenant()
    {
        var (db, audit, platform, cat, orders) = Create();
        var itemId = await ActivateTestAsync(cat, "ORD-IDEM-T");
        var key = "shared-key";
        var a = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId) with { IdempotencyKey = key });

        platform.Setup(p => p.ValidatePatientAsync(_otherTenant, _patient, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformPatientRef(_patient, "MRN-2", "Other", new DateTime(1991, 1, 1, 0, 0, 0, DateTimeKind.Utc)));
        platform.Setup(p => p.ValidateUserAsync(_otherTenant, _ordering, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserRef(_ordering, "Dr Ordering", "active"));
        platform.Setup(p => p.ValidateUserAsync(_otherTenant, _responsible, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserRef(_responsible, "Dr Responsible", "active"));

        // Seed catalogue item into other tenant by cloning minimal Active row is heavy;
        // instead create under other tenant via second catalogue path using same item id is invalid.
        // Create a dedicated Active item for other tenant.
        var otherCat = new CatalogueService(db, audit.Object);
        var otherItem = await otherCat.CreateDraftAsync(_otherTenant, _actor, new CreateCatalogueDraftRequest(
            CatalogueType: CatalogueTypes.Test,
            InternalOrderCode: "ORD-IDEM-T2",
            DisplayName: "Other Tenant Test",
            Discipline: "CLINICAL_CHEMISTRY",
            ChangeReason: "idem tenant"));
        otherItem = await otherCat.SubmitForReviewAsync(_otherTenant, _actor, otherItem.Id, new LifecycleActionRequest());
        otherItem = await otherCat.ApproveAsync(_otherTenant, _actor, otherItem.Id, new LifecycleActionRequest());
        otherItem = await otherCat.ActivateAsync(_otherTenant, _actor, otherItem.Id, new LifecycleActionRequest(
            EffectiveFrom: DateTime.UtcNow.AddDays(-1)));

        var otherOrders = new OrderService(db, audit.Object, platform.Object, otherCat);
        var b = await otherOrders.CreateDraftAsync(_otherTenant, _actor,
            DraftReq(otherItem.Id) with { IdempotencyKey = key });
        Assert.NotEqual(a.Id, b.Id);
        Assert.Equal(2, db.Orders.Count());
    }

    [Fact]
    public async Task Audit_Fail_Closed_On_Amend_Leaves_No_Orphans()
    {
        var (db, audit, platform, cat, orders) = Create();
        var itemId = await ActivateTestAsync(cat, "ORD-AUD-AM");
        var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
        var submitted = await orders.SubmitAsync(_tenant, _actor, draft.Id, new SubmitOrderRequest(draft.RowVersion));

        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), OrderAuditActions.AmendOrder, OrderAuditResourceTypes.Order,
                It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new CatalogueDomainException("audit down", 503, "audit_unavailable"));

        var failing = new OrderService(db, audit.Object, platform.Object, cat);
        var beforeVersions = db.OrderVersions.Count(v => v.OrderId == submitted.Id);
        var beforeTests = db.OrderTests.Count();
        var beforeSelections = db.OrderSelections.Count();

        var ex = await Assert.ThrowsAsync<OrderDomainException>(() =>
            failing.AmendAsync(_tenant, _actor, submitted.Id, new AmendOrderRequest(
                submitted.RowVersion, "clarify",
                _patient, null, _ordering, _responsible, _branch,
                OrderSources.Clinician, OrderPriorities.Routine, null, "updated indication", null,
                new[] { new OrderSelectionInput(itemId) })));
        Assert.Equal(503, ex.StatusCode);

        var order = await db.Orders.AsNoTracking().SingleAsync(o => o.Id == submitted.Id);
        Assert.Equal(OrderStatuses.Submitted, order.Status);
        Assert.Equal(1, order.CurrentVersionNumber);
        Assert.Equal(submitted.CurrentVersion!.Id, order.CurrentVersionId);
        Assert.Equal(submitted.RowVersion, order.RowVersion);
        Assert.Equal(beforeVersions, db.OrderVersions.Count(v => v.OrderId == submitted.Id));
        Assert.Equal(beforeTests, db.OrderTests.Count());
        Assert.Equal(beforeSelections, db.OrderSelections.Count());
    }

    [Fact]
    public async Task Audit_Fail_Closed_On_UpdateDraft()
    {
        var (db, audit, platform, cat, orders) = Create();
        var itemId = await ActivateTestAsync(cat, "ORD-AUD-UP");
        var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
        var priorIndication = draft.CurrentVersion!.ClinicalIndication;

        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), OrderAuditActions.UpdateDraft, OrderAuditResourceTypes.Order,
                It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new CatalogueDomainException("audit down", 503, "audit_unavailable"));

        var failing = new OrderService(db, audit.Object, platform.Object, cat);
        var ex = await Assert.ThrowsAsync<OrderDomainException>(() =>
            failing.UpdateDraftAsync(_tenant, _actor, draft.Id, new UpdateOrderDraftRequest(
                draft.RowVersion, _patient, null, _ordering, _responsible, _branch,
                OrderSources.Clinician, OrderPriorities.Routine, null, "should not persist", null,
                new[] { new OrderSelectionInput(itemId) })));
        Assert.Equal(503, ex.StatusCode);

        var after = await orders.GetAsync(_tenant, draft.Id);
        Assert.Equal(priorIndication, after.CurrentVersion!.ClinicalIndication);
        Assert.Equal(draft.RowVersion, after.RowVersion);
    }

    private (Mock<IPlatformAuditClient> Audit, Mock<IPlatformReferenceClient> Platform, CatalogueService Cat, OrderService Orders)
        BuildServices(
            LaboratoryDbContext db,
            Mock<IPlatformAuditClient>? audit = null,
            Mock<IPlatformReferenceClient>? platform = null)
    {
        if (audit is null)
        {
            audit = new Mock<IPlatformAuditClient>();
            audit.Setup(a => a.WriteAsync(
                    It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                    It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
        }

        if (platform is null)
        {
            platform = new Mock<IPlatformReferenceClient>();
            platform.Setup(p => p.ValidatePatientAsync(_tenant, _patient, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new PlatformPatientRef(_patient, "MRN-1", "Test Patient", new DateTime(1990, 1, 1, 0, 0, 0, DateTimeKind.Utc)));
            platform.Setup(p => p.ValidateUserAsync(_tenant, _ordering, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new PlatformUserRef(_ordering, "Dr Ordering", "active"));
            platform.Setup(p => p.ValidateUserAsync(_tenant, _responsible, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new PlatformUserRef(_responsible, "Dr Responsible", "active"));
            platform.Setup(p => p.ValidateVisitAsync(_tenant, _visit, _patient, _branch, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new PlatformVisitRef(_visit, _patient, _branch, "checked_in"));
        }

        var cat = new CatalogueService(db, audit.Object);
        var orders = new OrderService(db, audit.Object, platform.Object, cat);
        return (audit, platform, cat, orders);
    }

    private static async Task<(bool Ok, Exception? Exception)> WrapResult(Task<OrderDetailDto> task)
    {
        try
        {
            await task;
            return (true, null);
        }
        catch (Exception ex)
        {
            return (false, ex);
        }
    }
}
