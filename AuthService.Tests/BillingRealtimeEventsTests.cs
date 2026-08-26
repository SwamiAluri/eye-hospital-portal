using AuthService.Services;
using Xunit;

namespace AuthService.Tests;

public class BillingRealtimeEventsTests
{
    [Theory]
    [InlineData("Payment", BillingRealtimeEvents.PaymentReceived)]
    [InlineData("Refund", BillingRealtimeEvents.RefundCreated)]
    [InlineData("Reversal", BillingRealtimeEvents.PaymentReversed)]
    public void Payment_kind_maps_to_invalidation_type_not_amounts(string kind, string expected)
    {
        Assert.Equal(expected, BillingRealtimeEvents.FromPaymentKind(kind));
    }

    [Fact]
    public void Identity_details_exclude_money_fields()
    {
        var details = BillingRealtimeEvents.IdentityDetails(
            Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"));
        Assert.Contains("billId", details);
        Assert.Contains("journeyId", details);
        Assert.DoesNotContain("amount", details, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("balance", details, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("total", details, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("paid", details, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData(BillingRealtimeEvents.PaymentReceived)]
    [InlineData(BillingRealtimeEvents.PaymentReversed)]
    [InlineData(BillingRealtimeEvents.BillCreated)]
    [InlineData(BillingRealtimeEvents.BillFinalized)]
    [InlineData(BillingRealtimeEvents.RefundCreated)]
    [InlineData(BillingRealtimeEvents.PatientObligationChanged)]
    [InlineData(BillingRealtimeEvents.ClaimStatusChanged)]
    public void Spec_billing_event_names_are_defined(string hubType)
    {
        Assert.False(string.IsNullOrWhiteSpace(hubType));
    }
}
