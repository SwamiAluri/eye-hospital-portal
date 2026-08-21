using IpManagementService.Services;
using Xunit;

namespace IpManagementService.Tests;

public class IpFinancialFieldClassificationTests
{
    [Fact]
    public void InsurancePreauthSubmitted_IsDeprecated_UnderCcms()
    {
        var meta = IpFinancialFieldClassification.Find("InsurancePreauthSubmitted");
        Assert.NotNull(meta);
        Assert.Equal(IpFinancialFieldClassification.Deprecated, meta!.Classification);
        Assert.Equal("CCMS", meta.CanonicalOwner);
        Assert.True(IpFinancialFieldClassification.IsDeprecated("InsurancePreauthSubmitted"));
    }

    [Fact]
    public void FinancialState_IsClinicalWorkflow_NotBillingSot()
    {
        var meta = IpFinancialFieldClassification.Find("FinancialState");
        Assert.NotNull(meta);
        Assert.Equal(IpFinancialFieldClassification.ClinicalWorkflow, meta!.Classification);
        Assert.Equal("IP", meta.CanonicalOwner);
        Assert.Contains("Billing", meta.Notes);
    }

    [Fact]
    public void TotalPaid_IsBillingProjection()
    {
        var meta = IpFinancialFieldClassification.Find("TotalPaid");
        Assert.NotNull(meta);
        Assert.Equal(IpFinancialFieldClassification.BillingProjection, meta!.Classification);
        Assert.Equal("Billing", meta.CanonicalOwner);
    }
}
