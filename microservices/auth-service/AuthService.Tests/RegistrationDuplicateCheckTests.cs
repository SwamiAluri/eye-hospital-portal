using System.Reflection;
using System.Security.Claims;
using System.Text.Json;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models.Domain;
using AuthService.Models.Domain.Dtos;
using AuthService.SeedData;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

public class RegistrationDuplicateCheckTests
{
    private static readonly Guid TenantA = Guid.Parse("155fe198-6ae5-4a01-9254-ead5b427247e");
    private static readonly Guid TenantB = Guid.Parse("11b26293-9d9c-4633-927e-3294bff2a8d7");
    private static readonly Guid UserId = Guid.Parse("48a94c56-ccb2-49c0-9916-bee2703b0251");
    private static readonly JsonSerializerOptions Camel = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static readonly string[] ApprovedCreateRoles =
        PatientCreateRoleGrantCatalog.ApprovedRoleNormalizedNames;

    [Fact]
    public void Registration_endpoint_requires_patient_create_and_keeps_view_check_duplicates_unchanged()
    {
        var registration = typeof(PatientsController).GetMethod(
            nameof(PatientsController.CheckDuplicatesForRegistration));
        Assert.NotNull(registration);
        var registrationPerm = Assert.Single(
            registration!.GetCustomAttributes(typeof(RequirePermissionAttribute), false)
                .Cast<RequirePermissionAttribute>());
        Assert.Equal("patient.create", registrationPerm.PermissionCode);
        var registrationRoute = Assert.Single(
            registration.GetCustomAttributes(typeof(HttpPostAttribute), false)
                .Cast<HttpPostAttribute>());
        Assert.Equal("registration/check-duplicates", registrationRoute.Template);

        var viewCheck = typeof(PatientsController).GetMethod(nameof(PatientsController.CheckDuplicates));
        Assert.NotNull(viewCheck);
        var viewPerm = Assert.Single(
            viewCheck!.GetCustomAttributes(typeof(RequirePermissionAttribute), false)
                .Cast<RequirePermissionAttribute>());
        Assert.Equal("patient.view", viewPerm.PermissionCode);
        var viewRoute = Assert.Single(
            viewCheck.GetCustomAttributes(typeof(HttpPostAttribute), false)
                .Cast<HttpPostAttribute>());
        Assert.Equal("check-duplicates", viewRoute.Template);

        var create = typeof(PatientsController).GetMethod(nameof(PatientsController.CreatePatient));
        var createPerm = Assert.Single(
            create!.GetCustomAttributes(typeof(RequirePermissionAttribute), false)
                .Cast<RequirePermissionAttribute>());
        Assert.Equal("patient.create", createPerm.PermissionCode);
    }

    [Fact]
    public void Approved_create_roles_are_exactly_the_six_phase_3o_roles()
    {
        Assert.Equal(
            new[]
            {
                "ADMIN",
                "COUNSELLOR",
                "RECEPTIONIST",
                "MEDICAL RECORDS OFFICER",
                "NURSE",
                "IP COORDINATOR",
            },
            ApprovedCreateRoles);
    }

    [Theory]
    [InlineData("patient.create", true)]
    [InlineData("patient.view", false)]
    [InlineData("*", true)]
    [InlineData("", false)]
    public async Task Create_scoped_permission_requirement_accepts_patient_create_not_view_alone(
        string claim,
        bool expected)
    {
        Assert.Equal(expected, await AuthorizeCreateScoped(claim));
    }

