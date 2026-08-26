using IpManagementService.Models.Domain;
using IpManagementService.Services;
using Xunit;

namespace IpManagementService.Tests;

public class VitalThresholdPolicyTests
{
    private static readonly IpVitalThreshold Threshold = IpVitalThreshold.Defaults(Guid.NewGuid());

    private static VitalSign Vital(
        int? sys = null, int? dia = null, int? pulse = null,
        decimal? spo2 = null, decimal? temp = null)
        => new()
        {
            BloodPressureSystolic = sys,
            BloodPressureDiastolic = dia,
            PulseRate = pulse,
            OxygenSaturation = spo2,
            Temperature = temp,
            RecordedAt = DateTime.UtcNow,
        };

    [Fact]
    public void MissingRow_IsNotRecorded()
    {
        var r = VitalThresholdPolicy.Evaluate(null, Threshold);
        Assert.Equal(VitalThresholdPolicy.NotRecorded, r.Status);
    }

    [Fact]
    public void HighBp_200Over120_IsOutOfRangeHigh()
    {
        var r = VitalThresholdPolicy.Evaluate(Vital(sys: 200, dia: 120, pulse: 88, spo2: 98, temp: 98.6m), Threshold);
        Assert.Equal(VitalThresholdPolicy.OutOfRange, r.Status);
        var bp = Assert.Single(r.Findings);
        Assert.Equal("Blood pressure", bp.Measure);
        Assert.Equal("high", bp.Direction);
        Assert.Contains("200/120", bp.Detail);
    }

    [Fact]
    public void NormalVitals_NoWarn()
    {
        var r = VitalThresholdPolicy.Evaluate(Vital(sys: 128, dia: 78, pulse: 72, spo2: 98, temp: 98.6m), Threshold);
        Assert.Equal(VitalThresholdPolicy.Ok, r.Status);
        Assert.Empty(r.Findings);
    }

    [Fact]
    public void FahrenheitTemp_ConvertsBeforeCompare()
    {
        Assert.Equal(37.0m, VitalThresholdPolicy.ToCelsius(98.6m));
        var fever = VitalThresholdPolicy.Evaluate(Vital(sys: 120, dia: 80, pulse: 70, spo2: 98, temp: 102m), Threshold);
        Assert.Equal(VitalThresholdPolicy.OutOfRange, fever.Status);
        Assert.Contains(fever.Findings, f => f.Measure == "Temperature" && f.Direction == "high");
    }

    [Fact]
    public void LowPulseAndSpo2_UseLowWord()
    {
        var r = VitalThresholdPolicy.Evaluate(Vital(sys: 120, dia: 70, pulse: 32, spo2: 88m, temp: 98.2m), Threshold);
        Assert.Equal(VitalThresholdPolicy.OutOfRange, r.Status);
        Assert.Contains(r.Findings, f => f.Measure == "Pulse" && f.Direction == "low");
        Assert.Contains(r.Findings, f => f.Measure == "SpO2" && f.Direction == "low");
    }

    [Fact]
    public void MarkReadyWarning_IsWarn_AndAllowsProceed()
    {
        var warnings = new List<IpManagementService.Models.Dtos.ChecklistGateWarningDto>();
        VitalThresholdPolicy.AddMarkReadyWarning(
            warnings,
            VitalThresholdPolicy.Evaluate(Vital(sys: 192, dia: 114), Threshold));
        Assert.Equal("vitals_out_of_range", warnings[0].Code);
        Assert.Equal("warn", warnings[0].Severity);
        Assert.Contains("high", warnings[0].Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("still mark ready", warnings[0].Message, StringComparison.OrdinalIgnoreCase);

        warnings.Clear();
        VitalThresholdPolicy.AddMarkReadyWarning(warnings, new VitalThresholdPolicy.Result(VitalThresholdPolicy.NotRecorded, []));
        Assert.Equal("vitals_not_recorded", warnings[0].Code);
        Assert.Equal("warn", warnings[0].Severity);

        var mixed = new List<IpManagementService.Models.Dtos.ChecklistGateWarningDto>
        {
            warnings[0],
            new("surgical_consent_unsigned", "blocked", "block", false),
        };
        Assert.Contains(mixed, w => w.Severity == "block");
        Assert.DoesNotContain(warnings, w => w.Severity == "block");
    }
}
