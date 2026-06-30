using AuthService.Models.Domain.Dtos;
using AuthService.Services;
using Xunit;

namespace AuthService.Tests.Services;

public class PatientLookupRankingTests
{
    [Fact]
    public void Rank_OrdersExactMrnBeforeNamePrefix()
    {
        var rows = new List<PatientSuggestRowDto>
        {
            new() { FirstName = "Alex", LastName = "Smith", Mrn = "MRN-9001", Phone = "111" },
            new() { FirstName = "Alex", LastName = "Jones", Mrn = "MRN-10042", Phone = "222" },
        };

        var ranked = PatientLookupRanking.Rank(rows, "mrn-10042").ToList();

        Assert.Equal("MRN-10042", ranked[0].Mrn);
        Assert.Equal("MRN-9001", ranked[1].Mrn);
    }

    [Fact]
    public void Rank_PrefersMrnPrefixOverNameMatch()
    {
        var rows = new List<PatientSuggestRowDto>
        {
            new() { FirstName = "MRN", LastName = "Tester", Mrn = "P-5555" },
            new() { FirstName = "John", LastName = "Doe", Mrn = "MRN-7777" },
        };

        var ranked = PatientLookupRanking.Rank(rows, "mrn").ToList();

        Assert.Equal("MRN-7777", ranked[0].Mrn);
        Assert.Equal("P-5555", ranked[1].Mrn);
    }

    [Fact]
    public void Score_PhoneContainsNeedle()
    {
        var row = new PatientSuggestRowDto
        {
            FirstName = "Sam",
            LastName = "Patel",
            Mrn = "X1",
            Phone = "+919876543210",
        };

        var score = PatientLookupRanking.Score(row, "98765");
        Assert.Equal(4, score);
    }
}
