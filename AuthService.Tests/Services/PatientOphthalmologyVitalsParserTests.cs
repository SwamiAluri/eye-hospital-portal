using AuthService.Services;
using Xunit;

namespace AuthService.Tests.Services;

public class PatientOphthalmologyVitalsParserTests
{
    [Fact]
    public void ParseFromDraftJson_ExtractsVaAndIop()
    {
        const string json = """
            {
              "visualAcuityData": { "distanceOD": "6/9", "distanceOS": "6/12" },
              "tonometryData": { "iopOD": 16, "iopOS": 18 }
            }
            """;

        var result = PatientOphthalmologyVitalsParser.ParseFromDraftJson(json);

        Assert.NotNull(result);
        Assert.Equal("6/9", result!.VisualAcuityOd);
        Assert.Equal("6/12", result.VisualAcuityOs);
        Assert.Equal(16m, result.IopOd);
        Assert.Equal(18m, result.IopOs);
    }

    [Fact]
    public void ParseFromDraftJson_ReturnsNullWhenEmpty()
    {
        Assert.Null(PatientOphthalmologyVitalsParser.ParseFromDraftJson(null));
        Assert.Null(PatientOphthalmologyVitalsParser.ParseFromDraftJson("{}"));
    }
}
