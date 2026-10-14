using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using LaboratoryApi.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace LaboratoryApi.Tests;

public class SpecimenBarcodeServiceTests
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
        SpecimenService Specimens, SpecimenBarcodeService Barcodes)
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
        var barcodes = new SpecimenBarcodeService(db, audit.Object, platform.Object);
        _ = (catalogue, orders, collection);
        return (db, audit, platform, specimens, barcodes);
    }

    private async Task SeedConfigAsync(LaboratoryDbContext db, bool active = true, bool malformed = false,
        DateTime? effectiveFromUtc = null)
    {
        var cfg = SpecimenBarcodeService.CreateApprovedConfiguration(_tenant, _actor, effectiveFromUtc);
        cfg.IsActive = active;
        if (malformed)
        {
            cfg.Prefix = "XXX";
            cfg.FormatCode = "INVALID";
        }
        db.SpecimenBarcodeConfigurations.Add(cfg);
        await db.SaveChangesAsync();
    }

    private async Task<Guid> ActivateTestAsync(CatalogueService cat, string code)
    {
        var d = await cat.CreateDraftAsync(_tenant, _actor, new CreateCatalogueDraftRequest(
            CatalogueType: CatalogueTypes.Test,
            InternalOrderCode: code,
            DisplayName: code + " Name",
            Discipline: "CLINICAL_CHEMISTRY",
            ChangeReason: "barcode test",
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
            ClinicalIndication: "Barcode UAT",
            Notes: null,
            Selections: catalogueItemIds.Select((id, i) => new OrderSelectionInput(id, i)).ToArray());

    private async Task<(SpecimenDetailDto Specimen, SpecimenService Specimens, SpecimenBarcodeService Barcodes,
            LaboratoryDbContext Db, Mock<IPlatformAuditClient> Audit, OrderDetailDto Order)>
        CollectedAsync(bool seedConfig = true)
    {
        var (db, audit, platform, specimens, barcodes) = Create();
        var catalogue = new CatalogueService(db, audit.Object);
        var orders = new OrderService(db, audit.Object, platform.Object, catalogue);
        var collection = new CollectionService(db, audit.Object, platform.Object);
        if (seedConfig) await SeedConfigAsync(db);

        var itemId = await ActivateTestAsync(catalogue, "BAR-" + Guid.NewGuid().ToString("N")[..6]);
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
        return (specimen, specimens, barcodes, db, audit, order);
    }

    private AssignBarcodeRequest AssignReq(SpecimenDetailDto s, int? rv = null) =>
        new(rv ?? s.RowVersion, _branch);

    private PrintSpecimenLabelRequest PrintReq(SpecimenDetailDto s, int? rv = null) =>
        new(rv ?? s.RowVersion, _branch);

    private ReprintSpecimenLabelRequest ReprintReq(SpecimenDetailDto s, string reason = "Damaged label", int? rv = null) =>
        new(rv ?? s.RowVersion, _branch, reason);

    [Fact]
    public async Task Assign_Uses_Exact_Spc_Format_Utc_Date_And_Padding()
    {
        var (specimen, _, barcodes, _, _, _) = await CollectedAsync();
        var utc = DateTime.UtcNow;
        var dto = await barcodes.AssignBarcodeAsync(_tenant, _actor, specimen.Id, AssignReq(specimen));
        Assert.Equal(19, dto.BarcodeValue.Length);
        Assert.Matches(@"^SPC-\d{8}-\d{6}$", dto.BarcodeValue);
        Assert.StartsWith($"SPC-{utc:yyyyMMdd}-", dto.BarcodeValue);
        Assert.Equal(SpecimenBarcodeFormats.SymbologyCode128, dto.Symbology);
        Assert.NotEqual(specimen.Id.ToString(), dto.BarcodeValue);
    }

    [Fact]
    public async Task Complete_Collection_Does_Not_Auto_Generate_Barcode()
    {
        var (specimen, _, barcodes, db, _, _) = await CollectedAsync();
        Assert.Null(specimen.BarcodeValue);
        Assert.Null(await barcodes.GetBarcodeAsync(_tenant, specimen.Id));
        Assert.Empty(await db.SpecimenBarcodes.Where(b => b.SpecimenId == specimen.Id).ToListAsync());
    }

    [Fact]
    public async Task Receive_Does_Not_Auto_Generate_Barcode_And_Accession_Remains_Distinct()
    {
        var (specimen, specimens, barcodes, _, _, _) = await CollectedAsync();
        var received = await specimens.ReceiveAsync(_tenant, _actor, specimen.Id, new ReceiveSpecimenRequest(
            specimen.RowVersion, _branch, true, specimen.PatientMrnSnapshot!, specimen.PatientNameSnapshot!,
            specimen.PatientDateOfBirthSnapshot!.Value, "Bench"));
        Assert.NotNull(received.Accession);
        Assert.StartsWith("ACC-", received.Accession);
        Assert.Null(received.BarcodeValue);
        Assert.Null(await barcodes.GetBarcodeAsync(_tenant, specimen.Id));

        var barcode = await barcodes.AssignBarcodeAsync(_tenant, _actor, specimen.Id, AssignReq(received));
        Assert.StartsWith("SPC-", barcode.BarcodeValue);
        Assert.NotEqual(received.Accession, barcode.BarcodeValue);
    }

    [Fact]
    public async Task Reject_Does_Not_Auto_Generate_And_Retains_Existing_Barcode()
    {
        var (specimen, specimens, barcodes, _, _, _) = await CollectedAsync();
        var assigned = await barcodes.AssignBarcodeAsync(_tenant, _actor, specimen.Id, AssignReq(specimen));
        var detail = await specimens.GetAsync(_tenant, specimen.Id);
        var rejected = await specimens.RejectAsync(_tenant, _actor, specimen.Id, new RejectSpecimenRequest(
            detail.RowVersion, _branch, "INSUFFICIENT_SPECIMEN", true,
            detail.PatientMrnSnapshot!, detail.PatientNameSnapshot!, detail.PatientDateOfBirthSnapshot!.Value));
        Assert.Equal(SpecimenStatuses.Rejected, rejected.Status);
        Assert.Equal(assigned.BarcodeValue, rejected.BarcodeValue);
        Assert.Null(rejected.Accession);
    }

    [Fact]
    public async Task Rejected_Without_Barcode_Does_Not_Auto_Generate()
    {
        var (specimen, specimens, barcodes, _, _, _) = await CollectedAsync();
        var rejected = await specimens.RejectAsync(_tenant, _actor, specimen.Id, new RejectSpecimenRequest(
            specimen.RowVersion, _branch, "WRONG_CONTAINER", true,
            specimen.PatientMrnSnapshot!, specimen.PatientNameSnapshot!, specimen.PatientDateOfBirthSnapshot!.Value));
        Assert.Null(rejected.BarcodeValue);
        Assert.Null(await barcodes.GetBarcodeAsync(_tenant, specimen.Id));
    }

    [Fact]
    public async Task Print_Without_Barcode_Generates_Exactly_One_Barcode()
    {
        var (specimen, _, barcodes, db, audit, _) = await CollectedAsync();
        var label = await barcodes.PrintLabelAsync(_tenant, _actor, specimen.Id, PrintReq(specimen));
        Assert.Matches(@"^SPC-\d{8}-\d{6}$", label.BarcodeValue);
        Assert.Equal(SpecimenBarcodeFormats.SymbologyCode128, label.Symbology);
        Assert.Equal("MRN-1", label.PatientMrn);
        Assert.Equal("Test Patient", label.PatientName);
        Assert.False(string.IsNullOrWhiteSpace(label.OrderNumber));
        Assert.Null(label.Accession);
        Assert.DoesNotContain("DOB", label.PatientName, StringComparison.OrdinalIgnoreCase);

        Assert.Equal(1, await db.SpecimenBarcodes.CountAsync(b => b.SpecimenId == specimen.Id && b.IsActive));
        Assert.Equal(1, await db.SpecimenLabelPrintEvents.CountAsync(e => e.SpecimenId == specimen.Id));
        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, SpecimenBarcodeAuditActions.CreateSpecimenBarcode,
            SpecimenAuditResourceTypes.Specimen, specimen.Id,
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, SpecimenBarcodeAuditActions.PrintSpecimenLabel,
            SpecimenAuditResourceTypes.Specimen, specimen.Id,
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Print_With_Existing_Barcode_Reuses_Same_Value()
    {
        var (specimen, specimens, barcodes, db, _, _) = await CollectedAsync();
        var assigned = await barcodes.AssignBarcodeAsync(_tenant, _actor, specimen.Id, AssignReq(specimen));
        var detail = await specimens.GetAsync(_tenant, specimen.Id);
        var label = await barcodes.PrintLabelAsync(_tenant, _actor, specimen.Id, PrintReq(detail));
        Assert.Equal(assigned.BarcodeValue, label.BarcodeValue);
        Assert.Equal(1, await db.SpecimenBarcodes.CountAsync(b => b.SpecimenId == specimen.Id));
    }

    [Fact]
    public async Task Reprint_Requires_Reason_And_Reuses_Barcode()
    {
        var (specimen, specimens, barcodes, db, audit, _) = await CollectedAsync();
        var assigned = await barcodes.AssignBarcodeAsync(_tenant, _actor, specimen.Id, AssignReq(specimen));
        var detail = await specimens.GetAsync(_tenant, specimen.Id);

        var missing = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            barcodes.ReprintLabelAsync(_tenant, _actor, specimen.Id,
                new ReprintSpecimenLabelRequest(detail.RowVersion, _branch, "  ")));
        Assert.Equal("reprint_reason_required", missing.Code);

        var reprint = await barcodes.ReprintLabelAsync(_tenant, _actor, specimen.Id, ReprintReq(detail));
        Assert.Equal(assigned.BarcodeValue, reprint.BarcodeValue);
        Assert.Equal(SpecimenLabelPrintTypes.Reprint, reprint.PrintType);
        Assert.Equal(1, await db.SpecimenBarcodes.CountAsync(b => b.SpecimenId == specimen.Id));
        Assert.Equal(1, await db.SpecimenLabelPrintEvents.CountAsync(e =>
            e.SpecimenId == specimen.Id && e.PrintType == SpecimenLabelPrintTypes.Reprint));
        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, SpecimenBarcodeAuditActions.ReprintSpecimenLabel,
            SpecimenAuditResourceTypes.Specimen, specimen.Id,
            "Damaged label", It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Assign_Idempotency_Replay_And_Hash_Conflict()
    {
        var (specimen, _, barcodes, _, _, _) = await CollectedAsync();
        var key = "idem-assign-1";
        var first = await barcodes.AssignBarcodeAsync(_tenant, _actor, specimen.Id,
            AssignReq(specimen) with { IdempotencyKey = key });
        var replay = await barcodes.AssignBarcodeAsync(_tenant, _actor, specimen.Id,
            AssignReq(specimen) with { IdempotencyKey = key });
        Assert.Equal(first.BarcodeValue, replay.BarcodeValue);

        var conflict = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            barcodes.AssignBarcodeAsync(_tenant, _actor, specimen.Id,
                new AssignBarcodeRequest(specimen.RowVersion, _otherBranch, key)));
        Assert.Equal("idempotency_conflict", conflict.Code);
    }

    [Fact]
    public async Task Print_And_Reprint_Idempotency_Replay()
    {
        var (specimen, specimens, barcodes, db, _, _) = await CollectedAsync();
        var key = "idem-print-1";
        var first = await barcodes.PrintLabelAsync(_tenant, _actor, specimen.Id,
            PrintReq(specimen) with { IdempotencyKey = key });
        var replay = await barcodes.PrintLabelAsync(_tenant, _actor, specimen.Id,
            PrintReq(specimen) with { IdempotencyKey = key });
        Assert.Equal(first.PrintEventId, replay.PrintEventId);
        Assert.Equal(1, await db.SpecimenLabelPrintEvents.CountAsync(e => e.SpecimenId == specimen.Id));

        var detail = await specimens.GetAsync(_tenant, specimen.Id);
        var rkey = "idem-reprint-1";
        var r1 = await barcodes.ReprintLabelAsync(_tenant, _actor, specimen.Id,
            ReprintReq(detail) with { IdempotencyKey = rkey });
        var r2 = await barcodes.ReprintLabelAsync(_tenant, _actor, specimen.Id,
            ReprintReq(detail) with { IdempotencyKey = rkey });
        Assert.Equal(r1.PrintEventId, r2.PrintEventId);
    }

    [Fact]
    public async Task RowVersion_Conflict_On_Assign()
    {
        var (specimen, _, barcodes, _, _, _) = await CollectedAsync();
        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            barcodes.AssignBarcodeAsync(_tenant, _actor, specimen.Id, AssignReq(specimen, rv: 999)));
        Assert.Equal("concurrency_conflict", ex.Code);
    }

    [Fact]
    public async Task Audit_Failure_Is_Fail_Closed_No_Barcode_Persisted()
    {
        var (specimen, _, barcodes, db, audit, _) = await CollectedAsync();
        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), SpecimenBarcodeAuditActions.CreateSpecimenBarcode,
                It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new CatalogueDomainException("audit down", statusCode: 503, code: "audit_unavailable"));

        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            barcodes.AssignBarcodeAsync(_tenant, _actor, specimen.Id, AssignReq(specimen)));
        Assert.Equal("audit_unavailable", ex.Code);
        Assert.Empty(await db.SpecimenBarcodes.Where(b => b.SpecimenId == specimen.Id).ToListAsync());

        // Retry after audit recovers — no partial active barcode left behind.
        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        var rv = (await db.Specimens.AsNoTracking().FirstAsync(s => s.Id == specimen.Id)).RowVersion;
        var retry = await barcodes.AssignBarcodeAsync(_tenant, _actor, specimen.Id,
            new AssignBarcodeRequest(rv, _branch));
        Assert.Matches(@"^SPC-\d{8}-\d{6}$", retry.BarcodeValue);
        Assert.Equal(1, await db.SpecimenBarcodes.CountAsync(b => b.SpecimenId == specimen.Id && b.IsActive));
    }

    [Fact]
    public async Task Print_Audit_Failure_On_First_Print_Leaves_No_Partial_State()
    {
        var (specimen, specimens, barcodes, db, audit, _) = await CollectedAsync();
        // CREATE audit succeeds; PRINT audit fails.
        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), SpecimenBarcodeAuditActions.PrintSpecimenLabel,
                It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new CatalogueDomainException("audit down", statusCode: 503, code: "audit_unavailable"));

        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            barcodes.PrintLabelAsync(_tenant, _actor, specimen.Id, PrintReq(specimen)));
        Assert.Equal("audit_unavailable", ex.Code);
        Assert.Empty(await db.SpecimenBarcodes.Where(b => b.SpecimenId == specimen.Id).ToListAsync());
        Assert.Empty(await db.SpecimenLabelPrintEvents.Where(e => e.SpecimenId == specimen.Id).ToListAsync());

        // Gap semantics: sequence consumed during failed attempt is not reused.
        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        var rv = (await specimens.GetAsync(_tenant, specimen.Id)).RowVersion;
        var label = await barcodes.PrintLabelAsync(_tenant, _actor, specimen.Id,
            new PrintSpecimenLabelRequest(rv, _branch));
        Assert.EndsWith("-000002", label.BarcodeValue);
        Assert.Equal(1, await db.SpecimenBarcodes.CountAsync(b => b.SpecimenId == specimen.Id && b.IsActive));
        Assert.Equal(1, await db.SpecimenLabelPrintEvents.CountAsync(e => e.SpecimenId == specimen.Id));
    }

    [Fact]
    public async Task Existing_Barcode_Print_Audit_Failure_Does_Not_Replace_Barcode()
    {
        var (specimen, specimens, barcodes, db, audit, _) = await CollectedAsync();
        var assigned = await barcodes.AssignBarcodeAsync(_tenant, _actor, specimen.Id, AssignReq(specimen));
        var detail = await specimens.GetAsync(_tenant, specimen.Id);

        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), SpecimenBarcodeAuditActions.PrintSpecimenLabel,
                It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new CatalogueDomainException("audit down", statusCode: 503, code: "audit_unavailable"));

        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            barcodes.PrintLabelAsync(_tenant, _actor, specimen.Id, PrintReq(detail)));
        Assert.Equal("audit_unavailable", ex.Code);
        Assert.Equal(assigned.BarcodeValue,
            (await db.SpecimenBarcodes.SingleAsync(b => b.SpecimenId == specimen.Id && b.IsActive)).BarcodeValue);
        Assert.Empty(await db.SpecimenLabelPrintEvents.Where(e => e.SpecimenId == specimen.Id).ToListAsync());
        Assert.Equal(1, await db.SpecimenBarcodes.CountAsync(b => b.SpecimenId == specimen.Id));
    }

    [Fact]
    public async Task Print_Event_Persistence_Failure_Via_Concurrency_Leaves_Consistent_State()
    {
        // Force AppendPrintEvent SaveChanges concurrency conflict after barcode already exists.
        var (specimen, specimens, barcodes, db, _, _) = await CollectedAsync();
        var assigned = await barcodes.AssignBarcodeAsync(_tenant, _actor, specimen.Id, AssignReq(specimen));
        var detail = await specimens.GetAsync(_tenant, specimen.Id);

        // Stale row version simulates competing mutation between load and print-event save.
        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            barcodes.PrintLabelAsync(_tenant, _actor, specimen.Id,
                new PrintSpecimenLabelRequest(detail.RowVersion - 1, _branch)));
        Assert.Equal("concurrency_conflict", ex.Code);
        Assert.Equal(assigned.BarcodeValue,
            (await db.SpecimenBarcodes.SingleAsync(b => b.SpecimenId == specimen.Id && b.IsActive)).BarcodeValue);
        Assert.Empty(await db.SpecimenLabelPrintEvents.Where(e => e.SpecimenId == specimen.Id).ToListAsync());
    }

    [Fact]
    public async Task Ambiguous_Active_Configurations_Fail_Closed()
    {
        var (specimen, _, barcodes, db, _, _) = await CollectedAsync(seedConfig: false);
        var effective = DateTime.UnixEpoch;
        db.SpecimenBarcodeConfigurations.Add(SpecimenBarcodeService.CreateApprovedConfiguration(_tenant, _actor, effective));
        db.SpecimenBarcodeConfigurations.Add(SpecimenBarcodeService.CreateApprovedConfiguration(_tenant, _actor, effective));
        await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            barcodes.AssignBarcodeAsync(_tenant, _actor, specimen.Id, AssignReq(specimen)));
        Assert.Equal("barcode_configuration_ambiguous", ex.Code);
        Assert.Empty(await db.SpecimenBarcodes.Where(b => b.SpecimenId == specimen.Id).ToListAsync());
    }

    [Fact]
    public async Task Audit_Failure_Gap_Does_Not_Reuse_Sequence()
    {
        var (specimen, _, barcodes, db, audit, _) = await CollectedAsync();
        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), SpecimenBarcodeAuditActions.CreateSpecimenBarcode,
                It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new CatalogueDomainException("audit down", statusCode: 503, code: "audit_unavailable"));
        await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            barcodes.AssignBarcodeAsync(_tenant, _actor, specimen.Id, AssignReq(specimen)));

        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        var rv = (await db.Specimens.AsNoTracking().FirstAsync(s => s.Id == specimen.Id)).RowVersion;
        var assigned = await barcodes.AssignBarcodeAsync(_tenant, _actor, specimen.Id,
            new AssignBarcodeRequest(rv, _branch));
        Assert.EndsWith("-000002", assigned.BarcodeValue);
        Assert.DoesNotContain(
            await db.SpecimenBarcodes.Where(b => b.SpecimenId == specimen.Id).Select(b => b.BarcodeValue).ToListAsync(),
            v => v.EndsWith("-000001", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Configuration_Missing_Inactive_Malformed_Fail_Closed()
    {
        var (specimen, _, barcodes, db, _, _) = await CollectedAsync(seedConfig: false);
        var missing = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            barcodes.AssignBarcodeAsync(_tenant, _actor, specimen.Id, AssignReq(specimen)));
        Assert.Equal("barcode_configuration_missing", missing.Code);

        await SeedConfigAsync(db, active: false);
        var inactive = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            barcodes.AssignBarcodeAsync(_tenant, _actor, specimen.Id, AssignReq(specimen)));
        Assert.Equal("barcode_configuration_missing", inactive.Code);

        db.SpecimenBarcodeConfigurations.RemoveRange(db.SpecimenBarcodeConfigurations);
        await db.SaveChangesAsync();
        await SeedConfigAsync(db, malformed: true);
        var malformed = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            barcodes.AssignBarcodeAsync(_tenant, _actor, specimen.Id, AssignReq(specimen)));
        Assert.Equal("barcode_configuration_invalid", malformed.Code);
    }

    [Fact]
    public async Task Future_Configuration_Not_Effective_Until_Utc_Day()
    {
        var (specimen, _, barcodes, db, _, _) = await CollectedAsync(seedConfig: false);
        var tomorrow = DateTime.UtcNow.Date.AddDays(1);
        await SeedConfigAsync(db, effectiveFromUtc: DateTime.SpecifyKind(tomorrow, DateTimeKind.Utc));
        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            barcodes.AssignBarcodeAsync(_tenant, _actor, specimen.Id, AssignReq(specimen)));
        Assert.Equal("barcode_configuration_missing", ex.Code);
    }

    [Fact]
    public async Task Historical_Barcode_Unchanged_After_Config_Change()
    {
        var (specimen, _, barcodes, db, _, _) = await CollectedAsync();
        var assigned = await barcodes.AssignBarcodeAsync(_tenant, _actor, specimen.Id, AssignReq(specimen));
        var cfg = await db.SpecimenBarcodeConfigurations.FirstAsync();
        cfg.UpdatedAtUtc = DateTime.UtcNow;
        cfg.UpdatedByUserId = _actor;
        await db.SaveChangesAsync();
        var again = await barcodes.GetBarcodeAsync(_tenant, specimen.Id);
        Assert.Equal(assigned.BarcodeValue, again!.BarcodeValue);
    }

    [Fact]
    public async Task Concurrent_Allocation_Produces_Unique_Sequential_Values()
    {
        // Shared InMemory name + separate DbContext per worker (DbContext is not thread-safe).
        // Correctness for InMemory still uses the static sequence gate; PostgreSQL uses SQL RETURNING.
        var dbName = Guid.NewGuid().ToString("N");
        await using var seedDb = new LaboratoryDbContext(new DbContextOptionsBuilder<LaboratoryDbContext>()
            .UseInMemoryDatabase(dbName).Options);
        var audit = new Mock<IPlatformAuditClient>();
        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        var platform = BuildPlatformMock(authorized: true);
        await SeedConfigAsync(seedDb);

        var extras = new List<SpecimenDetailDto>();
        for (var i = 0; i < 5; i++)
            extras.Add(await CreateAnotherCollectedAsync(seedDb, audit, platform));

        var tasks = extras.Select(async s =>
        {
            await using var workerDb = new LaboratoryDbContext(new DbContextOptionsBuilder<LaboratoryDbContext>()
                .UseInMemoryDatabase(dbName).Options);
            var worker = new SpecimenBarcodeService(workerDb, audit.Object, platform.Object);
            return await worker.AssignBarcodeAsync(
                _tenant, _actor, s.Id, new AssignBarcodeRequest(s.RowVersion, _branch));
        });
        var results = await Task.WhenAll(tasks);
        var values = results.Select(r => r.BarcodeValue).ToList();
        Assert.Equal(5, values.Distinct(StringComparer.Ordinal).Count());
        Assert.All(values, v => Assert.Matches(@"^SPC-\d{8}-\d{6}$", v));
        var seqs = values.Select(v => int.Parse(v[^6..])).OrderBy(x => x).ToList();
        Assert.Equal(new[] { 1, 2, 3, 4, 5 }, seqs);
    }

    private Mock<IPlatformReferenceClient> BuildPlatformMock(bool authorized)
    {
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
        if (authorized)
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
        return platform;
    }

    [Fact]
    public async Task Counter_Exhaustion_Fails_Closed_No_Wrap()
    {
        var (specimen, _, barcodes, db, _, _) = await CollectedAsync();
        db.BarcodeNumberSequences.Add(new LmsBarcodeNumberSequence
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            SequenceDate = DateOnly.FromDateTime(DateTime.UtcNow),
            LastValue = SpecimenBarcodeFormats.SequenceMax,
        });
        await db.SaveChangesAsync();
        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            barcodes.AssignBarcodeAsync(_tenant, _actor, specimen.Id, AssignReq(specimen)));
        Assert.Equal("barcode_sequence_exhausted", ex.Code);
        Assert.Empty(await db.SpecimenBarcodes.Where(b => b.SpecimenId == specimen.Id).ToListAsync());
    }

    [Fact]
    public async Task Branch_Unauthorized_Fails()
    {
        var (db, audit, platform, specimens, barcodes) = Create(actorAuthorizedForBranch: false);
        await SeedConfigAsync(db);
        var catalogue = new CatalogueService(db, audit.Object);
        var orders = new OrderService(db, audit.Object, platform.Object, catalogue);
        var collection = new CollectionService(db, audit.Object, platform.Object);
        // Authorize collect branch validation for Complete Collection via other setups — Complete needs branch auth too.
        // Use authorized Create path then unauthorized barcode branch.
        platform.Setup(p => p.ValidateUserBranchAsync(
                _tenant, _actor, _branch, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserBranchRef(_actor, _branch, true));

        var itemId = await ActivateTestAsync(catalogue, "BR-" + Guid.NewGuid().ToString("N")[..6]);
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

        platform.Setup(p => p.ValidateUserBranchAsync(
                _tenant, _actor, _branch, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OrderDomainException(
                "User is not authorized for the collection branch.",
                statusCode: 403, code: "branch_unauthorized"));

        var ex = await Assert.ThrowsAsync<SpecimenDomainException>(() =>
            barcodes.AssignBarcodeAsync(_tenant, _actor, specimen.Id, AssignReq(specimen)));
        Assert.Equal(403, ex.StatusCode);
        Assert.Equal("branch_unauthorized", ex.Code);
    }

    [Fact]
    public async Task Order_And_OrderTest_Remain_Unchanged_After_Barcode()
    {
        var (specimen, _, barcodes, db, _, order) = await CollectedAsync();
        await barcodes.AssignBarcodeAsync(_tenant, _actor, specimen.Id, AssignReq(specimen));
        var orderEntity = await db.Orders.AsNoTracking().FirstAsync(o => o.Id == order.Id);
        Assert.Equal(OrderStatuses.Submitted, orderEntity.Status);
        var versionId = (await db.OrderVersions.AsNoTracking().FirstAsync(v => v.OrderId == order.Id)).Id;
        var tests = await db.OrderTests.AsNoTracking().Where(t => t.OrderVersionId == versionId).ToListAsync();
        Assert.All(tests, t => Assert.Equal(OrderTestStatuses.Ordered, t.Status));
        var task = await db.CollectionTasks.AsNoTracking().FirstAsync(t => t.Id == specimen.CollectionTaskId);
        Assert.Equal(CollectionTaskStatuses.Completed, task.Status);
    }

    [Fact]
    public async Task Recollection_Gets_Distinct_Barcode()
    {
        var (first, specimens, barcodes, db, audit, platform, _) = await CollectedFixtureWithExtras();
        var b1 = await barcodes.AssignBarcodeAsync(_tenant, _actor, first.Id, AssignReq(first));
        var second = await CreateAnotherCollectedAsync(db, audit, platform);
        var b2 = await barcodes.AssignBarcodeAsync(_tenant, _actor, second.Id, AssignReq(second));
        Assert.NotEqual(b1.BarcodeValue, b2.BarcodeValue);
        Assert.NotEqual(first.Id, second.Id);
        _ = specimens;
    }

    [Fact]
    public async Task Received_Label_Includes_Accession()
    {
        var (specimen, specimens, barcodes, _, _, _) = await CollectedAsync();
        var received = await specimens.ReceiveAsync(_tenant, _actor, specimen.Id, new ReceiveSpecimenRequest(
            specimen.RowVersion, _branch, true, specimen.PatientMrnSnapshot!, specimen.PatientNameSnapshot!,
            specimen.PatientDateOfBirthSnapshot!.Value));
        var label = await barcodes.PrintLabelAsync(_tenant, _actor, specimen.Id, PrintReq(received));
        Assert.Equal(received.Accession, label.Accession);
        Assert.NotEqual(label.Accession, label.BarcodeValue);
    }

    [Fact]
    public void Authz_Constants_Match_Approved_Permission_Names()
    {
        Assert.Equal("lms.specimens.barcode.view", LaboratoryAuthz.SpecimensBarcodeView);
        Assert.Equal("lms.specimens.label.print", LaboratoryAuthz.SpecimensLabelPrint);
        Assert.Equal("lms.specimens.label.reprint", LaboratoryAuthz.SpecimensLabelReprint);
    }

    [Fact]
    public void No_Void_Audit_Action_Constant()
    {
        Assert.Equal("CREATE_SPECIMEN_BARCODE", SpecimenBarcodeAuditActions.CreateSpecimenBarcode);
        Assert.Equal("PRINT_SPECIMEN_LABEL", SpecimenBarcodeAuditActions.PrintSpecimenLabel);
        Assert.Equal("REPRINT_SPECIMEN_LABEL", SpecimenBarcodeAuditActions.ReprintSpecimenLabel);
        Assert.Null(typeof(SpecimenBarcodeAuditActions).GetField("VoidSpecimenBarcode"));
    }

    private async Task<(SpecimenDetailDto Specimen, SpecimenService Specimens, SpecimenBarcodeService Barcodes,
            LaboratoryDbContext Db, Mock<IPlatformAuditClient> Audit, Mock<IPlatformReferenceClient> Platform,
            OrderDetailDto Order)>
        CollectedFixtureWithExtras()
    {
        var (db, audit, platform, specimens, barcodes) = Create();
        await SeedConfigAsync(db);
        var specimen = await CreateAnotherCollectedAsync(db, audit, platform);
        var order = await new OrderService(db, audit.Object, platform.Object, new CatalogueService(db, audit.Object))
            .GetAsync(_tenant, specimen.OrderId);
        return (specimen, specimens, barcodes, db, audit, platform, order);
    }

    private async Task<SpecimenDetailDto> CreateAnotherCollectedAsync(
        LaboratoryDbContext db, Mock<IPlatformAuditClient> audit, Mock<IPlatformReferenceClient> platform)
    {
        var catalogue = new CatalogueService(db, audit.Object);
        var orders = new OrderService(db, audit.Object, platform.Object, catalogue);
        var collection = new CollectionService(db, audit.Object, platform.Object);
        var specimens = new SpecimenService(db, audit.Object, platform.Object);
        var itemId = await ActivateTestAsync(catalogue, "X-" + Guid.NewGuid().ToString("N")[..6]);
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
        return await specimens.CompleteCollectionAsync(_tenant, _actor, planned.Id,
            new CompleteCollectionRequest(planned.RowVersion, true));
    }
}
