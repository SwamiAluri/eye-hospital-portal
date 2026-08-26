using IpManagementService.Services;
using Xunit;

namespace IpManagementService.Tests;

public class RoleActionAuthTests
{
    [Fact]
    public void ViewPermission_DoesNotAllowClinicalMutation()
    {
        string[] view = ["ip_management.view"];
        Assert.False(IpChecklistAuth.AllowsClinicalTransition(view, "Admitted"));
        Assert.False(IpChecklistAuth.AllowsClinicalTransition(view, "SentToOT"));
        Assert.False(IpChecklistAuth.AllowsClinicalTransition(view, "InOT"));
        Assert.False(IpChecklistAuth.AllowsClinicalTransition(view, "Discharged"));
        Assert.False(IpChecklistAuth.AllowsBillingMutation(view, "Payment"));
        Assert.False(IpChecklistAuth.AllowsBillingMutation(view, "Refund"));
    }

    [Fact]
    public void WardEdit_AllowsAdmitSendDischarge_NotOtAccept()
    {
        string[] ward = ["ward.checklist.edit"];
        Assert.True(IpChecklistAuth.AllowsClinicalTransition(ward, "Admitted"));
        Assert.True(IpChecklistAuth.AllowsClinicalTransition(ward, "ReadyForSurgery"));
        Assert.True(IpChecklistAuth.AllowsClinicalTransition(ward, "SentToOT"));
        Assert.True(IpChecklistAuth.AllowsClinicalTransition(ward, "Discharged"));
        Assert.False(IpChecklistAuth.AllowsClinicalTransition(ward, "InOT"));
        Assert.False(IpChecklistAuth.AllowsClinicalTransition(ward, "SurgeryCompleted"));
    }

    [Fact]
    public void OtSign_AllowsAcceptAndComplete_NotAdmit()
    {
        string[] ot = ["ot.safety.sign"];
        Assert.True(IpChecklistAuth.AllowsClinicalTransition(ot, "InOT"));
        Assert.True(IpChecklistAuth.AllowsClinicalTransition(ot, "SurgeryCompleted"));
        Assert.False(IpChecklistAuth.AllowsClinicalTransition(ot, "Admitted"));
        Assert.False(IpChecklistAuth.AllowsClinicalTransition(ot, "Discharged"));
    }

    [Fact]
    public void BoundViewOnly_BlocksAdmitAtCommandLayer()
    {
        var ctx = new JourneyCommandAuthContext();
        ctx.Bind(["ip_management.view"]);
        Assert.Throws<UnauthorizedAccessException>(ctx.RequireAdmit);
        Assert.Throws<UnauthorizedAccessException>(ctx.RequireEmergencyFc);
        Assert.Throws<UnauthorizedAccessException>(() => ctx.RequireBillingMutation("Refund"));
    }

    [Fact]
    public void UnboundContext_AllowsCommandLayer_ForTestsAndJobs()
    {
        var ctx = new JourneyCommandAuthContext();
        var ex = Record.Exception(ctx.RequireAdmit);
        Assert.Null(ex);
    }

    [Fact]
    public void Refund_IsFailClosed_WithoutRefundPermission()
    {
        Assert.False(IpChecklistAuth.AllowsBillingMutation(["bill.update"], "Refund"));
        Assert.True(IpChecklistAuth.AllowsBillingMutation(["bill.update"], "Payment"));
        Assert.True(IpChecklistAuth.AllowsBillingMutation(["opd_bill.refund"], "Refund"));
        Assert.False(IpChecklistAuth.HasPermission(["ip.emergency_fc.apply"], IpChecklistAuth.PermDischargeOverride));
        Assert.False(IpChecklistAuth.HasPermission(["ot.safety.sign"], IpChecklistAuth.PermImplantMismatchOverride));
        Assert.True(IpChecklistAuth.HasPermission(["ip.implant.mismatch.override"], IpChecklistAuth.PermImplantMismatchOverride));
        Assert.True(IpChecklistAuth.HasPermission(["*"], IpChecklistAuth.PermImplantMismatchOverride));
        Assert.False(IpChecklistAuth.HasPermission(["ward.checklist.edit"], IpChecklistAuth.PermSafetyTokenPrint));
        Assert.True(IpChecklistAuth.HasPermission(["ip.safety_token.print"], IpChecklistAuth.PermSafetyTokenPrint));
        Assert.True(IpChecklistAuth.HasPermission(["*"], IpChecklistAuth.PermSafetyTokenPrint));
        Assert.False(IpChecklistAuth.HasPermission(["ward.checklist.edit"], IpChecklistAuth.PermPostOpManage));
        Assert.True(IpChecklistAuth.HasPermission(["ip.postop.manage"], IpChecklistAuth.PermPostOpManage));
        Assert.True(IpChecklistAuth.HasPermission(["*"], IpChecklistAuth.PermPostOpManage));
    }

    [Fact]
    public void BoundWithoutImplantOverride_BlocksMismatchCommand()
    {
        var ctx = new JourneyCommandAuthContext();
        ctx.Bind(["ot.safety.sign"]);
        Assert.Throws<UnauthorizedAccessException>(ctx.RequireImplantMismatchOverride);
    }

    [Fact]
    public void UnboundContext_AllowsImplantOverride_ForTestsAndJobs()
    {
        var ctx = new JourneyCommandAuthContext();
        var ex = Record.Exception(ctx.RequireImplantMismatchOverride);
        Assert.Null(ex);
    }

    [Fact]
    public void BoundWithoutSafetyTokenPrint_BlocksPrintCommand()
    {
        var ctx = new JourneyCommandAuthContext();
        ctx.Bind(["ward.checklist.edit"]);
        Assert.Throws<UnauthorizedAccessException>(ctx.RequireSafetyTokenPrint);
    }

    [Fact]
    public void BoundWithoutPostOpManage_BlocksTaperWrite()
    {
        var ctx = new JourneyCommandAuthContext();
        ctx.Bind(["ward.checklist.edit"]);
        Assert.Throws<UnauthorizedAccessException>(ctx.RequirePostOpManage);
    }

    [Fact]
    public void UnboundContext_AllowsPostOpManage_ForTestsAndJobs()
    {
        var ctx = new JourneyCommandAuthContext();
        var ex = Record.Exception(ctx.RequirePostOpManage);
        Assert.Null(ex);
    }

    [Fact]
    public void UnboundContext_AllowsSafetyTokenPrint_ForTestsAndJobs()
    {
        var ctx = new JourneyCommandAuthContext();
        var ex = Record.Exception(ctx.RequireSafetyTokenPrint);
        Assert.Null(ex);
    }

    [Fact]
    public void UnmarkReady_RequiresDedicatedPermission_NotWardEdit()
    {
        string[] ward = ["ward.checklist.edit"];
        string[] unmark = ["ip.ot.unmark_ready"];
        Assert.False(IpChecklistAuth.AllowsClinicalTransition(ward, "ReadyForSurgery", "Admitted"));
        Assert.True(IpChecklistAuth.AllowsClinicalTransition(unmark, "ReadyForSurgery", "Admitted"));
        Assert.True(IpChecklistAuth.AllowsClinicalTransition(ward, "Admitted"));
        Assert.False(IpChecklistAuth.AllowsClinicalTransition(unmark, "Admitted", "ReadyForSurgery"));
    }
}
