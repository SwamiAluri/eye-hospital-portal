using System.Reflection;
using System.Security.Claims;
using System.Text.RegularExpressions;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models.Domain;
using AuthService.Models.Domain.Dtos;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

public class PatientMrnUpdateIntegrityTests
{
    private static readonly Guid TenantId = Guid.Parse("155fe198-6ae5-4a01-9254-ead5b427247e");
    private static readonly Guid OtherTenantId = Guid.Parse("266fe198-6ae5-4a01-9254-ead5b427247e");
    private static readonly Guid UserId = Guid.Parse("48a94c56-ccb2-49c0-9916-bee2703b0251");
    private static readonly Guid PatientId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid BranchId = Guid.Parse("74c014cf-9570-4824-bdf9-b369ea11a8f4");
    private const string PersistedMrn = "MRN-2024-01-ABCDE";

    [Fact]
    public async Task Create_generates_mrn_on_the_server()
    {
        Patient? created = null;
        var patients = new Mock<IPatientService>();
        patients.Setup(p => p.CreatePatientAsync(It.IsAny<Patient>()))
            .Callback<Patient>(p => created = p)
            .ReturnsAsync((Patient p) => p);
        var controller = CreateController(patients.Object, NoDuplicates());
        SignIn(controller);

        var result = await controller.CreatePatient(SampleRequest());

        Assert.IsType<CreatedAtActionResult>(result.Result);
        Assert.NotNull(created);
        Assert.Matches(new Regex(@"^MRN-\d{4}-\d{2}-[A-F0-9]{5}$"), created!.MedicalRecordNumber);
        Assert.NotEqual(PersistedMrn, created.MedicalRecordNumber);
        Assert.Null(typeof(CreatePatientRequest).GetProperty("MedicalRecordNumber"));
    }

    [Fact]
    public async Task Update_keeps_persisted_mrn_and_id_and_applies_existing_fields()
    {
        var stored = StoredPatient();
        Patient? saved = null;
        var patients = new Mock<IPatientService>();
        patients.Setup(p => p.GetPatientByIdAsync(PatientId, TenantId)).ReturnsAsync(stored);
        patients.Setup(p => p.UpdatePatientAsync(It.IsAny<Patient>()))
            .Callback<Patient>(p => saved = p)
            .ReturnsAsync((Patient p) => p);
        var controller = CreateController(patients.Object, NoDuplicates());
        SignIn(controller);

        var request = SampleUpdate(firstName: "Updated");
        var result = await controller.UpdatePatient(PatientId, request);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var body = Assert.IsType<PatientResponse>(ok.Value);
        Assert.Equal(PersistedMrn, body.MedicalRecordNumber);
        Assert.Equal(PatientId, body.Id);
        Assert.Equal("Updated", body.FirstName);
        Assert.NotNull(saved);
        Assert.Equal(PersistedMrn, saved!.MedicalRecordNumber);
        Assert.Equal(PatientId, saved.Id);
        Assert.Equal(TenantId, saved.TenantId);
        Assert.Equal(BranchId, saved.BranchId);
        Assert.Equal("Updated", saved.FirstName);
        Assert.Equal("Kept", saved.LastName);
        Assert.Equal("new@example.com", saved.Email);
        Assert.Equal("Keep Contact", saved.EmergencyContactName);
        Assert.Equal("https://photo", saved.PhotoUrl);
        Assert.Equal("Active", saved.Status);
    }

    [Fact]
    public void Update_request_does_not_accept_a_client_mrn()
    {
        Assert.Null(typeof(UpdatePatientRequest).GetProperty("MedicalRecordNumber"));
        Assert.Null(typeof(CreatePatientRequest).GetProperty("MedicalRecordNumber"));
    }

    [Fact]
    public async Task Update_does_not_replace_mrn_when_caller_entity_supplies_another_or_empty_value()
    {
        await using var db = CreateDb();
        var createdAt = new DateTime(2024, 1, 2, 0, 0, 0, DateTimeKind.Utc);
        db.Patients.Add(StoredPatient(createdAt));
        await db.SaveChangesAsync();
        var service = new PatientService(db, NullLogger<PatientService>.Instance);

        var replaced = await service.UpdatePatientAsync(new Patient
        {
            Id = PatientId,
            TenantId = TenantId,
            MedicalRecordNumber = "MRN-CLIENT-OVERRIDE",
            FirstName = "After",
            LastName = "Kept",
            DateOfBirth = new DateTime(1990, 5, 1),
            Gender = "Female",
            Email = "after@example.com",
        });
        Assert.NotNull(replaced);
        Assert.Equal(PersistedMrn, replaced!.MedicalRecordNumber);
        Assert.Equal(PatientId, replaced.Id);
        Assert.Equal("After", replaced.FirstName);
        Assert.Equal("after@example.com", replaced.Email);

        var cleared = await service.UpdatePatientAsync(new Patient
        {
            Id = PatientId,
            TenantId = TenantId,
            MedicalRecordNumber = "",
            FirstName = "After",
            LastName = "Kept",
            DateOfBirth = new DateTime(1990, 5, 1),
            Gender = "Female",
        });
        Assert.NotNull(cleared);
        Assert.Equal(PersistedMrn, cleared!.MedicalRecordNumber);
        Assert.Equal(PatientId, cleared.Id);
        Assert.NotEqual("", cleared.MedicalRecordNumber);
    }

