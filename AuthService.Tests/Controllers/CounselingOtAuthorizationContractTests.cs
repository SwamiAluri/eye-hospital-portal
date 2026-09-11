using System.Reflection;
using AuthService.Authorization;
using AuthService.Controllers;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace AuthService.Tests.Controllers;

/// <summary>
/// FS-03 — Finalize OT API authorization contract must remain counseling_sessions.update
/// for mutations and counseling_sessions.read for reads (server-side security boundary).
/// </summary>
public class CounselingOtAuthorizationContractTests
{
    private static RequirePermissionAttribute? Attr(string methodName)
    {
        var method = typeof(CounselingController).GetMethod(
            methodName,
            BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);
        Assert.NotNull(method);
        return method!.GetCustomAttribute<RequirePermissionAttribute>();
    }

    [Theory]
    [InlineData(nameof(CounselingController.UpsertOtSchedule))]
    [InlineData(nameof(CounselingController.UpdateOtSlot))]
    [InlineData(nameof(CounselingController.ConfirmOtSchedule))]
    [InlineData(nameof(CounselingController.FinaliseOtSchedule))]
    [InlineData(nameof(CounselingController.CancelOtSchedule))]
    [InlineData(nameof(CounselingController.ReopenOtCase))]
    [InlineData(nameof(CounselingController.PrepareOtList))]
    [InlineData(nameof(CounselingController.UpdateOtDetails))]
    public void Ot_mutations_require_counseling_sessions_update(string methodName)
    {
        var attr = Attr(methodName);
        Assert.NotNull(attr);
        Assert.Equal("Permission:counseling_sessions.update", attr!.Policy);
    }

    [Theory]
    [InlineData(nameof(CounselingController.GetFinalizeList))]
    [InlineData(nameof(CounselingController.GetOtList))]
    [InlineData(nameof(CounselingController.GetOtScheduleDetail))]
    public void Ot_reads_require_counseling_sessions_read(string methodName)
    {
        var attr = Attr(methodName);
        Assert.NotNull(attr);
        Assert.Equal("Permission:counseling_sessions.read", attr!.Policy);
    }

    [Fact]
    public void Ot_mutations_do_not_use_outpatient_checklist_permission()
    {
        var mutateMethods = new[]
        {
            nameof(CounselingController.UpsertOtSchedule),
            nameof(CounselingController.ConfirmOtSchedule),
            nameof(CounselingController.FinaliseOtSchedule),
            nameof(CounselingController.PrepareOtList),
            nameof(CounselingController.UpdateOtDetails),
            nameof(CounselingController.CancelOtSchedule),
            nameof(CounselingController.ReopenOtCase),
        };

        foreach (var name in mutateMethods)
        {
            var attr = Attr(name);
            Assert.NotNull(attr);
            Assert.DoesNotContain("outpatient_checklist", attr!.Policy);
            Assert.Equal("Permission:counseling_sessions.update", attr.Policy);
        }
    }
}
