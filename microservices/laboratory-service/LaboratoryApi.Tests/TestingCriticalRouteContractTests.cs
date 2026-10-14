using Xunit;

namespace LaboratoryApi.Tests;

/// <summary>L-CRT-01 — Critical HTTP routes must match FE client contracts.</summary>
public class TestingCriticalRouteContractTests
{
    private static string ReadTestingFunctionsSource()
    {
        var path = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "..", "..", "..", "..",
            "LaboratoryApi", "Functions", "TestingFunctions.cs"));
        Assert.True(File.Exists(path), $"Missing TestingFunctions.cs at {path}");
        return File.ReadAllText(path);
    }

    [Fact]
    public void Critical_Create_Acknowledge_And_Queue_Routes_Registered()
    {
        var src = ReadTestingFunctionsSource();

        Assert.Contains("[Function(\"LmsResultCriticalCreate\")]", src);
        Assert.Contains(
            "Route = \"lms/testing/results/{id:guid}/critical\"",
            src);
        Assert.Contains("[Function(\"LmsResultCriticalAcknowledge\")]", src);
        Assert.Contains(
            "Route = \"lms/testing/results/{id:guid}/critical/{criticalEventId:guid}/acknowledge\"",
            src);
        Assert.Contains("[Function(\"LmsCriticalWorkQueue\")]", src);
        Assert.Contains("Route = \"lms/testing/critical-work-queue\"", src);
        Assert.Contains("LaboratoryAuthz.ResultsCriticalManage", src);
        Assert.Contains("LaboratoryAuthz.ResultsCriticalAcknowledge", src);
        Assert.DoesNotContain("ResultStatus = Critical", src);
        Assert.DoesNotContain("Twilio", src);
        Assert.DoesNotContain("SmtpClient", src);
    }
}