    [Fact]
    public async Task Mapper_serialized_json_exposes_safe_fields_only()
    {
        var source = new DuplicateCheckResult
        {
            IsDuplicate = true,
            Message = "Found 1 possible duplicate(s). Highest confidence: 95%",
            Matches =
            {
                new PatientDuplicateMatch
                {
                    Id = Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
                    MedicalRecordNumber = "MRN-100",
                    FirstName = "Sam",
                    LastName = "Aluri",
                    DateOfBirth = new DateTime(1987, 8, 1),
                    ContactNumber = "9800000001",
                    Email = "sam@example.com",
                    MatchType = "PhoneMatch",
                    MatchConfidence = 0.95m,
                    DifferenceReason = "Phone: '9800000001' vs '9800000001'",
                },
            },
        };

        var mapped = RegistrationDuplicateCheckMapper.Map(
            source,
            new Dictionary<Guid, string?>
            {
                [source.Matches[0].Id] = "male",
            });

        var json = JsonSerializer.Serialize(mapped, Camel);
        Assert.Contains("\"isDuplicate\":true", json);
        Assert.Contains("\"medicalRecordNumber\":\"MRN-100\"", json);
        Assert.Contains("\"firstName\":\"Sam\"", json);
        Assert.Contains("\"lastName\":\"Aluri\"", json);
        Assert.Contains("\"matchType\":\"PhoneMatch\"", json);
        Assert.Contains("\"gender\":\"male\"", json);
        Assert.Contains(RegistrationDuplicateCheckMapper.SafeDuplicateMessage, json);
        Assert.DoesNotContain("9800000001", json);
        Assert.DoesNotContain("sam@example.com", json);
        Assert.DoesNotContain("contactNumber", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("differenceReason", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("matchConfidence", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Highest confidence", json);
        Assert.DoesNotContain("0.95", json);
        Assert.DoesNotContain("Levenshtein", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("confidence", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("clinical", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("billing", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("insurance", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("counselling", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Registration_check_without_tenant_is_unauthorized()
    {
        var controller = CreateController(CreateDb(), new Mock<IPatientDuplicateDetectionService>().Object);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity()),
            },
        };

        var result = await controller.CheckDuplicatesForRegistration(new DuplicateCheckRequest
        {
            FirstName = "Sam",
            LastName = "Aluri",
        });

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task Registration_check_maps_matcher_result_and_loads_gender()
    {
        await using var db = CreateDb();
        var patientId = Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
        db.Patients.Add(MakePatient(TenantA, patientId, "Sam", "Aluri", "1987-08-01", "male", "MRN-100", "9800000001", "sam@example.com"));
        await db.SaveChangesAsync();

        var duplicate = new Mock<IPatientDuplicateDetectionService>();
        duplicate.Setup(d => d.CheckDuplicatesAsync(
                It.IsAny<DuplicateCheckRequest>(),
                TenantA,
                null))
            .ReturnsAsync(new DuplicateCheckResult
            {
                IsDuplicate = true,
                Message = "Found 1 possible duplicate(s). Highest confidence: 100%",
                Matches =
                {
                    new PatientDuplicateMatch
                    {
                        Id = patientId,
                        MedicalRecordNumber = "MRN-100",
                        FirstName = "Sam",
                        LastName = "Aluri",
                        DateOfBirth = new DateTime(1987, 8, 1),
                        ContactNumber = "9800000001",
                        Email = "sam@example.com",
                        MatchType = "ExactNameDOB",
                        MatchConfidence = 1.0m,
                        DifferenceReason = "Same details",
                    },
                },
            });

        var controller = CreateController(db, duplicate.Object);
        SignIn(controller, TenantA);

        var action = await controller.CheckDuplicatesForRegistration(new DuplicateCheckRequest
        {
            FirstName = "Sam",
            LastName = "Aluri",
            DateOfBirth = new DateTime(1987, 8, 1),
        });

        var ok = Assert.IsType<OkObjectResult>(action.Result);
        var body = Assert.IsType<RegistrationDuplicateCheckResult>(ok.Value);
        Assert.True(body.IsDuplicate);
        Assert.Equal(RegistrationDuplicateCheckMapper.SafeDuplicateMessage, body.Message);
        var candidate = Assert.Single(body.Matches);
        Assert.Equal(patientId, candidate.Id);
        Assert.Equal("MRN-100", candidate.MedicalRecordNumber);
        Assert.Equal("ExactNameDOB", candidate.MatchType);
        Assert.Equal("male", candidate.Gender);
        Assert.Contains(RegistrationDuplicateAttributeSignals.FirstName, candidate.MatchedAttributes);
        Assert.Contains(RegistrationDuplicateAttributeSignals.LastName, candidate.MatchedAttributes);
        Assert.Contains(RegistrationDuplicateAttributeSignals.DateOfBirth, candidate.MatchedAttributes);

        var json = JsonSerializer.Serialize(body, Camel);
        Assert.Contains("\"matchedAttributes\"", json);
        Assert.Contains("\"differentAttributes\"", json);
        Assert.DoesNotContain("contactNumber", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("matchConfidence", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("differenceReason", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("9800000001", json);
        Assert.DoesNotContain("sam@example.com", json);
        Assert.DoesNotContain("100%", json);
    }

    [Theory]
    [InlineData("ExactNameDOB")]
    [InlineData("PhoneMatch")]
    [InlineData("EmailMatch")]
    [InlineData("FuzzyNameDOB")]
    public async Task Registration_check_preserves_match_type_from_matcher(string matchType)
    {
        var duplicate = new Mock<IPatientDuplicateDetectionService>();
        var id = Guid.NewGuid();
        duplicate.Setup(d => d.CheckDuplicatesAsync(
                It.IsAny<DuplicateCheckRequest>(),
                TenantA,
                null))
            .ReturnsAsync(new DuplicateCheckResult
            {
                IsDuplicate = true,
                Matches =
                {
                    new PatientDuplicateMatch
                    {
                        Id = id,
                        MedicalRecordNumber = "MRN-X",
                        FirstName = "A",
                        LastName = "B",
                        DateOfBirth = new DateTime(1990, 1, 1),
                        MatchType = matchType,
                        MatchConfidence = 0.9m,
                        ContactNumber = "1",
                        Email = "a@b.c",
                        DifferenceReason = "secret",
                    },
                },
            });

        await using var db = CreateDb();
        var controller = CreateController(db, duplicate.Object);
        SignIn(controller, TenantA);

        var action = await controller.CheckDuplicatesForRegistration(new DuplicateCheckRequest
        {
            FirstName = "A",
            LastName = "B",
        });
        var ok = Assert.IsType<OkObjectResult>(action.Result);
        var body = Assert.IsType<RegistrationDuplicateCheckResult>(ok.Value);
        Assert.Equal(matchType, Assert.Single(body.Matches).MatchType);
    }

    [Fact]
    public async Task Registration_check_no_match_returns_empty_safe_result()
    {
        var duplicate = new Mock<IPatientDuplicateDetectionService>();
        duplicate.Setup(d => d.CheckDuplicatesAsync(
                It.IsAny<DuplicateCheckRequest>(),
                TenantA,
                null))
            .ReturnsAsync(new DuplicateCheckResult
            {
                IsDuplicate = false,
                Message = "No duplicates found",
                Matches = new List<PatientDuplicateMatch>(),
            });

        await using var db = CreateDb();
        var controller = CreateController(db, duplicate.Object);
        SignIn(controller, TenantA);

        var action = await controller.CheckDuplicatesForRegistration(new DuplicateCheckRequest
        {
            FirstName = "Unique",
            LastName = "Person",
        });
        var ok = Assert.IsType<OkObjectResult>(action.Result);
        var body = Assert.IsType<RegistrationDuplicateCheckResult>(ok.Value);
        Assert.False(body.IsDuplicate);
        Assert.Empty(body.Matches);
        Assert.Equal(RegistrationDuplicateCheckMapper.SafeNoDuplicateMessage, body.Message);
    }

    [Fact]
    public async Task Real_matcher_exact_name_dob_is_tenant_scoped()
    {
        await using var db = CreateDb();
        var sharedDob = new DateTime(1987, 8, 1);
        db.Patients.Add(MakePatient(TenantA, Guid.NewGuid(), "Sam", "Aluri", "1987-08-01", "male", "MRN-A", "111", "a@t.com"));
        db.Patients.Add(MakePatient(TenantB, Guid.NewGuid(), "Sam", "Aluri", "1987-08-01", "male", "MRN-B", "222", "b@t.com"));
        await db.SaveChangesAsync();

        var service = new PatientDuplicateDetectionService(db, NullLogger<PatientDuplicateDetectionService>.Instance);
        var controller = CreateController(db, service);
        SignIn(controller, TenantA);

        var action = await controller.CheckDuplicatesForRegistration(new DuplicateCheckRequest
        {
            FirstName = "Sam",
            LastName = "Aluri",
            DateOfBirth = sharedDob,
        });
        var ok = Assert.IsType<OkObjectResult>(action.Result);
        var body = Assert.IsType<RegistrationDuplicateCheckResult>(ok.Value);
        Assert.True(body.IsDuplicate);
        Assert.All(body.Matches, m => Assert.Equal("ExactNameDOB", m.MatchType));
        Assert.DoesNotContain(body.Matches, m => m.MedicalRecordNumber == "MRN-B");
        Assert.Contains(body.Matches, m => m.MedicalRecordNumber == "MRN-A");
    }

    [Fact]
    public async Task Real_matcher_phone_email_fuzzy_and_no_match()
    {
        await using var db = CreateDb();
        db.Patients.Add(MakePatient(TenantA, Guid.NewGuid(), "Jane", "Smith", "1990-07-22", "female", "MRN-P", "555-0101", null));
        db.Patients.Add(MakePatient(TenantA, Guid.NewGuid(), "Bob", "Jones", "1985-03-15", "male", "MRN-E", null, "bob@example.com"));
        db.Patients.Add(MakePatient(TenantA, Guid.NewGuid(), "Jon", "Smith", "1990-07-22", "male", "MRN-F", null, null));
        await db.SaveChangesAsync();

        var service = new PatientDuplicateDetectionService(db, NullLogger<PatientDuplicateDetectionService>.Instance);
        var controller = CreateController(db, service);
        SignIn(controller, TenantA);

        var phone = await controller.CheckDuplicatesForRegistration(new DuplicateCheckRequest
        {
            FirstName = "Other",
            LastName = "Person",
            ContactNumber = "555-0101",
        });
        var phoneBody = Assert.IsType<RegistrationDuplicateCheckResult>(Assert.IsType<OkObjectResult>(phone.Result).Value);
        Assert.Contains(phoneBody.Matches, m => m.MatchType == "PhoneMatch");

        var email = await controller.CheckDuplicatesForRegistration(new DuplicateCheckRequest
        {
            FirstName = "Other",
            LastName = "Person",
            Email = "bob@example.com",
        });
        var emailBody = Assert.IsType<RegistrationDuplicateCheckResult>(Assert.IsType<OkObjectResult>(email.Result).Value);
        Assert.Contains(emailBody.Matches, m => m.MatchType == "EmailMatch");

        var fuzzy = await controller.CheckDuplicatesForRegistration(new DuplicateCheckRequest
        {
            FirstName = "John",
            LastName = "Smith",
            DateOfBirth = new DateTime(1990, 7, 22),
        });
        var fuzzyBody = Assert.IsType<RegistrationDuplicateCheckResult>(Assert.IsType<OkObjectResult>(fuzzy.Result).Value);
        Assert.Contains(fuzzyBody.Matches, m => m.MatchType is "FuzzyNameDOB" or "ExactNameDOB");

        var none = await controller.CheckDuplicatesForRegistration(new DuplicateCheckRequest
        {
            FirstName = "Zzxxyy",
            LastName = "Qqwwrr",
            DateOfBirth = new DateTime(2001, 1, 1),
            ContactNumber = "0000000000",
            Email = "unique-zzz@example.com",
        });
        var noneBody = Assert.IsType<RegistrationDuplicateCheckResult>(Assert.IsType<OkObjectResult>(none.Result).Value);
        Assert.False(noneBody.IsDuplicate);
        Assert.Empty(noneBody.Matches);
    }

    [Fact]
    public void Create_hard_block_source_still_checks_confidence_at_zero_point_nine_five()
    {
        var createSource = File.ReadAllText(Path.Combine(
            FindRepoRoot(),
            "microservices",
            "auth-service",
            "AuthService",
            "Controllers",
            "PatientsController.cs"));
        Assert.Contains("MatchConfidence >= 0.95m", createSource);
        Assert.Contains("Duplicate patient detected", createSource);
        Assert.Contains("[HttpPost(\"registration/check-duplicates\")]", createSource);
        Assert.Contains("[RequirePermission(\"patient.create\")]", createSource);
        // Existing view endpoint must not be dual-authorized with patient.create
        var viewBlockStart = createSource.IndexOf("[HttpPost(\"check-duplicates\")]", StringComparison.Ordinal);
        var viewBlockEnd = createSource.IndexOf("[HttpPost(\"registration/check-duplicates\")]", StringComparison.Ordinal);
        Assert.True(viewBlockStart >= 0 && viewBlockEnd > viewBlockStart);
        var viewBlock = createSource[viewBlockStart..viewBlockEnd];
        Assert.Contains("[RequirePermission(\"patient.view\")]", viewBlock);
        Assert.DoesNotContain("[RequirePermission(\"patient.create\")]", viewBlock);
    }

    private static async Task<bool> AuthorizeCreateScoped(string permissionClaim)
    {
        var requirement = new PermissionRequirement("patient.create");
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, UserId.ToString()),
            new("tenant_id", TenantA.ToString()),
        };
        if (!string.IsNullOrEmpty(permissionClaim))
            claims.Add(new Claim("permission", permissionClaim));
        var user = new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));
        var context = new AuthorizationHandlerContext(new[] { requirement }, user, null);
        await using var db = CreateDb();
        await new PermissionAuthorizationHandler(db).HandleAsync(context);
        return context.HasSucceeded;
    }

    private static PatientsController CreateController(
        AppDbContext db,
        IPatientDuplicateDetectionService duplicate)
    {
        return new PatientsController(
            patientService: null!,
            blobStorageService: null!,
            configuration: null!,
            logger: NullLogger<PatientsController>.Instance,
            duplicateDetectionService: duplicate,
            patientLookupService: null!,
            patientOmniSearchService: null!,
            patientSummaryService: null!,
            patientSummaryPdfService: null!,
            auditService: null!,
            recentViewsService: null!,
            context: db,
            branchAccess: null!);
    }

    private static void SignIn(PatientsController controller, Guid tenantId)
    {
        var identity = new ClaimsIdentity(new[]
        {
            new Claim("TenantId", tenantId.ToString()),
            new Claim("sub", UserId.ToString()),
            new Claim("permission", "patient.create"),
        }, "test");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) },
        };
    }

    private static Patient MakePatient(
        Guid tenantId,
        Guid id,
        string first,
        string last,
        string dob,
        string gender,
        string mrn,
        string? phone,
        string? email) =>
        new()
        {
            Id = id,
            TenantId = tenantId,
            MedicalRecordNumber = mrn,
            FirstName = first,
            LastName = last,
            DateOfBirth = DateTime.Parse(dob),
            Gender = gender,
            ContactNumber = phone,
            Email = email,
            Status = "Active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

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
            if (File.Exists(Path.Combine(dir.FullName, "Hospital Portal.sln"))
                || Directory.Exists(Path.Combine(dir.FullName, "microservices")))
                return dir.FullName;
            dir = dir.Parent;
        }
        throw new InvalidOperationException("Repository root not found");
    }
}
