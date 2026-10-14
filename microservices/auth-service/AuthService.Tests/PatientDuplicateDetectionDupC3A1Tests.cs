using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Domain.Dtos;
using AuthService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// DUP-C3A.1 — phone normalization + high-confidence vs possible-match reclassification.
/// In-memory only; does not touch shared PostgreSQL.
/// </summary>
public class PatientDuplicateDetectionDupC3A1Tests
{
    private static readonly Guid TenantA = Guid.Parse("155fe198-6ae5-4a01-9254-ead5b427247e");
    private static readonly Guid TenantB = Guid.Parse("11b26293-9d9c-4633-927e-3294bff2a8d7");

    [Fact]
    public async Task Exact_full_name_plus_dob_is_hard_block_confidence()
    {
        await using var db = CreateDb();
        db.Patients.Add(MakePatient(TenantA, "Sam", "Aluri", "1987-08-01", "MRN-1", "+91 98765 43210"));
        await db.SaveChangesAsync();

        var result = await Check(db, "Sam", "Aluri", "1987-08-01", contact: null);

        var match = Assert.Single(result.Matches);
        Assert.Equal("ExactNameDOB", match.MatchType);
        Assert.Equal(1.0m, match.MatchConfidence);
        Assert.True(IsHardBlock(result));
    }

    [Fact]
    public async Task Exact_name_dob_remains_hard_block_when_phones_differ_in_formatting()
    {
        await using var db = CreateDb();
        db.Patients.Add(MakePatient(TenantA, "Sam", "Aluri", "1987-08-01", "MRN-1", "+91 98765 43210"));
        await db.SaveChangesAsync();

        var result = await Check(db, "Sam", "Aluri", "1987-08-01", "9876543210");

        Assert.Contains(result.Matches, m => m.MatchType == "ExactNameDOB" && m.MatchConfidence >= 0.95m);
        Assert.True(IsHardBlock(result));
        Assert.Equal("+91 98765 43210", db.Patients.Single().ContactNumber);
    }

    [Fact]
    public async Task Normalized_phone_plus_exact_full_name_plus_dob_is_high_confidence()
    {
        await using var db = CreateDb();
        db.Patients.Add(MakePatient(TenantA, "Sam", "Aluri", "1987-08-01", "MRN-1", "+919876543210"));
        await db.SaveChangesAsync();

        var result = await Check(db, "Sam", "Aluri", "1987-08-01", "98765 43210");

        Assert.True(IsHardBlock(result));
        Assert.Contains(result.Matches, m => m.MatchConfidence >= 0.95m);
        Assert.Contains(result.Matches, m => m.MatchType is "ExactNameDOB" or "ExactNameDOBPhone");
    }

    [Fact]
    public async Task Phone_format_variants_are_recognized_as_equivalent_phone_match()
    {
        await using var db = CreateDb();
        db.Patients.Add(MakePatient(TenantA, "Sam", "Aluri", "1987-08-01", "MRN-1", "+91 98765 43210"));
        await db.SaveChangesAsync();

        foreach (var phone in new[] { "+919876543210", "98765 43210", "9876543210" })
        {
            var result = await Check(db, "Levin", "Other", "1999-01-01", phone);
            Assert.Contains(result.Matches, m => m.MatchType == "PhoneMatch");
            Assert.False(IsHardBlock(result));
        }
    }

    [Fact]
    public async Task Normalized_phone_only_different_identity_is_not_hard_block()
    {
        await using var db = CreateDb();
        db.Patients.Add(MakePatient(TenantA, "Parent", "Aluri", "1980-01-01", "MRN-P", "9876543210"));
        await db.SaveChangesAsync();

        var result = await Check(db, "Child", "Smith", "2015-06-01", "+91 98765 43210");

        var phone = Assert.Single(result.Matches, m => m.MatchType == "PhoneMatch");
        Assert.True(phone.MatchConfidence >= 0.80m);
        Assert.True(phone.MatchConfidence < 0.95m);
        Assert.True(result.IsDuplicate);
        Assert.False(IsHardBlock(result));
    }

    [Fact]
    public async Task Normalized_phone_plus_dob_different_name_is_not_hard_block()
    {
        await using var db = CreateDb();
        db.Patients.Add(MakePatient(TenantA, "Sam", "Aluri", "1987-08-01", "MRN-1", "9876543210"));
        await db.SaveChangesAsync();

        var result = await Check(db, "Levin", "Kumar", "1987-08-01", "+91 98765 43210");

        Assert.Contains(result.Matches, m => m.MatchType == "PhoneMatch");
        Assert.DoesNotContain(result.Matches, m => m.MatchConfidence >= 0.95m);
        Assert.False(IsHardBlock(result));
    }

