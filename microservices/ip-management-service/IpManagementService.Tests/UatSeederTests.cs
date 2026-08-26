using IpManagementService.Services.Uat;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Xunit;

namespace IpManagementService.Tests;

public class UatSeederTests
{
    [Fact]
    public void Catalog_HasFiveReplicasPerScenario()
    {
        var expanded = UatScenarioCatalog.Expand();
        Assert.Equal(UatScenarioCatalog.Scenarios.Length * UatScenarioCatalog.ReplicasPerScenario, expanded.Count);
        Assert.Equal("UAT-IP-001", expanded[0].Code);
        Assert.All(expanded, row => Assert.StartsWith("UAT-IP-", row.Code));
        Assert.True(expanded.Count >= 25);
    }

    [Fact]
    public void Environment_DisabledInProduction()
    {
        var env = new FakeHostEnvironment { EnvironmentName = "Production" };
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["EnableUatDataSeeder"] = "true",
        }).Build();
        Assert.False(UatEnvironment.IsEnabled(env, config));
        Assert.Throws<UnauthorizedAccessException>(() => UatEnvironment.EnsureEnabled(env, config));
    }

    [Fact]
    public void Environment_RequiresFlagInDevelopment()
    {
        var env = new FakeHostEnvironment { EnvironmentName = "Development" };
        var off = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["EnableUatDataSeeder"] = "false",
        }).Build();
        Assert.False(UatEnvironment.IsEnabled(env, off));

        var on = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["EnableUatDataSeeder"] = "true",
        }).Build();
        Assert.True(UatEnvironment.IsEnabled(env, on));
    }

    [Fact]
    public void FailureFlags_AreInProcessOnly()
    {
        UatFailureFlags.Clear();
        UatFailureFlags.Set("ccms_unavailable", true);
        Assert.True(UatFailureFlags.IsOn("ccms_unavailable"));
        UatFailureFlags.Clear();
        Assert.False(UatFailureFlags.IsOn("ccms_unavailable"));
    }

    private sealed class FakeHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "test";
        public string ContentRootPath { get; set; } = ".";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
