using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;
using Xunit;

namespace IpManagementService.Tests;

public class PreOpReadinessEngineTests
{
    private static PreOpCompletionDto Comp(
        string key,
        string category,
        bool done = false,
        bool blocking = false,
        string? formCode = null,
        string? resultValue = null)
        => new(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            key, key, category,
            blocking, false,
            done, false, null,
            null, null,
            null, null, DateTime.UtcNow,
            formCode, null,
            resultValue, null, null, null, null);

    [Fact]
    public void Compute_counts_unlocked_steps_ready()
    {
        var completions = new List<PreOpCompletionDto>
        {
            Comp("surgery_consent_signed", "Consent", done: true, blocking: true),
            Comp("payment_mode_confirmed", "Financial", done: true, blocking: true),
        };

        var dto = PreOpReadinessEngine.Compute(
            ClinicalState.Expected,
            "Paid",
            completions,
            null,
            new PreOpReadinessEngine.InvestigationSlice(3, 3, 0),
            null,
            new PreOpReadinessEngine.PacSlice("NotStarted"));

        Assert.True(dto.CountableSteps >= 3);
        Assert.Contains(dto.Steps, s => s.Key == "consent" && s.Status == "completed");
        Assert.Contains(dto.Steps, s => s.Key == "evaluation" && s.Locked);
    }

    [Fact]
    public void Compute_pac_complete_when_pac_done()
    {
        var dto = PreOpReadinessEngine.Compute(
            ClinicalState.Admitted,
            null,
            [],
            null,
            new PreOpReadinessEngine.InvestigationSlice(0, 0, 0),
            null,
            new PreOpReadinessEngine.PacSlice("Completed"));

        var pacStep = dto.Steps.First(s => s.Key == "pac");
        Assert.Equal("completed", pacStep.Status);
        Assert.Equal(1, pacStep.Completed);
        Assert.DoesNotContain(dto.Steps, s => s.Key == "anaesthesia");
    }

    [Fact]
    public void Summary_maps_ready_steps_to_row_meter()
    {
        var dto = new PreOpReadinessDto([], ReadySteps: 2, CountableSteps: 5, Blockers: 1);
        var (done, total) = PreOpReadinessEngine.Summary(dto);
        Assert.Equal(2, done);
        Assert.Equal(5, total);
    }
}

public class WardReadinessTests
{
    [Theory]
    [InlineData(ClinicalState.SentToOT)]
    [InlineData(ClinicalState.InOT)]
    public void PreOpStates_excludes_post_preop(string state)
    {
        Assert.DoesNotContain(state, WardReadiness.PreOpStates);
    }
}
