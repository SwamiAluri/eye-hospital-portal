using IpManagementService.Models.Dtos;
using IpManagementService.Services;
using Xunit;

namespace IpManagementService.Tests;

public class IpBillingFacadeTests
{
    [Fact]
    public async Task NoOpBillingClient_RefusesToRecordLocalLedger()
    {
        var client = new NoOpAuthBillingClient();
        Assert.Equal(Guid.Empty, await client.EnsureBillAsync(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 1, Guid.NewGuid()));
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            client.RecordPaymentAsync(Guid.NewGuid(), Guid.NewGuid(), "Payment", "Cash", 10, null, null, null));
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            client.ChargeItemsAsync(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "k", []));
    }

    [Fact]
    public void AddBillingRequest_DoesNotUseRunningTotalFormula()
    {
        var req = new AddBillingTransactionRequest("Payment", "Cash", 100, null, null);
        Assert.Equal(100, req.Amount);
        Assert.Equal("Payment", req.TransactionType);
    }

    [Fact]
    public void CutoverMapper_UnmatchedWithoutJourneyBill()
    {
        Assert.Equal("unmatched", IpBillingCutoverMapper.Classify(null, null, "unmapped"));
        Assert.Equal("pending_map", IpBillingCutoverMapper.Classify(Guid.NewGuid(), null, "unmapped"));
        Assert.Equal("mapped", IpBillingCutoverMapper.Classify(Guid.NewGuid(), Guid.NewGuid(), "unmapped"));
    }

    [Fact]
    public void CutoverMapper_MapsHistoricalKinds()
    {
        Assert.Equal("Advance", IpBillingCutoverMapper.MapPaymentKind("Advance"));
        Assert.Equal("Discount", IpBillingCutoverMapper.MapPaymentKind("Discount"));
        Assert.Equal("Refund", IpBillingCutoverMapper.MapPaymentKind("Refund"));
        Assert.Equal("Reversal", IpBillingCutoverMapper.MapPaymentKind("Reversal"));
        Assert.Equal("Payment", IpBillingCutoverMapper.MapPaymentKind("Payment"));
    }
}
