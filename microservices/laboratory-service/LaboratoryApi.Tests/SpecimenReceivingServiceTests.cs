using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using LaboratoryApi.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace LaboratoryApi.Tests;

public class SpecimenReceivingServiceTests
{
    private readonly Guid _tenant = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _actor = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _patient = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private readonly Guid _ordering = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private readonly Guid _responsible = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
    private readonly Guid _branch = Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff");
    private readonly Guid _otherBranch = Guid.Parse("12345678-1234-1234-1234-123456789012");
    private readonly DateTime _dob = new(1990, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    private (LaboratoryDbContext Db, Mock<IPlatformAuditClient> Audit, Mock<IPlatformReferenceClient> Platform,
        CatalogueService Catalogue, OrderService Orders, CollectionService Collection, SpecimenService Specimens)
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
                    "User is not authorized for the collection branch.",
                    statusCode: 403, code: "branch_unauthorized"));
        }

        platform.Setup(p => p.ValidateUserBranchAsync(
                _tenant, _actor, _otherBranch, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OrderDomainException(
                "User is not authorized for the collection branch.",
                statusCode: 403, code: "branch_unauthorized"));

        foreach (var (code, label) in SpecimenRejectionReasons.Approved)
        {
            platform.Setup(p => p.ValidateMasterValueAsync(
                    _tenant, SpecimenRejectionReasonMaster.EntityType, code, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new PlatformMasterValueRef(
                    SpecimenRejectionReasonMaster.EntityType, code, label, true, 1));
        }

        platform.Setup(p => p.ListActiveMasterValuesAsync(
                _tenant, SpecimenRejectionReasonMaster.EntityType, It.IsAny<CancellationToken>()))
            .ReturnsAsync(SpecimenRejectionReasons.Approved
                .Select((r, i) => new PlatformMasterValueRef(
                    SpecimenRejectionReasonMaster.EntityType, r.Code, r.Label, true, i + 1))
                .ToList());

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
            ChangeReason: "receive test",
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
            ClinicalIndication: "Receive UAT",
            Notes: null,
            Selections: catalogueItemIds.Select((id, i) => new OrderSelectionInput(id, i)).ToArray());

    private async Task<(SpecimenDetailDto Specimen, SpecimenService Specimens, LaboratoryDbContext Db,
            Mock<IPlatformAuditClient> Audit, Mock<IPlatformReferenceClient> Platform, OrderDetailDto Order)>
        CollectedSpecimenAsync(bool actorAuthorizedForBranch = true)
    {
        var (db, audit, platform, cat, orders, collection, specimens) = Create(actorAuthorizedForBranch);
        var itemId = await ActivateTestAsync(cat, "RCV-" + Guid.NewGuid().ToString("N")[..6]);
        var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
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
        return (specimen, specimens, db, audit, platform, order);
    }

    private ReceiveSpecimenRequest ReceiveReq(SpecimenDetailDto s, int? rowVersion = null) =>
        new(
            ExpectedRowVersion: rowVersion ?? s.RowVersion,
            ReceivingBranchId: _branch,
            PatientIdentityConfirmed: true,
            ConfirmedMrn: s.PatientMrnSnapshot!,
            ConfirmedPatientName: s.PatientNameSnapshot!,
            ConfirmedDateOfBirth: s.PatientDateOfBirthSnapshot!.Value,
            ReceivingLocationText: "Bench A");

    private RejectSpecimenRequest RejectReq(SpecimenDetailDto s, string code = "INSUFFICIENT_SPECIMEN") =>
        new(
            ExpectedRowVersion: s.RowVersion,
            OperatingBranchId: _branch,
            RejectionReasonCode: code,
            PatientIdentityConfirmed: true,
            ConfirmedMrn: s.PatientMrnSnapshot!,
            ConfirmedPatientName: s.PatientNameSnapshot!,
            ConfirmedDateOfBirth: s.PatientDateOfBirthSnapshot!.Value);

    [Fact]
    public async Task Collected_to_Received_succeeds_with_accession_format()
    {
        var (specimen, svc, db, audit, _, order) = await CollectedSpecimenAsync();
        var received = await svc.ReceiveAsync(_tenant, _actor, specimen.Id, ReceiveReq(specimen));

        Assert.Equal(SpecimenStatuses.Received, received.Status);
        Assert.Matches(@"^ACC-\d{8}-\d{6}$", received.Accession!);
        Assert.Equal(19, received.Accession!.Length);
        Assert.StartsWith("ACC-", received.Accession);
        Assert.Equal(_actor, received.ReceivedByUserId);
        Assert.NotNull(received.ReceivedAtUtc);
        Assert.Equal(_branch, received.ReceivingBranchId);

        var orderAfter = await db.Orders.AsNoTracking().FirstAsync(o => o.Id == order.Id);
        Assert.Equal(OrderStatuses.Submitted, orderAfter.Status);
        Assert.All(received.OrderTests, ot => Assert.Equal(OrderTestStatuses.Ordered, ot.OrderTestStatus));

        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, SpecimenAuditActions.ReceiveSpecimen,
            SpecimenAuditResourceTypes.Specimen, specimen.Id,
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Collected_to_Rejected_persists_code_and_label_snapshot_without_accession()
    {
        var (specimen, svc, _, audit, _, _) = await CollectedSpecimenAsync();
        var rejected = await svc.RejectAsync(_tenant, _actor, specimen.Id, RejectReq(specimen, "WRONG_CONTAINER"));

        Assert.Equal(SpecimenStatuses.Rejected, rejected.Status);
        Assert.Null(rejected.Accession);
        Assert.Equal("WRONG_CONTAINER", rejected.RejectionReasonCode);
        Assert.Equal("Incorrect specimen container", rejected.RejectionReasonLabelSnapshot);
        Assert.Equal(_actor, rejected.RejectedByUserId);

        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, SpecimenAuditActions.RejectSpecimen,
            SpecimenAuditResourceTypes.Specimen, specimen.Id,
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Forbidden_transitions_rejected()
    {
        var (specimen, svc, _, _, _, _) = await CollectedSpecimenAsync();
        var received = await svc.ReceiveAsync(_tenant, _actor, specimen.Id, ReceiveReq(specimen));

        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            svc.ReceiveAsync(_tenant, _actor, received.Id, ReceiveReq(received)));
        Assert.Equal("invalid_state", ex.Code);

        var (s2, svc2, _, _, _, _) = await CollectedSpecimenAsync();
        var rejected = await svc2.RejectAsync(_tenant, _actor, s2.Id, RejectReq(s2));
        var ex2 = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            svc2.ReceiveAsync(_tenant, _actor, rejected.Id, ReceiveReq(rejected) with
            {
                ConfirmedMrn = rejected.PatientMrnSnapshot!,
                ConfirmedPatientName = rejected.PatientNameSnapshot!,
                ConfirmedDateOfBirth = rejected.PatientDateOfBirthSnapshot!.Value,
            }));
        Assert.Equal("invalid_state", ex2.Code);

        var ex3 = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            svc2.RejectAsync(_tenant, _actor, rejected.Id, RejectReq(rejected)));
        Assert.Equal("invalid_state", ex3.Code);
    }

    [Fact]
    public async Task Complete_collection_does_not_create_accession()
    {
        var (specimen, _, _, _, _, _) = await CollectedSpecimenAsync();
        Assert.Equal(SpecimenStatuses.Collected, specimen.Status);
        Assert.Null(specimen.Accession);
    }

    [Fact]
    public async Task Patient_confirmation_mismatch_fails()
    {
        var (specimen, svc, _, _, _, _) = await CollectedSpecimenAsync();
        var req = ReceiveReq(specimen) with { ConfirmedMrn = "WRONG" };
        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            svc.ReceiveAsync(_tenant, _actor, specimen.Id, req));
        Assert.Equal("patient_confirmation_failure", ex.Code);
    }

    [Fact]
    public async Task Unauthorized_branch_fails()
    {
        var (specimen, svc, _, _, _, _) = await CollectedSpecimenAsync();
        var req = ReceiveReq(specimen) with { ReceivingBranchId = _otherBranch };
        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            svc.ReceiveAsync(_tenant, _actor, specimen.Id, req));
        Assert.Equal(403, ex.StatusCode);
        Assert.Equal("branch_unauthorized", ex.Code);
    }

    [Fact]
    public async Task Stale_row_version_returns_409()
    {
        var (specimen, svc, _, _, _, _) = await CollectedSpecimenAsync();
        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            svc.ReceiveAsync(_tenant, _actor, specimen.Id, ReceiveReq(specimen, rowVersion: specimen.RowVersion + 5)));
        Assert.Equal(409, ex.StatusCode);
        Assert.Equal("concurrency_conflict", ex.Code);
    }

    [Fact]
    public async Task Idempotent_receive_replays_without_second_accession()
    {
        var (specimen, svc, db, _, _, _) = await CollectedSpecimenAsync();
        var key = "recv-" + Guid.NewGuid().ToString("N");
        var req = ReceiveReq(specimen) with { IdempotencyKey = key };
        var first = await svc.ReceiveAsync(_tenant, _actor, specimen.Id, req);
        var second = await svc.ReceiveAsync(_tenant, _actor, specimen.Id, req);
        Assert.Equal(first.Accession, second.Accession);
        Assert.Equal(1, await db.Specimens.CountAsync(s => s.TenantId == _tenant && s.Accession != null));
    }

    [Fact]
    public async Task Idempotency_conflict_same_service_different_payload()
    {
        var (specimen, svc, _, _, _, _) = await CollectedSpecimenAsync();
        var key = "recv-fp-" + Guid.NewGuid().ToString("N");
        await svc.ReceiveAsync(_tenant, _actor, specimen.Id, ReceiveReq(specimen) with { IdempotencyKey = key });

        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            svc.ReceiveAsync(_tenant, _actor, specimen.Id,
                ReceiveReq(specimen) with { IdempotencyKey = key, ReceivingLocationText = "Other" }));
        Assert.Equal("idempotency_conflict", ex.Code);
    }

    [Fact]
    public async Task Accession_sequence_increments_daily()
    {
        var (s1, svc, _, _, _, _) = await CollectedSpecimenAsync();
        var (s2, svc2, _, _, _, _) = await CollectedSpecimenAsync();
        // separate services/dbs — sequence not shared. Use same service for both.
        var (db, audit, platform, cat, orders, collection, specimens) = Create();
        async Task<SpecimenDetailDto> MakeCollected()
        {
            var itemId = await ActivateTestAsync(cat, "SEQ-" + Guid.NewGuid().ToString("N")[..6]);
            var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
            var order = await orders.SubmitAsync(_tenant, _actor, draft.Id, new SubmitOrderRequest(draft.RowVersion));
            var otIds = order.CurrentVersion!.Tests.Select(t => t.Id).ToArray();
            var planned = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
                order.Id, _branch, otIds, LocationText: null));
            planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
                new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.Ready));
            planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
                new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.InProgress));
            planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
                new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.Completed));
            return await specimens.CompleteCollectionAsync(_tenant, _actor, planned.Id,
                new CompleteCollectionRequest(planned.RowVersion, true));
        }

        var a = await MakeCollected();
        var b = await MakeCollected();
        var ra = await specimens.ReceiveAsync(_tenant, _actor, a.Id, ReceiveReq(a));
        var rb = await specimens.ReceiveAsync(_tenant, _actor, b.Id, ReceiveReq(b));
        Assert.NotEqual(ra.Accession, rb.Accession);
        var seqA = int.Parse(ra.Accession!.Split('-')[2]);
        var seqB = int.Parse(rb.Accession!.Split('-')[2]);
        Assert.Equal(seqA + 1, seqB);
        _ = s1; _ = svc; _ = s2; _ = svc2; _ = db; _ = audit; _ = platform;
    }

    [Fact]
    public async Task Unknown_rejection_reason_rejected()
    {
        var (specimen, svc, _, _, platform, _) = await CollectedSpecimenAsync();
        platform.Setup(p => p.ValidateMasterValueAsync(
                _tenant, SpecimenRejectionReasonMaster.EntityType, "NOT_A_REASON", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OrderDomainException("Master value not found.", statusCode: 404, code: "invalid_rejection_reason"));

        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            svc.RejectAsync(_tenant, _actor, specimen.Id, RejectReq(specimen, "NOT_A_REASON")));
        Assert.Equal("invalid_rejection_reason", ex.Code);
    }

    [Fact]
    public async Task Inactive_rejection_reason_rejected()
    {
        var (specimen, svc, _, _, platform, _) = await CollectedSpecimenAsync();
        platform.Setup(p => p.ValidateMasterValueAsync(
                _tenant, SpecimenRejectionReasonMaster.EntityType, "INSUFFICIENT_SPECIMEN", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OrderDomainException(
                "Master value is inactive.", statusCode: 400, code: "rejection_reason_inactive"));

        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            svc.RejectAsync(_tenant, _actor, specimen.Id, RejectReq(specimen)));
        Assert.Equal("rejection_reason_inactive", ex.Code);
    }

    [Fact]
    public async Task Audit_failure_fail_closed_on_receive()
    {
        var (specimen, svc, db, audit, _, _) = await CollectedSpecimenAsync();
        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), SpecimenAuditActions.ReceiveSpecimen,
                It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new CatalogueDomainException("audit fail", statusCode: 503, code: "audit_unavailable"));

        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            svc.ReceiveAsync(_tenant, _actor, specimen.Id, ReceiveReq(specimen)));
        Assert.Equal("audit_unavailable", ex.Code);

        var row = await db.Specimens.AsNoTracking().FirstAsync(s => s.Id == specimen.Id);
        Assert.Equal(SpecimenStatuses.Collected, row.Status);
        Assert.Null(row.Accession);
    }

    [Fact]
    public async Task List_returns_collected_specimens()
    {
        var (specimen, svc, _, _, _, _) = await CollectedSpecimenAsync();
        var page = await svc.ListAsync(_tenant, new SpecimenListQuery(Status: "Collected"));
        Assert.Contains(page.Items, i => i.Id == specimen.Id);
    }

    [Fact]
    public async Task Rejection_reasons_list_returns_approved_active_codes()
    {
        var (_, svc, _, _, _, _) = await CollectedSpecimenAsync();
        var reasons = await svc.ListRejectionReasonsAsync(_tenant);
        Assert.Equal(SpecimenRejectionReasons.Approved.Count, reasons.Count);
        Assert.Contains(reasons, r => r.Code == "PATIENT_IDENTITY_MISMATCH");
    }

    [Fact]
    public async Task Generated_accession_length_is_exactly_19()
    {
        // ACC-YYYYMMDD-NNNNNN = 3 + 1 + 8 + 1 + 6 = 19
        Assert.Equal(19, "ACC-20261011-000001".Length);

        var (specimen, svc, _, _, _, _) = await CollectedSpecimenAsync();
        var received = await svc.ReceiveAsync(_tenant, _actor, specimen.Id, ReceiveReq(specimen));
        Assert.Equal(19, received.Accession!.Length);
        Assert.Matches(@"^ACC-\d{8}-\d{6}$", received.Accession);
    }

    [Fact]
    public async Task Zero_expected_row_version_is_rejected_for_receive()
    {
        var (specimen, svc, _, _, _, _) = await CollectedSpecimenAsync();
        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            svc.ReceiveAsync(_tenant, _actor, specimen.Id, ReceiveReq(specimen, rowVersion: 0)));
        Assert.Equal(409, ex.StatusCode);
        Assert.Equal("concurrency_conflict", ex.Code);
    }

    [Fact]
    public async Task Concurrent_receive_allocations_produce_unique_accessions()
    {
        var (db, audit, platform, cat, orders, collection, specimens) = Create();

        async Task<SpecimenDetailDto> MakeCollected()
        {
            var itemId = await ActivateTestAsync(cat, "PAR-" + Guid.NewGuid().ToString("N")[..6]);
            var draft = await orders.CreateDraftAsync(_tenant, _actor, DraftReq(itemId));
            var order = await orders.SubmitAsync(_tenant, _actor, draft.Id, new SubmitOrderRequest(draft.RowVersion));
            var otIds = order.CurrentVersion!.Tests.Select(t => t.Id).ToArray();
            var planned = await collection.CreateAsync(_tenant, _actor, new CreateCollectionTaskRequest(
                order.Id, _branch, otIds, LocationText: null));
            planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
                new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.Ready));
            planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
                new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.InProgress));
            planned = await collection.TransitionAsync(_tenant, _actor, planned.Id,
                new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.Completed));
            return await specimens.CompleteCollectionAsync(_tenant, _actor, planned.Id,
                new CompleteCollectionRequest(planned.RowVersion, true));
        }

        var collected = new List<SpecimenDetailDto>();
        for (var i = 0; i < 8; i++)
            collected.Add(await MakeCollected());

        var tasks = collected.Select(s =>
            specimens.ReceiveAsync(_tenant, _actor, s.Id, ReceiveReq(s))).ToArray();
        var results = await Task.WhenAll(tasks);

        var accessions = results.Select(r => r.Accession!).ToList();
        Assert.Equal(accessions.Count, accessions.Distinct(StringComparer.Ordinal).Count());
        Assert.All(accessions, a => Assert.Equal(19, a.Length));

        var sequences = accessions.Select(a => int.Parse(a.Split('-')[2])).OrderBy(x => x).ToList();
        Assert.Equal(sequences.Count, sequences.Distinct().Count());

        // Unique indexes / sequence table are authoritative in production (Npgsql upsert).
        // InMemory path uses per-process SemaphoreSlim only as a test provider aid.
        Assert.Equal(1, await db.AccessionNumberSequences.CountAsync(s => s.TenantId == _tenant));
        Assert.Equal(8, await db.AccessionNumberSequences
            .Where(s => s.TenantId == _tenant).Select(s => s.LastValue).FirstAsync());
        _ = audit;
        _ = platform;
    }

    [Fact]
    public async Task Reject_audit_failure_fail_closed_no_terminal_state()
    {
        var (specimen, svc, db, audit, _, _) = await CollectedSpecimenAsync();
        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), SpecimenAuditActions.RejectSpecimen,
                It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new CatalogueDomainException("audit fail", statusCode: 503, code: "audit_unavailable"));

        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            svc.RejectAsync(_tenant, _actor, specimen.Id, RejectReq(specimen)));
        Assert.Equal("audit_unavailable", ex.Code);

        var row = await db.Specimens.AsNoTracking().FirstAsync(s => s.Id == specimen.Id);
        Assert.Equal(SpecimenStatuses.Collected, row.Status);
        Assert.Null(row.RejectionReasonCode);
        Assert.Null(row.Accession);
    }
}
