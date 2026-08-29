using AuthService.Services;
using Xunit;

namespace AuthService.Tests.Services;

public class OpdClinicalCopyTests
{
    [Fact]
    public void SecondFinalize_DoesNotBlankExistingIol()
    {
        Assert.False(OpdClinicalCopy.ShouldWrite("+21.00 D", null, forceRefresh: false));
        Assert.False(OpdClinicalCopy.ShouldWrite("+21.00 D", "  ", forceRefresh: false));
        Assert.Equal("+21.00 D", OpdClinicalCopy.FirstNonEmpty(null, "+21.00 D"));
    }

    [Fact]
    public void FirstFill_WritesWhenExistingEmpty()
    {
        Assert.True(OpdClinicalCopy.ShouldWrite(null, "+21.00 D", forceRefresh: false));
        Assert.True(OpdClinicalCopy.ShouldWrite("", "+21.00 D", forceRefresh: false));
    }

    [Fact]
    public void Refresh_OverwritesNonEmpty()
    {
        Assert.True(OpdClinicalCopy.ShouldWrite("+19.00 D", "+21.00 D", forceRefresh: true));
        Assert.False(OpdClinicalCopy.ShouldWrite("+19.00 D", null, forceRefresh: true));
    }

    [Fact]
    public void ResolveIol_PrefersSessionThenBiometryOnFirstFill()
        => Assert.Equal("+21.00 D", OpdClinicalCopy.ResolveIol(null, "+21.00 D", "+22.00 D", preferBiometry: false));

    [Fact]
    public void ResolveIol_PrefersBiometryOnRefresh()
        => Assert.Equal("+22.00 D", OpdClinicalCopy.ResolveIol(null, "+21.00 D", "+22.00 D", preferBiometry: true));

    [Fact]
    public void FormatIol_TwoDecimalsWithSign()
    {
        Assert.Equal("+21.00 D", OpdClinicalCopy.FormatIol(21m));
        Assert.Equal("-1.50 D", OpdClinicalCopy.FormatIol(-1.5m));
    }

    [Fact]
    public void MapEye_CounsellorNotationToJourney()
    {
        Assert.Equal("OD", OpdClinicalCopy.MapEyeToJourney("RE"));
        Assert.Equal("OS", OpdClinicalCopy.MapEyeToJourney("LE"));
        Assert.Equal("OU", OpdClinicalCopy.MapEyeToJourney("BE"));
        Assert.Equal("OD", OpdClinicalCopy.MapEyeToBiometry("RIGHT"));
        Assert.Null(OpdClinicalCopy.MapEyeToBiometry("BE"));
    }

    [Fact]
    public void ResolveDiagnosis_NeverUsesRecommendedSurgery()
    {
        var snap = OpdClinicalCopy.ResolveDiagnosis(
            patientDiagnoses: Array.Empty<OpdDiagnosisLine>(),
            clinicalSummaryJson: null,
            examDiagnosis: null,
            recommendedSurgery: "Phaco + IOL");

        Assert.Null(snap.Summary);
        Assert.Null(snap.Json);
    }

    [Fact]
    public void ResolveDiagnosis_PrefersStructuredPatientDiagnosesOverExamAndSummary()
    {
        var snap = OpdClinicalCopy.ResolveDiagnosis(
            patientDiagnoses: new[]
            {
                new OpdDiagnosisLine
                {
                    Icd10 = "H40.1",
                    Description = "Open-angle glaucoma",
                    Laterality = "OS",
                    DiagnosisType = "secondary",
                    IsPrimary = false,
                },
                new OpdDiagnosisLine
                {
                    Icd10 = "H25.1",
                    Description = "Age-related cataract",
                    Laterality = "OD",
                    DiagnosisType = "primary",
                    IsPrimary = true,
                },
            },
            clinicalSummaryJson: """{"diagnosis":"session text"}""",
            examDiagnosis: "exam text",
            recommendedSurgery: "Phaco + IOL");

        Assert.Contains("H25.1", snap.Summary, StringComparison.Ordinal);
        Assert.Contains("H40.1", snap.Summary, StringComparison.Ordinal);
        Assert.StartsWith("H25.1", snap.Summary, StringComparison.Ordinal);
        Assert.DoesNotContain("Phaco", snap.Summary, StringComparison.Ordinal);
        Assert.DoesNotContain("session text", snap.Summary, StringComparison.Ordinal);
        Assert.Contains("\"icd10\":\"H25.1\"", snap.Json, StringComparison.Ordinal);
        Assert.Contains("\"icd10\":\"H40.1\"", snap.Json, StringComparison.Ordinal);
        Assert.Contains("\"isPrimary\":true", snap.Json, StringComparison.Ordinal);
    }

    [Fact]
    public void ResolveDiagnosis_FallsBackToClinicalSummaryThenExam()
    {
        var fromSummary = OpdClinicalCopy.ResolveDiagnosis(
            Array.Empty<OpdDiagnosisLine>(),
            """{"diagnosis":"Immature cataract OD"}""",
            "exam text",
            "Phaco + IOL");
        Assert.Equal("Immature cataract OD", fromSummary.Summary);

        var fromExam = OpdClinicalCopy.ResolveDiagnosis(
            Array.Empty<OpdDiagnosisLine>(),
            """{"chiefComplaint":"blur"}""",
            "Nuclear cataract",
            "Phaco + IOL");
        Assert.Equal("Nuclear cataract", fromExam.Summary);

        var missing = OpdClinicalCopy.ResolveDiagnosis(
            Array.Empty<OpdDiagnosisLine>(), null, "  ", "Phaco + IOL");
        Assert.Null(missing.Summary);
    }
}
