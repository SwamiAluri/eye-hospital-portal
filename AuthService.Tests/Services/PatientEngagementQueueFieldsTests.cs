using AuthService.Context;
using AuthService.Tests;
using AuthService.Models.Domain;
using AuthService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests.Services;

public class PatientEngagementQueueFieldsTests : IDisposable
{
    private readonly AppDbContext _context;
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly Guid _patientId = Guid.NewGuid();

    public PatientEngagementQueueFieldsTests()
    {
        _context = TestDbContextFactory.CreateInMemory();
    }

    public void Dispose() => _context.Dispose();

    [Fact]
    public async Task LoadForPatientsAsync_MapsQueueStationRoomAndProviderRole()
    {
        var checkedInAt = DateTime.UtcNow.AddMinutes(-20);
        _context.Patients.Add(new Patient
        {
            Id = _patientId,
            TenantId = _tenantId,
            BranchId = _branchId,
            MedicalRecordNumber = "MRN-Q-1",
            FirstName = "Queue",
            LastName = "Patient",
            DateOfBirth = new DateTime(1980, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            Gender = "F",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        _context.QueueItems.Add(new QueueItem
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            BranchId = _branchId,
            PatientId = _patientId,
            TokenNumber = "T-1",
            QueueType = "Optometry",
            Status = "waiting",
            Priority = "normal",
            CheckedInAt = checkedInAt,
            RoomNumber = "4B",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await _context.SaveChangesAsync();

        var acuity = new Mock<IAcuityScoringService>();
        acuity.Setup(a => a.Compute(
                It.IsAny<bool>(),
                It.IsAny<string?>(),
                It.IsAny<bool>(),
                It.IsAny<bool>(),
                It.IsAny<bool>(),
                It.IsAny<bool>()))
            .Returns("low");

        var service = new PatientEngagementService(
            _context,
            acuity.Object,
            NullLogger<PatientEngagementService>.Instance);

        var bundles = await service.LoadForPatientsAsync(_tenantId, _branchId, new[] { _patientId });

        Assert.True(bundles.ContainsKey(_patientId));
        var bundle = bundles[_patientId];
        Assert.Equal("Optometry", bundle.CurrentStation);
        Assert.Equal("4B", bundle.RoomNumber);
        Assert.Equal("Optometrist", bundle.AssignedProviderRole);
        Assert.NotNull(bundle.WaitingMinutes);
        Assert.InRange(bundle.WaitingMinutes!.Value, 19, 21);
    }
}
