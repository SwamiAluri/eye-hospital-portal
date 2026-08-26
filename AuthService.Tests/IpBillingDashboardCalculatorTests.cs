using AuthService.Services;
using Xunit;

namespace AuthService.Tests;

public class IpBillingDashboardCalculatorTests
{
    private static readonly DateTime MonthStart = new(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime MonthEnd = new(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void ResolveRange_Today_IsExplicitUtcDay()
    {
        var now = new DateTime(2026, 8, 23, 15, 0, 0, DateTimeKind.Utc);
        var (from, to, _) = IpBillingDashboardCalculator.ResolveRange("today", null, null, now);
        Assert.Equal(new DateTime(2026, 8, 23, 0, 0, 0, DateTimeKind.Utc), from);
        Assert.Equal(new DateTime(2026, 8, 24, 0, 0, 0, DateTimeKind.Utc), to);
    }

    [Fact]
    public void BilledUsesBillDate_CollectedUsesPaymentDate()
    {
        var bills = new[]
        {
            Fact(Guid.NewGuid(), MonthStart.AddDays(2), 10000, 0, false,
            [
                Pay("Payment", 4000, MonthStart.AddDays(20), "cash"),
            ]),
            Fact(Guid.NewGuid(), MonthStart.AddMonths(-1), 5000, 0, false,
            [
                Pay("Payment", 5000, MonthStart.AddDays(3), "upi"),
            ]),
        };

        var result = IpBillingDashboardCalculator.Compute(bills, MonthStart, MonthEnd, "This month");
        Assert.Equal(10000, result.TotalBilled);
        Assert.Equal(9000, result.TotalCollected);
        Assert.Equal("opd_bills.bill_date", result.BilledDateBasis);
        Assert.Equal("opd_bill_payments.payment_date", result.CollectionDateBasis);
    }

    [Fact]
    public void PatientAndPayerOutstanding_AreSeparated()
    {
        var bills = new[]
        {
            Fact(Guid.NewGuid(), MonthStart, 10000, 7000, true,
            [
                Pay("Payment", 2000, MonthStart.AddDays(1), "cash"),
            ]),
        };

        var result = IpBillingDashboardCalculator.Compute(bills, MonthStart, MonthEnd, "m");
        Assert.Equal(1000, result.PatientOutstanding);
        Assert.Equal(7000, result.PayerOutstanding);
        Assert.NotEqual(result.PatientOutstanding + result.PayerOutstanding, result.PatientOutstanding);
        Assert.Equal(1, result.Patients.Count);
        Assert.Equal(1000, result.Patients[0].PatientOutstanding);
        Assert.Equal(7000, result.Patients[0].PayerOutstanding);
    }

    [Fact]
    public void RefundsAndAdjustments_UsePaymentDate()
    {
        var bills = new[]
        {
            Fact(Guid.NewGuid(), MonthStart, 1000, 0, false,
            [
                Pay("Payment", 1000, MonthStart.AddDays(1), "cash"),
                Pay("Refund", 250, MonthStart.AddDays(2), "cash"),
                Pay("Discount", 100, MonthStart.AddDays(1), "cash"),
            ]),
        };
        var result = IpBillingDashboardCalculator.Compute(bills, MonthStart, MonthEnd, "m");
        Assert.Equal(250, result.Refunds);
        Assert.Equal(100, result.Adjustments);
        Assert.Equal(1000, result.TotalCollected);
    }

    [Fact]
    public void Aging_UsesBillDateAsOfPeriodEnd()
    {
        var old = new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc);
        var bills = new[]
        {
            Fact(Guid.NewGuid(), old, 5000, 0, false, []),
        };
        var result = IpBillingDashboardCalculator.Compute(bills, MonthStart, MonthEnd, "m");
        var bucket = result.Aging.Single(a => a.Key == "31_60");
        Assert.Equal(1, bucket.Count);
        Assert.Equal(5000, bucket.PatientOutstanding);
        Assert.Equal(0, bucket.PayerOutstanding);
    }

    [Fact]
    public void PaymentInstrument_IsNotPayerCategory()
    {
        var bills = new[]
        {
            Fact(Guid.NewGuid(), MonthStart, 1000, 0, false,
            [
                Pay("Payment", 400, MonthStart.AddDays(1), "cash"),
                Pay("Payment", 600, MonthStart.AddDays(1), "Insurance"),
            ]),
        };
        var result = IpBillingDashboardCalculator.Compute(bills, MonthStart, MonthEnd, "m");
        Assert.Contains(result.PaymentInstruments, i => i.Key == "cash" && i.Amount == 400);
        Assert.Contains(result.PaymentInstruments, i => i.Key == "other" && i.Amount == 600);
        Assert.Contains(result.PayerMix, p => p.Key == "self");
        Assert.DoesNotContain(result.PayerMix, p => p.Key == "cash");
    }

    [Fact]
    public void Pipeline_AdvanceHeld_WhenOnlyAdvanceCollected()
    {
        var bills = new[]
        {
            Fact(Guid.NewGuid(), MonthStart, 8000, 0, false,
            [
                Pay("Advance", 2000, MonthStart.AddDays(1), "upi"),
            ]),
        };
        var result = IpBillingDashboardCalculator.Compute(bills, MonthStart, MonthEnd, "m");
        Assert.Contains(result.Pipeline, p => p.Key == "advance_held" && p.Count == 1);
    }

    [Fact]
    public void Pipeline_PackageConfirmed_WhenGeneratedWithNoPayments()
    {
        var bills = new[]
        {
            Fact(Guid.NewGuid(), MonthStart, 8000, 0, false, []),
        };
        var result = IpBillingDashboardCalculator.Compute(bills, MonthStart, MonthEnd, "m");
        Assert.Contains(result.Pipeline, p => p.Key == "package_confirmed" && p.Count == 1);
        Assert.Equal(9, result.Pipeline.Count);
        Assert.Contains(result.PayerMix, p => p.Key == "tpa");
        Assert.Contains(result.PayerMix, p => p.Key == "government");
        Assert.Contains(result.PayerMix, p => p.Key == "corporate");
    }

    [Fact]
    public void ClassifyPayer_PrefersCcmsPayerType()
    {
        Assert.Equal("tpa", IpBillingDashboardCalculator.ClassifyPayer(true, "Star Health", "tpa"));
        Assert.Equal("government", IpBillingDashboardCalculator.ClassifyPayer(true, "Star Health", "govt"));
    }

    [Fact]
    public void ResolveRange_Custom_UsesExplicitDates()
    {
        var from = new DateTime(2026, 8, 10, 0, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2026, 8, 12, 0, 0, 0, DateTimeKind.Utc);
        var (f, t, label) = IpBillingDashboardCalculator.ResolveRange("custom", from, to, MonthStart);
        Assert.Equal(from, f);
        Assert.Equal(new DateTime(2026, 8, 13, 0, 0, 0, DateTimeKind.Utc), t);
        Assert.Equal("Custom range", label);
    }

    [Fact]
    public void ClassifyPayer_GovernmentAndTpa()
    {
        Assert.Equal("government", IpBillingDashboardCalculator.ClassifyPayer(true, "CGHS Hyderabad"));
        Assert.Equal("tpa", IpBillingDashboardCalculator.ClassifyPayer(true, "Medi Assist TPA"));
        Assert.Equal("self", IpBillingDashboardCalculator.ClassifyPayer(false, null));
    }

    private static IpBillingDashboardCalculator.PaymentFact Pay(string kind, decimal amount, DateTime when, string mode)
        => new(kind, amount, "completed", when, mode);

    private static IpBillingDashboardCalculator.BillFact Fact(
        Guid patientId, DateTime billDate, decimal gross, decimal insurance, bool isInsurance,
        IpBillingDashboardCalculator.PaymentFact[] payments)
        => new(
            Guid.NewGuid(), patientId, Guid.NewGuid(), "IP-1", billDate, gross, 0, insurance,
            false, isInsurance, "generated", "Test Patient", "UHID1",
            isInsurance ? "Star Health" : null, payments);
}
