using IpManagementService.Models.Domain;
using IpManagementService.Services;
using Xunit;

namespace IpManagementService.Tests;

public class SurgicalSafetyBillingGateTests
{
    [Fact]
    public void PaidSettledOnJourney_DoesNotSatisfyOtBillingGate()
    {
        var journey = new PatientJourney { FinancialState = FinancialState.Paid, BalanceDue = 0 };
        var checklist = new SurgicalSafetyChecklist();
        Assert.False(SurgicalSafetyService.IsBillingGateSatisfied(journey, checklist));
        Assert.False(SurgicalSafetyService.IsBillingVerifiedAuto(journey));
    }

    [Fact]
    public void LinkedOpdBill_SatisfiesOtBillingGate()
    {
        var journey = new PatientJourney
        {
            FinancialState = FinancialState.Confirmed,
            OpdBillId = Guid.NewGuid(),
        };
        Assert.True(SurgicalSafetyService.IsBillingGateSatisfied(journey, new SurgicalSafetyChecklist()));
        Assert.True(SurgicalSafetyService.IsBillingVerifiedAuto(journey));
    }

    [Fact]
    public void EmergencyFc_SatisfiesOtBillingGate()
    {
        var journey = new PatientJourney { EmergencyFcApplied = true, FinancialState = FinancialState.NotCreated };
        Assert.True(SurgicalSafetyService.IsBillingGateSatisfied(journey, new SurgicalSafetyChecklist()));
    }

    [Fact]
    public void PrivilegedBillingOverride_SatisfiesOtBillingGate()
    {
        var journey = new PatientJourney { FinancialState = FinancialState.NotCreated };
        var checklist = new SurgicalSafetyChecklist { BillingVerifiedOverride = true };
        Assert.True(SurgicalSafetyService.IsBillingGateSatisfied(journey, checklist));
    }
}
