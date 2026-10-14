using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using LaboratoryApi.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Moq;
using Xunit;

namespace LaboratoryApi.Tests;

/// <summary>
/// L-CRT-01 PRE-UAT — real PostgreSQL concurrency evidence for Critical classification
/// and acknowledgement. Requires LABORATORY_TEST_CONNECTION (or local.settings DefaultConnection).
/// Fails (does not silently skip) when the connection is unset or not Npgsql.
/// Uses an ephemeral tenant and cleans up seeded rows afterward.
/// </summary>
public class CriticalResultPostgresConcurrencyTests
{
    private const int ConcurrentWorkers = 8;

    private static string? ResolveConnection()
    {
        var env = Environment.GetEnvironmentVariable("LABORATORY_TEST_CONNECTION")
                  ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
        if (!string.IsNullOrWhiteSpace(env))
            return env;

        var localSettings = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory, "..", "..", "..", "..", "LaboratoryApi", "local.settings.json"));
        if (!File.Exists(localSettings))
            return null;

        var cfg = new ConfigurationBuilder().AddJsonFile(localSettings, optional: false).Build();
        return cfg.GetConnectionString("DefaultConnection")
               ?? cfg["ConnectionStrings:DefaultConnection"];
    }

    private static Mock<IPlatformReferenceClient> Platform(
        Guid tenant, Guid actor, Guid branch, Guid patient, Guid ordering, Guid responsible)
    {
        var platform = new Mock<IPlatformReferenceClient>();
        platform.Setup(p => p.ValidatePatientAsync(tenant, patient, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformPatientRef(patient, "MRN-CRT-PG", "CRT PG Patient",
                new DateTime(1990, 1, 1, 0, 0, 0, DateTimeKind.Utc)));
        platform.Setup(p => p.ValidateUserAsync(tenant, ordering, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserRef(ordering, "Dr Ordering", "active"));
        platform.Setup(p => p.ValidateUserAsync(tenant, responsible, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserRef(responsible, "Dr Responsible", "active"));
        platform.Setup(p => p.ValidateUserWithPermissionAsync(
                tenant, actor, LaboratoryAuthz.CollectionCollect, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserRef(actor, "Collector", "active"));
        platform.Setup(p => p.ValidateUserBranchAsync(
                tenant, actor, branch, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlatformUserBranchRef(actor, branch, true));
        foreach (var (code, label) in SpecimenRejectionReasons.Approved)
        {
            platform.Setup(p => p.ValidateMasterValueAsync(
                    tenant, SpecimenRejectionReasonMaster.EntityType, code, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new PlatformMasterValueRef(
                    SpecimenRejectionReasonMaster.EntityType, code, label, true, 1));
        }
        return platform;
    }

    private static Mock<IPlatformAuditClient> AuditOk()
    {
        var audit = new Mock<IPlatformAuditClient>();
        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        return audit;
    }

    private static Mock<IPlatformNotificationClient> NotifyOk()
    {
        var notify = new Mock<IPlatformNotificationClient>();
        notify.Setup(n => n.EmitTenantIntentAsync(
                It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        return notify;
    }

    private static async Task CleanupTenantAsync(DbContextOptions<LaboratoryDbContext> options, Guid tenantId)
    {
        await using var db = new LaboratoryDbContext(options);
        await db.Database.ExecuteSqlAsync($"""
            DELETE FROM lms_critical_result_events WHERE tenant_id = {tenantId};
            DELETE FROM lms_result_idempotency WHERE tenant_id = {tenantId};
            DELETE FROM lms_result_versions WHERE tenant_id = {tenantId};
            DELETE FROM lms_results WHERE tenant_id = {tenantId};
            DELETE FROM lms_specimen_order_tests WHERE tenant_id = {tenantId};
            DELETE FROM lms_specimen_label_print_events WHERE tenant_id = {tenantId};
            DELETE FROM lms_specimen_barcodes WHERE tenant_id = {tenantId};
            DELETE FROM lms_specimen_idempotency WHERE tenant_id = {tenantId};
            DELETE FROM lms_collection_idempotency WHERE tenant_id = {tenantId};
            DELETE FROM lms_order_idempotency WHERE tenant_id = {tenantId};
            DELETE FROM lms_order_selections WHERE tenant_id = {tenantId};
            DELETE FROM lms_specimens WHERE tenant_id = {tenantId};
            DELETE FROM lms_collection_task_order_tests WHERE tenant_id = {tenantId};
            DELETE FROM lms_collection_tasks WHERE tenant_id = {tenantId};
            DELETE FROM lms_collection_task_number_sequences WHERE tenant_id = {tenantId};
            DELETE FROM lms_accession_number_sequences WHERE tenant_id = {tenantId};
            DELETE FROM lms_barcode_number_sequences WHERE tenant_id = {tenantId};
            DELETE FROM lms_order_tests WHERE tenant_id = {tenantId};
            UPDATE lms_orders SET current_version_id = NULL WHERE tenant_id = {tenantId};
            DELETE FROM lms_order_versions WHERE tenant_id = {tenantId};
            DELETE FROM lms_orders WHERE tenant_id = {tenantId};
            DELETE FROM lms_order_number_sequences WHERE tenant_id = {tenantId};
            DELETE FROM lms_catalogue_branch_applicability WHERE tenant_id = {tenantId};
            DELETE FROM lms_catalogue_panel_components WHERE tenant_id = {tenantId};
            UPDATE lms_catalogue_items SET current_active_version_id = NULL, latest_version_id = NULL WHERE tenant_id = {tenantId};
            DELETE FROM lms_catalogue_versions WHERE tenant_id = {tenantId};
            DELETE FROM lms_catalogue_items WHERE tenant_id = {tenantId};
            """);
    }

    private static async Task<(Guid Tenant, Guid Actor, Guid Branch, Guid ResultId, int VersionNumber)>
        SeedVerifiedResultAsync(DbContextOptions<LaboratoryDbContext> options)
    {
        var tenant = Guid.NewGuid();
        var actor = Guid.NewGuid();
        var branch = Guid.NewGuid();
        var patient = Guid.NewGuid();
        var ordering = Guid.NewGuid();
        var responsible = Guid.NewGuid();

        await using var db = new LaboratoryDbContext(options);
        Assert.True(db.Database.IsNpgsql(), "Provider must be PostgreSQL (Npgsql), not InMemory.");

        var audit = AuditOk();
        var notify = NotifyOk();
        var platform = Platform(tenant, actor, branch, patient, ordering, responsible);
        var catalogue = new CatalogueService(db, audit.Object);
        var orders = new OrderService(db, audit.Object, platform.Object, catalogue);
        var collection = new CollectionService(db, audit.Object, platform.Object);
        var specimens = new SpecimenService(db, audit.Object, platform.Object);
        var results = new ResultService(db, audit.Object, platform.Object);

        var code = "CRT-PG-" + Guid.NewGuid().ToString("N")[..6];
        var d = await catalogue.CreateDraftAsync(tenant, actor, new CreateCatalogueDraftRequest(
            CatalogueType: CatalogueTypes.Test,
            InternalOrderCode: code,
            DisplayName: code + " Name",
            Discipline: "CLINICAL_CHEMISTRY",
            Classification: CatalogueClassifications.Local,
            ChangeReason: "crt-pg-concurrency",
            BranchIds: null));
        d = await catalogue.SubmitForReviewAsync(tenant, actor, d.Id, new LifecycleActionRequest());
        d = await catalogue.ApproveAsync(tenant, actor, d.Id, new LifecycleActionRequest());
        d = await catalogue.ActivateAsync(tenant, actor, d.Id, new LifecycleActionRequest(
            EffectiveFrom: DateTime.UtcNow.AddDays(-1)));
        var version = await db.CatalogueVersions
            .Where(v => v.CatalogueItemId == d.Id && v.TenantId == tenant)
            .OrderByDescending(v => v.VersionNumber)
            .FirstAsync();
        version.ResultDatatype = "Numeric";
        version.PermittedUnits = "mg/dL";
        await db.SaveChangesAsync();

        var draft = await orders.CreateDraftAsync(tenant, actor, new CreateOrderDraftRequest(
            PatientId: patient,
            VisitId: null,
            OrderingProviderUserId: ordering,
            ResponsibleClinicianUserId: responsible,
            OperatingBranchId: branch,
            OrderSource: OrderSources.Clinician,
            Priority: OrderPriorities.Routine,
            PriorityReason: null,
            ClinicalIndication: "CRT PG concurrency",
            Notes: null,
            Selections: new[] { new OrderSelectionInput(d.Id, 0) }));
        var order = await orders.SubmitAsync(tenant, actor, draft.Id, new SubmitOrderRequest(draft.RowVersion));
        var otId = order.CurrentVersion!.Tests.Single().Id;
        var planned = await collection.CreateAsync(tenant, actor, new CreateCollectionTaskRequest(
            order.Id, branch, new[] { otId }, LocationText: "Bay PG"));
        planned = await collection.TransitionAsync(tenant, actor, planned.Id,
            new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.Ready));
        planned = await collection.TransitionAsync(tenant, actor, planned.Id,
            new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.InProgress));
        planned = await collection.TransitionAsync(tenant, actor, planned.Id,
            new TransitionCollectionTaskRequest(planned.RowVersion, CollectionTaskStatuses.Completed));
        var specimen = await specimens.CompleteCollectionAsync(tenant, actor, planned.Id,
            new CompleteCollectionRequest(planned.RowVersion, true));
        specimen = await specimens.ReceiveAsync(tenant, actor, specimen.Id, new ReceiveSpecimenRequest(
            specimen.RowVersion, branch, true, specimen.PatientMrnSnapshot!, specimen.PatientNameSnapshot!,
            specimen.PatientDateOfBirthSnapshot!.Value, "Bench"));
        var result = await results.CreateDraftAsync(tenant, actor, new CreateResultDraftRequest(
            otId, specimen.Id, branch, NumericValue: "12.5", Unit: "mg/dL", Comment: "pg"));
        var verified = await results.VerifyAsync(tenant, actor, result.Id, new VerifyResultRequest(
            branch, result.RowVersion, result.CurrentVersionNumber));

        return (tenant, actor, branch, verified.Id, verified.CurrentVersionNumber);
    }

    [Fact]
    public async Task PostgreSQL_Concurrent_Classify_Same_Version_Creates_Exactly_One_Event()
    {
        var conn = ResolveConnection();
        Assert.False(string.IsNullOrWhiteSpace(conn),
            "LABORATORY_TEST_CONNECTION (or LaboratoryApi local.settings DefaultConnection) is required for PRE-UAT PostgreSQL concurrency evidence.");

        var options = new DbContextOptionsBuilder<LaboratoryDbContext>()
            .UseNpgsql(conn)
            .Options;

        await using (var setup = new LaboratoryDbContext(options))
        {
            Assert.True(setup.Database.IsNpgsql(), "Provider must be PostgreSQL (Npgsql), not InMemory.");
            await setup.Database.MigrateAsync();
        }

        var (tenant, actor, branch, resultId, versionNumber) = await SeedVerifiedResultAsync(options);
        try
        {
            var audit = AuditOk();
            var notify = NotifyOk();
            var platform = Platform(tenant, actor, branch, Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
            // Branch validation is the only platform call Create uses after seed.
            platform.Setup(p => p.ValidateUserBranchAsync(
                    tenant, actor, branch, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new PlatformUserBranchRef(actor, branch, true));

            var tasks = Enumerable.Range(0, ConcurrentWorkers).Select(async _ =>
            {
                await using var db = new LaboratoryDbContext(options);
                Assert.True(db.Database.IsNpgsql());
                var svc = new CriticalResultService(db, audit.Object, platform.Object, notify.Object);
                try
                {
                    var dto = await svc.CreateAsync(tenant, actor, resultId,
                        new CreateCriticalEventRequest(branch, versionNumber));
                    return (Ok: true, Code: (string?)null, Id: (Guid?)dto.Id);
                }
                catch (TestingDomainException ex)
                {
                    return (Ok: false, Code: ex.Code, Id: (Guid?)null);
                }
            });

            var outcomes = await Task.WhenAll(tasks);
            var successes = outcomes.Where(o => o.Ok).ToList();
            var conflicts = outcomes.Where(o => !o.Ok).ToList();

            Assert.Single(successes);
            Assert.Equal(ConcurrentWorkers - 1, conflicts.Count);
            Assert.All(conflicts, c => Assert.Equal("already_critical", c.Code));

            await using var verify = new LaboratoryDbContext(options);
            var events = await verify.CriticalResultEvents.AsNoTracking()
                .Where(e => e.TenantId == tenant && e.ResultId == resultId && e.ResultVersionNumber == versionNumber)
                .ToListAsync();
            Assert.Single(events);
            Assert.Equal(CriticalResultEventStatuses.Open, events[0].Status);
            Assert.Equal(successes[0].Id, events[0].Id);
        }
        finally
        {
            await CleanupTenantAsync(options, tenant);
        }
    }

    [Fact]
    public async Task PostgreSQL_Concurrent_Acknowledge_One_Wins_Others_Conflict()
    {
        var conn = ResolveConnection();
        Assert.False(string.IsNullOrWhiteSpace(conn),
            "LABORATORY_TEST_CONNECTION (or LaboratoryApi local.settings DefaultConnection) is required for PRE-UAT PostgreSQL concurrency evidence.");

        var options = new DbContextOptionsBuilder<LaboratoryDbContext>()
            .UseNpgsql(conn)
            .Options;

        await using (var setup = new LaboratoryDbContext(options))
        {
            Assert.True(setup.Database.IsNpgsql());
            await setup.Database.MigrateAsync();
        }

        var (tenant, actor, branch, resultId, versionNumber) = await SeedVerifiedResultAsync(options);
        try
        {
            var audit = AuditOk();
            var notify = NotifyOk();
            var platform = new Mock<IPlatformReferenceClient>();
            platform.Setup(p => p.ValidateUserBranchAsync(
                    tenant, actor, branch, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new PlatformUserBranchRef(actor, branch, true));

            CriticalEventDto created;
            await using (var db = new LaboratoryDbContext(options))
            {
                var svc = new CriticalResultService(db, audit.Object, platform.Object, notify.Object);
                created = await svc.CreateAsync(tenant, actor, resultId,
                    new CreateCriticalEventRequest(branch, versionNumber));
            }

            var expectedRv = created.RowVersion;
            var tasks = Enumerable.Range(0, ConcurrentWorkers).Select(async i =>
            {
                await using var db = new LaboratoryDbContext(options);
                var svc = new CriticalResultService(db, audit.Object, platform.Object, notify.Object);
                try
                {
                    var dto = await svc.AcknowledgeAsync(
                        tenant, actor, resultId, created.Id,
                        new AcknowledgeCriticalEventRequest(branch, expectedRv, $"ack-{i}"));
                    return (Ok: true, Code: (string?)null, Status: dto.Status);
                }
                catch (TestingDomainException ex)
                {
                    return (Ok: false, Code: ex.Code, Status: (string?)null);
                }
            });

            var outcomes = await Task.WhenAll(tasks);
            var successes = outcomes.Where(o => o.Ok).ToList();
            var failures = outcomes.Where(o => !o.Ok).ToList();

            Assert.Single(successes);
            Assert.Equal(CriticalResultEventStatuses.Acknowledged, successes[0].Status);
            Assert.Equal(ConcurrentWorkers - 1, failures.Count);
            Assert.All(failures, f =>
                Assert.True(
                    f.Code is "concurrency_conflict" or "already_acknowledged",
                    $"Unexpected failure code: {f.Code}"));

            await using var verify = new LaboratoryDbContext(options);
            var evt = await verify.CriticalResultEvents.AsNoTracking()
                .SingleAsync(e => e.Id == created.Id && e.TenantId == tenant);
            Assert.Equal(CriticalResultEventStatuses.Acknowledged, evt.Status);
            Assert.NotNull(evt.AcknowledgedAtUtc);
            Assert.False(string.IsNullOrWhiteSpace(evt.AcknowledgementEvidence));
            Assert.Equal(expectedRv + 1, evt.RowVersion);
        }
        finally
        {
            await CleanupTenantAsync(options, tenant);
        }
    }
}
