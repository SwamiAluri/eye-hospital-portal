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
/// Patient-id coverage-case read: tenant + soft-delete scope, coverage_case.read only.
/// </summary>
public class CoverageCasePatientReadTests
{
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private const string JwtKey = "your-secret-key-min-32-characters-change-this";

    [Fact]
    public async Task Unauthenticated_IsRejected_BeforeDataLoad()
    {
        var fn = Functions(null!, CreateJwt());

        var response = await fn.ByPatient(Request(bearer: null), Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Authenticated_WithoutPermission_IsRejected_BeforeDataLoad()
    {
        var fn = Functions(null!, CreateJwt());

        var response = await fn.ByPatient(Request(Token()), Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UnrelatedCcmsPermission_IsRejected_BeforeDataLoad()
    {
        var fn = Functions(null!, CreateJwt());

        var response = await fn.ByPatient(Request(Token("ccms.claim.read")), Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CoverageCaseRead_Authorizes_EmptyPatient_AsEmptyCollection()
    {
        await using var db = CreateDb();
        var fn = Functions(db, CreateJwt());

        var response = await fn.ByPatient(Request(Token("ccms.coverage_case.read")), Guid.NewGuid());
        var json = await ReadJson(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(0, json.RootElement.GetProperty("totalCount").GetInt32());
        Assert.Equal(0, json.RootElement.GetProperty("cases").GetArrayLength());
    }

    [Fact]
    public async Task ReturnsOnlyTheRequestedPatient_InsideTheTokenTenant()
    {
        await using var db = CreateDb();
        var patientA = Guid.NewGuid();
        var patientB = Guid.NewGuid();
        db.CoverageCases.AddRange(
            Seed(TenantId, patientA, "CC-A1", Guid.NewGuid()),
            Seed(TenantId, patientA, "CC-A2", Guid.NewGuid()),
            Seed(TenantId, patientB, "CC-B1", null),
            Seed(OtherTenantId, patientA, "CC-OTHER-TENANT", null),
            Seed(TenantId, patientA, "CC-DELETED", null, deleted: DateTime.UtcNow));
        await db.SaveChangesAsync();
        var fn = Functions(db, CreateJwt());

        var response = await fn.ByPatient(Request(Token("ccms.coverage_case.read")), patientA);
        var numbers = await CaseNumbers(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new[] { "CC-A1", "CC-A2" }, numbers.OrderBy(n => n).ToArray());
        Assert.DoesNotContain("CC-B1", numbers);
        Assert.DoesNotContain("CC-OTHER-TENANT", numbers);
        Assert.DoesNotContain("CC-DELETED", numbers);
    }

    [Fact]
    public async Task DifferentPatient_DoesNotReturnAnotherPatientsCases()
    {
        await using var db = CreateDb();
        var patientA = Guid.NewGuid();
        var patientB = Guid.NewGuid();
        db.CoverageCases.Add(Seed(TenantId, patientB, "CC-B-ONLY", null));
        await db.SaveChangesAsync();
        var fn = Functions(db, CreateJwt());

        var response = await fn.ByPatient(Request(Token("ccms.coverage_case.read")), patientA);
        var json = await ReadJson(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(0, json.RootElement.GetProperty("cases").GetArrayLength());
    }

    [Fact]
    public async Task StoredBranchId_IsNotAQueryPredicate()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var branchA = Guid.NewGuid();
        var branchB = Guid.NewGuid();
        db.CoverageCases.AddRange(
            Seed(TenantId, patientId, "CC-BR-A", branchA),
            Seed(TenantId, patientId, "CC-BR-B", branchB),
            Seed(TenantId, patientId, "CC-BR-NULL", null));
        await db.SaveChangesAsync();
        var fn = Functions(db, CreateJwt());

        var numbers = await CaseNumbers(await fn.ByPatient(Request(Token("ccms.coverage_case.read")), patientId));

        Assert.Equal(new[] { "CC-BR-A", "CC-BR-B", "CC-BR-NULL" }, numbers.OrderBy(n => n).ToArray());
    }

    [Fact]
    public async Task ExistingList_StillReturnsEveryPatientInTheTenant()
    {
        await using var db = CreateDb();
        var patientA = Guid.NewGuid();
        var patientB = Guid.NewGuid();
        db.CoverageCases.AddRange(
            Seed(TenantId, patientA, "CC-LIST-A", null),
            Seed(TenantId, patientB, "CC-LIST-B", null));
        await db.SaveChangesAsync();
        var fn = Functions(db, CreateJwt());

        var listNumbers = await CaseNumbers(await fn.List(Request(Token("ccms.coverage_case.read"))));
        var patientNumbers = await CaseNumbers(await fn.ByPatient(Request(Token("ccms.coverage_case.read")), patientA));

        Assert.Equal(new[] { "CC-LIST-A", "CC-LIST-B" }, listNumbers.OrderBy(n => n).ToArray());
        Assert.Equal(new[] { "CC-LIST-A" }, patientNumbers);
    }

    [Fact]
    public async Task PatientRead_DoesNotUseWorkspace()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.CoverageCases.Add(Seed(TenantId, patientId, "CC-NO-WS", null));
        await db.SaveChangesAsync();
        var fn = Functions(db, CreateJwt());

        var response = await fn.ByPatient(Request(Token("ccms.coverage_case.read")), patientId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new[] { "CC-NO-WS" }, await CaseNumbers(response));
    }

    [Fact]
    public async Task ByPatient_UsesServerPageWindow_AndCapsPageSize()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var older = Seed(TenantId, patientId, "CC-OLD", null);
        var newer = Seed(TenantId, patientId, "CC-NEW", null);
        older.CreatedAt = DateTime.UtcNow.AddMinutes(-2);
        newer.CreatedAt = DateTime.UtcNow;
        db.CoverageCases.AddRange(older, newer);
        await db.SaveChangesAsync();
        var fn = Functions(db, CreateJwt());
        var token = Token("ccms.coverage_case.read");

        var first = await ReadJson(await fn.ByPatient(Request(token, "?pageNumber=1&pageSize=1"), patientId));
        var second = await CaseNumbers(await fn.ByPatient(Request(token, "?pageNumber=2&pageSize=1"), patientId));
        var capped = await ReadJson(await fn.ByPatient(Request(token, "?pageSize=500"), patientId));
        var defaults = await ReadJson(await fn.ByPatient(Request(token), patientId));

        Assert.Equal("CC-NEW", first.RootElement.GetProperty("cases")[0].GetProperty("caseNumber").GetString());
        Assert.Equal(2, first.RootElement.GetProperty("totalCount").GetInt32());
        Assert.Equal(1, first.RootElement.GetProperty("pageSize").GetInt32());
        Assert.Equal(new[] { "CC-OLD" }, second);
        Assert.Equal(100, capped.RootElement.GetProperty("pageSize").GetInt32());
        Assert.Equal(2, capped.RootElement.GetProperty("cases").GetArrayLength());
        Assert.Equal(20, defaults.RootElement.GetProperty("pageSize").GetInt32());
    }

    private static CoverageCaseFunctions Functions(CcmsDbContext db, JwtService jwt) =>
        new(
            db is null ? null! : new CoverageCaseService(db, null!, null!, null!, NullLogger<CoverageCaseService>.Instance),
            null!,
            null!,
            jwt,
            null!,
            db!,
            NullLogger<CoverageCaseFunctions>.Instance);

    private static CcmsCoverageCase Seed(
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

    private static async Task<List<string>> CaseNumbers(HttpResponseData response)
    {
        var json = await ReadJson(response);
        return json.RootElement.GetProperty("cases").EnumerateArray()
            .Select(item => item.GetProperty("caseNumber").GetString()!)
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
            "http://localhost/ccms/coverage-cases/by-patient" + (query ?? ""),
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
