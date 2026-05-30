using CcmsApi.Data;
using CcmsApi.Models.Domain;
using Microsoft.EntityFrameworkCore;

namespace CcmsApi.Tests.Fixtures;

/// <summary>
/// Provides a fresh EF Core InMemory database for each test class.
/// Seed helpers are provided as extension methods on the fixture so every
/// test can compose the minimal data it needs.
/// </summary>
public sealed class InMemoryDbFixture : IDisposable
{
    public readonly Guid TenantId  = Guid.NewGuid();
    public readonly Guid ActorId   = Guid.NewGuid();

    public CcmsDbContext Db { get; }

    public InMemoryDbFixture()
    {
        var options = new DbContextOptionsBuilder<CcmsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())  // unique DB per test class
            .Options;

        Db = new CcmsDbContext(options);
        Db.Database.EnsureCreated();
    }

    // ── Seed helpers ──────────────────────────────────────────────────────────

    public CcmsCoverageCase SeedCase(
        string state       = "CASE_OPEN",
        string payerType   = "insurance",
        string? caseNumber = null)
    {
        var c = new CcmsCoverageCase
        {
            Id           = Guid.NewGuid(),
            TenantId     = TenantId,
            CaseNumber   = caseNumber ?? $"CCMS-{Guid.NewGuid().ToString()[..8].ToUpper()}",
            CurrentState = state,
            PayerType    = payerType,
            PaymentType  = "cashless",
            ApprovedAmount = 0m,
            IsDraft      = false,
            CreatedAt    = DateTime.UtcNow,
            UpdatedAt    = DateTime.UtcNow,
            CreatedByUserId = ActorId,
            UpdatedByUserId = ActorId,
            Status       = "active",
        };
        Db.CoverageCases.Add(c);
        Db.SaveChanges();
        return c;
    }

    public CcmsCoverageAuthorization SeedAuthorization(
        Guid caseId,
        decimal requestedAmount = 50_000m,
        string  status          = "PREAUTH_SENT")
    {
        var a = new CcmsCoverageAuthorization
        {
            Id                = Guid.NewGuid(),
            TenantId          = TenantId,
            CoverageCase_Id   = caseId,
            AuthorizationType = "preauth",
            RequestedAmount   = requestedAmount,
            ApprovedAmount    = 0m,
            Status            = status,
            ProcessStatus     = "pending",
            CreatedAt         = DateTime.UtcNow,
            UpdatedAt         = DateTime.UtcNow,
            CreatedByUserId   = ActorId,
            UpdatedByUserId   = ActorId,
        };
        Db.CoverageAuthorizations.Add(a);
        Db.SaveChanges();
        return a;
    }

    public CcmsVisitInsurancePolicy SeedPolicy(
        Guid caseId,
        string policyNumber = "POL-001",
        bool   isPrimary    = true)
    {
        var p = new CcmsVisitInsurancePolicy
        {
            Id              = Guid.NewGuid(),
            TenantId        = TenantId,
            CoverageCase_Id = caseId,
            PolicyNumber    = policyNumber,
            IsPrimary       = isPrimary,
            SortOrder       = 1,
            CreatedAt       = DateTime.UtcNow,
            UpdatedAt       = DateTime.UtcNow,
            CreatedByUserId = ActorId,
            UpdatedByUserId = ActorId,
            Status          = "active",
        };
        Db.VisitInsurancePolicies.Add(p);
        Db.SaveChanges();
        return p;
    }

    public CcmsEnhancementRequest SeedEnhancement(
        Guid caseId,
        decimal requestedAmount = 10_000m,
        string  ehStatus        = "active")
    {
        var e = new CcmsEnhancementRequest
        {
            Id              = Guid.NewGuid(),
            TenantId        = TenantId,
            CoverageCase_Id = caseId,
            EnhancementType = "amount",
            RequestedAmount = requestedAmount,
            ApprovedAmount  = 0m,
            Status          = ehStatus,
            CreatedAt       = DateTime.UtcNow,
            UpdatedAt       = DateTime.UtcNow,
            CreatedByUserId = ActorId,
            UpdatedByUserId = ActorId,
        };
        Db.EnhancementRequests.Add(e);
        Db.SaveChanges();
        return e;
    }

    public CcmsSettlement SeedSettlement(
        Guid caseId,
        decimal settledAmount = 40_000m,
        decimal claimAmount   = 50_000m)
    {
        var s = new CcmsSettlement
        {
            Id                   = Guid.NewGuid(),
            TenantId             = TenantId,
            CoverageCase_Id      = caseId,
            SettlementNumber     = $"STL-{DateTime.UtcNow:yyMM}-000001",
            SettlementType       = "partial",
            SettledAmount        = settledAmount,
            ClaimAmount          = claimAmount,
            OutstandingAmount    = claimAmount - settledAmount,
            ReconciliationStatus = "pending",
            Status               = "active",
            CreatedAt            = DateTime.UtcNow,
            UpdatedAt            = DateTime.UtcNow,
            CreatedByUserId      = ActorId,
            UpdatedByUserId      = ActorId,
        };
        Db.Settlements.Add(s);
        Db.SaveChanges();
        return s;
    }

    public CcmsClaimPacket SeedClaim(
        Guid caseId,
        decimal claimedAmount = 50_000m,
        string  claimStatus   = "active")
    {
        var c = new CcmsClaimPacket
        {
            Id              = Guid.NewGuid(),
            TenantId        = TenantId,
            CoverageCase_Id = caseId,
            ClaimNumber     = $"CLM-{DateTime.UtcNow:yyMM}-000001",
            ClaimedAmount   = claimedAmount,
            ClaimType       = "cashless",
            SubmissionMode  = "manual",
            Status          = claimStatus,
            CreatedAt       = DateTime.UtcNow,
            UpdatedAt       = DateTime.UtcNow,
            CreatedByUserId = ActorId,
            UpdatedByUserId = ActorId,
        };
        Db.ClaimPackets.Add(c);
        Db.SaveChanges();
        return c;
    }

    public void Dispose() => Db.Dispose();
}
