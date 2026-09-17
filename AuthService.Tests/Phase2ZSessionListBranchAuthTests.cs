using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Counselor;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Phase 2Z F-04 — GET sessions branch scope via AccessibleBranchIds + FollowupBranchAccessService.
/// </summary>
public class Phase2ZSessionListBranchAuthTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly CounselingWorkflowService _sessions;
    private readonly FollowupBranchAccessService _branchAccess;

    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _otherTenant = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private readonly Guid _branchA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _branchB = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private readonly Guid _branchUnauthorized = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private readonly Guid _userSingle = Guid.Parse("c0000001-0000-0000-0000-000000000001");
    private readonly Guid _userMulti = Guid.Parse("c0000002-0000-0000-0000-000000000002");
    private readonly Guid _counselor = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private readonly Guid _patient = Guid.Parse("a1000001-0000-0000-0000-000000000001");
    private readonly Guid _sessionA = Guid.Parse("b1000001-0000-0000-0000-000000000001");
    private readonly Guid _sessionB = Guid.Parse("b1000002-0000-0000-0000-000000000002");
    private readonly Guid _sessionOtherTenant = Guid.Parse("b1000003-0000-0000-0000-000000000003");

    public Phase2ZSessionListBranchAuthTests()
    {
        _db = TestDbContextFactory.CreateInMemory();
        _branchAccess = new FollowupBranchAccessService(_db);
        _sessions = CreateWorkflowService(_db);
        Seed();
    }

    public void Dispose() => _db.Dispose();

    private static CounselingWorkflowService CreateWorkflowService(AppDbContext db)
    {
        var logger = new Mock<ILogger<CounselingWorkflowService>>();
        var blob = new Mock<IBlobStorageService>();
        var http = new Mock<System.Net.Http.IHttpClientFactory>();
        var config = new Mock<IConfiguration>();
        config.Setup(c => c["CcmsService:BaseUrl"]).Returns("http://localhost:7075/api");
        config.Setup(c => c["InternalApi:Key"]).Returns(string.Empty);
        var notifier = new Mock<IQueueDisplayNotifier>();
        return new CounselingWorkflowService(
            db, logger.Object, blob.Object, http.Object, config.Object, notifier.Object,
            new FollowupBranchAccessService(db),
            new Mock<IAuditService>().Object);
    }

    private void Seed()
    {
        _db.Users.Add(new AppUser
        {
            Id = _userSingle,
            TenantId = _tenant,
            UserName = "single@test",
            NormalizedUserName = "SINGLE@TEST",
            Email = "single@test",
            NormalizedEmail = "SINGLE@TEST",
            FirstName = "Single",
            LastName = "User",
            BranchId = _branchA,
        });
        _db.Users.Add(new AppUser
        {
            Id = _userMulti,
            TenantId = _tenant,
            UserName = "multi@test",
            NormalizedUserName = "MULTI@TEST",
            Email = "multi@test",
            NormalizedEmail = "MULTI@TEST",
            FirstName = "Multi",
            LastName = "User",
            BranchId = _branchA,
        });
        _db.UserBranches.Add(new UserBranch
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            UserId = _userSingle,
            BranchId = _branchA,
            Status = "active",
            EffectiveFrom = DateTime.UtcNow.AddDays(-30),
        });
        _db.UserBranches.Add(new UserBranch
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            UserId = _userMulti,
            BranchId = _branchA,
            Status = "active",
            EffectiveFrom = DateTime.UtcNow.AddDays(-30),
        });
        _db.UserBranches.Add(new UserBranch
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            UserId = _userMulti,
            BranchId = _branchB,
            Status = "active",
            EffectiveFrom = DateTime.UtcNow.AddDays(-30),
        });
        _db.Patients.Add(new Patient
        {
            Id = _patient,
            TenantId = _tenant,
            FirstName = "Test",
            LastName = "Patient",
            MedicalRecordNumber = "MRN-SESS",
            DateOfBirth = new DateTime(1980, 1, 1),
            Gender = "Female",
        });

        AddSession(_sessionA, _tenant, _branchA);
        AddSession(_sessionB, _tenant, _branchB);
        AddSession(_sessionOtherTenant, _otherTenant, _branchA);
        _db.SaveChanges();
    }

    private void AddSession(Guid id, Guid tenantId, Guid branchId)
    {
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = id,
            TenantId = tenantId,
            BranchId = branchId,
            PatientId = _patient,
            CounselorId = _counselor,
            ReferredByDoctorId = Guid.NewGuid(),
            SessionDate = DateTime.UtcNow.Date.AddDays(-1),
            PatientType = "Cash",
            SessionType = "Initial",
            CreatedAt = DateTime.UtcNow,
        });
    }

    [Fact]
    public async Task UnauthorizedBranch_Throws403Shape()
    {
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _branchAccess.ResolveAccessibleBranchesAsync(_tenant, _userSingle, _branchUnauthorized));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _branchAccess.ResolveAccessibleBranchesAsync(_tenant, _userSingle, _branchB));
    }

    [Fact]
    public async Task OmittedBranch_SingleUser_OnlyAuthorizedBranchSessions()
    {
        var scope = await _branchAccess.ResolveAccessibleBranchesAsync(_tenant, _userSingle, null);
        var result = await _sessions.GetAllSessionsAsync(new SessionFilters
        {
            TenantId = _tenant,
            AccessibleBranchIds = scope,
            PageSize = 50,
        });

        Assert.Single(result.Sessions);
        Assert.Equal(_sessionA, result.Sessions[0].Id);
        Assert.DoesNotContain(result.Sessions, s => s.Id == _sessionB);
        Assert.DoesNotContain(result.Sessions, s => s.Id == _sessionOtherTenant);
    }

    [Fact]
    public async Task AuthorizedBranch_Success_ReturnsThatBranchOnly()
    {
        var scope = await _branchAccess.ResolveAccessibleBranchesAsync(_tenant, _userMulti, _branchB);
        var result = await _sessions.GetAllSessionsAsync(new SessionFilters
        {
            TenantId = _tenant,
            BranchId = _branchB,
            AccessibleBranchIds = scope,
            PageSize = 50,
        });

        Assert.Single(result.Sessions);
        Assert.Equal(_sessionB, result.Sessions[0].Id);
    }

    [Fact]
    public async Task MultiBranchUser_OmittedBranch_SeesAllAuthorized()
    {
        var scope = await _branchAccess.ResolveAccessibleBranchesAsync(_tenant, _userMulti, null);
        var result = await _sessions.GetAllSessionsAsync(new SessionFilters
        {
            TenantId = _tenant,
            AccessibleBranchIds = scope,
            PageSize = 50,
        });

        Assert.Equal(2, result.Sessions.Count);
        Assert.Contains(result.Sessions, s => s.Id == _sessionA);
        Assert.Contains(result.Sessions, s => s.Id == _sessionB);
        Assert.DoesNotContain(result.Sessions, s => s.Id == _sessionOtherTenant);
    }

    [Fact]
    public async Task EmptyAccessibleBranches_ReturnsEmpty_NotTenantWide()
    {
        var result = await _sessions.GetAllSessionsAsync(new SessionFilters
        {
            TenantId = _tenant,
            AccessibleBranchIds = Array.Empty<Guid>(),
            PageSize = 50,
        });

        Assert.Empty(result.Sessions);
        Assert.Equal(0, result.TotalCount);
    }

    [Fact]
    public async Task TenantIsolation_OtherTenantSessionsExcluded()
    {
        var scope = await _branchAccess.ResolveAccessibleBranchesAsync(_tenant, _userMulti, null);
        var result = await _sessions.GetAllSessionsAsync(new SessionFilters
        {
            TenantId = _tenant,
            AccessibleBranchIds = scope,
            PageSize = 50,
        });

        Assert.DoesNotContain(result.Sessions, s => s.TenantId == _otherTenant);
        Assert.DoesNotContain(result.Sessions, s => s.Id == _sessionOtherTenant);
    }
}
