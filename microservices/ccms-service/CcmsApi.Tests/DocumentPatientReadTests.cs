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
/// Patient-id CCMS document metadata read. Permission is ccms.document.read.
/// Tenant scope matches the coverage-case patient read. No branch predicate.
/// The response does not include blob URLs or signed access URLs.
/// </summary>
public class DocumentPatientReadTests
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
    public async Task ClaimRead_DoesNotAuthorize_BeforeDataLoad()
    {
        var fn = Functions(null, CreateJwt());

        var response = await fn.ByPatient(Request(Token("ccms.claim.read")), Guid.NewGuid());

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
    public async Task DocumentContent_WithoutPermission_DoesNotOpenBlob()
    {
        var fn = Functions(null, CreateJwt());

        var response = await fn.GetDocumentContent(Request(Token()), Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task DocumentRead_Authorizes_EmptyPatient_AsEmptyCollection()
    {
        await using var db = CreateDb();
        var fn = Functions(db, CreateJwt());

        var response = await fn.ByPatient(Request(Token("ccms.document.read")), Guid.NewGuid());
        var json = await ReadJson(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(0, json.RootElement.GetProperty("totalCount").GetInt32());
        Assert.Equal(0, json.RootElement.GetProperty("documents").GetArrayLength());
    }

    [Fact]
    public async Task ReturnsOnlyThatPatientsDocuments_InsideTheTokenTenant_WithoutBlobFields()
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
        db.Documents.AddRange(
            Doc(TenantId, caseA1.Id, "a1.pdf", created: DateTime.UtcNow.AddMinutes(-2)),
            Doc(TenantId, caseA2.Id, "a2.pdf", created: DateTime.UtcNow),
            Doc(TenantId, caseA1.Id, "deleted.pdf", deleted: DateTime.UtcNow),
            Doc(TenantId, caseB.Id, "b.pdf"),
            Doc(OtherTenantId, otherCase.Id, "other-tenant.pdf"),
            Doc(TenantId, deletedCase.Id, "on-deleted-case.pdf"),
            Doc(OtherTenantId, caseA1.Id, "tenant-mismatch.pdf"));
        await db.SaveChangesAsync();
        var fn = Functions(db, CreateJwt());

        var response = await fn.ByPatient(Request(Token("ccms.document.read")), patientA);
        var json = await ReadJson(response);
        var names = Names(json);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new[] { "a2.pdf", "a1.pdf" }, names);
        var body = json.RootElement.GetRawText();
        Assert.DoesNotContain("blob.example", body);
        Assert.False(json.RootElement.GetProperty("documents")[0].TryGetProperty("accessUrl", out _));
        Assert.False(json.RootElement.GetProperty("documents")[0].TryGetProperty("blobUrl", out _));
        Assert.False(json.RootElement.GetProperty("documents")[0].TryGetProperty("url", out _));
        Assert.Equal("preauth", json.RootElement.GetProperty("documents")[0].GetProperty("documentCategory").GetString());
        Assert.Equal("active", json.RootElement.GetProperty("documents")[0].GetProperty("status").GetString());
    }

    [Fact]
    public async Task DifferentPatient_DoesNotReturnAnotherPatientsDocuments()
    {
        await using var db = CreateDb();
        var patientA = Guid.NewGuid();
        var patientB = Guid.NewGuid();
        var caseB = Case(TenantId, patientB, "CC-B", null);
        db.CoverageCases.Add(caseB);
        db.Documents.Add(Doc(TenantId, caseB.Id, "b-only.pdf"));
        await db.SaveChangesAsync();
        var fn = Functions(db, CreateJwt());

        var response = await fn.ByPatient(Request(Token("ccms.document.read")), patientA);
        var json = await ReadJson(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(0, json.RootElement.GetProperty("documents").GetArrayLength());
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
        db.Documents.AddRange(
            Doc(TenantId, branchA.Id, "br-a.pdf"),
            Doc(TenantId, branchB.Id, "br-b.pdf"),
            Doc(TenantId, noBranch.Id, "br-null.pdf"));
        await db.SaveChangesAsync();
        var fn = Functions(db, CreateJwt());

        var names = Names(await ReadJson(
            await fn.ByPatient(Request(Token("ccms.document.read")), patientId)));

        Assert.Equal(new[] { "br-a.pdf", "br-b.pdf", "br-null.pdf" }, names.OrderBy(n => n).ToArray());
    }

    [Fact]
    public async Task OnePatientRequest_ReturnsDocumentsFromMultipleCases()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var first = Case(TenantId, patientId, "CC-1", null);
        var second = Case(TenantId, patientId, "CC-2", null);
        db.CoverageCases.AddRange(first, second);
        db.Documents.AddRange(
            Doc(TenantId, first.Id, "first.pdf"),
            Doc(TenantId, second.Id, "second.pdf"));
        await db.SaveChangesAsync();
        var fn = Functions(db, CreateJwt());

        var response = await fn.ByPatient(Request(Token("ccms.document.read")), patientId);
        var json = await ReadJson(response);

        Assert.Equal(2, json.RootElement.GetProperty("totalCount").GetInt32());
        Assert.Equal(2, json.RootElement.GetProperty("documents").GetArrayLength());
    }

    [Fact]
    public async Task ExistingCaseDocumentList_StillReturnsStorageFields()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var coverageCase = Case(TenantId, patientId, "CC-EXISTING", null);
        db.CoverageCases.Add(coverageCase);
        db.Documents.Add(Doc(TenantId, coverageCase.Id, "existing.pdf"));
        await db.SaveChangesAsync();
        var fn = Functions(db, CreateJwt());

        var response = await fn.GetForCase(Request(Token("ccms.document.read")), coverageCase.Id);
        var json = await ReadJson(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(JsonValueKind.Array, json.RootElement.ValueKind);
        Assert.Equal("existing.pdf", json.RootElement[0].GetProperty("fileName").GetString());
        Assert.True(json.RootElement[0].TryGetProperty("url", out _));
        Assert.True(json.RootElement[0].TryGetProperty("accessUrl", out _));
    }

    [Fact]
    public async Task ByPatient_UsesServerPageWindow_AndCapsPageSize_WithoutBlobFields()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var coverageCase = Case(TenantId, patientId, "CC-PAGE", null);
        db.CoverageCases.Add(coverageCase);
        db.Documents.AddRange(
            Doc(TenantId, coverageCase.Id, "older.pdf", created: DateTime.UtcNow.AddMinutes(-2)),
            Doc(TenantId, coverageCase.Id, "newer.pdf", created: DateTime.UtcNow));
        await db.SaveChangesAsync();
        var fn = Functions(db, CreateJwt());
        var token = Token("ccms.document.read");

        var first = await ReadJson(await fn.ByPatient(Request(token, "?pageNumber=1&pageSize=1"), patientId));
        var second = Names(await ReadJson(await fn.ByPatient(Request(token, "?pageNumber=2&pageSize=1"), patientId)));
        var capped = await ReadJson(await fn.ByPatient(Request(token, "?pageSize=500"), patientId));
        var defaults = await ReadJson(await fn.ByPatient(Request(token), patientId));
        var serialized = first.RootElement.GetRawText();

        Assert.Equal("newer.pdf", first.RootElement.GetProperty("documents")[0].GetProperty("documentName").GetString());
        Assert.Equal(2, first.RootElement.GetProperty("totalCount").GetInt32());
        Assert.Equal(1, first.RootElement.GetProperty("pageSize").GetInt32());
        Assert.Equal(new[] { "older.pdf" }, second);
        Assert.Equal(100, capped.RootElement.GetProperty("pageSize").GetInt32());
        Assert.Equal(2, capped.RootElement.GetProperty("documents").GetArrayLength());
        Assert.Equal(20, defaults.RootElement.GetProperty("pageSize").GetInt32());
        Assert.DoesNotContain("blobUrl", serialized, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("accessUrl", serialized, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("filePath", serialized, StringComparison.OrdinalIgnoreCase);
    }

    private static DocumentFunctions Functions(CcmsDbContext? db, JwtService jwt) =>
        new(
            db is null
                ? null!
                : new DocumentEngineService(
                    db,
                    new ConfigurationBuilder().Build(),
                    NullLogger<DocumentEngineService>.Instance),
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

    private static CcmsDocument Doc(
        Guid tenantId,
        Guid caseId,
        string name,
        DateTime? created = null,
        DateTime? deleted = null) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CoverageCase_Id = caseId,
            DocumentCategory = "preauth",
            DocumentType = "clinical_note",
            DocumentName = name,
            BlobUrl = "https://blob.example/ccms-documents/" + name,
            FileSizeBytes = 2048,
            MimeType = "application/pdf",
            UploadedAt = created ?? DateTime.UtcNow,
            Status = "active",
            CreatedAt = created ?? DateTime.UtcNow,
            UpdatedAt = created ?? DateTime.UtcNow,
            DeletedAt = deleted,
        };

    private static List<string> Names(JsonDocument json) =>
        json.RootElement.GetProperty("documents").EnumerateArray()
            .Select(item => item.GetProperty("documentName").GetString()!)
            .ToList();

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
            "http://localhost/ccms/documents/by-patient" + (query ?? ""),
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
