using System.Reflection;
using System.Security.Claims;
using AuthService.Authorization;
using AuthService.Controllers;
using AuthService.Models.Domain.Dtos;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace AuthService.Tests;

public class PatientDirectoryExportAuthorizationTests
{
    private static readonly Guid TenantId = Guid.Parse("155fe198-6ae5-4a01-9254-ead5b427247e");
    private static readonly Guid UserId = Guid.Parse("48a94c56-ccb2-49c0-9916-bee2703b0251");
    private static readonly Guid RequestedBranch = Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    private static readonly Guid EffectiveBranch = Guid.Parse("74c014cf-9570-4824-bdf9-b369ea11a8f4");

    [Fact]
    public void Directory_endpoints_keep_existing_permission_codes()
    {
        AssertPermission(nameof(PatientsController.LookupPatients), "patient.view");
        AssertPermission(nameof(PatientsController.CreatePatient), "patient.create");
        AssertPermission(nameof(PatientsController.ExportLookup), "patient.export");
        Assert.Null(typeof(PatientsController).GetMethod("MergePatients"));
    }

    [Fact]
    public async Task Export_without_tenant_is_unauthorized()
    {
        var lookup = new Mock<IPatientLookupService>();
        var controller = CreateController(new Mock<IFollowupBranchAccessService>().Object, lookup.Object, new Mock<IAuditService>().Object);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity()) },
        };

        var result = await controller.ExportLookup(RequestedBranch);

        Assert.IsType<UnauthorizedResult>(result);
        lookup.Verify(l => l.ExportCsvAsync(It.IsAny<PatientLookupQuery>()), Times.Never);
    }

    [Fact]
    public async Task Export_rejects_branch_the_resolver_does_not_authorize()
    {
        var branch = new Mock<IFollowupBranchAccessService>();
        branch.Setup(b => b.ResolveEffectiveBranchAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new UnauthorizedAccessException("Branch is not authorized for this caller."));
        var lookup = new Mock<IPatientLookupService>();
        var controller = CreateController(branch.Object, lookup.Object, new Mock<IAuditService>().Object);
        SignIn(controller);

        var result = await controller.ExportLookup(RequestedBranch, q: "sam", name: "Sam", gender: "female");

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
        lookup.Verify(l => l.ExportCsvAsync(It.IsAny<PatientLookupQuery>()), Times.Never);
    }

    [Fact]
    public async Task Export_uses_resolved_branch_and_keeps_lookup_filters()
    {
        var branch = new Mock<IFollowupBranchAccessService>();
        branch.Setup(b => b.ResolveEffectiveBranchAsync(
                TenantId, UserId, RequestedBranch, It.IsAny<CancellationToken>()))
            .ReturnsAsync(EffectiveBranch);
        PatientLookupQuery? captured = null;
        var lookup = new Mock<IPatientLookupService>();
        lookup.Setup(l => l.ExportCsvAsync(It.IsAny<PatientLookupQuery>()))
            .Callback<PatientLookupQuery>(q => captured = q)
            .ReturnsAsync(new byte[] { 1, 2 });
        Guid? auditedBranch = null;
        var audit = new Mock<IAuditService>();
        audit.Setup(a => a.LogDataAccessAsync(
                UserId, "PatientLookup", It.IsAny<Guid>(), "EXPORT_CSV", "PHI"))
            .Callback<Guid, string, Guid, string, string>((_, _, resourceId, _, _) => auditedBranch = resourceId)
            .Returns(Task.CompletedTask);
        var controller = CreateController(branch.Object, lookup.Object, audit.Object);
        SignIn(controller);

        var dobFrom = new DateTime(1990, 1, 1);
        var providerId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var result = await controller.ExportLookup(
            RequestedBranch,
            q: "sam",
            tab: "current",
            sortBy: "name",
            sortDir: "asc",
            favoritesOnly: true,
            assignedToMe: true,
            engagementTypes: "opd",
            programCodes: "CATARACT",
            patientTypes: "Cash",
            gender: "female",
            mrn: "MRN-1",
            phone: "9876543210",
            dobFrom: dobFrom,
            name: "Sam",
            diagnosis: "cataract",
            providerId: providerId,
            departmentId: Guid.Parse("22222222-2222-2222-2222-222222222222"),
            wardName: "Ward A",
            appointmentFrom: new DateTime(2026, 6, 1),
            admissionFrom: new DateTime(2026, 5, 1));

        Assert.IsType<FileContentResult>(result);
        Assert.NotNull(captured);
        Assert.Equal(EffectiveBranch, captured!.BranchId);
        Assert.NotEqual(RequestedBranch, captured.BranchId);
        Assert.Equal(TenantId, captured.TenantId);
        Assert.Equal("sam", captured.Q);
        Assert.Equal("current", captured.Tab);
        Assert.Equal(1, captured.Page);
        Assert.Equal(5000, captured.PageSize);
        Assert.Equal("name", captured.SortBy);
        Assert.Equal("asc", captured.SortDir);
        Assert.True(captured.FavoritesOnly);
        Assert.True(captured.AssignedToMe);
        Assert.Equal("opd", Assert.Single(captured.EngagementTypes));
        Assert.Equal("CATARACT", Assert.Single(captured.ProgramCodes));
        Assert.Equal("Cash", Assert.Single(captured.PatientTypes));
        Assert.Equal("female", captured.Gender);
        Assert.Equal("MRN-1", captured.Mrn);
        Assert.Equal("9876543210", captured.Phone);
        Assert.Equal("Sam", captured.Name);
        Assert.Equal("cataract", captured.Diagnosis);
        Assert.Equal(providerId, captured.ProviderId);
        Assert.Equal("Ward A", captured.WardName);
        Assert.Equal(dobFrom, captured.DobFrom);
        Assert.Equal(EffectiveBranch, auditedBranch);
    }

    private static void AssertPermission(string methodName, string code)
    {
        var method = typeof(PatientsController).GetMethod(methodName);
        Assert.NotNull(method);
        var perm = method!.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(perm);
        Assert.Equal(code, perm!.PermissionCode);
    }

    private static PatientsController CreateController(
        IFollowupBranchAccessService branch,
        IPatientLookupService lookup,
        IAuditService audit)
    {
        return new PatientsController(
            patientService: null!,
            blobStorageService: null!,
            configuration: null!,
            logger: null!,
            duplicateDetectionService: null!,
            patientLookupService: lookup,
            patientOmniSearchService: null!,
            patientSummaryService: null!,
            patientSummaryPdfService: null!,
            auditService: audit,
            recentViewsService: null!,
            context: null!,
            branchAccess: branch);
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
}
