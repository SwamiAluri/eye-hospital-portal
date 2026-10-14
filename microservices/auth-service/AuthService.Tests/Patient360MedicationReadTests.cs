using System.Security.Claims;
using System.Text.Json;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Models.Prescription;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

public class Patient360MedicationReadTests
{
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid PatientId = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly Guid OtherPatientId = Guid.Parse("55555555-5555-5555-5555-555555555555");
    private static readonly Guid DoctorId = Guid.Parse("66666666-6666-6666-6666-666666666666");
    private static readonly JsonSerializerOptions Camel = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    [Fact]
    public void Endpoint_RequiresPatient360MedicationRead()
    {
        var method = typeof(Patient360MedicationController).GetMethod(nameof(Patient360MedicationController.GetPatient360Medications));
        var permission = Assert.Single(method!.GetCustomAttributes(typeof(RequirePermissionAttribute), false).Cast<RequirePermissionAttribute>());
        var route = Assert.Single(method.GetCustomAttributes(typeof(HttpGetAttribute), false).Cast<HttpGetAttribute>());
        Assert.Equal("patient360.medication.read", permission.PermissionCode);
        Assert.Equal("patients/{patientId:guid}/patient-360", route.Template);
        foreach (var substitute in new[]
        {
            "patient.view", "prescription.read", "prescription.create", "prescription.update",
            "prescription.delete", "prescription.print", "prescription.dispense",
            "medication.search", "medication.admin", "postopcare.read",
            "ward.checklist.edit", "anaesthesia.pac.edit",
        })
            Assert.NotEqual(substitute, permission.PermissionCode);
    }

    [Fact]
    public async Task MedicationRead_AllowsTheRead_AndSubstitutesDoNot()
    {
        Assert.True(await Authorize("patient360.medication.read"));
        Assert.False(await Authorize("patient.view"));
        Assert.False(await Authorize("prescription.read"));
        Assert.False(await Authorize("prescription.dispense"));
        Assert.False(await Authorize("medication.search"));
        Assert.False(await Authorize("ward.checklist.edit"));
        Assert.False(await Authorize(""));
        Assert.True(await Authorize("*"));
    }

