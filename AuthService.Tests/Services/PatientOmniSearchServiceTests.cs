using AuthService.Context;
using AuthService.Tests;
using AuthService.Models.Domain;
using AuthService.Models.Domain.Dtos;
using AuthService.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace AuthService.Tests.Services;

public class PatientOmniSearchServiceTests
{
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();

    private static PatientOmniSearchService CreateService(
        out AppDbContext context,
        Mock<IPatientLookupService>? lookupMock = null)
    {
        context = TestDbContextFactory.CreateInMemory();
        lookupMock ??= new Mock<IPatientLookupService>();
        return new PatientOmniSearchService(context, lookupMock.Object);
    }

    [Fact]
    public async Task SearchAsync_InvalidScope_ReturnsEmpty()
    {
        var service = CreateService(out _);
        var hits = await service.SearchAsync(_tenantId, _branchId, _userId, "unknown", "test", 10);
        Assert.Empty(hits);
    }

    [Fact]
    public async Task SearchAsync_CarePrograms_ReturnsFiveProgramsWhenQueryEmpty()
    {
        var service = CreateService(out _);
        var hits = await service.SearchAsync(_tenantId, _branchId, _userId, "care_programs", "", 25);
        Assert.Equal(5, hits.Count);
        Assert.Contains(hits, h => h.Id == "CORNEA" && h.HubFilter!["programCodes"] == "CORNEA");
        Assert.All(hits, h => Assert.Equal("hub_filter", h.ActionType));
    }

    [Fact]
    public async Task SearchAsync_CarePrograms_FiltersByLabel()
    {
        var service = CreateService(out _);
        var hits = await service.SearchAsync(_tenantId, _branchId, _userId, "care_programs", "glau", 10);
        Assert.Single(hits);
        Assert.Equal("GLAUCOMA", hits[0].Id);
        Assert.Equal("Glaucoma", hits[0].Title);
    }

    [Fact]
    public async Task SearchAsync_Patients_RequiresMinTwoCharacters()
    {
        var lookup = new Mock<IPatientLookupService>();
        var service = CreateService(out _, lookup);
        var hits = await service.SearchAsync(_tenantId, _branchId, _userId, "patients", "a", 10);
        Assert.Empty(hits);
        lookup.Verify(
            l => l.SuggestAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<int>()),
            Times.Never);
    }

    [Fact]
    public async Task SearchAsync_Patients_DelegatesToLookupService()
    {
        var patientId = Guid.NewGuid();
        var lookup = new Mock<IPatientLookupService>();
        lookup
            .Setup(l => l.SuggestAsync(_tenantId, _branchId, _userId, "al", 5))
            .ReturnsAsync(new List<PatientSuggestRowDto>
            {
                new()
                {
                    Id = patientId,
                    FirstName = "Alex",
                    LastName = "Kim",
                    Mrn = "MRN-42",
                    DateOfBirth = DateTime.UtcNow.AddYears(-30),
                    Gender = "M",
                    Phone = "555-0100",
                },
            });

        var service = CreateService(out _, lookup);
        var hits = await service.SearchAsync(_tenantId, _branchId, _userId, "patients", "al", 5);

        Assert.Single(hits);
        Assert.Equal(patientId.ToString(), hits[0].PatientId);
        Assert.Equal("patient_profile", hits[0].ActionType);
        Assert.Equal("Alex Kim", hits[0].Title);
    }
}
