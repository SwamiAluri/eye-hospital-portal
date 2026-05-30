using System.Diagnostics;
using CcmsApi.Data;
using CcmsApi.Models.Domain;
using CcmsApi.Services;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace CcmsApi.Tests.PerformanceTests;

/// <summary>
/// Performance guard: the pre-auth queue and case list must handle 5,000 rows
/// within acceptable response times using an in-process EF InMemory provider.
///
/// Acceptance thresholds (in-process, no network):
///   - ListAsync (cases, paginated)          &lt; 500 ms for 5k rows, page 1 of 20
///   - GetPreAuthQueueAsync (raw EF query)   &lt; 500 ms for 5k authorizations
///   - GetByCaseIdAsync (VisitPolicy list)   &lt; 100 ms for 200 policies on one case
///
/// NOTE: EF InMemory is purely in-process and skips SQL parsing, network I/O and
/// index usage. These tests act as a baseline guard against O(n²) loops or
/// accidental eager-loads in the service layer, NOT as a replacement for load
/// testing against a real PostgreSQL instance with GIN indexes.
/// </summary>
public sealed class PreAuthQueuePerformanceTests : IDisposable
{
    private const int TargetCaseCount        = 5_000;
    private const int TargetAuthCount        = 5_000;
    private const int TargetPoliciesPerCase  = 200;   // single case
    private const int PageSize               = 20;

    private const int MaxCaseListMs          = 500;
    private const int MaxAuthQueryMs         = 500;
    private const int MaxPolicyListMs        = 100;

    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _actorId  = Guid.NewGuid();

    private readonly CcmsDbContext _db;
    private readonly CoverageCaseService _caseSvc;
    private readonly VisitPolicyService _policySvc;

    public PreAuthQueuePerformanceTests()
    {
        var options = new DbContextOptionsBuilder<CcmsDbContext>()
            .UseInMemoryDatabase($"perf-{Guid.NewGuid()}")
            .Options;
        _db = new CcmsDbContext(options);
        _db.Database.EnsureCreated();

        var wfMock = new Moq.Mock<IWorkflowEngine>();
        wfMock.Setup(w => w.StartAsync(
                Moq.It.IsAny<Guid>(), Moq.It.IsAny<Guid>(), Moq.It.IsAny<string>(),
                Moq.It.IsAny<Guid>(), Moq.It.IsAny<CancellationToken>()))
            .ReturnsAsync((Guid tid, Guid eid, string _, Guid _, CancellationToken _) =>
                new CcmsWorkflowInstance
                {
                    Id           = Guid.NewGuid(),
                    TenantId     = tid,
                    EntityId     = eid,
                    EntityType   = "coverage_case",
                    CurrentState = "CASE_OPEN",
                    Status       = "active",
                    CreatedAt    = DateTime.UtcNow,
                    UpdatedAt    = DateTime.UtcNow,
                });

        _caseSvc   = new CoverageCaseService(
            _db, wfMock.Object,
            new FinancialYearService(_db),
            NullLogger<CoverageCaseService>.Instance);

        _policySvc = new VisitPolicyService(_db);
    }

    // ── Seed helpers ──────────────────────────────────────────────────────────

    private void SeedCases(int count, string state = "PREAUTH_SENT")
    {
        var now   = DateTime.UtcNow;
        var batch = Enumerable.Range(0, count).Select(i => new CcmsCoverageCase
        {
            Id              = Guid.NewGuid(),
            TenantId        = _tenantId,
            CaseNumber      = $"CCMS-PERF-{i:D6}",
            CurrentState    = state,
            PayerType       = "insurance",
            PaymentType     = "cashless",
            ApprovedAmount  = 0m,
            IsDraft         = false,
            Status          = "active",
            PatientName     = $"Patient {i}",
            CreatedAt       = now.AddMinutes(-i),
            UpdatedAt       = now,
            CreatedByUserId = _actorId,
            UpdatedByUserId = _actorId,
        }).ToList();

        _db.CoverageCases.AddRange(batch);
        _db.SaveChanges();
    }

    private (Guid caseId, List<Guid> authIds) SeedAuthorizations(int count)
    {
        var caseId = Guid.NewGuid();
        _db.CoverageCases.Add(new CcmsCoverageCase
        {
            Id              = caseId,
            TenantId        = _tenantId,
            CaseNumber      = "CCMS-PERF-AUTH",
            CurrentState    = "PREAUTH_SENT",
            PayerType       = "insurance",
            PaymentType     = "cashless",
            ApprovedAmount  = 0m,
            IsDraft         = false,
            Status          = "active",
            CreatedAt       = DateTime.UtcNow,
            UpdatedAt       = DateTime.UtcNow,
            CreatedByUserId = _actorId,
            UpdatedByUserId = _actorId,
        });

        var now   = DateTime.UtcNow;
        var auths = Enumerable.Range(0, count).Select(_ => new CcmsCoverageAuthorization
        {
            Id              = Guid.NewGuid(),
            TenantId        = _tenantId,
            CoverageCase_Id = caseId,
            AuthorizationType = "preauth",
            RequestedAmount = 50_000m,
            ApprovedAmount  = 0m,
            Status          = "active",
            ProcessStatus   = "sent",
            CreatedAt       = now,
            UpdatedAt       = now,
            CreatedByUserId = _actorId,
            UpdatedByUserId = _actorId,
        }).ToList();

        _db.CoverageAuthorizations.AddRange(auths);
        _db.SaveChanges();
        return (caseId, auths.Select(a => a.Id).ToList());
    }

