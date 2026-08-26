using IpManagementService.Services;
using Xunit;

namespace IpManagementService.Tests;

public class Gs1BarcodeParserTests
{
    private const string MockupConcatenated = "01089012345678902188213101728063010B2291";
    private const string Parenthesized = "(01)08901234567890(21)88213(10)B2291(17)280630";
    private const string Gs1WithFnc1 = "01089012345678902188213\u001d10B2291\u001d17280630";
    private const string DataMatrixConcatenated = "]d201089012345678901728063010B22912188213";

    [Fact]
    public void Parenthesized_01_21_10_17()
    {
        var r = Gs1BarcodeParser.Parse(Parenthesized);
        Assert.True(r.Parsed);
        Assert.Equal("08901234567890", r.Gtin);
        Assert.Equal("88213", r.Serial);
        Assert.Equal("B2291", r.Lot);
        Assert.Equal(new DateOnly(2028, 6, 30), r.Expiry);
        Assert.Equal("gs1", r.Symbology);
    }

    [Fact]
    public void Concatenated_01_21_10_17_WithFnc1()
    {
        var r = Gs1BarcodeParser.Parse(Gs1WithFnc1);
        Assert.True(r.Parsed);
        Assert.Equal("08901234567890", r.Gtin);
        Assert.Equal("88213", r.Serial);
        Assert.Equal("B2291", r.Lot);
        Assert.Equal(new DateOnly(2028, 6, 30), r.Expiry);
    }

    [Fact]
    public void DataMatrix_Concatenated_01_17_10_21()
    {
        var r = Gs1BarcodeParser.Parse(DataMatrixConcatenated);
        Assert.True(r.Parsed);
        Assert.Equal("gs1-datamatrix", r.Symbology);
        Assert.Equal("08901234567890", r.Gtin);
        Assert.Equal("88213", r.Serial);
        Assert.Equal("B2291", r.Lot);
        Assert.Equal(new DateOnly(2028, 6, 30), r.Expiry);
    }

    [Fact]
    public void MockupString_RecoversSerialLotExpiry()
    {
        var r = Gs1BarcodeParser.Parse(MockupConcatenated);
        Assert.True(r.Parsed);
        Assert.Equal("08901234567890", r.Gtin);
        Assert.Equal("88213", r.Serial);
        Assert.Equal("B2291", r.Lot);
        Assert.Equal(new DateOnly(2028, 6, 30), r.Expiry);
    }

    [Fact]
    public void InvalidGs1_IsUnreadable()
    {
        var r = Gs1BarcodeParser.Parse("01XX");
        Assert.False(r.Parsed);
        Assert.True(r.Unreadable);
        Assert.True(r.IsGs1);
        Assert.Equal(
            "This barcode could not be read. Enter the serial from the pack. Do not guess the power.",
            Gs1BarcodeParser.UnreadableMessage);
    }

    [Fact]
    public void ManualSerial_IsRawNotGs1()
    {
        Assert.True(Gs1BarcodeParser.IsManualSerial("88213"));
        var r = Gs1BarcodeParser.Parse("88213");
        Assert.False(r.Parsed);
        Assert.False(r.Unreadable);
        Assert.Equal("raw", r.Symbology);
    }

    [Fact]
    public void ShortCode_IsNotManual()
        => Assert.False(Gs1BarcodeParser.IsManualSerial("abc"));
}
