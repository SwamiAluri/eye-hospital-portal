using AuthService.Hubs;
using AuthService.Models.Branch;
using AuthService.Models.Domain;
using AuthService.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

public class BranchCapacityServiceTests
{
    [Fact]
    public async Task Summary_IncludesReclinerAndDayCareChair()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        SeedBranch(db, tenantId, branchId);
        db.BedInventories.AddRange(
            Bed(tenantId, branchId, "G-1", BedInventoryTypes.General, "Occupied"),
            Bed(tenantId, branchId, "R-1", BedInventoryTypes.Recliner, "Available"),
            Bed(tenantId, branchId, "C-1", BedInventoryTypes.DayCareChair, "Occupied"));
        await db.SaveChangesAsync();

        var svc = NewService(db);
        var summary = await svc.GetCapacitySummaryAsync(branchId, tenantId);

        Assert.Equal(3, summary.TotalBeds);
        Assert.Equal(1, summary.AvailableBeds);
        Assert.Equal(1, summary.ReclinerBeds.Total);
        Assert.Equal(1, summary.ReclinerBeds.Available);
        Assert.Equal(1, summary.DayCareChairBeds.Total);
        Assert.Equal(1, summary.DayCareChairBeds.Occupied);
    }

    [Fact]
    public async Task Inventory_PrefersWardId_FallsBackToWardName()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var wardId = Guid.NewGuid();
        var otherWard = Guid.NewGuid();
        SeedBranch(db, tenantId, branchId);

        var byFk = Bed(tenantId, branchId, "R-1", BedInventoryTypes.Recliner, "Available");
        byFk.WardId = wardId;
        byFk.WardName = "Stale Name";

        var byName = Bed(tenantId, branchId, "C-1", BedInventoryTypes.DayCareChair, "Available");
        byName.WardId = null;
        byName.WardName = "Day Care Ward";

        var other = Bed(tenantId, branchId, "G-1", BedInventoryTypes.General, "Available");
        other.WardId = otherWard;
        other.WardName = "Day Care Ward";

        db.BedInventories.AddRange(byFk, byName, other);
        await db.SaveChangesAsync();

        var svc = NewService(db);
        var beds = await svc.GetBedInventoryAsync(
            branchId, tenantId, wardId: wardId, wardName: "Day Care Ward");

        Assert.Equal(2, beds.Count);
        Assert.Contains(beds, b => b.Id == byFk.Id && b.WardId == wardId);
        Assert.Contains(beds, b => b.Id == byName.Id && b.BedType == BedInventoryTypes.DayCareChair);
        Assert.DoesNotContain(beds, b => b.Id == other.Id);
    }

    [Fact]
    public async Task Occupy_Recliner_UsesUnchangedLifecycle()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var actor = Guid.NewGuid();
        SeedBranch(db, tenantId, branchId);
        var recliner = Bed(tenantId, branchId, "R-9", BedInventoryTypes.Recliner, BedLifecyclePolicy.Available);
        db.BedInventories.Add(recliner);
        await db.SaveChangesAsync();

        var svc = NewService(db);
        var patientId = Guid.NewGuid();
        var updated = await svc.ApplyJourneyBedActionAsync(recliner.Id, "occupy", patientId, tenantId, actor);

        Assert.Equal(BedLifecyclePolicy.Occupied, updated.BedStatus);
        Assert.Equal(BedInventoryTypes.Recliner, updated.BedType);
        Assert.True(updated.IsOccupied);
        Assert.Equal(patientId, updated.PatientId);

        var vacated = await svc.ApplyJourneyBedActionAsync(recliner.Id, "vacate", patientId, tenantId, actor);
        Assert.Equal(BedLifecyclePolicy.Cleaning, vacated.BedStatus);
        Assert.False(vacated.IsOccupied);
        Assert.Null(vacated.PatientId);
    }

    [Fact]
    public async Task Occupy_Succeeds_WhenSignalRThrows()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        SeedBranch(db, tenantId, branchId);
        var bed = Bed(tenantId, branchId, "R-8", BedInventoryTypes.Recliner, BedLifecyclePolicy.Available);
        db.BedInventories.Add(bed);
        await db.SaveChangesAsync();

        var hub = new Mock<IHubContext<CapacityHub>>();
        var clients = new Mock<IHubClients>();
        var proxy = new Mock<IClientProxy>();
        hub.Setup(h => h.Clients).Returns(clients.Object);
        clients.Setup(c => c.Group(It.IsAny<string>())).Returns(proxy.Object);
        proxy
            .Setup(p => p.SendCoreAsync(It.IsAny<string>(), It.IsAny<object?[]>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("hub down"));

        var svc = new BranchCapacityService(db, hub.Object, NullLogger<BranchCapacityService>.Instance);
        var updated = await svc.ApplyJourneyBedActionAsync(bed.Id, "occupy", Guid.NewGuid(), tenantId, Guid.NewGuid());
        Assert.Equal(BedLifecyclePolicy.Occupied, updated.BedStatus);
        Assert.True(updated.IsOccupied);
    }

    [Fact]
    public async Task CreateBed_Wave7Alias_AttachesDayCareAndCanonicalizesName()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var dayCareId = Guid.NewGuid();
        SeedBranch(db, tenantId, branchId);
        db.WardRefs.AddRange(
            new WardRef
            {
                Id = dayCareId,
                TenantId = tenantId,
                BranchId = branchId,
                WardName = "Day Care Ward",
                WardType = "DayCare",
                IsActive = true,
            },
            new WardRef
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                BranchId = branchId,
                WardName = "Surgical Ward",
                WardType = "Surgical",
                IsActive = true,
            });
        await db.SaveChangesAsync();

        var svc = NewService(db);
        var created = await svc.CreateBedAsync(new BedInventory
        {
            TenantId = tenantId,
            BranchId = branchId,
            BedNumber = "W7-SMOKE-3",
            BedType = BedInventoryTypes.Recliner,
            BedStatus = BedLifecyclePolicy.Available,
            WardName = "Wave7",
        }, Guid.NewGuid());

        Assert.Equal(dayCareId, created.WardId);
        Assert.Equal("Day Care Ward", created.WardName);
        Assert.Equal(BedInventoryTypes.Recliner, created.BedType);
    }

    [Fact]
    public async Task CreateBed_WithWardId_CopiesWardName()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var generalId = Guid.NewGuid();
        SeedBranch(db, tenantId, branchId);
        db.WardRefs.Add(new WardRef
        {
            Id = generalId,
            TenantId = tenantId,
            BranchId = branchId,
            WardName = "General Ward",
            WardType = "General",
            IsActive = true,
        });
        await db.SaveChangesAsync();

        var svc = NewService(db);
        var created = await svc.CreateBedAsync(new BedInventory
        {
            TenantId = tenantId,
            BranchId = branchId,
            BedNumber = "G-2",
            BedType = BedInventoryTypes.General,
            BedStatus = BedLifecyclePolicy.Available,
            WardId = generalId,
            WardName = "stale",
        }, Guid.NewGuid());

        Assert.Equal(generalId, created.WardId);
        Assert.Equal("General Ward", created.WardName);
    }

    private static BranchCapacityService NewService(AuthService.Context.AppDbContext db)
    {
        var hub = new Mock<IHubContext<CapacityHub>>();
        var clients = new Mock<IHubClients>();
        var proxy = new Mock<IClientProxy>();
        hub.Setup(h => h.Clients).Returns(clients.Object);
        clients.Setup(c => c.Group(It.IsAny<string>())).Returns(proxy.Object);
        proxy
            .Setup(p => p.SendCoreAsync(It.IsAny<string>(), It.IsAny<object?[]>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        return new BranchCapacityService(db, hub.Object, NullLogger<BranchCapacityService>.Instance);
    }

    private static void SeedBranch(AuthService.Context.AppDbContext db, Guid tenantId, Guid branchId)
    {
        db.Branches.Add(new Branch
        {
            Id = branchId,
            TenantId = tenantId,
            Name = "Main",
            Status = "Active",
        });
    }

    private static BedInventory Bed(Guid tenantId, Guid branchId, string number, string type, string status)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            BedNumber = number,
            BedType = type,
            BedStatus = status,
            Status = "active",
            CreatedAt = DateTime.UtcNow,
        };
}
