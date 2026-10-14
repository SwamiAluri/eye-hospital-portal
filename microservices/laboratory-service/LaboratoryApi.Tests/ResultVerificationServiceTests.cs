using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using LaboratoryApi.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace LaboratoryApi.Tests;

/// <summary>L-VER-01 — Technical Verification (Draft → TechnicalVerified).</summary>
public class ResultVerificationServiceTests
{
    private readonly Guid _tenant = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _otherTenant = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private readonly Guid _actor = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _otherActor = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
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
            platform.Setup(p => p.ValidateUserBranchAsync(
                    _tenant, _otherActor, _branch, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new PlatformUserBranchRef(_otherActor, _branch, true));
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
        string? units = "mg/dL")
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
        version.ResultDatatype = datatype;
        version.PermittedUnits = units;
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
            ClinicalIndication: "Verification UAT",
            Notes: null,
            Selections: catalogueItemIds.Select((id, i) => new OrderSelectionInput(id, i)).ToArray());

    private async Task<(SpecimenDetailDto Specimen, OrderDetailDto Order, Guid OrderTestId, ResultService Results,
            LaboratoryDbContext Db, Mock<IPlatformAuditClient> Audit, ResultDraftDto Draft)>
        DraftFixtureAsync(string? datatype = "Numeric", string? numeric = "12.5", string? qualitative = null)
    {
        var (db, audit, _, results, specimens, orders, catalogue, collection) = Create();
        var itemId = await ActivateTestAsync(catalogue, db, "VER-" + Guid.NewGuid().ToString("N")[..6], datatype);
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
            otId, specimen.Id, _branch,
            NumericValue: datatype == "Numeric" ? numeric : null,
            QualitativeValue: datatype == "Qualitative" ? qualitative ?? "Positive" : null,
            Unit: datatype == "Numeric" ? "mg/dL" : null,
            Comment: "draft comment"));
        return (specimen, order, otId, results, db, audit, result);
    }

    [Fact]
    public async Task Draft_To_TechnicalVerified_Succeeds_With_Metadata()
    {
        var (specimen, order, otId, results, db, audit, draft) = await DraftFixtureAsync();
        var verified = await results.VerifyAsync(_tenant, _actor, draft.Id, new VerifyResultRequest(
            _branch, draft.RowVersion, draft.CurrentVersionNumber));

        Assert.Equal(ResultStatuses.TechnicalVerified, verified.Status);
        Assert.Equal(_actor, verified.VerifiedByUserId);
        Assert.NotNull(verified.VerifiedAtUtc);
        Assert.Equal(draft.CurrentVersionNumber, verified.VerifiedVersionNumber);
        Assert.Equal(draft.RowVersion + 1, verified.RowVersion);

        var ot = await db.OrderTests.AsNoTracking().FirstAsync(t => t.Id == otId);
        Assert.Equal(OrderTestStatuses.Ordered, ot.Status);
        var ord = await db.Orders.AsNoTracking().FirstAsync(o => o.Id == order.Id);
        Assert.Equal(OrderStatuses.Submitted, ord.Status);
        var sp = await db.Specimens.AsNoTracking().FirstAsync(s => s.Id == specimen.Id);
        Assert.Equal(SpecimenStatuses.Received, sp.Status);

        var versions = await db.ResultVersions.AsNoTracking()
            .Where(v => v.ResultId == draft.Id).OrderBy(v => v.VersionNumber).ToListAsync();
        Assert.Single(versions);
        Assert.Equal("12.5", versions[0].NumericValue);

        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, ResultAuditActions.VerifyResult, ResultAuditResources.LmsResult,
            draft.Id, It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Same_Person_Creator_May_Verify()
    {
        var (_, _, _, results, _, _, draft) = await DraftFixtureAsync();
        var verified = await results.VerifyAsync(_tenant, _actor, draft.Id, new VerifyResultRequest(
            _branch, draft.RowVersion));
        Assert.Equal(ResultStatuses.TechnicalVerified, verified.Status);
        Assert.Equal(draft.CreatedByUserId, verified.VerifiedByUserId);
    }

    [Fact]
    public async Task Second_Verify_Fails_Already_Verified()
    {
        var (_, _, _, results, _, _, draft) = await DraftFixtureAsync();
        var v1 = await results.VerifyAsync(_tenant, _actor, draft.Id, new VerifyResultRequest(
            _branch, draft.RowVersion));
        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            results.VerifyAsync(_tenant, _actor, draft.Id, new VerifyResultRequest(
                _branch, v1.RowVersion)));
        Assert.Equal("already_verified", ex.Code);
    }

    [Fact]
    public async Task Draft_Update_After_TechnicalVerified_Rejected()
    {
        var (_, _, _, results, _, _, draft) = await DraftFixtureAsync();
        var v1 = await results.VerifyAsync(_tenant, _actor, draft.Id, new VerifyResultRequest(
            _branch, draft.RowVersion));
        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            results.UpdateDraftAsync(_tenant, _actor, draft.Id, new UpdateResultDraftRequest(
                _branch, v1.RowVersion, NumericValue: "99")));
        Assert.Equal("invalid_state", ex.Code);
    }

    [Fact]
    public async Task Stale_RowVersion_Returns_409()
    {
        var (_, _, _, results, _, _, draft) = await DraftFixtureAsync();
        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            results.VerifyAsync(_tenant, _actor, draft.Id, new VerifyResultRequest(
                _branch, draft.RowVersion - 1)));
        Assert.Equal("concurrency_conflict", ex.Code);
    }

    [Fact]
    public async Task Concurrent_Update_Then_Stale_Verify_Fails()
    {
        var (_, _, _, results, _, _, draft) = await DraftFixtureAsync();
        var updated = await results.UpdateDraftAsync(_tenant, _actor, draft.Id, new UpdateResultDraftRequest(
            _branch, draft.RowVersion, NumericValue: "13.0", Unit: "mg/dL"));
        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            results.VerifyAsync(_tenant, _actor, draft.Id, new VerifyResultRequest(
                _branch, draft.RowVersion)));
        Assert.Equal("concurrency_conflict", ex.Code);

        var ok = await results.VerifyAsync(_tenant, _actor, draft.Id, new VerifyResultRequest(
            _branch, updated.RowVersion, updated.CurrentVersionNumber));
        Assert.Equal(2, ok.VerifiedVersionNumber);
    }

    [Fact]
    public async Task Expected_Current_Version_Mismatch_Fails()
    {
        var (_, _, _, results, _, _, draft) = await DraftFixtureAsync();
        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            results.VerifyAsync(_tenant, _actor, draft.Id, new VerifyResultRequest(
                _branch, draft.RowVersion, ExpectedCurrentVersionNumber: 99)));
        Assert.Equal("version_conflict", ex.Code);
    }

    [Fact]
    public async Task Comment_Only_Draft_Blocked()
    {
        var (db, audit, _, results, specimens, orders, catalogue, collection) = Create();
        var itemId = await ActivateTestAsync(catalogue, db, "CMT-" + Guid.NewGuid().ToString("N")[..6]);
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
            otId, specimen.Id, _branch, Comment: "note only"));

        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            results.VerifyAsync(_tenant, _actor, draft.Id, new VerifyResultRequest(_branch, draft.RowVersion)));
        Assert.Equal("value_required", ex.Code);
        _ = audit;
    }

    [Fact]
    public async Task Idempotent_Verify_Replays_And_Hash_Conflict()
    {
        var (_, _, _, results, _, _, draft) = await DraftFixtureAsync();
        const string key = "verify-idem-1";
        var first = await results.VerifyAsync(_tenant, _actor, draft.Id, new VerifyResultRequest(
            _branch, draft.RowVersion, draft.CurrentVersionNumber, key));
        var replay = await results.VerifyAsync(_tenant, _actor, draft.Id, new VerifyResultRequest(
            _branch, draft.RowVersion, draft.CurrentVersionNumber, key));
        Assert.Equal(first.Id, replay.Id);
        Assert.Equal(first.RowVersion, replay.RowVersion);
        Assert.Equal(ResultStatuses.TechnicalVerified, replay.Status);

        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            results.VerifyAsync(_tenant, _actor, draft.Id, new VerifyResultRequest(
                _branch, draft.RowVersion + 1, draft.CurrentVersionNumber, key)));
        Assert.Equal("idempotency_conflict", ex.Code);
    }

    [Fact]
    public async Task Audit_Failure_Fail_Closed_On_Verify()
    {
        var (_, _, _, results, db, audit, draft) = await DraftFixtureAsync();
        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), ResultAuditActions.VerifyResult, It.IsAny<string>(),
                It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("audit down"));

        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            results.VerifyAsync(_tenant, _actor, draft.Id, new VerifyResultRequest(_branch, draft.RowVersion)));
        Assert.Equal("audit_unavailable", ex.Code);

        var persisted = await db.Results.AsNoTracking().FirstAsync(r => r.Id == draft.Id);
        Assert.Equal(ResultStatuses.Draft, persisted.Status);
        Assert.Null(persisted.VerifiedByUserId);
        Assert.Null(persisted.VerifiedAtUtc);
        Assert.Null(persisted.VerifiedVersionNumber);
        Assert.Equal(draft.RowVersion, persisted.RowVersion);
    }

    [Fact]
    public async Task Wrong_Tenant_Cannot_Verify()
    {
        var (_, _, _, results, _, _, draft) = await DraftFixtureAsync();
        var ex = await Assert.ThrowsAsync<TestingDomainException>(() =>
            results.VerifyAsync(_otherTenant, _actor, draft.Id, new VerifyResultRequest(
                _branch, draft.RowVersion)));
        Assert.Equal("not_found", ex.Code);
    }

    [Fact]
    public async Task Unauthorized_Branch_Cannot_Verify()
    {
        var (_, _, _, _, _, _, draft) = await DraftFixtureAsync();
        var (_, _, _, results2, _, _, _, _) = Create(actorAuthorizedForBranch: false);
        await Assert.ThrowsAsync<OrderDomainException>(() =>
            results2.VerifyAsync(_tenant, _actor, draft.Id, new VerifyResultRequest(
                _branch, draft.RowVersion)));
    }

    [Fact]
    public async Task ResultStatus_Draft_Filter_Excludes_TechnicalVerified()
    {
        var (_, _, otId, results, _, _, draft) = await DraftFixtureAsync();
        await results.VerifyAsync(_tenant, _actor, draft.Id, new VerifyResultRequest(
            _branch, draft.RowVersion));

        var draftOnly = await results.ListWorkQueueAsync(_tenant, _actor, new TestingWorkQueueQuery(
            _branch, ResultStatus: ResultStatuses.Draft));
        Assert.DoesNotContain(draftOnly.Items, i => i.OrderTestId == otId);

        // Default Testing work queue is Draft-or-none only — TechnicalVerified must not leak.
        var testingDefault = await results.ListWorkQueueAsync(
            _tenant, _actor, new TestingWorkQueueQuery(_branch));
        Assert.DoesNotContain(testingDefault.Items, i => i.OrderTestId == otId);
    }

    [Fact]
    public async Task Default_Testing_Work_Queue_Excludes_TechnicalVerified()
    {
        var (_, _, otId, results, _, _, draft) = await DraftFixtureAsync();
        await results.VerifyAsync(_tenant, _actor, draft.Id, new VerifyResultRequest(
            _branch, draft.RowVersion));

        var page = await results.ListWorkQueueAsync(_tenant, _actor, new TestingWorkQueueQuery(_branch));
        Assert.DoesNotContain(page.Items, i =>
            i.OrderTestId == otId || i.ResultStatus == ResultStatuses.TechnicalVerified);
    }

    [Fact]
    public async Task Default_Testing_Work_Queue_Still_Includes_Draft()
    {
        var (_, _, otId, results, _, _, draft) = await DraftFixtureAsync();

        var page = await results.ListWorkQueueAsync(_tenant, _actor, new TestingWorkQueueQuery(_branch));
        Assert.Contains(page.Items, i =>
            i.OrderTestId == otId && i.ResultId == draft.Id && i.ResultStatus == ResultStatuses.Draft);
    }

    [Fact]
    public async Task No_Hardcoded_Clinical_Interpretation_On_Verify()
    {
        var (_, _, _, results, db, _, draft) = await DraftFixtureAsync(numeric: "999999");
        var verified = await results.VerifyAsync(_tenant, _actor, draft.Id, new VerifyResultRequest(
            _branch, draft.RowVersion));
        Assert.Equal(ResultStatuses.TechnicalVerified, verified.Status);
        var entity = await db.Results.AsNoTracking().FirstAsync(r => r.Id == draft.Id);
        Assert.Equal("999999", entity.NumericValue);
        Assert.DoesNotContain("Abnormal", entity.Comment ?? "");
        Assert.DoesNotContain("Critical", entity.Comment ?? "");
    }

    [Fact]
    public async Task Qualitative_Verify_Succeeds()
    {
        var (_, _, _, results, _, _, draft) =
            await DraftFixtureAsync(datatype: "Qualitative", numeric: null, qualitative: "Reactive");
        var verified = await results.VerifyAsync(_tenant, _actor, draft.Id, new VerifyResultRequest(
            _branch, draft.RowVersion));
        Assert.Equal(ResultStatuses.TechnicalVerified, verified.Status);
        Assert.Equal("Reactive", verified.QualitativeValue);
    }
}
