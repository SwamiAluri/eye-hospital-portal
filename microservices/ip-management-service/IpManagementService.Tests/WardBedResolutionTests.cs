using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace IpManagementService.Tests;

public class WardBedResolutionTests
{
    [Fact]
    public void BelongsToWard_PrefersWardId()
    {
        var ward = new Ward { Id = Guid.NewGuid(), WardName = "Day Care Ward" };
        var byFk = new AuthBedSnapshot(Guid.NewGuid(), "R-1", "1", "Stale", "Available", ward.Id, "Recliner");
        var otherFk = new AuthBedSnapshot(Guid.NewGuid(), "G-1", "2", "Day Care Ward", "Available", Guid.NewGuid(), "General");

        Assert.True(WardService.BelongsToWard(byFk, ward));
        Assert.False(WardService.BelongsToWard(otherFk, ward));
    }

    [Fact]
    public void BelongsToWard_FallsBackToNameWhenFkNull()
    {
        var ward = new Ward { Id = Guid.NewGuid(), WardName = "Day Care Ward" };
        var named = new AuthBedSnapshot(Guid.NewGuid(), "C-1", null, "day care ward", "Available", null, "DayCareChair");
        var unmatched = new AuthBedSnapshot(Guid.NewGuid(), "W-1", null, "Wave7", "Available", null, "General");

        Assert.True(WardService.BelongsToWard(named, ward));
        Assert.False(WardService.BelongsToWard(unmatched, ward));
    }

    [Fact]
    public async Task GetBedsAsync_ReturnsReclinerOnWardByFk()
    {
        var options = new DbContextOptionsBuilder<IpManagementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        await using var db = new IpManagementDbContext(options);
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var ward = new Ward
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            WardName = "Day Care Ward",
            WardType = "DayCare",
            IsActive = true,
            Status = "active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.Wards.Add(ward);
        await db.SaveChangesAsync();

        var reclinerId = Guid.NewGuid();
        var beds = new FakeBeds([
            new AuthBedSnapshot(reclinerId, "R-1", "Bay 1", "Stale", "Available", ward.Id, "Recliner"),
            new AuthBedSnapshot(Guid.NewGuid(), "G-9", "9", "Day Care Ward", "Available", Guid.NewGuid(), "General"),
        ]);
        var svc = new WardService(db, beds);

        var listed = await svc.GetBedsAsync(ward.Id, tenantId);

        var row = Assert.Single(listed);
        Assert.Equal(reclinerId.ToString(), row.BedId);
        Assert.Equal("Recliner", row.BedType);
        Assert.Contains("Recliner", row.Description);
        Assert.True(row.IsAvailable);
        Assert.Null(row.OccupantUhid);
    }

    [Fact]
    public async Task GetBedsAsync_AttachesOccupantFromAssignedBed()
    {
        var options = new DbContextOptionsBuilder<IpManagementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        await using var db = new IpManagementDbContext(options);
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var ward = new Ward
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            WardName = "Day Care Ward",
            WardType = "DayCare",
            IsActive = true,
            Status = "active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        var bedId = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        var journeyId = Guid.NewGuid();
        db.Wards.Add(ward);
        db.Patients.Add(new IpPatient
        {
            Id = patientId,
            TenantId = tenantId,
            FirstName = "Meena",
            LastName = "Iyer",
        });
        db.PatientJourneys.Add(new PatientJourney
        {
            Id = journeyId,
            TenantId = tenantId,
            BranchId = branchId,
            PatientId = patientId,
            Uhid = "UAT-002",
            AssignedBedId = bedId,
            ClinicalState = ClinicalState.Admitted,
            OtState = OtState.NotSent,
            FinancialState = FinancialState.Draft,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        });
        await db.SaveChangesAsync();

        var svc = new WardService(db, new FakeBeds([
            new AuthBedSnapshot(bedId, "C-04", null, "Day Care Ward", "Occupied", ward.Id, "DayCareChair"),
            new AuthBedSnapshot(Guid.NewGuid(), "C-06", null, "Day Care Ward", "Available", ward.Id, "DayCareChair"),
        ]));

        var listed = await svc.GetBedsAsync(ward.Id, tenantId);
        var occupied = Assert.Single(listed, b => b.BedStatus == "Occupied");
        Assert.Equal(journeyId, occupied.OccupantJourneyId);
        Assert.Equal("UAT-002", occupied.OccupantUhid);
        Assert.Equal("Meena Iyer", occupied.OccupantName);
        Assert.Equal("C-04", occupied.BedNumber);

        var available = Assert.Single(listed, b => b.IsAvailable);
        Assert.Null(available.OccupantJourneyId);
        Assert.Equal("Chair", WardService.MapSurfaceLabel(available.BedType));
    }

    [Fact]
    public void MapSurfaceLabel_ChairsAreChair()
    {
        Assert.Equal("Chair", WardService.MapSurfaceLabel("Recliner"));
        Assert.Equal("Chair", WardService.MapSurfaceLabel("DayCareChair"));
        Assert.Equal("Bed", WardService.MapSurfaceLabel(null));
        Assert.Equal("Occupied", WardService.MapStatusLabel("occupied"));
    }

    private sealed class FakeBeds : IAuthBedLifecycleClient
    {
        private readonly IReadOnlyList<AuthBedSnapshot> _rows;
        public FakeBeds(IReadOnlyList<AuthBedSnapshot> rows) => _rows = rows;

        public Task<AuthBedSnapshot?> ApplyAsync(
            Guid tenantId, Guid bedId, Guid actorUserId, Guid? patientId, string action)
            => Task.FromResult<AuthBedSnapshot?>(null);

        public Task<IReadOnlyList<AuthBedSnapshot>> ListAsync(
            Guid tenantId, Guid branchId, string? wardName, Guid? wardId = null)
            => Task.FromResult(_rows);
    }
}
