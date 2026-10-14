using System.Reflection;
using AuthService.Controllers;
using AuthService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

public class InternalAuditControllerTests
{
    private const string Key = "hp-internal-svc-key-change-in-production-2026";

    private static InternalAuditController Create(
        Mock<IAuditService> audit,
        string? key = Key)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["InternalApi:Key"] = key,
            })
            .Build();

        var ctl = new InternalAuditController(audit.Object, config, NullLogger<InternalAuditController>.Instance)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext(),
            },
        };
        return ctl;
    }

    private static void Authorize(InternalAuditController ctl, Guid tenantId)
    {
        ctl.ControllerContext.HttpContext.Request.Headers["X-Internal-Key"] = Key;
        ctl.ControllerContext.HttpContext.Request.Headers["X-Tenant-ID"] = tenantId.ToString("D");
    }

    [Fact]
    public async Task Write_Rejects_Missing_Internal_Key()
    {
        var audit = new Mock<IAuditService>();
        var ctl = Create(audit);
        var tenant = Guid.NewGuid();
        ctl.ControllerContext.HttpContext.Request.Headers["X-Tenant-ID"] = tenant.ToString("D");
        var result = await ctl.Write(new InternalAuditController.InternalAuditWriteRequest(
            tenant, Guid.NewGuid(), "CREATE_DRAFT", "LmsCatalogueVersion", Guid.NewGuid()));
        Assert.IsType<UnauthorizedObjectResult>(result);
        audit.Verify(a => a.LogAsync(
            It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()), Times.Never);
    }

    [Fact]
    public async Task Write_Rejects_Missing_Tenant_Header()
    {
        var audit = new Mock<IAuditService>();
        var ctl = Create(audit);
        ctl.ControllerContext.HttpContext.Request.Headers["X-Internal-Key"] = Key;
        var result = await ctl.Write(new InternalAuditController.InternalAuditWriteRequest(
            Guid.NewGuid(), Guid.NewGuid(), "CREATE_DRAFT", "LmsCatalogueVersion", Guid.NewGuid()));
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Write_Rejects_Tenant_Header_Body_Mismatch()
    {
        var audit = new Mock<IAuditService>();
        var ctl = Create(audit);
        Authorize(ctl, Guid.NewGuid());
        var result = await ctl.Write(new InternalAuditController.InternalAuditWriteRequest(
            Guid.NewGuid(), Guid.NewGuid(), "CREATE_DRAFT", "LmsCatalogueVersion", Guid.NewGuid()));
        Assert.IsType<BadRequestObjectResult>(result);
        audit.Verify(a => a.LogAsync(
            It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()), Times.Never);
    }

    [Fact]
    public async Task Write_Rejects_Non_Allowlisted_Action_And_ResourceType()
    {
        var audit = new Mock<IAuditService>();
        var ctl = Create(audit);
        var tenant = Guid.NewGuid();
        Authorize(ctl, tenant);

        var badAction = await ctl.Write(new InternalAuditController.InternalAuditWriteRequest(
            tenant, Guid.NewGuid(), "DELETE_PATIENT", "LmsCatalogueVersion", Guid.NewGuid()));
        Assert.IsType<BadRequestObjectResult>(badAction);

        var badResource = await ctl.Write(new InternalAuditController.InternalAuditWriteRequest(
            tenant, Guid.NewGuid(), "ACTIVATE", "Patient", Guid.NewGuid()));
        Assert.IsType<BadRequestObjectResult>(badResource);
    }

    [Fact]
    public async Task Write_Logs_When_Authorized_With_Matching_Tenant()
    {
        var audit = new Mock<IAuditService>();
        audit.Setup(a => a.LogAsync(
                It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .Returns(Task.CompletedTask);

        var ctl = Create(audit);
        var tenant = Guid.NewGuid();
        Authorize(ctl, tenant);

        var actor = Guid.NewGuid();
        var resource = Guid.NewGuid();
        var result = await ctl.Write(new InternalAuditController.InternalAuditWriteRequest(
            tenant, actor, "ACTIVATE", "LmsCatalogueVersion", resource,
            Reason: "UAT activate", OldValues: "status=Approved", NewValues: "status=Active",
            CorrelationId: "corr-1"));

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(tenant, ctl.HttpContext.Items["TenantId"]);
        Assert.Equal("corr-1", ctl.HttpContext.Items["SessionId"]);
        audit.Verify(a => a.LogAsync(
            actor, "ACTIVATE", "LmsCatalogueVersion", resource,
            It.Is<string?>(d => d != null && d.Contains("UAT activate")),
            "status=Approved", "status=Active"), Times.Once);
        Assert.NotNull(ok.Value);
    }

    [Fact]
    public void Controller_Is_Internal_Route_Only()
    {
        var route = typeof(InternalAuditController).GetCustomAttribute<RouteAttribute>();
        Assert.Equal("api/internal/audit", route?.Template);
    }

    [Fact]
    public void Allowlist_Covers_Catalogue_Lifecycle_Actions()
    {
        foreach (var action in new[]
                 {
                     "CREATE_DRAFT", "UPDATE_DRAFT", "SUBMIT_REVIEW", "RETURN_TO_DRAFT",
                     "APPROVE", "ACTIVATE", "RETIRE", "SUPERSEDE", "CREATE_VERSION",
                 })
        {
            Assert.Contains(action, InternalAuditController.AllowedActions);
        }
        Assert.Contains("LmsCatalogueVersion", InternalAuditController.AllowedResourceTypes);
    }

    [Fact]
    public void Allowlist_Covers_Lms_Order_Actions_And_Resources()
    {
        foreach (var action in new[] { "SUBMIT_ORDER", "AMEND_ORDER", "CANCEL_ORDER" })
            Assert.Contains(action, InternalAuditController.AllowedActions);
        Assert.Contains("LmsOrder", InternalAuditController.AllowedResourceTypes);
        Assert.Contains("LmsOrderVersion", InternalAuditController.AllowedResourceTypes);
    }

    [Fact]
    public void Allowlist_Covers_Lms_Collection_Actions_And_Resource()
    {
        foreach (var action in new[]
                 {
                     "CREATE_COLLECTION_TASK",
                     "TRANSITION_COLLECTION_TASK",
                     "CLAIM_COLLECTION_TASK",
                     "ASSIGN_COLLECTION_TASK",
                     "RELEASE_COLLECTION_TASK",
                     "CANCEL_COLLECTION_TASK",
                 })
        {
            Assert.Contains(action, InternalAuditController.AllowedActions);
        }
        Assert.Contains("LmsCollectionTask", InternalAuditController.AllowedResourceTypes);
    }

    [Fact]
    public void Allowlist_Covers_Lms_Specimen_Actions_And_Resource()
    {
        foreach (var action in new[]
                 {
                     "CREATE_SPECIMEN", "COMPLETE_COLLECTION", "RECEIVE_SPECIMEN", "REJECT_SPECIMEN",
                     "CREATE_SPECIMEN_BARCODE", "PRINT_SPECIMEN_LABEL", "REPRINT_SPECIMEN_LABEL",
                 })
            Assert.Contains(action, InternalAuditController.AllowedActions);
        Assert.DoesNotContain("VOID_SPECIMEN_BARCODE", InternalAuditController.AllowedActions);
        Assert.Contains("LmsSpecimen", InternalAuditController.AllowedResourceTypes);
    }

    [Fact]
    public void Allowlist_Covers_Lms_Result_Draft_Actions_And_Resource()
    {
        foreach (var action in new[]
                 {
                     "CREATE_RESULT_DRAFT", "UPDATE_RESULT_DRAFT", "VERIFY_RESULT", "AUTHORIZE_RESULT",
                 })
            Assert.Contains(action, InternalAuditController.AllowedActions);
        Assert.DoesNotContain("RETURN_RESULT_TO_DRAFT", InternalAuditController.AllowedActions);
        Assert.DoesNotContain("REJECT_RESULT", InternalAuditController.AllowedActions);
        Assert.DoesNotContain("RELEASE_RESULT", InternalAuditController.AllowedActions);
        Assert.Contains("LmsResult", InternalAuditController.AllowedResourceTypes);
    }

    [Fact]
    public void Allowlist_Covers_Lms_Critical_Result_Actions_And_Resource()
    {
        foreach (var action in new[] { "CREATE_CRITICAL_EVENT", "ACKNOWLEDGE_CRITICAL_EVENT" })
            Assert.Contains(action, InternalAuditController.AllowedActions);
        Assert.Contains("LmsCriticalResultEvent", InternalAuditController.AllowedResourceTypes);
        Assert.DoesNotContain("ESCALATE_CRITICAL_EVENT", InternalAuditController.AllowedActions);
        Assert.DoesNotContain("RELEASE_RESULT", InternalAuditController.AllowedActions);
    }

    [Fact]
    public void Allowlist_Covers_Lms_Report_Foundation_Actions_And_Resources()
    {
        foreach (var action in new[]
                 {
                     "CREATE_REPORT_DRAFT", "APPEND_REPORT_VERSION", "FINALIZE_REPORT", "RELEASE_REPORT",
                     "ASSIGN_REPORT_NUMBER",
                     "REQUEST_OFFICIAL_PDF", "OFFICIAL_PDF_GENERATED", "OFFICIAL_PDF_FAILED",
                     "DOWNLOAD_OFFICIAL_PDF",
                 })
            Assert.Contains(action, InternalAuditController.AllowedActions);
        Assert.Contains("LmsReport", InternalAuditController.AllowedResourceTypes);
        Assert.Contains("LmsReportVersion", InternalAuditController.AllowedResourceTypes);
        Assert.DoesNotContain("PUBLISH_REPORT", InternalAuditController.AllowedActions);
        Assert.DoesNotContain("UNRELEASE_REPORT", InternalAuditController.AllowedActions);
    }

    [Theory]
    [InlineData("CREATE_COLLECTION_TASK")]
    [InlineData("TRANSITION_COLLECTION_TASK")]
    [InlineData("CLAIM_COLLECTION_TASK")]
    [InlineData("ASSIGN_COLLECTION_TASK")]
    [InlineData("RELEASE_COLLECTION_TASK")]
    [InlineData("CANCEL_COLLECTION_TASK")]
    public async Task Write_Accepts_Collection_Actions_With_LmsCollectionTask(string action)
    {
        var audit = new Mock<IAuditService>();
        audit.Setup(a => a.LogAsync(
                It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .Returns(Task.CompletedTask);

        var ctl = Create(audit);
        var tenant = Guid.NewGuid();
        Authorize(ctl, tenant);

        var actor = Guid.NewGuid();
        var resource = Guid.NewGuid();
        var result = await ctl.Write(new InternalAuditController.InternalAuditWriteRequest(
            tenant, actor, action, "LmsCollectionTask", resource,
            NewValues: "status=Planned"));

        Assert.IsType<OkObjectResult>(result);
        audit.Verify(a => a.LogAsync(
            actor, action, "LmsCollectionTask", resource,
            It.IsAny<string?>(), It.IsAny<string?>(), "status=Planned"), Times.Once);
    }

    [Fact]
    public async Task Write_Accepts_Existing_Order_And_Catalogue_Actions()
    {
        var audit = new Mock<IAuditService>();
        audit.Setup(a => a.LogAsync(
                It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .Returns(Task.CompletedTask);

        var ctl = Create(audit);
        var tenant = Guid.NewGuid();
        Authorize(ctl, tenant);

        var order = await ctl.Write(new InternalAuditController.InternalAuditWriteRequest(
            tenant, Guid.NewGuid(), "SUBMIT_ORDER", "LmsOrder", Guid.NewGuid()));
        Assert.IsType<OkObjectResult>(order);

        var catalogue = await ctl.Write(new InternalAuditController.InternalAuditWriteRequest(
            tenant, Guid.NewGuid(), "CREATE_DRAFT", "LmsCatalogueVersion", Guid.NewGuid()));
        Assert.IsType<OkObjectResult>(catalogue);
    }

    [Theory]
    [InlineData("RECEIVE_SPECIMEN")]
    [InlineData("REJECT_SPECIMEN")]
    public async Task Write_Accepts_Lms_Receive_And_Reject_Actions(string action)
    {
        var audit = new Mock<IAuditService>();
        audit.Setup(a => a.LogAsync(
                It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .Returns(Task.CompletedTask);

        var ctl = Create(audit);
        var tenant = Guid.NewGuid();
        Authorize(ctl, tenant);

        var actor = Guid.NewGuid();
        var resource = Guid.NewGuid();
        var result = await ctl.Write(new InternalAuditController.InternalAuditWriteRequest(
            tenant, actor, action, "LmsSpecimen", resource,
            NewValues: action == "RECEIVE_SPECIMEN"
                ? "status=Received; accession=ACC-20261011-000001"
                : "status=Rejected; reason=INSUFFICIENT_SPECIMEN"));

        Assert.IsType<OkObjectResult>(result);
        audit.Verify(a => a.LogAsync(
            actor, action, "LmsSpecimen", resource,
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()), Times.Once);
    }
}
