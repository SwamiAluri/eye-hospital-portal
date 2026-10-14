using System.Net;
using System.Text.Json;
using CcmsApi.Data;
using CcmsApi.Functions;
using CcmsApi.Models.Domain;
using CcmsApi.Services;
using CcmsApi.Tests.Helpers;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace CcmsApi.Tests;

/// <summary>
/// Patient-id CCMS settlement read. Permission is ccms.settlement.read.
/// Patient identity is the coverage case. No branch predicate.
/// </summary>
public class SettlementPatientReadTests
{
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private const string JwtKey = "your-secret-key-min-32-characters-change-this";

    [Fact]
    public async Task Unauthenticated_IsRejected_BeforeDataLoad()
    {
        var fn = Functions(null, CreateJwt());
        var response = await fn.ByPatient(Request(bearer: null), Guid.NewGuid());
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task MissingTenant_IsRejected()
    {
        var fn = Functions(null, CreateJwt());
        var response = await fn.ByPatient(Request(Token(includeTenant: false, "ccms.settlement.read")), Guid.NewGuid());
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Authenticated_WithoutPermission_IsRejected()
    {
        var fn = Functions(null, CreateJwt());
        Assert.Equal(HttpStatusCode.Unauthorized, (await fn.ByPatient(Request(Token()), Guid.NewGuid())).StatusCode);
    }

    [Theory]
    [InlineData("ccms.settlement.create")]
    [InlineData("ccms.settlement.reconcile")]
    [InlineData("ccms.claim.read")]
    [InlineData("ccms.coverage_case.read")]
    [InlineData("patient.view")]
    [InlineData("bill.update")]
    public async Task SiblingPermission_DoesNotAuthorize(string permission)
    {
        var fn = Functions(null, CreateJwt());
        var response = await fn.ByPatient(Request(Token(permission)), Guid.NewGuid());
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task SettlementRead_Authorizes_EmptyPatient_AsEmptyCollection()
    {
        await using var db = CreateDb();
        var fn = Functions(db, CreateJwt());
        var json = await ReadJson(await fn.ByPatient(Request(Token("ccms.settlement.read")), Guid.NewGuid()));
        Assert.Equal(0, json.RootElement.GetProperty("totalCount").GetInt32());
        Assert.Equal(0, json.RootElement.GetProperty("settlements").GetArrayLength());
    }

    [Fact]
    public async Task ReturnsOnlyThatPatientsSettlements_InsideTheTokenTenant()
    {
        await using var db = CreateDb();
        var patientA = Guid.NewGuid();
        var patientB = Guid.NewGuid();
        var claimId = Guid.NewGuid();
        var caseA = Case(TenantId, patientA, "CC-A", Guid.NewGuid());
        var caseB = Case(TenantId, patientB, "CC-B", null);
        var otherCase = Case(OtherTenantId, patientA, "CC-OTHER", null);
        var deletedCase = Case(TenantId, patientA, "CC-DEL-CASE", null, deleted: DateTime.UtcNow);
        db.CoverageCases.AddRange(caseA, caseB, otherCase, deletedCase);
        db.ClaimPackets.Add(new CcmsClaimPacket
        {
            Id = claimId,
            TenantId = TenantId,
            CoverageCase_Id = caseA.Id,
            ClaimNumber = "CLM-A",
            ClaimedAmount = 5000m,
            Status = "active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        db.Settlements.AddRange(
            Settlement(TenantId, caseA.Id, "STL-A", claimId, created: DateTime.UtcNow),
            Settlement(TenantId, caseA.Id, "STL-DELETED", null, deleted: DateTime.UtcNow),
            Settlement(TenantId, caseB.Id, "STL-B", null),
            Settlement(OtherTenantId, otherCase.Id, "STL-OTHER-TENANT", null),
            Settlement(TenantId, deletedCase.Id, "STL-ON-DELETED-CASE", null),
            Settlement(OtherTenantId, caseA.Id, "STL-TENANT-MISMATCH", null));
        await db.SaveChangesAsync();

        var response = await Functions(db, CreateJwt()).ByPatient(Request(Token("ccms.settlement.read")), patientA);
        var json = await ReadJson(response);
        var numbers = json.RootElement.GetProperty("settlements").EnumerateArray()
            .Select(item => item.GetProperty("settlementNumber").GetString())
            .ToList();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new[] { "STL-A" }, numbers);
        var row = json.RootElement.GetProperty("settlements")[0];
        Assert.Equal("CC-A", row.GetProperty("caseNumber").GetString());
        Assert.Equal("CLM-A", row.GetProperty("claimNumber").GetString());
        Assert.Equal("partial", row.GetProperty("settlementType").GetString());
        Assert.Equal(4000m, row.GetProperty("settledAmount").GetDecimal());
        Assert.Equal(5000m, row.GetProperty("claimAmount").GetDecimal());
        Assert.Equal("pending", row.GetProperty("reconciliationStatus").GetString());
        Assert.False(row.TryGetProperty("outstandingAmount", out _));
        Assert.False(row.TryGetProperty("bankReference", out _));
        Assert.False(row.TryGetProperty("reconciliationNotes", out _));
        Assert.False(row.TryGetProperty("lineItems", out _));
        Assert.False(row.TryGetProperty("coverageCase_Id", out _));
        var text = row.GetRawText();
        Assert.DoesNotContain("secret-bank", text);
        Assert.DoesNotContain("secret-note", text);
    }

    [Fact]
    public async Task DifferentPatient_DoesNotReturnAnotherPatientsSettlements()
    {
        await using var db = CreateDb();
        var patientA = Guid.NewGuid();
        var patientB = Guid.NewGuid();
        var caseB = Case(TenantId, patientB, "CC-B", null);
        db.CoverageCases.Add(caseB);
        db.Settlements.Add(Settlement(TenantId, caseB.Id, "STL-B-ONLY", null));
        await db.SaveChangesAsync();

        var json = await ReadJson(await Functions(db, CreateJwt())
            .ByPatient(Request(Token("ccms.settlement.read")), patientA));
        Assert.Equal(0, json.RootElement.GetProperty("settlements").GetArrayLength());
    }

    [Fact]
    public async Task DeletedClaim_DoesNotSupplyAClaimNumber()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var coverageCase = Case(TenantId, patientId, "CC-A", null);
        var claimId = Guid.NewGuid();
        db.CoverageCases.Add(coverageCase);
        db.ClaimPackets.Add(new CcmsClaimPacket
        {
            Id = claimId,
            TenantId = TenantId,
            CoverageCase_Id = coverageCase.Id,
            ClaimNumber = "CLM-DELETED",
            ClaimedAmount = 1,
            Status = "active",
            DeletedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        db.Settlements.Add(Settlement(TenantId, coverageCase.Id, "STL-A", claimId));
        await db.SaveChangesAsync();

        var json = await ReadJson(await Functions(db, CreateJwt())
            .ByPatient(Request(Token("ccms.settlement.read")), patientId));
        var row = json.RootElement.GetProperty("settlements")[0];
        Assert.Equal("STL-A", row.GetProperty("settlementNumber").GetString());
        Assert.False(row.TryGetProperty("claimNumber", out _));
    }

    [Fact]
    public async Task StoredCaseBranchId_IsNotAQueryPredicate()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var branchA = Case(TenantId, patientId, "CC-BR-A", Guid.NewGuid());
        var branchB = Case(TenantId, patientId, "CC-BR-B", Guid.NewGuid());
        db.CoverageCases.AddRange(branchA, branchB);
        db.Settlements.AddRange(
            Settlement(TenantId, branchA.Id, "STL-BR-A", null),
            Settlement(TenantId, branchB.Id, "STL-BR-B", null));
        await db.SaveChangesAsync();

        var numbers = (await ReadJson(await Functions(db, CreateJwt())
            .ByPatient(Request(Token("ccms.settlement.read")), patientId)))
            .RootElement.GetProperty("settlements").EnumerateArray()
            .Select(item => item.GetProperty("settlementNumber").GetString()!)
            .OrderBy(n => n)
            .ToArray();
        Assert.Equal(new[] { "STL-BR-A", "STL-BR-B" }, numbers);
    }

    [Fact]
    public async Task ByPatient_UsesServerPageWindow_AndCapsPageSize()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var coverageCase = Case(TenantId, patientId, "CC-PAGE", null);
        db.CoverageCases.Add(coverageCase);
        db.Settlements.AddRange(
            Settlement(TenantId, coverageCase.Id, "STL-OLD", null, created: DateTime.UtcNow.AddMinutes(-2)),
            Settlement(TenantId, coverageCase.Id, "STL-NEW", null, created: DateTime.UtcNow));
        await db.SaveChangesAsync();
        var fn = Functions(db, CreateJwt());
        var token = Token("ccms.settlement.read");

        var first = await ReadJson(await fn.ByPatient(Request(token, "?pageNumber=1&pageSize=1"), patientId));
        var second = await ReadJson(await fn.ByPatient(Request(token, "?pageNumber=2&pageSize=1"), patientId));
        var again = await ReadJson(await fn.ByPatient(Request(token, "?pageNumber=1&pageSize=1"), patientId));
        var capped = await ReadJson(await fn.ByPatient(Request(token, "?pageSize=500"), patientId));
        var defaults = await ReadJson(await fn.ByPatient(Request(token), patientId));

        Assert.Equal("STL-NEW", first.RootElement.GetProperty("settlements")[0].GetProperty("settlementNumber").GetString());
        Assert.Equal(first.RootElement.GetProperty("settlements")[0].GetProperty("settlementNumber").GetString(),
            again.RootElement.GetProperty("settlements")[0].GetProperty("settlementNumber").GetString());
        Assert.Equal(2, first.RootElement.GetProperty("totalCount").GetInt32());
        Assert.Equal(1, first.RootElement.GetProperty("pageSize").GetInt32());
        Assert.Equal("STL-OLD", second.RootElement.GetProperty("settlements")[0].GetProperty("settlementNumber").GetString());
        Assert.Equal(100, capped.RootElement.GetProperty("pageSize").GetInt32());
        Assert.Equal(2, capped.RootElement.GetProperty("settlements").GetArrayLength());
        Assert.Equal(20, defaults.RootElement.GetProperty("pageSize").GetInt32());
    }

    [Fact]
    public async Task ExistingCaseGet_StillReturnsTheOperationalDto()
    {
        await using var db = CreateDb();
        var coverageCase = Case(TenantId, Guid.NewGuid(), "CC-EXISTING", null);
        db.CoverageCases.Add(coverageCase);
        var row = Settlement(TenantId, coverageCase.Id, "STL-EXISTING", null);
        row.BankReference = "BANK-1";
        db.Settlements.Add(row);
        await db.SaveChangesAsync();

        var json = await ReadJson(await Functions(db, CreateJwt())
            .GetForCase(Request(Token("ccms.settlement.read")), coverageCase.Id));
        Assert.Equal(JsonValueKind.Array, json.RootElement.ValueKind);
        Assert.Equal("STL-EXISTING", json.RootElement[0].GetProperty("settlementNumber").GetString());
        Assert.Equal("BANK-1", json.RootElement[0].GetProperty("bankReference").GetString());
    }

    private static SettlementFunctions Functions(CcmsDbContext? db, JwtService jwt) =>
        new(
            db is null
                ? null!
                : new SettlementReconciliationService(db, null!, NullLogger<SettlementReconciliationService>.Instance),
            jwt);

    private static CcmsCoverageCase Case(
        Guid tenantId, Guid patientId, string caseNumber, Guid? branchId, DateTime? deleted = null) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CaseNumber = caseNumber,
            PatientId = patientId,
            BranchId = branchId,
            CurrentState = "FULL_SETTLEMENT",
            PayerType = "insurance",
            Status = "active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            DeletedAt = deleted,
        };

    private static CcmsSettlement Settlement(
        Guid tenantId,
        Guid caseId,
        string number,
        Guid? claimId,
        DateTime? created = null,
        DateTime? deleted = null) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CoverageCase_Id = caseId,
            ClaimPacketId = claimId,
            SettlementNumber = number,
            SettlementType = "partial",
            SettledAmount = 4000m,
            ClaimAmount = 5000m,
            OutstandingAmount = 1000m,
            PaymentMode = "NEFT",
            PaymentReference = "UTR-1",
            BankReference = "secret-bank",
            ReconciliationNotes = "secret-note",
            ReconciliationStatus = "pending",
            Status = "active",
            CreatedAt = created ?? DateTime.UtcNow,
            UpdatedAt = created ?? DateTime.UtcNow,
            DeletedAt = deleted,
        };

