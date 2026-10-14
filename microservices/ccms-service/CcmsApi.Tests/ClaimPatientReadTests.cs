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
/// Patient-id CCMS claims read. Permission is ccms.claim.read.
/// Tenant scope matches the coverage-case patient read. No branch predicate.
/// </summary>
public class ClaimPatientReadTests
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
    public async Task Authenticated_WithoutPermission_IsRejected_BeforeDataLoad()
    {
        var fn = Functions(null, CreateJwt());

        var response = await fn.ByPatient(Request(Token()), Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CoverageCaseRead_DoesNotAuthorize_BeforeDataLoad()
    {
        var fn = Functions(null, CreateJwt());

        var response = await fn.ByPatient(Request(Token("ccms.coverage_case.read")), Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task AuthorizationRead_DoesNotAuthorize_BeforeDataLoad()
    {
        var fn = Functions(null, CreateJwt());

        var response = await fn.ByPatient(Request(Token("ccms.authorization.read")), Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task EligibilityRead_DoesNotAuthorize_BeforeDataLoad()
    {
        var fn = Functions(null, CreateJwt());

        var response = await fn.ByPatient(Request(Token("ccms.eligibility.read")), Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UnrelatedCcmsPermission_IsRejected_BeforeDataLoad()
    {
        var fn = Functions(null, CreateJwt());

        var response = await fn.ByPatient(Request(Token("ccms.document.read")), Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ClaimRead_Authorizes_EmptyPatient_AsEmptyCollection()
    {
        await using var db = CreateDb();
        var fn = Functions(db, CreateJwt());

        var response = await fn.ByPatient(Request(Token("ccms.claim.read")), Guid.NewGuid());
        var json = await ReadJson(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(0, json.RootElement.GetProperty("totalCount").GetInt32());
        Assert.Equal(0, json.RootElement.GetProperty("claims").GetArrayLength());
    }

    [Fact]
    public async Task ReturnsOnlyThatPatientsClaims_InsideTheTokenTenant()
    {
        await using var db = CreateDb();
        var patientA = Guid.NewGuid();
        var patientB = Guid.NewGuid();
        var caseA1 = Case(TenantId, patientA, "CC-A1", Guid.NewGuid());
        var caseA2 = Case(TenantId, patientA, "CC-A2", Guid.NewGuid());
        var caseB = Case(TenantId, patientB, "CC-B", null);
        var otherCase = Case(OtherTenantId, patientA, "CC-OTHER", null);
        var deletedCase = Case(TenantId, patientA, "CC-DEL-CASE", null, deleted: DateTime.UtcNow);
        db.CoverageCases.AddRange(caseA1, caseA2, caseB, otherCase, deletedCase);
        db.ClaimPackets.AddRange(
            Packet(TenantId, caseA1.Id, "CLM-A1", created: DateTime.UtcNow.AddMinutes(-2)),
            Packet(TenantId, caseA2.Id, "CLM-A2", created: DateTime.UtcNow),
            Packet(TenantId, caseA1.Id, "CLM-DELETED", deleted: DateTime.UtcNow),
            Packet(TenantId, caseB.Id, "CLM-B"),
            Packet(OtherTenantId, otherCase.Id, "CLM-OTHER-TENANT"),
            Packet(TenantId, deletedCase.Id, "CLM-ON-DELETED-CASE"),
            Packet(OtherTenantId, caseA1.Id, "CLM-CLAIM-TENANT-MISMATCH"));
        await db.SaveChangesAsync();
        var fn = Functions(db, CreateJwt());

        var response = await fn.ByPatient(Request(Token("ccms.claim.read")), patientA);
        var numbers = await ClaimNumbers(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new[] { "CLM-A2", "CLM-A1" }, numbers);
        Assert.DoesNotContain("CLM-B", numbers);
        Assert.DoesNotContain("CLM-DELETED", numbers);
        Assert.DoesNotContain("CLM-OTHER-TENANT", numbers);
        Assert.DoesNotContain("CLM-ON-DELETED-CASE", numbers);
        Assert.DoesNotContain("CLM-CLAIM-TENANT-MISMATCH", numbers);
    }

    [Fact]
    public async Task DifferentPatient_DoesNotReturnAnotherPatientsClaims()
    {
        await using var db = CreateDb();
        var patientA = Guid.NewGuid();
        var patientB = Guid.NewGuid();
        var caseB = Case(TenantId, patientB, "CC-B", null);
        db.CoverageCases.Add(caseB);
        db.ClaimPackets.Add(Packet(TenantId, caseB.Id, "CLM-B-ONLY"));
        await db.SaveChangesAsync();
        var fn = Functions(db, CreateJwt());

        var response = await fn.ByPatient(Request(Token("ccms.claim.read")), patientA);
        var json = await ReadJson(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(0, json.RootElement.GetProperty("claims").GetArrayLength());
    }

    [Fact]
    public async Task StoredCaseBranchId_IsNotAQueryPredicate()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var branchA = Case(TenantId, patientId, "CC-BR-A", Guid.NewGuid());
        var branchB = Case(TenantId, patientId, "CC-BR-B", Guid.NewGuid());
        var noBranch = Case(TenantId, patientId, "CC-BR-NULL", null);
        db.CoverageCases.AddRange(branchA, branchB, noBranch);
        db.ClaimPackets.AddRange(
            Packet(TenantId, branchA.Id, "CLM-BR-A"),
            Packet(TenantId, branchB.Id, "CLM-BR-B"),
            Packet(TenantId, noBranch.Id, "CLM-BR-NULL"));
        await db.SaveChangesAsync();
        var fn = Functions(db, CreateJwt());

        var numbers = await ClaimNumbers(
            await fn.ByPatient(Request(Token("ccms.claim.read")), patientId));

        Assert.Equal(new[] { "CLM-BR-A", "CLM-BR-B", "CLM-BR-NULL" }, numbers.OrderBy(n => n).ToArray());
    }

    [Fact]
    public async Task ExistingCaseGet_StillReturnsThatCasesClaims()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var coverageCase = Case(TenantId, patientId, "CC-EXISTING", null);
        db.CoverageCases.Add(coverageCase);
        db.ClaimPackets.Add(Packet(TenantId, coverageCase.Id, "CLM-EXISTING"));
        await db.SaveChangesAsync();
        var fn = Functions(db, CreateJwt());

        var response = await fn.GetForCase(Request(Token("ccms.claim.read")), coverageCase.Id);
        var json = await ReadJson(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(JsonValueKind.Array, json.RootElement.ValueKind);
        Assert.Equal("CLM-EXISTING", json.RootElement[0].GetProperty("claimNumber").GetString());
    }

    [Fact]
    public async Task ByPatient_UsesServerPageWindow_AndCapsPageSize()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var coverageCase = Case(TenantId, patientId, "CC-PAGE", null);
        db.CoverageCases.Add(coverageCase);
        db.ClaimPackets.AddRange(
            Packet(TenantId, coverageCase.Id, "CLM-OLD", created: DateTime.UtcNow.AddMinutes(-2)),
            Packet(TenantId, coverageCase.Id, "CLM-NEW", created: DateTime.UtcNow));
        await db.SaveChangesAsync();
        var fn = Functions(db, CreateJwt());
        var token = Token("ccms.claim.read");

        var first = await ReadJson(await fn.ByPatient(Request(token, "?pageNumber=1&pageSize=1"), patientId));
        var second = await ClaimNumbers(await fn.ByPatient(Request(token, "?pageNumber=2&pageSize=1"), patientId));
        var capped = await ReadJson(await fn.ByPatient(Request(token, "?pageSize=500"), patientId));
        var defaults = await ReadJson(await fn.ByPatient(Request(token), patientId));

        Assert.Equal("CLM-NEW", first.RootElement.GetProperty("claims")[0].GetProperty("claimNumber").GetString());
        Assert.Equal(2, first.RootElement.GetProperty("totalCount").GetInt32());
        Assert.Equal(1, first.RootElement.GetProperty("pageSize").GetInt32());
        Assert.Equal(new[] { "CLM-OLD" }, second);
        Assert.Equal(100, capped.RootElement.GetProperty("pageSize").GetInt32());
        Assert.Equal(2, capped.RootElement.GetProperty("claims").GetArrayLength());
        Assert.Equal(20, defaults.RootElement.GetProperty("pageSize").GetInt32());
    }

    private static ClaimFunctions Functions(CcmsDbContext? db, JwtService jwt) =>
        new(
            db is null
                ? null!
                : new ClaimPacketGeneratorService(db, null!, NullLogger<ClaimPacketGeneratorService>.Instance),
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
            CurrentState = "DRAFT",
            PayerType = "insurance",
            Status = "active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            DeletedAt = deleted,
        };

    private static CcmsClaimPacket Packet(
        Guid tenantId,
        Guid caseId,
        string claimNumber,
        DateTime? created = null,
        DateTime? deleted = null) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CoverageCase_Id = caseId,
            ClaimNumber = claimNumber,
            ClaimedAmount = 1000m,
            ClaimType = "cashless",
            SubmissionMode = "manual",
            QueryStatus = "none",
            Status = "active",
            CreatedAt = created ?? DateTime.UtcNow,
            UpdatedAt = created ?? DateTime.UtcNow,
            DeletedAt = deleted,
        };

    private static async Task<List<string>> ClaimNumbers(HttpResponseData response)
    {
        var json = await ReadJson(response);
        return json.RootElement.GetProperty("claims").EnumerateArray()
            .Select(item => item.GetProperty("claimNumber").GetString()!)
            .ToList();
    }

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
            "http://localhost/ccms/claims/by-patient" + (query ?? ""),
            bearer is null
                ? null
                : new Dictionary<string, string> { ["Authorization"] = "Bearer " + bearer });

    private static string Token(params string[] permissions)
    {
        var claims = new List<System.Security.Claims.Claim>
        {
            new(System.Security.Claims.ClaimTypes.NameIdentifier, UserId.ToString()),
            new("tenant_id", TenantId.ToString()),
        };
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