    private (Guid caseId, List<Guid> policyIds) SeedPolicies(int count)
    {
        var caseId = Guid.NewGuid();
        _db.CoverageCases.Add(new CcmsCoverageCase
        {
            Id              = caseId,
            TenantId        = _tenantId,
            CaseNumber      = "CCMS-PERF-POL",
            CurrentState    = "CASE_OPEN",
            PayerType       = "insurance",
            PaymentType     = "cashless",
            ApprovedAmount  = 0m,
            IsDraft         = false,
            Status          = "active",
            CreatedAt       = DateTime.UtcNow,
            UpdatedAt       = DateTime.UtcNow,
            CreatedByUserId = _actorId,
            UpdatedByUserId = _actorId,
        });

        var now      = DateTime.UtcNow;
        var policies = Enumerable.Range(0, count).Select((i) => new CcmsVisitInsurancePolicy
        {
            Id              = Guid.NewGuid(),
            TenantId        = _tenantId,
            CoverageCase_Id = caseId,
            PolicyNumber    = $"POL-PERF-{i:D6}",
            IsPrimary       = i == 0,
            SortOrder       = i,
            Status          = "active",
            CreatedAt       = now,
            UpdatedAt       = now,
            CreatedByUserId = _actorId,
            UpdatedByUserId = _actorId,
        }).ToList();

        _db.VisitInsurancePolicies.AddRange(policies);
        _db.SaveChanges();
        return (caseId, policies.Select(p => p.Id).ToList());
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact(DisplayName = "ListAsync — 5k cases, page 1 of 20 completes < 500ms")]
    public async Task ListAsync_5kCases_CompletesWithinThreshold()
    {
        SeedCases(TargetCaseCount);

        // Warm up EF InMemory
        await _caseSvc.ListAsync(_tenantId, page: 1, pageSize: PageSize);

        var sw = Stopwatch.StartNew();
        var result = await _caseSvc.ListAsync(_tenantId, page: 1, pageSize: PageSize);
        sw.Stop();

        result.TotalCount.Should().Be(TargetCaseCount);
        result.Items.Should().HaveCount(PageSize);

        sw.ElapsedMilliseconds.Should().BeLessThan(MaxCaseListMs,
            $"ListAsync on {TargetCaseCount} cases must complete in < {MaxCaseListMs}ms " +
            $"(actual {sw.ElapsedMilliseconds}ms). Check for accidental eager-loads or O(n²) loops.");
    }

    [Fact(DisplayName = "ListAsync — 5k cases with state filter completes < 500ms")]
    public async Task ListAsync_5kCasesFiltered_CompletesWithinThreshold()
    {
        SeedCases(TargetCaseCount / 2, state: "PREAUTH_SENT");
        SeedCases(TargetCaseCount / 2, state: "APPROVED");

        var sw = Stopwatch.StartNew();
        var result = await _caseSvc.ListAsync(_tenantId, state: "PREAUTH_SENT", page: 1, pageSize: PageSize);
        sw.Stop();

        result.Items.Should().OnlyContain(c => c.CurrentState == "PREAUTH_SENT");
        sw.ElapsedMilliseconds.Should().BeLessThan(MaxCaseListMs,
            $"Filtered ListAsync must complete in < {MaxCaseListMs}ms (actual {sw.ElapsedMilliseconds}ms).");
    }

    [Fact(DisplayName = "GetByCaseIdAsync (authorization) — 5k auths, single case, completes < 500ms")]
    public async Task GetAuthorizationsByCaseId_5kRows_CompletesWithinThreshold()
    {
        var (caseId, _) = SeedAuthorizations(TargetAuthCount);

        // Direct EF query (mimics OperationsFunctions / PreAuthorizationService)
        var sw = Stopwatch.StartNew();
        var rows = await _db.CoverageAuthorizations
            .AsNoTracking()
            .Where(a => a.CoverageCase_Id == caseId && a.DeletedAt == null)
            .OrderByDescending(a => a.CreatedAt)
            .Take(100)
            .ToListAsync();
        sw.Stop();

        rows.Should().HaveCount(100);
        sw.ElapsedMilliseconds.Should().BeLessThan(MaxAuthQueryMs,
            $"Authorization query for {TargetAuthCount} rows must complete in < {MaxAuthQueryMs}ms " +
            $"(actual {sw.ElapsedMilliseconds}ms).");
    }

    [Fact(DisplayName = "GetByCaseAsync (VisitPolicy) — 200 policies, single case, completes < 100ms")]
    public async Task GetPoliciesByCaseId_200Rows_CompletesWithinThreshold()
    {
        var (caseId, _) = SeedPolicies(TargetPoliciesPerCase);

        var sw = Stopwatch.StartNew();
        var dtos = await _policySvc.GetByCaseAsync(caseId);
        sw.Stop();

        dtos.Should().HaveCount(TargetPoliciesPerCase);
        sw.ElapsedMilliseconds.Should().BeLessThan(MaxPolicyListMs,
            $"GetByCaseAsync for {TargetPoliciesPerCase} policies must complete in < {MaxPolicyListMs}ms " +
            $"(actual {sw.ElapsedMilliseconds}ms).");
    }

    [Fact(DisplayName = "ListAsync — search across 5k cases completes < 500ms")]
    public async Task ListAsync_SearchQuery_5kRows_CompletesWithinThreshold()
    {
        SeedCases(TargetCaseCount);

        var sw = Stopwatch.StartNew();
        var result = await _caseSvc.ListAsync(_tenantId, search: "CCMS-PERF-002", page: 1, pageSize: PageSize);
        sw.Stop();

        sw.ElapsedMilliseconds.Should().BeLessThan(MaxCaseListMs,
            $"Search ListAsync on {TargetCaseCount} cases must complete in < {MaxCaseListMs}ms " +
            $"(actual {sw.ElapsedMilliseconds}ms).");
    }

    public void Dispose() => _db.Dispose();
}
