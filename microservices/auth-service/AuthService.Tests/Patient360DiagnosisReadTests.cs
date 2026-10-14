using System.Security.Claims;
using System.Text.Json;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models.Domain;
using AuthService.SeedData;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

public class Patient360DiagnosisReadTests
{
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid PatientId = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly Guid OtherPatientId = Guid.Parse("55555555-5555-5555-5555-555555555555");
    private static readonly Guid ProviderId = Guid.Parse("66666666-6666-6666-6666-666666666666");
    private static readonly JsonSerializerOptions Camel = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private static readonly string[] DeniedRoles =
    {
        "PHARMACIST",
        "PHARMACY MANAGER",
        "PHARMACY TECHNICIAN",
        "BILLING CLERK",
        "CASHIER",
        "FINANCE",
        "TPA EXECUTIVE",
        "IP COORDINATOR",
        "OT COORDINATOR",
        "RECEPTIONIST",
        "OPTICAL MANAGER",
        "LAB MANAGER",
        "LAB TECHNICIAN",
        "RADIOLOGY TECHNICIAN",
    };

    [Fact]
    public void Endpoint_RequiresPatient360DiagnosisRead_AndLeavesTheLegacyRouteAlone()
    {
        var method = typeof(Patient360DiagnosisController).GetMethod(nameof(Patient360DiagnosisController.GetPatient360CodedDiagnoses));
        var permission = Assert.Single(method!.GetCustomAttributes(typeof(RequirePermissionAttribute), false).Cast<RequirePermissionAttribute>());
        var route = Assert.Single(method.GetCustomAttributes(typeof(HttpGetAttribute), false).Cast<HttpGetAttribute>());
        Assert.Equal("patient360.diagnosis.read", permission.PermissionCode);
        Assert.Equal("patients/{patientId:guid}/patient-360", route.Template);
        foreach (var substitute in new[]
        {
            "patient.view", "examination.view", "prescription.read",
            "clinical_documentation.diagnosis.read", "counseling_sessions.read",
            "ip.view", "bill.view",
        })
            Assert.NotEqual(substitute, permission.PermissionCode);

        var legacy = File.ReadAllText(Path.Combine(FindRepoRoot(), "microservices", "auth-service", "AuthService", "Controllers", "DiagnosesController.cs"));
        Assert.Contains("[HttpGet(\"patient/{patientId}\")]", legacy);
        Assert.DoesNotContain("patient360.diagnosis.read", legacy);
        Assert.DoesNotContain("patients/{patientId:guid}/patient-360", legacy);
    }

    [Fact]
    public void GrantMatrix_MatchesTheApprovedThirteenRoles()
    {
        Assert.Equal(
            new[]
            {
                "ADMIN", "CONSULTANT", "DOCTOR", "SENIOR DOCTOR", "NURSE", "SENIOR NURSE",
                "NURSE MANAGER", "SURGEON", "JUNIOR DOCTOR", "ANAESTHETIST", "COUNSELLOR",
                "RADIOLOGIST", "MEDICAL RECORDS OFFICER",
            },
            Patient360DiagnosisReadPermissionCatalog.ApprovedRoleNormalizedNames);
        foreach (var denied in DeniedRoles)
            Assert.DoesNotContain(denied, Patient360DiagnosisReadPermissionCatalog.ApprovedRoleNormalizedNames);
    }

    [Fact]
    public async Task DiagnosisRead_AllowsTheRead_AndSubstitutesDoNot()
    {
        Assert.True(await Authorize("patient360.diagnosis.read"));
        Assert.False(await Authorize("patient.view"));
        Assert.False(await Authorize("clinical_documentation.diagnosis.read"));
        Assert.False(await Authorize("examination.view"));
        Assert.False(await Authorize(""));
        Assert.True(await Authorize("*"));
    }