    [Fact]
    public async Task Normalized_phone_same_surname_dob_different_first_is_possible_match_not_hard_block()
    {
        await using var db = CreateDb();
        db.Patients.Add(MakePatient(TenantA, "Sam", "Aluri", "1987-08-01", "MRN-1", "+91 98765 43210"));
        await db.SaveChangesAsync();

        var result = await Check(db, "Levin", "Aluri", "1987-08-01", "9876543210");

        Assert.True(result.IsDuplicate);
        Assert.Contains(result.Matches, m => m.MatchType == "PhoneMatch");
        Assert.False(IsHardBlock(result));
        Assert.All(result.Matches, m => Assert.True(m.MatchConfidence < 0.95m));
    }

    [Fact]
    public async Task Same_dob_only_is_not_duplicate()
    {
        await using var db = CreateDb();
        db.Patients.Add(MakePatient(TenantA, "Sam", "Aluri", "1987-08-01", "MRN-1", "1111111111"));
        await db.SaveChangesAsync();

        var result = await Check(db, "Levin", "Other", "1987-08-01", "2222222222");

        Assert.False(result.IsDuplicate);
        Assert.Empty(result.Matches);
    }

    [Fact]
    public async Task Same_surname_plus_dob_only_is_not_hard_block()
    {
        await using var db = CreateDb();
        db.Patients.Add(MakePatient(TenantA, "Sam", "Aluri", "1987-08-01", "MRN-1", "1111111111"));
        await db.SaveChangesAsync();

        var result = await Check(db, "Levin", "Aluri", "1987-08-01", "2222222222");

        Assert.False(IsHardBlock(result));
        Assert.DoesNotContain(result.Matches, m => m.MatchConfidence >= 0.95m);
    }

    [Fact]
    public async Task Soft_deleted_candidate_excluded()
    {
        await using var db = CreateDb();
        var p = MakePatient(TenantA, "Sam", "Aluri", "1987-08-01", "MRN-1", "9876543210");
        p.DeletedAt = DateTime.UtcNow;
        db.Patients.Add(p);
        await db.SaveChangesAsync();

        var result = await Check(db, "Sam", "Aluri", "1987-08-01", "9876543210");

        Assert.Empty(result.Matches);
        Assert.False(result.IsDuplicate);
    }

    [Fact]
    public async Task Different_tenant_candidate_excluded()
    {
        await using var db = CreateDb();
        db.Patients.Add(MakePatient(TenantB, "Sam", "Aluri", "1987-08-01", "MRN-B", "9876543210"));
        await db.SaveChangesAsync();

        var result = await Check(db, "Sam", "Aluri", "1987-08-01", "9876543210");

        Assert.Empty(result.Matches);
    }

    [Fact]
    public async Task Truly_identical_normalized_phone_values_still_match()
    {
        await using var db = CreateDb();
        db.Patients.Add(MakePatient(TenantA, "A", "One", "1990-01-01", "MRN-1", "9876543210"));
        await db.SaveChangesAsync();

        var result = await Check(db, "B", "Two", "1991-02-02", "9876543210");

        Assert.Contains(result.Matches, m => m.MatchType == "PhoneMatch");
        Assert.False(IsHardBlock(result));
    }

    [Fact]
    public async Task Original_stored_phone_is_not_rewritten_by_matching()
    {
        await using var db = CreateDb();
        const string original = "+91 98765 43210";
        db.Patients.Add(MakePatient(TenantA, "Sam", "Aluri", "1987-08-01", "MRN-1", original));
        await db.SaveChangesAsync();

        await Check(db, "Levin", "Aluri", "1987-08-01", "9876543210");

        Assert.Equal(original, db.Patients.Single().ContactNumber);
    }

    private static bool IsHardBlock(DuplicateCheckResult result) =>
        result.IsDuplicate && result.Matches.Any(m => m.MatchConfidence >= 0.95m);

    private static async Task<DuplicateCheckResult> Check(
        AppDbContext db,
        string first,
        string last,
        string dob,
        string? contact)
    {
        var service = new PatientDuplicateDetectionService(db, NullLogger<PatientDuplicateDetectionService>.Instance);
        return await service.CheckDuplicatesAsync(
            new DuplicateCheckRequest
            {
                FirstName = first,
                LastName = last,
                DateOfBirth = DateTime.Parse(dob),
                ContactNumber = contact,
            },
            TenantA);
    }

    private static Patient MakePatient(
        Guid tenantId,
        string first,
        string last,
        string dob,
        string mrn,
        string? phone) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            MedicalRecordNumber = mrn,
            FirstName = first,
            LastName = last,
            DateOfBirth = DateTime.Parse(dob),
            Gender = "male",
            ContactNumber = phone,
            Status = "Active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AppDbContext(options, new HttpContextAccessor());
    }
}
