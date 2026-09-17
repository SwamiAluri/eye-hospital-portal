using System;
using System.IO;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Counselor;
using AuthService.Models.Domain;
using AuthService.Services;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Phase2Y (PD5/PD6) — operational honesty locks for Follow-up Center due/priority.
/// </summary>
public class Phase2YFollowupHonestyTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly FollowupListService _list;
    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _branch = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private Guid[] Scope => new[] { _branch };

    public Phase2YFollowupHonestyTests()
    {
        _db = TestDbContextFactory.CreateInMemory();
        _list = new FollowupListService(_db);
        Seed();
    }

    public void Dispose() => _db.Dispose();

    private void Seed()
    {
        var patient = Guid.Parse("a00000d2-0000-0000-0000-0000000000d2");
        _db.Patients.Add(new Patient
        {
            Id = patient,
            TenantId = _tenant,
            FirstName = "Honesty",
            LastName = "Probe",
            MedicalRecordNumber = "UHID-Y1",
            ContactNumber = "9000000888",
            DateOfBirth = new DateTime(1980, 1, 1),
            Gender = "Male",
        });
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = Guid.Parse("b00000d2-0000-0000-0000-0000000000d2"),
            TenantId = _tenant,
            BranchId = _branch,
            PatientId = patient,
            ReferredByDoctorId = Guid.NewGuid(),
            SessionDate = DateTime.UtcNow.Date.AddDays(-10),
            PatientType = "Cash",
            PatientIntention = "Undecided",
            Status = "Scheduled",
            LastContactDate = null,
            ContactAttemptCount = 0,
            EscalationStatus = "Normal",
            CreatedAt = DateTime.UtcNow.AddDays(-10),
            UpdatedAt = DateTime.UtcNow,
        });
        _db.SaveChanges();
    }

    [Fact]
    public void ActiveQuerySource_HasNoPlus7Plus14Plus30DueHeuristics()
    {
        var path = LocateFollowupListServiceSource();
        Assert.True(File.Exists(path), $"Expected source at {path}");
        var src = File.ReadAllText(path);
        const string marker = "internal IQueryable<CounselingSession> BuildActiveSessionQuery";
        var start = src.IndexOf(marker, StringComparison.Ordinal);
        Assert.True(start >= 0);
        var end = src.IndexOf(
            "internal IQueryable<CounselingSession> BuildColdSessionQuery",
            start,
            StringComparison.Ordinal);
        Assert.True(end > start);
        var activeBuilder = src.Substring(start, end - start);
        Assert.DoesNotContain("AddDays(7)", activeBuilder, StringComparison.Ordinal);
        Assert.DoesNotContain("AddDays(14)", activeBuilder, StringComparison.Ordinal);
        Assert.DoesNotContain("AddDays(30)", activeBuilder, StringComparison.Ordinal);
        Assert.DoesNotContain("AddDays(-7)", activeBuilder, StringComparison.Ordinal);
        Assert.DoesNotContain("AddDays(-14)", activeBuilder, StringComparison.Ordinal);
        Assert.DoesNotContain("DueDate", activeBuilder, StringComparison.Ordinal);
    }

    [Fact]
    public void ActiveDto_HasNoGenericDueDateProperty()
    {
        Assert.Null(typeof(ActiveFollowupItemDto).GetProperty("DueDate"));
        Assert.Null(typeof(ColdLeadItemDto).GetProperty("DueDate"));
        Assert.Null(typeof(PostSurgeryFollowupItemDto).GetProperty("DueDate"));
    }

    [Fact]
    public async Task NeverContacted_DoesNotMapToMediumAlertLevel()
    {
        var active = await _list.GetActiveAsync(_tenant, Scope, null, null, 1, 50);
        var row = Assert.Single(active.Items);
        Assert.Null(row.LastContactDate);
        Assert.Equal("Normal", row.AlertLevel);
    }

    [Fact]
    public async Task Populations_Unchanged_ActiveColdPostContracts()
    {
        Assert.Equal(7, FollowupQueryContracts.ActiveIntentions.Length);
        Assert.Equal(2, FollowupQueryContracts.ColdIntentions.Length);
        Assert.Contains("Undecided", FollowupQueryContracts.ActiveIntentions);
        Assert.Contains("Declined", FollowupQueryContracts.ColdIntentions);

        var active = await _list.GetActiveAsync(_tenant, Scope, null, null, 1, 50);
        Assert.Equal(1, active.Total);

        var cold = await _list.GetColdLeadsAsync(_tenant, Scope, null, 1, 50);
        Assert.Equal(0, cold.Total);

        var post = await _list.GetPostSurgeryAsync(_tenant, Scope, null, 1, 50);
        Assert.Equal(0, post.Total);
    }

    private static string LocateFollowupListServiceSource()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            var candidate = Path.Combine(
                dir.FullName,
                "microservices", "auth-service", "AuthService", "Services", "FollowupListService.cs");
            if (File.Exists(candidate)) return candidate;
            dir = dir.Parent;
        }

        return Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "..", "..", "..", "..",
            "microservices", "auth-service", "AuthService", "Services", "FollowupListService.cs"));
    }
}
