using Xunit;

namespace LaboratoryApi.Tests;

/// <summary>
/// L-AUTH-01 runtime 404 regression: LaboratoryApi must register the authorize HTTP route
/// that the FE client targets (POST /api/lms/testing/results/{id}/authorize).
/// </summary>
public class TestingAuthorizeRouteContractTests
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
    public void Authorize_Endpoint_Is_Post_Lms_Testing_Results_Id_Authorize()
    {
        var src = ReadTestingFunctionsSource();

        Assert.Contains("[Function(\"LmsResultAuthorize\")]", src);
        Assert.Contains(
            "[HttpTrigger(AuthorizationLevel.Anonymous, \"post\", Route = \"lms/testing/results/{id:guid}/authorize\")]",
            src);
        Assert.Contains("AuthorizeAsync", src);
        Assert.Contains("LaboratoryAuthz.ResultsAuthorize", src);
    }

    [Fact]
    public void Verify_Endpoint_Remains_Distinct_From_Authorize()
    {
        var src = ReadTestingFunctionsSource();

        Assert.Contains(
            "Route = \"lms/testing/results/{id:guid}/verify\"",
            src);
        Assert.Contains(
            "Route = \"lms/testing/results/{id:guid}/authorize\"",
            src);
        Assert.Contains("[Function(\"LmsResultVerify\")]", src);
        Assert.Contains("[Function(\"LmsResultAuthorize\")]", src);
    }
}