    private static async Task<JsonDocument> ReadJson(HttpResponseData response)
    {
        response.Body.Position = 0;
        return await JsonDocument.ParseAsync(response.Body);
    }

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

    private static FunctionHttpTestDoubles.TestHttpRequestData Request(string? bearer, string? query = null) =>
        FunctionHttpTestDoubles.CreateGetRequest(
            FunctionHttpTestDoubles.CreateContext(),
            "http://localhost/ccms/settlements/by-patient" + (query ?? ""),
            bearer is null
                ? null
                : new Dictionary<string, string> { ["Authorization"] = "Bearer " + bearer });

    private static string Token(params string[] permissions) => Token(includeTenant: true, permissions);

    private static string Token(bool includeTenant, params string[] permissions)
    {
        var claims = new List<System.Security.Claims.Claim>
        {
            new(System.Security.Claims.ClaimTypes.NameIdentifier, UserId.ToString()),
        };
        if (includeTenant)
            claims.Add(new System.Security.Claims.Claim("tenant_id", TenantId.ToString()));
        foreach (var permission in permissions)
            claims.Add(new System.Security.Claims.Claim("permission", permission));

        var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
        var descriptor = new Microsoft.IdentityModel.Tokens.SecurityTokenDescriptor
        {
            Subject = new System.Security.Claims.ClaimsIdentity(claims),
            Issuer = "EyeHospitalAuth",
            Audience = "EyeHospitalAPI",
            Expires = DateTime.UtcNow.AddHours(1),
            SigningCredentials = new Microsoft.IdentityModel.Tokens.SigningCredentials(
                new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(
                    System.Text.Encoding.UTF8.GetBytes(JwtKey)),
                Microsoft.IdentityModel.Tokens.SecurityAlgorithms.HmacSha256Signature),
        };
        return handler.WriteToken(handler.CreateToken(descriptor));
    }
}