    [Fact]
    public async Task MissingOrMalformedTenant_IsUnauthorized_NotAnEmptyPage()
    {
        await using var db = CreateDb();
        db.Patients.Add(Patient(TenantId, PatientId));
        await db.SaveChangesAsync();

        Assert.IsType<UnauthorizedObjectResult>(await Controller(db, tenant: null).GetPatient360CodedDiagnoses(PatientId));
        Assert.IsType<UnauthorizedObjectResult>(await Controller(db, tenant: "not-a-guid").GetPatient360CodedDiagnoses(PatientId));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            Service(db).ListAsync(Guid.Empty, UserId, PatientId, 1, 20));
    }

    [Fact]
    public async Task ForeignAndDeletedPatients_AreNotFound()
    {
        await using var db = CreateDb();
        db.Patients.Add(Patient(OtherTenantId, PatientId));
        db.Patients.Add(Patient(TenantId, OtherPatientId, deleted: true));
        var code = Code(OtherTenantId, "H25.011");
        db.DiagnosisCodes.Add(code);
        db.PatientDiagnoses.Add(Row(OtherTenantId, PatientId, code, "primary", new DateTime(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc)));
        await db.SaveChangesAsync();

        Assert.IsType<NotFoundObjectResult>(await Controller(db, TenantId.ToString()).GetPatient360CodedDiagnoses(PatientId));
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            Service(db).ListAsync(TenantId, UserId, OtherPatientId, 1, 20));
    }

    [Fact]
    public async Task ReturnsAllowListedCodedRows_AndExcludesMismatches()
    {
        await using var db = CreateDb();
        var patient = Patient(TenantId, PatientId);
        patient.BranchId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        db.Patients.Add(patient);
        db.Patients.Add(Patient(TenantId, OtherPatientId));

        var code = Code(TenantId, "H25.011", "Cortical cataract", "OD");
        var otherCode = Code(OtherTenantId, "H40.111", "Foreign glaucoma", "OS");
        var deletedCode = Code(TenantId, "H52.01", "Deleted code", "OU");
        deletedCode.DeletedAt = DateTime.UtcNow;
        db.DiagnosisCodes.AddRange(code, otherCode, deletedCode);

        var day = new DateTime(2026, 8, 2, 10, 0, 0, DateTimeKind.Utc);
        var newer = Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff");
        var older = Guid.Parse("00000000-0000-0000-0000-000000000001");
        db.PatientDiagnoses.Add(Row(TenantId, PatientId, code, "rule-out", day, newer, eye: "OS"));
        db.PatientDiagnoses.Add(Row(TenantId, PatientId, code, "primary", day, older, eye: "OD"));
        db.PatientDiagnoses.Add(Row(TenantId, PatientId, code, "secondary", day.AddDays(-1)));
        db.PatientDiagnoses.Add(Row(TenantId, PatientId, code, "primary", day.AddDays(1), deleted: true));
        db.PatientDiagnoses.Add(Row(OtherTenantId, PatientId, otherCode, "primary", day.AddDays(2)));
        db.PatientDiagnoses.Add(Row(TenantId, PatientId, deletedCode, "primary", day.AddDays(3)));
        db.PatientDiagnoses.Add(Row(TenantId, OtherPatientId, code, "primary", day));
        await db.SaveChangesAsync();

        var page = await Service(db).ListAsync(TenantId, UserId, PatientId, 1, 20);
        Assert.Equal(3, page.TotalCount);
        Assert.Equal(new[] { newer, older }, page.Items.Take(2).Select(item => item.Id).ToArray());
        Assert.Equal("rule-out", page.Items[0].DiagnosisType);
        Assert.Equal("OS", page.Items[0].EyeSpecificity);
        Assert.Equal("OD", page.Items[0].CodeLaterality);
        Assert.Equal("H25.011", page.Items[0].Code);
        Assert.DoesNotContain(page.Items, item => item.Code == "H40.111" || item.Code == "H52.01");

        var json = JsonSerializer.Serialize(page, Camel);
        foreach (var absent in new[]
        {
            "secret-clinical-notes", "status", "superseded", "patientId", "tenantId",
            "diagnosedByUserId", "visitId", "examinationId", "billable", "clinicalNotes",
            "confirmed", "provisional", "provider",
        })
            Assert.DoesNotContain(absent, json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AuthorizedEmpty_WhenThePatientHasNoEligibleRows()
    {
        await using var db = CreateDb();
        db.Patients.Add(Patient(TenantId, PatientId));
        await db.SaveChangesAsync();

        var page = await Service(db).ListAsync(TenantId, UserId, PatientId, 1, 20);
        Assert.Empty(page.Items);
        Assert.Equal(0, page.TotalCount);
        Assert.Equal(1, page.PageNumber);
        Assert.Equal(20, page.PageSize);
    }

    [Fact]
    public async Task Paging_FiltersBeforeTheWindow_AndCapsAtOneHundred()
    {
        await using var db = CreateDb();
        db.Patients.Add(Patient(TenantId, PatientId));
        var code = Code(TenantId, "H25.011");
        var foreign = Code(OtherTenantId, "H40.111");
        db.DiagnosisCodes.AddRange(code, foreign);
        var day = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        for (var i = 0; i < 21; i++)
            db.PatientDiagnoses.Add(Row(TenantId, PatientId, code, "primary", day.AddMinutes(i)));
        db.PatientDiagnoses.Add(Row(TenantId, PatientId, code, "primary", day, deleted: true));
        db.PatientDiagnoses.Add(Row(TenantId, PatientId, foreign, "primary", day.AddDays(1)));
        await db.SaveChangesAsync();

        var first = await Service(db).ListAsync(TenantId, UserId, PatientId, 0, 0);
        Assert.Equal(21, first.TotalCount);
        Assert.Equal(20, first.PageSize);
        Assert.Equal(20, first.Items.Count);
        Assert.True(first.Items[0].DiagnosedAt > first.Items[1].DiagnosedAt);

        var second = await Service(db).ListAsync(TenantId, UserId, PatientId, 2, 20);
        Assert.Single(second.Items);

        var capped = await Service(db).ListAsync(TenantId, UserId, PatientId, 1, 500);
        Assert.Equal(100, capped.PageSize);
        Assert.Equal(21, capped.Items.Count);
    }

    [Fact]
    public async Task DatabaseFailure_IsNotAnEmptyPage()
    {
        var controller = new Patient360DiagnosisController(new BoomDiagnosisRead())
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                    {
                        new Claim(ClaimTypes.NameIdentifier, UserId.ToString()),
                        new Claim("TenantId", TenantId.ToString()),
                    }, "test")),
                },
            },
        };

        await Assert.ThrowsAsync<InvalidOperationException>(() => controller.GetPatient360CodedDiagnoses(PatientId));
    }

    [Fact]
    public void Read_StaysInsideCodedDiagnosis_AndDoesNotApplyABranchRule()
    {
        var root = FindRepoRoot();
        var service = File.ReadAllText(Path.Combine(root, "microservices", "auth-service", "AuthService", "Services", "Patient360DiagnosisReadService.cs"));
        Assert.DoesNotContain("FollowupBranchAccess", service);
        Assert.DoesNotContain("BranchId", service);
        Assert.DoesNotContain("ClinicalExamination", service);
        Assert.DoesNotContain("ExaminationDraft", service);
        Assert.DoesNotContain("Prescription", service);
        Assert.DoesNotContain("Counseling", service);
        Assert.DoesNotContain("Discharge", service);
        Assert.DoesNotContain("OpdDiagnosis", service);
        Assert.DoesNotContain(".Status", service);
        Assert.DoesNotContain("catch (Exception", File.ReadAllText(Path.Combine(
            root, "microservices", "auth-service", "AuthService", "Controllers", "Patient360DiagnosisController.cs")));
    }

    private sealed class BoomDiagnosisRead : IPatient360DiagnosisReadService
    {
        public Task<DTOs.Patient360CodedDiagnosisPageDto> ListAsync(
            Guid tenantId, Guid userId, Guid patientId, int pageNumber, int pageSize, CancellationToken cancellationToken = default)
            => throw new InvalidOperationException("database unavailable");
    }

    private static async Task<bool> Authorize(string permission)
    {
        var requirement = new PermissionRequirement("patient360.diagnosis.read");
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, UserId.ToString()),
            new("tenant_id", TenantId.ToString()),
        };
        if (!string.IsNullOrEmpty(permission))
            claims.Add(new Claim("permission", permission));
        var user = new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));
        var context = new AuthorizationHandlerContext(new[] { requirement }, user, null);
        await using var db = CreateDb();
        await new PermissionAuthorizationHandler(db).HandleAsync(context);
        return context.HasSucceeded;
    }

    private static Patient360DiagnosisController Controller(AppDbContext db, string? tenant)
    {
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, UserId.ToString()) };
        if (tenant != null)
            claims.Add(new Claim("TenantId", tenant));
        return new Patient360DiagnosisController(Service(db))
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test")),
                },
            },
        };
    }

    private static Patient360DiagnosisReadService Service(AppDbContext db) => new(db);

    private static Patient Patient(Guid tenantId, Guid id, bool deleted = false) => new()
    {
        Id = id,
        TenantId = tenantId,
        MedicalRecordNumber = "MRN-secret",
        FirstName = "Ada",
        LastName = "Lovelace",
        DateOfBirth = new DateTime(1980, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        Gender = "Female",
        DeletedAt = deleted ? DateTime.UtcNow : null,
    };

    private static DiagnosisCode Code(Guid tenantId, string code, string description = "Cortical cataract", string? laterality = "OD") => new()
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Code = code,
        Description = description,
        Category = "Cataract",
        Laterality = laterality,
        Billable = true,
        Status = "active",
    };

    private static PatientDiagnosis Row(
        Guid tenantId,
        Guid patientId,
        DiagnosisCode code,
        string type,
        DateTime when,
        Guid? id = null,
        string? eye = "OD",
        bool deleted = false) => new()
    {
        Id = id ?? Guid.NewGuid(),
        TenantId = tenantId,
        PatientId = patientId,
        DiagnosisCodeId = code.Id,
        VisitId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
        ExaminationId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"),
        DiagnosisType = type,
        EyeSpecificity = eye,
        DiagnosedAt = when,
        DiagnosedByUserId = ProviderId,
        ClinicalNotes = "secret-clinical-notes",
        Status = "superseded",
        DeletedAt = deleted ? when : null,
    };

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AppDbContext(options, new HttpContextAccessor());
    }

    private static string FindRepoRoot([System.Runtime.CompilerServices.CallerFilePath] string sourceFile = "")
    {
        foreach (var start in new[] { AppContext.BaseDirectory, Path.GetDirectoryName(sourceFile) })
        {
            if (string.IsNullOrEmpty(start)) continue;
            var dir = new DirectoryInfo(start);
            while (dir != null)
            {
                if (Directory.Exists(Path.Combine(dir.FullName, "microservices"))
                    && Directory.Exists(Path.Combine(dir.FullName, "consolidated")))
                    return dir.FullName;
                dir = dir.Parent;
            }
        }

        throw new DirectoryNotFoundException("Repository root was not found.");
    }
}
