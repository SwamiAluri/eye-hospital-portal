using AuthService.Services;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// DUP-C3A.1 — comparison-only phone normalization (does not mutate stored values).
/// </summary>
public class PatientPhoneComparisonNormalizerTests
{
    [Theory]
    [InlineData("+91 98765 43210", "9876543210")]
    [InlineData("+919876543210", "9876543210")]
    [InlineData("98765 43210", "9876543210")]
    [InlineData("9876543210", "9876543210")]
    [InlineData("  +91-98765-43210  ", "9876543210")]
    [InlineData("(98765) 43210", "9876543210")]
    [InlineData("98765.43210", "9876543210")]
    [InlineData("09876543210", "9876543210")]
    public void Indian_format_variants_normalize_to_same_national_mobile(string raw, string expected)
    {
        Assert.Equal(expected, PatientPhoneComparisonNormalizer.Normalize(raw));
    }

    [Theory]
    [InlineData("+91 98765 43210", "+919876543210")]
    [InlineData("+91 98765 43210", "98765 43210")]
    [InlineData("+91 98765 43210", "9876543210")]
    [InlineData("+919876543210", "98765 43210")]
    [InlineData("+919876543210", "9876543210")]
    [InlineData("98765 43210", "9876543210")]
    public void Approved_matrix_pairs_compare_equal(string a, string b)
    {
        Assert.Equal(
            PatientPhoneComparisonNormalizer.Normalize(a),
            PatientPhoneComparisonNormalizer.Normalize(b));
    }

    [Fact]
    public void Plus_one_us_number_is_not_stripped_to_indian_ten_digits()
    {
        var withCountry = PatientPhoneComparisonNormalizer.Normalize("+1 9876543210");
        var nationalOnly = PatientPhoneComparisonNormalizer.Normalize("9876543210");
        Assert.Equal("19876543210", withCountry);
        Assert.Equal("9876543210", nationalOnly);
        Assert.NotEqual(withCountry, nationalOnly);
    }

    [Fact]
    public void Uk_plus_forty_four_is_not_collapsed_to_trailing_ten_digits_as_indian()
    {
        var withCountry = PatientPhoneComparisonNormalizer.Normalize("+44 7700 900123");
        var trailingTen = PatientPhoneComparisonNormalizer.Normalize("7700900123");
        Assert.Equal("447700900123", withCountry);
        Assert.NotEqual(withCountry, trailingTen);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("---")]
    public void Null_empty_or_non_digit_returns_null(string? raw)
    {
        Assert.Null(PatientPhoneComparisonNormalizer.Normalize(raw));
    }
}