    [Fact]
    public async Task MissingOrMalformedTenant_IsUnauthorized_NotAnEmptyPage()
    {
        await using var db = CreateDb();
        db.Patients.Add(Patient(TenantId, PatientId));
        await db.SaveChangesAsync();

        Assert.IsType<UnauthorizedObjectResult>(await Controller(db, tenant: null).GetPatient360Medications(PatientId));
        Assert.IsType<UnauthorizedObjectResult>(await Controller(db, tenant: "not-a-guid").GetPatient360Medications(PatientId));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            Service(db).ListAsync(Guid.Empty, UserId, PatientId, 1, 20));
    }

    [Fact]
    public async Task ForeignAndDeletedPatients_AreNotFound()
    {
        await using var db = CreateDb();
        db.Patients.Add(Patient(OtherTenantId, PatientId));
        db.Patients.Add(Patient(TenantId, OtherPatientId, deleted: true));
        db.Prescriptions.Add(Rx(OtherTenantId, PatientId, "active", new DateTime(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc)));
        await db.SaveChangesAsync();

        Assert.IsType<NotFoundObjectResult>(await Controller(db, TenantId.ToString()).GetPatient360Medications(PatientId));
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            Service(db).ListAsync(TenantId, UserId, OtherPatientId, 1, 20));
    }

    [Fact]
    public async Task ReturnsAllowListedHistory_AndExcludesForeignDeletedAndUnknownStates()
    {
        await using var db = CreateDb();
        var patient = Patient(TenantId, PatientId);
        patient.BranchId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        db.Patients.Add(patient);
        db.Patients.Add(Patient(TenantId, OtherPatientId));

        var sameDayNewer = Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff");
        var sameDayOlder = Guid.Parse("00000000-0000-0000-0000-000000000001");
        var day = new DateTime(2026, 8, 2, 10, 0, 0, DateTimeKind.Utc);
        db.Prescriptions.Add(Rx(TenantId, PatientId, "completed", day, sameDayNewer));
        db.Prescriptions.Add(Rx(TenantId, PatientId, "active", day, sameDayOlder));
        db.Prescriptions.Add(Rx(TenantId, PatientId, "cancelled", day.AddDays(-1)));
        db.Prescriptions.Add(Rx(TenantId, PatientId, "expired", day.AddDays(1)));
        db.Prescriptions.Add(Rx(TenantId, PatientId, "active", day.AddDays(2), deleted: true));
        db.Prescriptions.Add(Rx(TenantId, OtherPatientId, "active", day));
        db.Prescriptions.Add(Rx(OtherTenantId, PatientId, "active", day));
        var droppedLine = Rx(TenantId, PatientId, "active", day.AddDays(3));
        droppedLine.Medications.Single().DeletedAt = DateTime.UtcNow;
        db.Prescriptions.Add(droppedLine);
        await db.SaveChangesAsync();

        var page = await Service(db).ListAsync(TenantId, UserId, PatientId, 1, 20);
        Assert.Equal(3, page.TotalCount);
        Assert.Equal(new[] { sameDayNewer, sameDayOlder }, page.Items.Take(2).Select(item => item.Id).ToArray());
        Assert.Equal("cancelled", page.Items[2].Status);
        Assert.DoesNotContain(page.Items, item => item.Status == "expired");

        var json = JsonSerializer.Serialize(page, Camel);
        Assert.Contains("timolol", json, StringComparison.OrdinalIgnoreCase);
        foreach (var absent in new[]
        {
            "secret-diagnosis", "secret-note", "secret-instructions", "secret-pharmacy", "secret-contact",
            "patientId", "tenantId", "doctorId", "doctorName", "dispensedBy", "pharmacyName",
            "diagnosis", "notes", "instructions", "centralThickness", "mrp", "discount", "barcode", "Ada",
        })
            Assert.DoesNotContain(absent, json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AuthorizedEmpty_WhenThePatientHasNoEligibleLines()
    {
        await using var db = CreateDb();
        db.Patients.Add(Patient(TenantId, PatientId));
        await db.SaveChangesAsync();

        var page = await Service(db).ListAsync(TenantId, UserId, PatientId, 1, 20);
        Assert.Empty(page.Items);
        Assert.Equal(0, page.TotalCount);
        Assert.Equal(20, page.PageSize);
    }

    [Fact]
    public async Task Paging_FiltersBeforeTheWindow_AndCapsAtOneHundred()
    {
        await using var db = CreateDb();
        db.Patients.Add(Patient(TenantId, PatientId));
        var day = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        for (var i = 0; i < 21; i++)
            db.Prescriptions.Add(Rx(TenantId, PatientId, "active", day.AddMinutes(i)));
        db.Prescriptions.Add(Rx(TenantId, PatientId, "active", day, deleted: true));
        db.Prescriptions.Add(Rx(TenantId, PatientId, "expired", day));
        await db.SaveChangesAsync();

        var first = await Service(db).ListAsync(TenantId, UserId, PatientId, 0, 0);
        Assert.Equal(21, first.TotalCount);
        Assert.Equal(20, first.PageSize);
        Assert.Equal(20, first.Items.Count);

        var second = await Service(db).ListAsync(TenantId, UserId, PatientId, 2, 20);
        Assert.Single(second.Items);

        var capped = await Service(db).ListAsync(TenantId, UserId, PatientId, 1, 500);
        Assert.Equal(100, capped.PageSize);
        Assert.Equal(21, capped.Items.Count);
    }

    [Fact]
    public void OperationalPrescriptionRoutes_AndBranchRule_StayOutOfThisSlice()
    {
        var root = FindRepoRoot();
        var operational = File.ReadAllText(Path.Combine(root, "microservices", "auth-service", "AuthService", "Controllers", "PrescriptionsController.cs"));
        Assert.Contains("[HttpGet(\"patient/{patientId}\")]", operational);
        Assert.Contains("prescription.read", operational);
        Assert.DoesNotContain("patient360.medication.read", operational);
        Assert.DoesNotContain("patients/{patientId:guid}/patient-360", operational);

        var service = File.ReadAllText(Path.Combine(root, "microservices", "auth-service", "AuthService", "Services", "Patient360MedicationReadService.cs"));
        Assert.DoesNotContain("FollowupBranchAccess", service);
        Assert.DoesNotContain("ResolveEffectiveBranch", service);
        Assert.DoesNotContain("BranchId", service);
        Assert.DoesNotContain("PharmacyBill", service);
        Assert.DoesNotContain("PostOpMedication", service);
        Assert.DoesNotContain("catch (Exception", File.ReadAllText(Path.Combine(
            root, "microservices", "auth-service", "AuthService", "Controllers", "Patient360MedicationController.cs")));
    }

    private static async Task<bool> Authorize(string permission)
    {
        var requirement = new PermissionRequirement("patient360.medication.read");
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

    private static Patient360MedicationController Controller(AppDbContext db, string? tenant)
    {
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, UserId.ToString()) };
        if (tenant != null)
            claims.Add(new Claim("TenantId", tenant));
        return new Patient360MedicationController(Service(db))
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

    private static Patient360MedicationReadService Service(AppDbContext db) => new(db);

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

    private static Prescription Rx(Guid tenantId, Guid patientId, string status, DateTime when, Guid? id = null, bool deleted = false)
    {
        var prescriptionId = id ?? Guid.NewGuid();
        return new Prescription
        {
            Id = prescriptionId,
            TenantId = tenantId,
            PatientId = patientId,
            DoctorId = DoctorId,
            PrescriptionDate = when,
            Diagnosis = "secret-diagnosis",
            Instructions = "secret-instructions",
            Notes = "secret-note",
            Status = status,
            PharmacyName = "secret-pharmacy",
            PharmacyContact = "secret-contact",
            DispensedDate = when,
            DispensedByUserId = DoctorId,
            DeletedAt = deleted ? when : null,
            Medications =
            {
                new PrescriptionMedication
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PrescriptionId = prescriptionId,
                    MedicationName = "Timolol",
                    GenericName = "Timolol maleate",
                    Dosage = "0.5%",
                    Form = "eye drops",
                    Route = "ocular",
                    Frequency = "BD",
                    DurationDays = 30,
                    Quantity = 1,
                    Instructions = "secret-line-instructions",
                    StartDate = when.Date,
                    EndDate = when.Date.AddDays(30),
                },
            },
        };
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AppDbContext(options, new HttpContextAccessor());
    }

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            if (Directory.Exists(Path.Combine(dir.FullName, "microservices")))
                return dir.FullName;
            dir = dir.Parent;
        }

        throw new DirectoryNotFoundException("Repository root was not found.");
    }
}
