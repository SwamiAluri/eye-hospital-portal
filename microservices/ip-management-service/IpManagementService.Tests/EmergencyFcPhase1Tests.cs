using IpManagementService.Models.Dtos;
using IpManagementService.Services;
using Xunit;

namespace IpManagementService.Tests;

public class IpChecklistAuthEmergencyFcTests
{
    [Fact]
    public void PermEmergencyFc_IsDistinctFromView()
    {
        Assert.Equal("ip.emergency_fc.apply", IpChecklistAuth.PermEmergencyFc);
        Assert.NotEqual(IpChecklistAuth.PermIpView, IpChecklistAuth.PermEmergencyFc);
        Assert.NotEqual(IpChecklistAuth.PermWardEdit, IpChecklistAuth.PermEmergencyFc);
    }

    [Theory]
    [InlineData(new[] { "ip.emergency_fc.apply" }, true)]
    [InlineData(new[] { "ward.checklist.edit" }, false)]
    [InlineData(new[] { "ip_management.view" }, false)]
    [InlineData(new[] { "ot.safety.sign" }, false)]
    [InlineData(new string[0], false)] // Wave 1 D3: empty JWT permissions deny
    public void EmergencyFcPermissionMatrix(string[] permissions, bool allowed)
    {
        var has = IpChecklistAuth.HasPermission(permissions, IpChecklistAuth.PermEmergencyFc);

        Assert.Equal(allowed, has);
    }
}

public class EmergencyFcRequestValidationTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void EmergencyFcRequest_EmptyReason_IsInvalid(string? reason)
    {
        // Mirrors ApplyEmergencyFcAsync guard — reason is mandatory.
        Assert.True(string.IsNullOrWhiteSpace(reason));
    }

    [Fact]
    public void EmergencyFcRequest_WithReason_IsValid()
    {
        var req = new EmergencyFcRequest("Trauma overnight — surgery cannot wait", false, false, false);
        Assert.False(string.IsNullOrWhiteSpace(req.Reason));
    }
}
