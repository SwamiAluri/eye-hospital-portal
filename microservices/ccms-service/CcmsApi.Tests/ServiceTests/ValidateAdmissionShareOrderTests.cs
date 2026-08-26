using CcmsApi.Services;
using CcmsApi.Tests.Fixtures;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace CcmsApi.Tests.ServiceTests;

/// <summary>
/// Reallocate copies the original BillDate onto the new summary. validate-admission
/// (discharge + Billing finalize) must pick the latest CreatedAt row, not BillDate.
/// </summary>
public class ValidateAdmissionShareOrderTests : IDisposable
{
    private readonly InMemoryDbFixture _fix = new();

    [Fact]
    public async Task ValidateAdmission_UsesLatestCreatedAt_WhenBillDateIsCopied()
    {
        var journeyId = Guid.NewGuid();
        var coverage = _fix.SeedCase(state: "PARTIAL_APPROVAL", caseNumber: "CCMS-SHARE-ORDER");
        coverage.JourneyId = journeyId;
        coverage.ApprovedAmount = 100_000m;
        await _fix.Db.SaveChangesAsync();

        var billDate = new DateTime(2026, 8, 20, 0, 0, 0, DateTimeKind.Utc);
        var older = _fix.SeedBillingSummary(coverage.Id, 105_000m, 63_000m, 42_000m, copayAmount: 7_000m);
        older.BillDate = billDate;
        older.CreatedAt = new DateTime(2026, 8, 20, 10, 0, 0, DateTimeKind.Utc);

        var newer = _fix.SeedBillingSummary(coverage.Id, 105_000m, 90_000m, 15_000m, copayAmount: 10_000m);
        newer.BillDate = billDate;
        newer.CreatedAt = new DateTime(2026, 8, 26, 12, 0, 0, DateTimeKind.Utc);
        await _fix.Db.SaveChangesAsync();

        var svc = new CoverageCaseService(
            _fix.Db,
            workflow: null!,
            fyService: null!,
            authClient: null!,
            NullLogger<CoverageCaseService>.Instance);

        var result = await svc.ValidateAdmissionAsync(_fix.TenantId, journeyId, sessionId: null);

        result.CaseId.Should().Be(coverage.Id);
        result.PatientShareAmount.Should().Be(15_000m);
        result.PayerShareAmount.Should().Be(90_000m);
    }

    public void Dispose() => _fix.Dispose();
}
