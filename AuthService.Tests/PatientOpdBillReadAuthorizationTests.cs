using System.Security.Claims;
using AuthService.Controllers;
using AuthService.DTOs.Billing;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

public class PatientOpdBillReadAuthorizationTests
{
    private static ClaimsPrincipal UserWith(params string[] permissions)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
            new("tenant_id", Guid.NewGuid().ToString()),
        };
        claims.AddRange(permissions.Select(p => new Claim("permission", p)));
        return new ClaimsPrincipal(new ClaimsIdentity(claims, authenticationType: "jwt"));
    }

    [Fact]
    public async Task Unauthenticated_IsRejected()
    {
        var anon = new ClaimsPrincipal(new ClaimsIdentity());
        var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => BillingMutationAuth.RequireAllAsync(anon, null, "patient.view", "bill.update"));
        Assert.Equal("Authentication required.", ex.Message);
    }

    [Fact]
    public async Task AuthenticatedWithoutPatientView_IsRejected()
    {
        var user = UserWith("bill.update");
        var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => BillingMutationAuth.RequireAllAsync(user, null, "patient.view", "bill.update"));
        Assert.Equal("Missing permission: patient.view", ex.Message);
    }

    [Fact]
    public async Task PatientViewWithoutBillUpdate_IsRejected()
    {
        var user = UserWith("patient.view");
        var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => BillingMutationAuth.RequireAllAsync(user, null, "patient.view", "bill.update"));
        Assert.Equal("Missing permission: bill.update", ex.Message);
    }

    [Fact]
    public async Task PatientViewAndBillUpdate_IsAuthorized()
    {
        var user = UserWith("patient.view", "bill.update");
        await BillingMutationAuth.RequireAllAsync(user, null, "patient.view", "bill.update");
    }

    [Fact]
    public async Task AuthorizedPatientQuery_ReturnsTheExistingListShape()
    {
        var patientId = Guid.NewGuid();
        var bill = new OpdBillListDto
        {
            Id = Guid.NewGuid(),
            BillNumber = "OPD-1",
            PatientName = "Ada",
            PatientMrn = "MRN-1",
            Status = "Pending",
        };
        var bills = new Mock<IOpdBillService>();
        bills.Setup(s => s.AuthorizePatientBillReadAsync()).Returns(Task.CompletedTask);
        var tenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        bills.Setup(s => s.GetByPatientIdAsync(tenantId, patientId, 1, 50)).ReturnsAsync(new List<OpdBillListDto> { bill });
        var controller = ControllerWithTenant(bills.Object, tenantId);

        var result = await controller.GetAll(patientId: patientId, page: 1, pageSize: 50);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(ok.Value);
        var payload = ok.Value!;
        var list = Assert.IsAssignableFrom<IEnumerable<OpdBillListDto>>(payload.GetType().GetProperty("bills")!.GetValue(payload));
        Assert.Single(list);
        Assert.Equal(1, payload.GetType().GetProperty("total")!.GetValue(payload));
        bills.Verify(s => s.GetByPatientIdAsync(tenantId, patientId, 1, 50), Times.Once);
    }

    [Fact]
    public async Task UnknownPatient_StaysAnEmptyOkList()
    {
        var patientId = Guid.NewGuid();
        var bills = new Mock<IOpdBillService>();
        bills.Setup(s => s.AuthorizePatientBillReadAsync()).Returns(Task.CompletedTask);
        var tenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        bills.Setup(s => s.GetByPatientIdAsync(tenantId, patientId, 1, 50)).ReturnsAsync(new List<OpdBillListDto>());
        var controller = ControllerWithTenant(bills.Object, tenantId);

        var result = await controller.GetAll(patientId: patientId, page: 1, pageSize: 50);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(0, ok.Value!.GetType().GetProperty("total")!.GetValue(ok.Value));
    }

    [Fact]
    public async Task BranchList_DoesNotRequireThePatientBillReadGate()
    {
        var branchId = Guid.NewGuid();
        var bills = new Mock<IOpdBillService>();
        bills.Setup(s => s.GetByBranchIdAsync(branchId, null, null, null, 1, 50))
            .ReturnsAsync(new List<OpdBillListDto>());
        var controller = new OpdBillsController(bills.Object, NullLogger<OpdBillsController>.Instance);

        var result = await controller.GetAll(branchId: branchId, page: 1, pageSize: 50);

        Assert.IsType<OkObjectResult>(result);
        bills.Verify(s => s.AuthorizePatientBillReadAsync(), Times.Never);
    }

    [Fact]
    public async Task RejectedPatientQuery_DoesNotLoadBills()
    {
        var patientId = Guid.NewGuid();
        var bills = new Mock<IOpdBillService>();
        bills.Setup(s => s.AuthorizePatientBillReadAsync())
            .ThrowsAsync(new UnauthorizedAccessException("Missing permission: bill.update"));
        var controller = ControllerWithTenant(bills.Object, Guid.Parse("22222222-2222-2222-2222-222222222222"));

        var result = await controller.GetAll(patientId: patientId);

        Assert.IsType<UnauthorizedObjectResult>(result);
        bills.Verify(s => s.GetByPatientIdAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<int>(), It.IsAny<int>()), Times.Never);
    }

    private static OpdBillsController ControllerWithTenant(IOpdBillService bills, Guid tenantId)
    {
        var http = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
                new Claim("tenant_id", tenantId.ToString()),
            }, "test")),
        };
        return new OpdBillsController(bills, NullLogger<OpdBillsController>.Instance)
        {
            ControllerContext = new ControllerContext { HttpContext = http },
        };
    }
}
