using AuthService.Services;
using Xunit;

namespace AuthService.Tests;

/// <summary>Legacy path under microservices — keep interface smoke if this project is built separately.</summary>
public class FollowupBranchEffectiveBranchInterfaceSmokeTests
{
    [Fact]
    public void Interface_exposes_ResolveEffectiveBranchAsync()
    {
        var method = typeof(IFollowupBranchAccessService).GetMethod(
            nameof(IFollowupBranchAccessService.ResolveEffectiveBranchAsync));
        Assert.NotNull(method);
        Assert.Equal(typeof(Task<Guid>), method!.ReturnType);
    }
}
