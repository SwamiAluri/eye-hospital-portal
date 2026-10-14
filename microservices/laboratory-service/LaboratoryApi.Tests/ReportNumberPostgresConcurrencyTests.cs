using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using LaboratoryApi.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Moq;
using Xunit;

namespace LaboratoryApi.Tests;

/// <summary>
/// L-REP-03 CUT A — real PostgreSQL concurrency evidence for operating-branch Report Number allocation.
/// Requires LABORATORY_TEST_CONNECTION (or LaboratoryApi local.settings DefaultConnection).
/// </summary>
public class ReportNumberPostgresConcurrencyTests
{
    private const int ConcurrentWorkers = 6;

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
            .ReturnsAsync(new PlatformPatientRef(patient, "MRN-RN-PG", "RN PG Patient",
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

    private static async Task CleanupTenantAsync(DbContextOptions<LaboratoryDbContext> options, Guid tenantId)
    {
        await using var db = new LaboratoryDbContext(options);
        await db.Database.ExecuteSqlAsync($"""
            DELETE FROM lms_report_number_sequences WHERE tenant_id = {tenantId};
            DELETE FROM lms_report_number_configurations WHERE tenant_id = {tenantId};
            DELETE FROM lms_report_draft_source_claims WHERE tenant_id = {tenantId};
            DELETE FROM lms_report_version_sources WHERE tenant_id = {tenantId};
            DELETE FROM lms_report_versions WHERE tenant_id = {tenantId};
            DELETE FROM lms_report_idempotency WHERE tenant_id = {tenantId};
            DELETE FROM lms_reports WHERE tenant_id = {tenantId};
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

    private static async Task<(Guid Tenant, Guid Actor, Guid Branch, List<(Guid ReportId, int RowVersion)> Reports)>
        SeedReleasedReportsAsync(DbContextOptions<LaboratoryDbContext> options, int count)
    {
        var tenant = Guid.NewGuid();
        var actor = Guid.NewGuid();
        var branch = Guid.NewGuid();
        var patient = Guid.NewGuid();
        var ordering = Guid.NewGuid();
        var responsible = Guid.NewGuid();

        await using var db = new LaboratoryDbContext(options);
        Assert.True(db.Database.IsNpgsql(), "Provider must be PostgreSQL (Npgsql), not InMemory.");

        db.ReportNumberConfigurations.Add(ReportNumberFormats.CreateTestConfiguration(
            tenant, branch, actor, prefix: "RPT", sequenceWidth: 6));
        await db.SaveChangesAsync();

        var audit = AuditOk();
        var platform = Platform(tenant, actor, branch, patient, ordering, responsible);
        var catalogue = new CatalogueService(db, audit.Object);
        var orders = new OrderService(db, audit.Object, platform.Object, catalogue);
        var collection = new CollectionService(db, audit.Object, platform.Object);
        var specimens = new SpecimenService(db, audit.Object, platform.Object);
        var results = new ResultService(db, audit.Object, platform.Object);
        var reports = new ReportService(db, audit.Object, platform.Object);

        var released = new List<(Guid ReportId, int RowVersion)>();
        for (var i = 0; i < count; i++)
        {
            var code = "RN-PG-" + Guid.NewGuid().ToString("N")[..6];
            var d = await catalogue.CreateDraftAsync(tenant, actor, new CreateCatalogueDraftRequest(
                CatalogueType: CatalogueTypes.Test,
                InternalOrderCode: code,
                DisplayName: code + " Name",
                Discipline: "CLINICAL_CHEMISTRY",
                Classification: CatalogueClassifications.Local,
                ChangeReason: "rn-pg-concurrency",
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
                ClinicalIndication: "RN PG",
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
                otId, specimen.Id, branch, NumericValue: "10.1", Unit: "mg/dL"));
            var verified = await results.VerifyAsync(tenant, actor, result.Id, new VerifyResultRequest(
                branch, result.RowVersion, result.CurrentVersionNumber));
            var authorized = await results.AuthorizeAsync(tenant, actor, verified.Id, new AuthorizeResultRequest(
                branch, verified.RowVersion, verified.CurrentVersionNumber));

            var reportDraft = await reports.CreateDraftAsync(tenant, actor, new CreateReportDraftRequest(
                branch, $"idem-rn-pg-d-{i}-{Guid.NewGuid():N}",
                new[] { new ReportSourceResultRef(authorized.Id, authorized.CurrentVersionNumber) }));
            var finalized = await reports.FinalizeAsync(tenant, actor, reportDraft.Id, new FinalizeReportRequest(
                branch, $"idem-rn-pg-f-{i}-{Guid.NewGuid():N}", reportDraft.RowVersion));
            var rel = await reports.ReleaseAsync(tenant, actor, reportDraft.Id, new ReleaseReportRequest(
                branch, $"idem-rn-pg-r-{i}-{Guid.NewGuid():N}", finalized.RowVersion));
            released.Add((rel.Id, rel.RowVersion));
        }

        return (tenant, actor, branch, released);
    }

    [Fact]
    public async Task PostgreSQL_Concurrent_Assign_Distinct_Reports_Produces_Unique_Numbers()
    {
        var conn = ResolveConnection();
        Assert.False(string.IsNullOrWhiteSpace(conn),
            "LABORATORY_TEST_CONNECTION (or LaboratoryApi local.settings DefaultConnection) is required for PostgreSQL concurrency evidence.");

        var options = new DbContextOptionsBuilder<LaboratoryDbContext>()
            .UseNpgsql(conn)
            .Options;

        await using (var setup = new LaboratoryDbContext(options))
        {
            Assert.True(setup.Database.IsNpgsql());
            await setup.Database.MigrateAsync();
        }

        var (tenant, actor, branch, seeded) = await SeedReleasedReportsAsync(options, ConcurrentWorkers);
        try
        {
            var audit = AuditOk();
            var platform = new Mock<IPlatformReferenceClient>();
            platform.Setup(p => p.ValidateUserBranchAsync(
                    tenant, actor, branch, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new PlatformUserBranchRef(actor, branch, true));

            var tasks = seeded.Select(async (item, i) =>
            {
                await using var db = new LaboratoryDbContext(options);
                var svc = new ReportService(db, audit.Object, platform.Object);
                try
                {
                    var dto = await svc.AssignNumberAsync(tenant, actor, item.ReportId,
                        new AssignReportNumberRequest(
                            branch, $"idem-rn-pg-a-{i}-{Guid.NewGuid():N}", item.RowVersion));
                    return (Ok: true, Number: dto.BusinessReportNumber, Code: (string?)null);
                }
                catch (TestingDomainException ex)
                {
                    return (Ok: false, Number: (string?)null, Code: ex.Code);
                }
            });

            var outcomes = await Task.WhenAll(tasks);
            var successes = outcomes.Where(o => o.Ok).ToList();
            Assert.Equal(ConcurrentWorkers, successes.Count);
            Assert.Equal(ConcurrentWorkers, successes.Select(s => s.Number).Distinct().Count());
            Assert.All(successes, s => Assert.False(string.IsNullOrWhiteSpace(s.Number)));

            await using var verify = new LaboratoryDbContext(options);
            var numbers = await verify.Reports.AsNoTracking()
                .Where(r => r.TenantId == tenant && r.BusinessReportNumber != null)
                .Select(r => r.BusinessReportNumber!)
                .ToListAsync();
            Assert.Equal(ConcurrentWorkers, numbers.Count);
            Assert.Equal(ConcurrentWorkers, numbers.Distinct(StringComparer.Ordinal).Count());
        }
        finally
        {
            await CleanupTenantAsync(options, tenant);
        }
    }

    [Fact]
    public async Task PostgreSQL_Concurrent_Assign_Same_Report_Succeeds_Exactly_Once()
    {
        var conn = ResolveConnection();
        Assert.False(string.IsNullOrWhiteSpace(conn),
            "LABORATORY_TEST_CONNECTION (or LaboratoryApi local.settings DefaultConnection) is required for PostgreSQL concurrency evidence.");

        var options = new DbContextOptionsBuilder<LaboratoryDbContext>()
            .UseNpgsql(conn)
            .Options;

        await using (var setup = new LaboratoryDbContext(options))
        {
            Assert.True(setup.Database.IsNpgsql());
            await setup.Database.MigrateAsync();
        }

        var (tenant, actor, branch, seeded) = await SeedReleasedReportsAsync(options, 1);
        var report = seeded[0];
        try
        {
            var audit = AuditOk();
            var platform = new Mock<IPlatformReferenceClient>();
            platform.Setup(p => p.ValidateUserBranchAsync(
                    tenant, actor, branch, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new PlatformUserBranchRef(actor, branch, true));

            var expectedRv = report.RowVersion;
            var tasks = Enumerable.Range(0, ConcurrentWorkers).Select(async i =>
            {
                await using var db = new LaboratoryDbContext(options);
                var svc = new ReportService(db, audit.Object, platform.Object);
                try
                {
                    var dto = await svc.AssignNumberAsync(tenant, actor, report.ReportId,
                        new AssignReportNumberRequest(
                            branch, $"idem-rn-pg-same-{i}-{Guid.NewGuid():N}", expectedRv));
                    return (Ok: true, Number: dto.BusinessReportNumber, Code: (string?)null);
                }
                catch (TestingDomainException ex)
                {
                    return (Ok: false, Number: (string?)null, Code: ex.Code);
                }
            });

            var outcomes = await Task.WhenAll(tasks);
            var successes = outcomes.Where(o => o.Ok).ToList();
            var failures = outcomes.Where(o => !o.Ok).ToList();

            Assert.Single(successes);
            Assert.False(string.IsNullOrWhiteSpace(successes[0].Number));
            Assert.Equal(ConcurrentWorkers - 1, failures.Count);
            Assert.All(failures, f =>
                Assert.True(
                    f.Code is "concurrency_conflict" or "invalid_state" or "idempotency_conflict",
                    $"Unexpected failure code: {f.Code}"));

            await using var verify = new LaboratoryDbContext(options);
            var row = await verify.Reports.AsNoTracking()
                .SingleAsync(r => r.Id == report.ReportId && r.TenantId == tenant);
            Assert.Equal(successes[0].Number, row.BusinessReportNumber);
            Assert.Equal(1, await verify.Reports.CountAsync(r =>
                r.TenantId == tenant && r.BusinessReportNumber != null));
        }
        finally
        {
            await CleanupTenantAsync(options, tenant);
        }
    }
}
