using System.Security.Claims;
using AuthService.Authorization;
using AuthService.DTOs.Billing;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ChargeReconciliationController : ControllerBase
{
    private readonly IChargeReconciliationService _svc;

    public ChargeReconciliationController(IChargeReconciliationService svc) => _svc = svc;

    private Guid GetTenantId()
    {
        var raw = User.FindFirst("tenant_id")?.Value
            ?? User.FindFirst("TenantId")?.Value
            ?? Request.Headers["X-Tenant-ID"].FirstOrDefault();
        return Guid.TryParse(raw, out var id) ? id : throw new UnauthorizedAccessException();
    }

    [HttpGet]
    [RequirePermission("bill.view")]
    public async Task<ActionResult<ChargeReconciliationReportDto>> Get(
        [FromQuery] DateTime? fromUtc, [FromQuery] DateTime? toUtc)
        => Ok(await _svc.GetReportAsync(GetTenantId(), fromUtc, toUtc));

    [HttpPost("run")]
    [RequirePermission("bill.view")]
    public async Task<ActionResult<ChargeReconciliationReportDto>> Run(
        [FromQuery] DateTime? fromUtc, [FromQuery] DateTime? toUtc)
        => Ok(await _svc.GetReportAsync(GetTenantId(), fromUtc, toUtc));

    [HttpGet("wastage")]
    [RequirePermission("bill.view")]
    public async Task<ActionResult<WastageReportDto>> Wastage(
        [FromQuery] DateTime? fromUtc, [FromQuery] DateTime? toUtc)
        => Ok(await _svc.GetWastageAsync(GetTenantId(), fromUtc, toUtc));

    [HttpGet("completeness")]
    [RequirePermission("bill.view")]
    public async Task<ActionResult<ChargeCompletenessDto>> Completeness(
        [FromQuery] Guid? billId, [FromQuery] Guid? patientJourneyId)
        => Ok(await _svc.GetCompletenessAsync(GetTenantId(), billId, patientJourneyId));
}