    [Fact]
    public async Task Update_without_tenant_is_unauthorized()
    {
        var patients = new Mock<IPatientService>();
        var controller = CreateController(patients.Object, NoDuplicates());
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity()) },
        };

        var result = await controller.UpdatePatient(PatientId, SampleUpdate("Sam"));

        Assert.IsType<UnauthorizedResult>(result.Result);
        patients.Verify(p => p.UpdatePatientAsync(It.IsAny<Patient>()), Times.Never);
    }

    [Fact]
    public void Update_keeps_patient_update_permission()
    {
        var method = typeof(PatientsController).GetMethod(nameof(PatientsController.UpdatePatient));
        var perm = method!.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.Equal("patient.update", perm!.PermissionCode);
    }

    [Fact]
    public async Task Update_does_not_load_or_write_another_tenants_patient()
    {
        var patients = new Mock<IPatientService>();
        patients.Setup(p => p.GetPatientByIdAsync(PatientId, TenantId)).ReturnsAsync((Patient?)null);
        var controller = CreateController(patients.Object, NoDuplicates());
        SignIn(controller);

        var result = await controller.UpdatePatient(PatientId, SampleUpdate("Sam"));

        Assert.IsType<NotFoundResult>(result.Result);
        patients.Verify(p => p.GetPatientByIdAsync(PatientId, OtherTenantId), Times.Never);
        patients.Verify(p => p.UpdatePatientAsync(It.IsAny<Patient>()), Times.Never);
    }

    [Fact]
    public void Mrn_lookup_index_stays_tenant_scoped_and_non_unique()
    {
        var text = File.ReadAllText(FindAuthServiceFile(
            Path.Combine("Data", "Migrations", "20260616120000_AddPatientHubTables.cs")));
        Assert.Contains("CREATE INDEX IF NOT EXISTS ix_patients_tenant_mrn", text);
        Assert.Contains("ON patient (tenant_id, medical_record_number)", text);
        Assert.DoesNotContain("UNIQUE INDEX IF NOT EXISTS ix_patients_tenant_mrn", text);

        var context = File.ReadAllText(FindAuthServiceFile(Path.Combine("Context", "AppDbContext.cs")));
        Assert.Contains("entity.Property(e => e.MedicalRecordNumber).HasColumnName(\"medical_record_number\");", context);
        Assert.DoesNotContain("MedicalRecordNumber }).IsUnique", context);
    }

    private static Patient StoredPatient(DateTime? createdAt = null) => new()
    {
        Id = PatientId,
        TenantId = TenantId,
        BranchId = BranchId,
        MedicalRecordNumber = PersistedMrn,
        FirstName = "Sam",
        LastName = "Kept",
        DateOfBirth = new DateTime(1990, 5, 1),
        Gender = "Female",
        Email = "old@example.com",
        EmergencyContactName = "Keep Contact",
        PhotoUrl = "https://photo",
        Status = "Active",
        CreatedAt = createdAt ?? new DateTime(2024, 1, 2, 0, 0, 0, DateTimeKind.Utc),
    };

    private static CreatePatientRequest SampleRequest() => new()
    {
        FirstName = "Sam",
        LastName = "Kept",
        DateOfBirth = new DateTime(1990, 5, 1),
        Gender = "Female",
        Email = "new@example.com",
        BranchId = BranchId,
    };

    private static UpdatePatientRequest SampleUpdate(string firstName) => new()
    {
        Id = PatientId,
        FirstName = firstName,
        LastName = "Kept",
        DateOfBirth = new DateTime(1990, 5, 1),
        Gender = "Female",
        Email = "new@example.com",
    };

    private static IPatientDuplicateDetectionService NoDuplicates()
    {
        var duplicates = new Mock<IPatientDuplicateDetectionService>();
        duplicates.Setup(d => d.CheckDuplicatesAsync(
                It.IsAny<DuplicateCheckRequest>(),
                It.IsAny<Guid>(),
                It.IsAny<Guid?>()))
            .ReturnsAsync(new DuplicateCheckResult());
        return duplicates.Object;
    }

    private static PatientsController CreateController(
        IPatientService patients,
        IPatientDuplicateDetectionService duplicates)
    {
        var branch = new Mock<IFollowupBranchAccessService>();
        branch.Setup(b => b.ResolveEffectiveBranchAsync(
                TenantId, UserId, BranchId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(BranchId);
        return new PatientsController(
            patientService: patients,
            blobStorageService: null!,
            configuration: null!,
            logger: null!,
            duplicateDetectionService: duplicates,
            patientLookupService: null!,
            patientOmniSearchService: null!,
            patientSummaryService: null!,
            patientSummaryPdfService: null!,
            auditService: new Mock<IAuditService>().Object,
            recentViewsService: null!,
            context: null!,
            branchAccess: branch.Object);
    }

    private static void SignIn(PatientsController controller)
    {
        var identity = new ClaimsIdentity(new[]
        {
            new Claim("TenantId", TenantId.ToString()),
            new Claim("sub", UserId.ToString()),
        }, "test");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) },
        };
    }

    private static string FindAuthServiceFile(string relativePath)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            var candidate = Path.Combine(dir.FullName, "AuthService", relativePath);
            if (File.Exists(candidate)) return candidate;
            dir = dir.Parent;
        }

        throw new FileNotFoundException(relativePath);
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AppDbContext(options, new HttpContextAccessor());
    }
}
