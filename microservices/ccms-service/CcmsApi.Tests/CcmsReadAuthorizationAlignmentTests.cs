using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Claims;
using System.Text;
using CcmsApi.Data;
using CcmsApi.Functions;
using CcmsApi.Models.Domain;
using CcmsApi.Services;
using CcmsApi.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace CcmsApi.Tests;

/// <summary>
/// Server-side gates for the approved granular CCMS read codes.
/// Services are left null on rejection paths so a call into CCMS data fails the test.
/// </summary>
public class CcmsReadAuthorizationAlignmentTests
{
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private const string JwtKey = "your-secret-key-min-32-characters-change-this";

    [Fact]
    public async Task Unauthenticated_Read_IsRejected_BeforeDataLoad()
    {
        await using var db = CreateDb();
        var fn = CoverageFunctions(db, CreateJwt());

        var response = await fn.GetById(Request(bearer: null), Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Authenticated_WithoutRequiredPermission_IsRejected_BeforeDataLoad()
    {
        var fn = new ClaimFunctions(null!, CreateJwt());

        var response = await fn.GetForCase(
            Request(Token("ccms.coverage_case.read")),
            Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task RequiredPermission_Authorizes_And_MissingCase_StaysNotFound()
    {
        await using var db = CreateDb();
        var fn = CoverageFunctions(db, CreateJwt());

        var response = await fn.GetById(Request(Token("ccms.coverage_case.read")), Guid.NewGuid());

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task RequiredPermission_ReturnsExistingCase()
    {
        await using var db = CreateDb();
        var caseId = Guid.NewGuid();
        db.CoverageCases.Add(new CcmsCoverageCase
        {
            Id = caseId,
            TenantId = TenantId,
            CaseNumber = "CC-AUTH-1",
            PatientId = Guid.NewGuid(),
            CurrentState = "DRAFT",
            PayerType = "insurance",
            Status = "active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();
        var fn = CoverageFunctions(db, CreateJwt());

        var response = await fn.GetById(Request(Token("ccms.coverage_case.read")), caseId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task CoverageCaseRead_AuthorizesList_And_EmptyListStaysEmpty()
    {
        await using var db = CreateDb();
        var fn = CoverageFunctions(db, CreateJwt());

        var response = await fn.List(Request(Token("ccms.coverage_case.read")));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task MissingSession_StaysNoContent_AfterAuthorization()
    {
        await using var db = CreateDb();
        var fn = CoverageFunctions(db, CreateJwt());

        var response = await fn.BySession(Request(Token("ccms.coverage_case.read")), Guid.NewGuid());

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task CounsellorSessionPermission_AuthorizesBySession_ButNotTheCaseList()
    {
        await using var db = CreateDb();
        var fn = CoverageFunctions(db, CreateJwt());

        var bySession = await fn.BySession(Request(Token("counseling_sessions.update")), Guid.NewGuid());
        var list = await fn.List(Request(Token("counseling_sessions.update")));

        Assert.Equal(HttpStatusCode.NoContent, bySession.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, list.StatusCode);
    }

    [Fact]
    public async Task ClaimRead_DoesNotRequirePatientView()
    {
        await using var db = CreateDb();
        var fn = ClaimFunctions(db, CreateJwt());

        var response = await fn.GetForCase(Request(Token("ccms.claim.read")), Guid.NewGuid());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task AuthorizationRead_AuthorizesCaseList_And_EmptyStaysEmpty()
    {
        await using var db = CreateDb();
        var fn = AuthorizationFunctions(db, CreateJwt());

        var denied = await fn.GetForCase(Request(Token("ccms.claim.read")), Guid.NewGuid());
        var allowed = await fn.GetForCase(Request(Token("ccms.authorization.read")), Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Unauthorized, denied.StatusCode);
        Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
    }

    [Fact]
    public async Task EligibilityRead_AuthorizesChecks_And_EmptyStaysEmpty()
    {
        await using var db = CreateDb();
        var fn = new EligibilityFunctions(
            new EligibilityService(db, null!, NullLogger<EligibilityService>.Instance),
            null!,
            CreateJwt(),
            NullLogger<EligibilityFunctions>.Instance);

        var denied = await fn.ListEligibilityChecks(Request(Token("ccms.coverage_case.read")), Guid.NewGuid());
        var allowed = await fn.ListEligibilityChecks(Request(Token("ccms.eligibility.read")), Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Unauthorized, denied.StatusCode);
        Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
    }

    [Fact]
    public async Task DocumentRead_AuthorizesList_And_RejectsSiblingPermission()
    {
        await using var db = CreateDb();
        var fn = new DocumentFunctions(
            new DocumentEngineService(db, JwtConfiguration(), NullLogger<DocumentEngineService>.Instance),
            CreateJwt());

        var denied = await fn.GetForCase(Request(Token("ccms.coverage_case.read")), Guid.NewGuid());
        var allowed = await fn.GetForCase(Request(Token("ccms.document.read")), Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Unauthorized, denied.StatusCode);
        Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
    }

    [Fact]
    public async Task DocumentContent_WithoutPermission_IsRejected_BeforeBlobOpen()
    {
        var fn = new DocumentFunctions(null!, CreateJwt());

        var response = await fn.GetDocumentContent(Request(Token("ccms.document.upload")), Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task BillingRead_AuthorizesSummary_And_MissingSummaryStaysNotFound()
    {
        await using var db = CreateDb();
        var fn = new BillingIntegrationFunctions(
            new CoverageAllocationEngine(db, null!, NullLogger<CoverageAllocationEngine>.Instance),
            db,
            CreateJwt());

        var denied = await fn.GetSummary(Request(Token("ccms.billing.allocate")), Guid.NewGuid());
        var allowed = await fn.GetSummary(Request(Token("ccms.billing.read")), Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Unauthorized, denied.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, allowed.StatusCode);
    }

    [Fact]
    public async Task SettlementRead_AuthorizesCaseList_And_EmptyStaysEmpty()
    {
        await using var db = CreateDb();
        var fn = new SettlementFunctions(
            new SettlementReconciliationService(db, null!, NullLogger<SettlementReconciliationService>.Instance),
            CreateJwt());

        var denied = await fn.GetForCase(Request(Token("ccms.claim.read")), Guid.NewGuid());
        var allowed = await fn.GetForCase(Request(Token("ccms.settlement.read")), Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Unauthorized, denied.StatusCode);
        Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
    }

    [Fact]
    public async Task ClaimQueue_And_OperationsClaimsQueue_RequireClaimRead()
    {
        await using var db = CreateDb();
        var claims = ClaimFunctions(db, CreateJwt());
        var ops = new OperationsFunctions(db, null!, CreateJwt(), NullLogger<OperationsFunctions>.Instance);

        var deniedQueue = await claims.GetQueue(Request(Token("ccms.claim.submit")));
        var allowedQueue = await claims.GetQueue(Request(Token("ccms.claim.read")));
        var deniedOps = await ops.GetClaimsQueue(Request(Token("ccms.coverage_case.read")));
        var allowedOps = await ops.GetClaimsQueue(Request(Token("ccms.claim.read")));

        Assert.Equal(HttpStatusCode.Unauthorized, deniedQueue.StatusCode);
        Assert.Equal(HttpStatusCode.OK, allowedQueue.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, deniedOps.StatusCode);
        Assert.Equal(HttpStatusCode.OK, allowedOps.StatusCode);
    }

    [Fact]
    public async Task AuthorizationQueues_RequireAuthorizationRead()
    {
        await using var db = CreateDb();
        var auth = AuthorizationFunctions(db, CreateJwt());
        var ops = new OperationsFunctions(
            db,
            new PreAuthOpsQueueService(db),
            CreateJwt(),
            NullLogger<OperationsFunctions>.Instance);

        var denied = await auth.GetQueue(Request(Token("ccms.authorization.create")));
        var allowed = await auth.GetQueue(Request(Token("ccms.authorization.read")));
        var deniedOps = await ops.GetPreAuthQueue(Request(Token()));
        var allowedOps = await ops.GetPreAuthQueue(Request(Token("ccms.authorization.read")));
        var allowedSummary = await ops.GetPreAuthQueueSummary(Request(Token("ccms.authorization.read")));

        Assert.Equal(HttpStatusCode.Unauthorized, denied.StatusCode);
        Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, deniedOps.StatusCode);
        Assert.Equal(HttpStatusCode.OK, allowedOps.StatusCode);
        Assert.Equal(HttpStatusCode.OK, allowedSummary.StatusCode);
    }

    [Fact]
    public async Task SettlementQueue_RequiresSettlementRead()
    {
        await using var db = CreateDb();
        var ops = new OperationsFunctions(db, null!, CreateJwt(), NullLogger<OperationsFunctions>.Instance);

        var denied = await ops.GetSettlementQueue(Request(Token("ccms.settlement.create")));
        var allowed = await ops.GetSettlementQueue(Request(Token("ccms.settlement.read")));

        Assert.Equal(HttpStatusCode.Unauthorized, denied.StatusCode);
        Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
    }

    [Fact]
    public async Task HoldingSeveralCodes_StillRequiresTheEndpointCode()
    {
        await using var db = CreateDb();
        var billing = new BillingIntegrationFunctions(
            new CoverageAllocationEngine(db, null!, NullLogger<CoverageAllocationEngine>.Instance),
            db,
            CreateJwt());

        var response = await billing.GetWithAllocations(
            Request(Token("ccms.coverage_case.read", "ccms.claim.read", "ccms.settlement.read")),
            Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task DocumentAccessUrls_RequireDocumentRead_BeforeBlobAccess()
    {
        var fn = new DocumentFunctions(null!, CreateJwt());
        var docId = Guid.NewGuid();

        var byCase = await fn.GetAccessUrl(Request(Token("ccms.document.upload")), Guid.NewGuid(), docId);
        var byId = await fn.GetAccessUrlByDocumentId(Request(Token()), docId);

        Assert.Equal(HttpStatusCode.Unauthorized, byCase.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, byId.StatusCode);
    }

    [Fact]
    public async Task BillingAllocationReads_RequireBillingRead()
    {
        await using var db = CreateDb();
        var fn = new BillingIntegrationFunctions(
            new CoverageAllocationEngine(db, null!, NullLogger<CoverageAllocationEngine>.Instance),
            db,
            CreateJwt());

        var deniedAllocations = await fn.GetAllocations(Request(Token("ccms.coverage_case.read")), Guid.NewGuid());
        var allowedAllocations = await fn.GetAllocations(Request(Token("ccms.billing.read")), Guid.NewGuid());
        var allowedFull = await fn.GetWithAllocations(Request(Token("ccms.billing.read")), Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Unauthorized, deniedAllocations.StatusCode);
        Assert.Equal(HttpStatusCode.OK, allowedAllocations.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, allowedFull.StatusCode);
    }

    private static CoverageCaseFunctions CoverageFunctions(CcmsDbContext db, JwtService jwt) =>
        new(
            new CoverageCaseService(db, null!, null!, null!, NullLogger<CoverageCaseService>.Instance),
            null!,
            null!,
            jwt,
            null!,
            db,
            NullLogger<CoverageCaseFunctions>.Instance);

    private static ClaimFunctions ClaimFunctions(CcmsDbContext db, JwtService jwt) =>
        new(new ClaimPacketGeneratorService(db, null!, NullLogger<ClaimPacketGeneratorService>.Instance), jwt);

    private static AuthorizationFunctions AuthorizationFunctions(CcmsDbContext db, JwtService jwt) =>
        new(
            new PreAuthorizationService(db, null!, null!, null!, NullLogger<PreAuthorizationService>.Instance),
            null!,
            jwt,
            NullLogger<AuthorizationFunctions>.Instance);

    private static CcmsDbContext CreateDb()
    {
        var opts = new DbContextOptionsBuilder<CcmsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new CcmsDbContext(opts);
    }

    private static JwtService CreateJwt() => new(JwtConfiguration(), new TenantContext());

    private static IConfiguration JwtConfiguration() =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt__Key"] = JwtKey,
            ["Jwt__Issuer"] = "EyeHospitalAuth",
            ["Jwt__Audience"] = "EyeHospitalAPI",
        }).Build();

    private static FunctionHttpTestDoubles.TestHttpRequestData Request(string? bearer) =>
        FunctionHttpTestDoubles.CreateGetRequest(
            FunctionHttpTestDoubles.CreateContext(),
            "http://localhost/ccms/read-auth",
            bearer is null
                ? null
                : new Dictionary<string, string> { ["Authorization"] = "Bearer " + bearer });

    private static string Token(params string[] permissions)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, UserId.ToString()),
            new("tenant_id", TenantId.ToString()),
        };
        foreach (var permission in permissions)
            claims.Add(new Claim("permission", permission));

        var handler = new JwtSecurityTokenHandler();
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Issuer = "EyeHospitalAuth",
            Audience = "EyeHospitalAPI",
            Expires = DateTime.UtcNow.AddHours(1),
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtKey)),
                SecurityAlgorithms.HmacSha256Signature),
        };
        return handler.WriteToken(handler.CreateToken(descriptor));
    }
}
