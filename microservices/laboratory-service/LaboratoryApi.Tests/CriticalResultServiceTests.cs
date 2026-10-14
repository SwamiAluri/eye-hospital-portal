using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using LaboratoryApi.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace LaboratoryApi.Tests;

/// <summary>L-CRT-01 — Manual Critical classification + acknowledgement.</summary>
public class CriticalResultServiceTests
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

    private (LaboratoryDbContext Db, Mock<IPlatformAuditClient> Audit, Mock<IPlatformNotificationClient> Notify,
        ResultService Results, CriticalResultService Critical, SpecimenService Specimens, OrderService Orders,
        CatalogueService Catalogue, CollectionService Collection)
        Create(bool notifySucceeds = true)
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

        var notify = new Mock<IPlatformNotificationClient>();
        if (notifySucceeds)
        {
            notify.Setup(n => n.EmitTenantIntentAsync(
                    It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
        }
        else
        {
            notify.Setup(n => n.EmitTenantIntentAsync(
                    It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<CancellationToken>()))
                .ThrowsAsync(new TestingDomainException(
                    "Notification infrastructure unavailable.",
                    statusCode: 503, code: "notification_unavailable"));
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
        var critical = new CriticalResultService(db, audit.Object, platform.Object, notify.Object);
        return (db, audit, notify, results, critical, specimens, orders, catalogue, collection);
    }

    private async Task<Guid> ActivateTestAsync(
        CatalogueService cat, LaboratoryDbContext db, string code)
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
            ClinicalIndication: "Critical UAT",
            Notes: null,
            Selections: catalogueItemIds.Select((id, i) => new OrderSelectionInput(id, i)).ToArray());

    private async Task<(ResultDraftDto Verified, CriticalResultService Critical, ResultService Results,
            LaboratoryDbContext Db, Mock<IPlatformAuditClient> Audit, Mock<IPlatformNotificationClient> Notify,
            Guid OrderTestId, Guid SpecimenId)>
        VerifiedFixtureAsync(bool notifySucceeds = true)
    {
        var (db, audit, notify, results, critical, specimens, orders, catalogue, collection) =
            Create(notifySucceeds);
        var itemId = await ActivateTestAsync(catalogue, db, "CRT-" + Guid.NewGuid().ToString("N")[..6]);
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
        return (verified, critical, results, db, audit, notify, otId, specimen.Id);
    }

    [Fact]
    public async Task TechnicalVerified_May_Be_Classified_Critical_With_Version_Binding()
    {
        var (verified, critical, _, db, audit, notify, otId, specimenId) = await VerifiedFixtureAsync();
        var evt = await critical.CreateAsync(_tenant, _actor, verified.Id, new CreateCriticalEventRequest(
            _branch, verified.CurrentVersionNumber));

        Assert.Equal(CriticalResultEventStatuses.Open, evt.Status);
        Assert.Equal(ResultStatuses.TechnicalVerified, evt.ResultStatus);
        Assert.Equal(verified.CurrentVersionNumber, evt.ResultVersionNumber);
        Assert.Equal(_actor, evt.ClassifiedByUserId);
        Assert.NotNull(evt.ClassifiedAtUtc);
        Assert.Equal(CriticalNotificationIntentStatuses.Emitted, evt.NotificationIntentStatus);

        var result = await db.Results.AsNoTracking().FirstAsync(r => r.Id == verified.Id);
        Assert.Equal(ResultStatuses.TechnicalVerified, result.Status);

        var ot = await db.OrderTests.AsNoTracking().FirstAsync(t => t.Id == otId);
        Assert.Equal(OrderTestStatuses.Ordered, ot.Status);
        var sp = await db.Specimens.AsNoTracking().FirstAsync(s => s.Id == specimenId);
        Assert.Equal(SpecimenStatuses.Received, sp.Status);

        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, CriticalAuditActions.CreateCriticalEvent,
            CriticalAuditResources.LmsCriticalResultEvent, evt.Id,
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
        notify.Verify(n => n.EmitTenantIntentAsync(
            _tenant, PlatformNotificationClient.CriticalResultIntentType,
            It.IsAny<string>(), It.Is<string>(d => d.Contains(evt.Id.ToString())),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ClinicallyAuthorized_May_Be_Classified_Critical()
    {
        var (verified, critical, results, _, _, _, _, _) = await VerifiedFixtureAsync();
        var authorized = await results.AuthorizeAsync(_tenant, _actor, verified.Id, new AuthorizeResultRequest(
            _branch, verified.RowVersion, verified.CurrentVersionNumber));
        var evt = await critical.CreateAsync(_tenant, _actor, authorized.Id, new CreateCriticalEventRequest(_branch));
        Assert.Equal(ResultStatuses.ClinicallyAuthorized, evt.ResultStatus);
        Assert.Equal(CriticalResultEventStatuses.Open, evt.Status);
    }

    [Fact]
    public async Task Draft_Cannot_Be_Classified_Critical()
    {
        var (db, _, _, results, critical, specimens, orders, catalogue, collection) = Create();
        var itemId = await ActivateTestAsync(catalogue, db, "DRF-" + Guid.NewGuid().ToString("N")[..6]);
        var d = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
        var order = await orders.SubmitAsync(_tenant, _actor, d.Id, new SubmitOrderRequest(d.RowVersion));
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
        var draft = await results.CreateDraftAsync(_tenant, _actor, new CreateResultDraftRequest(
            otId, specimen.Id, _branch, NumericValue: "1", Unit: "mg/dL"));

        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            critical.CreateAsync(_tenant, _actor, draft.Id, new CreateCriticalEventRequest(_branch)));
        Assert.Equal("invalid_state", ex.Code);
    }

    [Fact]
    public async Task Duplicate_Classification_Same_Version_Conflicts()
    {
        var (verified, critical, _, _, _, _, _, _) = await VerifiedFixtureAsync();
        await critical.CreateAsync(_tenant, _actor, verified.Id, new CreateCriticalEventRequest(_branch));
        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            critical.CreateAsync(_tenant, _actor, verified.Id, new CreateCriticalEventRequest(_branch)));
        Assert.Equal("already_critical", ex.Code);
    }

    [Fact]
    public async Task Acknowledge_Requires_Evidence_And_Succeeds()
    {
        var (verified, critical, _, db, audit, _, _, _) = await VerifiedFixtureAsync();
        var evt = await critical.CreateAsync(_tenant, _actor, verified.Id, new CreateCriticalEventRequest(_branch));
        var ack = await critical.AcknowledgeAsync(
            _tenant, _actor, verified.Id, evt.Id,
            new AcknowledgeCriticalEventRequest(_branch, evt.RowVersion, "  Phone read-back OK  "));

        Assert.Equal(CriticalResultEventStatuses.Acknowledged, ack.Status);
        Assert.Equal(_actor, ack.AcknowledgedByUserId);
        Assert.Equal("Phone read-back OK", ack.AcknowledgementEvidence);
        Assert.Equal(ResultStatuses.TechnicalVerified, ack.ResultStatus);

        var row = await db.Results.AsNoTracking().FirstAsync(r => r.Id == verified.Id);
        Assert.Equal(ResultStatuses.TechnicalVerified, row.Status);

        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, CriticalAuditActions.AcknowledgeCriticalEvent,
            CriticalAuditResources.LmsCriticalResultEvent, evt.Id,
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Acknowledge_Empty_Evidence_Rejected()
    {
        var (verified, critical, _, _, _, _, _, _) = await VerifiedFixtureAsync();
        var evt = await critical.CreateAsync(_tenant, _actor, verified.Id, new CreateCriticalEventRequest(_branch));
        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            critical.AcknowledgeAsync(
                _tenant, _actor, verified.Id, evt.Id,
                new AcknowledgeCriticalEventRequest(_branch, evt.RowVersion, "   ")));
        Assert.Equal("acknowledgement_evidence_required", ex.Code);
    }

    [Fact]
    public async Task Stale_RowVersion_Acknowledge_Conflicts()
    {
        var (verified, critical, _, _, _, _, _, _) = await VerifiedFixtureAsync();
        var evt = await critical.CreateAsync(_tenant, _actor, verified.Id, new CreateCriticalEventRequest(_branch));
        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            critical.AcknowledgeAsync(
                _tenant, _actor, verified.Id, evt.Id,
                new AcknowledgeCriticalEventRequest(_branch, evt.RowVersion - 1, "ack")));
        Assert.Equal("concurrency_conflict", ex.Code);
    }

    [Fact]
    public async Task Create_Idempotency_Replay_And_Hash_Conflict()
    {
        var (verified, critical, _, _, _, notify, _, _) = await VerifiedFixtureAsync();
        var key = "crt-create-" + Guid.NewGuid().ToString("N");
        var first = await critical.CreateAsync(_tenant, _actor, verified.Id, new CreateCriticalEventRequest(
            _branch, verified.CurrentVersionNumber, key));
        var replay = await critical.CreateAsync(_tenant, _actor, verified.Id, new CreateCriticalEventRequest(
            _branch, verified.CurrentVersionNumber, key));
        Assert.Equal(first.Id, replay.Id);
        notify.Verify(n => n.EmitTenantIntentAsync(
            It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<CancellationToken>()), Times.Once);

        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            critical.CreateAsync(_tenant, _actor, verified.Id, new CreateCriticalEventRequest(
                _branch, verified.CurrentVersionNumber + 99, key)));
        Assert.Equal("idempotency_conflict", ex.Code);
    }

    [Fact]
    public async Task Audit_Failure_On_Create_Reverts_Event()
    {
        var (verified, critical, _, db, audit, _, _, _) = await VerifiedFixtureAsync();
        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), CriticalAuditActions.CreateCriticalEvent,
                It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("audit down"));

        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            critical.CreateAsync(_tenant, _actor, verified.Id, new CreateCriticalEventRequest(_branch)));
        Assert.Equal("audit_unavailable", ex.Code);
        Assert.Empty(await db.CriticalResultEvents.AsNoTracking().Where(e => e.ResultId == verified.Id).ToListAsync());
    }

    [Fact]
    public async Task Audit_Failure_On_Acknowledge_Reverts_Mutation()
    {
        var (verified, critical, _, db, audit, _, _, _) = await VerifiedFixtureAsync();
        var evt = await critical.CreateAsync(_tenant, _actor, verified.Id, new CreateCriticalEventRequest(_branch));
        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), CriticalAuditActions.AcknowledgeCriticalEvent,
                It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("audit down"));

        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            critical.AcknowledgeAsync(
                _tenant, _actor, verified.Id, evt.Id,
                new AcknowledgeCriticalEventRequest(_branch, evt.RowVersion, "phone ack")));
        Assert.Equal("audit_unavailable", ex.Code);

        var row = await db.CriticalResultEvents.AsNoTracking()
            .SingleAsync(e => e.Id == evt.Id && e.TenantId == _tenant);
        Assert.Equal(CriticalResultEventStatuses.Open, row.Status);
        Assert.Null(row.AcknowledgedAtUtc);
        Assert.Null(row.AcknowledgementEvidence);
        Assert.Equal(evt.RowVersion, row.RowVersion);
    }

    [Fact]
    public async Task Acknowledge_Idempotency_Replay_And_Hash_Conflict()
    {
        var (verified, critical, _, _, _, _, _, _) = await VerifiedFixtureAsync();
        var evt = await critical.CreateAsync(_tenant, _actor, verified.Id, new CreateCriticalEventRequest(_branch));
        var key = "crt-ack-" + Guid.NewGuid().ToString("N");
        var first = await critical.AcknowledgeAsync(
            _tenant, _actor, verified.Id, evt.Id,
            new AcknowledgeCriticalEventRequest(_branch, evt.RowVersion, "ack evidence", key));
        var replay = await critical.AcknowledgeAsync(
            _tenant, _actor, verified.Id, evt.Id,
            new AcknowledgeCriticalEventRequest(_branch, evt.RowVersion, "ack evidence", key));
        Assert.Equal(first.Id, replay.Id);
        Assert.Equal(CriticalResultEventStatuses.Acknowledged, replay.Status);

        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            critical.AcknowledgeAsync(
                _tenant, _actor, verified.Id, evt.Id,
                new AcknowledgeCriticalEventRequest(_branch, evt.RowVersion, "different evidence", key)));
        Assert.Equal("idempotency_conflict", ex.Code);
    }

    [Fact]
    public async Task Notification_Unavailable_Preserves_Open_Event_Without_Ack()
    {
        var (verified, critical, _, _, _, _, _, _) = await VerifiedFixtureAsync(notifySucceeds: false);
        var evt = await critical.CreateAsync(_tenant, _actor, verified.Id, new CreateCriticalEventRequest(_branch));
        Assert.Equal(CriticalResultEventStatuses.Open, evt.Status);
        Assert.Equal(CriticalNotificationIntentStatuses.Unavailable, evt.NotificationIntentStatus);
        Assert.Null(evt.AcknowledgedAtUtc);
    }

    [Fact]
    public async Task Wrong_Tenant_Not_Found()
    {
        var (verified, critical, _, _, _, _, _, _) = await VerifiedFixtureAsync();
        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            critical.CreateAsync(_otherTenant, _actor, verified.Id, new CreateCriticalEventRequest(_branch)));
        Assert.Equal("not_found", ex.Code);
    }

    [Fact]
    public async Task Unauthorized_Branch_Rejected()
    {
        var (verified, critical, _, _, _, _, _, _) = await VerifiedFixtureAsync();
        await Assert.ThrowsAsync<OrderDomainException>(() =>
            critical.CreateAsync(_tenant, _actor, verified.Id, new CreateCriticalEventRequest(_otherBranch)));
    }

    [Fact]
    public async Task Work_Queue_Returns_Real_Events_Only()
    {
        var (verified, critical, _, _, _, _, _, _) = await VerifiedFixtureAsync();
        await critical.CreateAsync(_tenant, _actor, verified.Id, new CreateCriticalEventRequest(_branch));
        var page = await critical.ListWorkQueueAsync(_tenant, _actor, new CriticalWorkQueueQuery(_branch));
        Assert.Equal(1, page.TotalCount);
        Assert.Equal(verified.Id, page.Items[0].ResultId);
        Assert.Equal(ResultStatuses.TechnicalVerified, page.Items[0].ResultStatus);
        Assert.Equal(CriticalResultEventStatuses.Open, page.Items[0].CriticalStatus);
    }

    [Fact]
    public void Permissions_Are_Distinct_From_Authorize_And_Verify()
    {
        Assert.NotEqual(LaboratoryAuthz.ResultsAuthorize, LaboratoryAuthz.ResultsCriticalManage);
        Assert.NotEqual(LaboratoryAuthz.TestingVerify, LaboratoryAuthz.ResultsCriticalAcknowledge);
        Assert.Equal("lms.results.critical.view", LaboratoryAuthz.ResultsCriticalView);
        Assert.Equal("lms.results.critical.manage", LaboratoryAuthz.ResultsCriticalManage);
        Assert.Equal("lms.results.critical.acknowledge", LaboratoryAuthz.ResultsCriticalAcknowledge);
    }

    [Fact]
    public void ResultStatuses_Do_Not_Include_Critical()
    {
        Assert.Equal("Draft", ResultStatuses.Draft);
        Assert.Equal("TechnicalVerified", ResultStatuses.TechnicalVerified);
        Assert.Equal("ClinicallyAuthorized", ResultStatuses.ClinicallyAuthorized);
        Assert.DoesNotContain("Critical", new[]
        {
            ResultStatuses.Draft, ResultStatuses.TechnicalVerified, ResultStatuses.ClinicallyAuthorized,
        });
    }
}
