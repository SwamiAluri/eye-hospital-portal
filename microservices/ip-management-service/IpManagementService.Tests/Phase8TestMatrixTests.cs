using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace IpManagementService.Tests;

/// <summary>Phase 8 clinical / OT / security matrix remaining from prior phases.</summary>
public class Phase8TestMatrixTests
{
    [Theory]
    [InlineData(ClinicalState.Expected, ClinicalState.Admitted)]
    [InlineData(ClinicalState.Admitted, ClinicalState.ReadyForSurgery)]
    [InlineData(ClinicalState.ReadyForSurgery, ClinicalState.SentToOT)]
    [InlineData(ClinicalState.SentToOT, ClinicalState.InOT)]
    [InlineData(ClinicalState.InOT, ClinicalState.SurgeryCompleted)]
    [InlineData(ClinicalState.SurgeryCompleted, ClinicalState.PostOp)]
    [InlineData(ClinicalState.PostOp, ClinicalState.ReadyForDischarge)]
    [InlineData(ClinicalState.ReadyForDischarge, ClinicalState.Discharged)]
    public void Clinical_ForwardPath_IsAllowed(string from, string to)
    {
        var ex = Record.Exception(() => StateTransitionValidator.ValidateClinical(from, to));
        Assert.Null(ex);
    }

    [Theory]
    [InlineData(OtState.NotSent, OtState.SentToOT)]
    [InlineData(OtState.SentToOT, OtState.Accepted)]
    [InlineData(OtState.Accepted, OtState.InProgress)]
    [InlineData(OtState.InProgress, OtState.Completed)]
    public void Ot_ForwardPath_IsAllowed(string from, string to)
    {
        var ex = Record.Exception(() => StateTransitionValidator.ValidateOt(from, to));
        Assert.Null(ex);
    }

    [Fact]
    public void Ot_DuplicateComplete_IsBlocked()
    {
        Assert.Throws<InvalidOperationException>(
            () => StateTransitionValidator.ValidateOt(OtState.Completed, OtState.Completed));
    }

    [Fact]
    public void Death_AllowedInOt_LamaIsNot()
    {
        var death = Record.Exception(() =>
            StateTransitionValidator.ValidateTypedDischarge(ClinicalState.InOT, DischargeType.Death));
        Assert.Null(death);
        Assert.Throws<InvalidOperationException>(() =>
            StateTransitionValidator.ValidateTypedDischarge(ClinicalState.InOT, DischargeType.Lama));
    }

    [Fact]
    public void TransferDischarge_AllowedFromAdmitted()
    {
        var ex = Record.Exception(() =>
            StateTransitionValidator.ValidateTypedDischarge(ClinicalState.Admitted, DischargeType.Transfer));
        Assert.Null(ex);
    }

    [Fact]
    public void PrivilegedEmergencyFc_FailClosedWithoutPermission()
    {
        var ctx = new JourneyCommandAuthContext();
        ctx.Bind(["ip.admit", "ward.checklist.edit"]);
        Assert.Throws<UnauthorizedAccessException>(ctx.RequireEmergencyFc);
        Assert.Throws<UnauthorizedAccessException>(ctx.RequireDischargeOverride);
    }

    [Fact]
    public void OpenBedHistoryUniqueIndex_IsMappedForPostgres()
    {
        using var db = new IpManagementDbContext(
            new DbContextOptionsBuilder<IpManagementDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
                .Options);
        var index = db.Model.FindEntityType(typeof(JourneyBedAssignment))!
            .GetIndexes()
            .Single(i => i.GetDatabaseName() == "ux_journey_bed_assignment_one_open");
        Assert.True(index.IsUnique);
        Assert.Equal("ended_at IS NULL AND deleted_at IS NULL", index.GetFilter());
    }

    [Fact]
    public void PrivilegedEmergencyFc_AllowedWithDedicatedPermission()
    {
        var ctx = new JourneyCommandAuthContext();
        ctx.Bind(["ip.emergency_fc.apply"]);
        var ex = Record.Exception(ctx.RequireEmergencyFc);
        Assert.Null(ex);
    }
}
