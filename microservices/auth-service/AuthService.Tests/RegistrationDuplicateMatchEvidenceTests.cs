using System.Text.Json;
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
/// DUP-C3A.2b — Server-authored matched/different attribute evidence on create-scoped DTO.
/// In-memory only; does not touch shared PostgreSQL.
/// </summary>
public class RegistrationDuplicateMatchEvidenceTests
{
    private static readonly Guid TenantA = Guid.Parse("155fe198-6ae5-4a01-9254-ead5b427247e");
    private static readonly Guid TenantB = Guid.Parse("11b26293-9d9c-4633-927e-3294bff2a8d7");
    private static readonly JsonSerializerOptions Camel = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    [Fact]
    public async Task Exact_name_dob_emits_first_last_dob_matched()
    {
        await using var db = CreateDb();
        db.Patients.Add(Make(TenantA, "Sam", "Aluri", "1987-08-01", "MRN-1", "+91 11111 11111", null));
        await db.SaveChangesAsync();

        var body = await Check(db, "Sam", "Aluri", "1987-08-01", null, null);
        var candidate = Assert.Single(body.Matches);
        Assert.Equal("ExactNameDOB", candidate.MatchType);
        Assert.Equal(
            new[]
            {
                RegistrationDuplicateAttributeSignals.FirstName,
                RegistrationDuplicateAttributeSignals.LastName,
                RegistrationDuplicateAttributeSignals.DateOfBirth,
            },
            candidate.MatchedAttributes);
        Assert.Empty(candidate.DifferentAttributes);
    }

    [Fact]
    public async Task Same_first_dob_phone_different_last_emits_expected_evidence()
    {
        await using var db = CreateDb();
        db.Patients.Add(Make(TenantA, "Samuel", "Aluri", "1987-08-01", "MRN-A", "+91 98765 43210", null));
        await db.SaveChangesAsync();

        var body = await Check(db, "Samuel", "Levin", "1987-08-01", "9876543210", null);
        var candidate = Assert.Single(body.Matches);
        Assert.Equal("PhoneMatch", candidate.MatchType);
        Assert.Equal(0.90m, await HighestConfidence(db, "Samuel", "Levin", "1987-08-01", "9876543210", null));
        Assert.Contains(RegistrationDuplicateAttributeSignals.FirstName, candidate.MatchedAttributes);
        Assert.Contains(RegistrationDuplicateAttributeSignals.DateOfBirth, candidate.MatchedAttributes);
        Assert.Contains(RegistrationDuplicateAttributeSignals.Phone, candidate.MatchedAttributes);
        Assert.Contains(RegistrationDuplicateAttributeSignals.LastName, candidate.DifferentAttributes);
        Assert.DoesNotContain(RegistrationDuplicateAttributeSignals.LastName, candidate.MatchedAttributes);
    }

    [Fact]
    public async Task Phone_only_different_identity_emits_phone_matched_and_identity_different()
    {
        await using var db = CreateDb();
        db.Patients.Add(Make(TenantA, "Parent", "Aluri", "1980-01-01", "MRN-P", "9876543210", null));
        await db.SaveChangesAsync();

        var body = await Check(db, "Child", "Smith", "2015-06-01", "+91 98765 43210", null);
        var candidate = Assert.Single(body.Matches);
        Assert.Equal("PhoneMatch", candidate.MatchType);
        Assert.Equal(new[] { RegistrationDuplicateAttributeSignals.Phone }, candidate.MatchedAttributes);
        Assert.Contains(RegistrationDuplicateAttributeSignals.FirstName, candidate.DifferentAttributes);
        Assert.Contains(RegistrationDuplicateAttributeSignals.LastName, candidate.DifferentAttributes);
        Assert.Contains(RegistrationDuplicateAttributeSignals.DateOfBirth, candidate.DifferentAttributes);
    }

    [Fact]
    public async Task Multiple_candidates_receive_independent_evidence()
    {
        await using var db = CreateDb();
        db.Patients.Add(Make(TenantA, "Samuel", "Aluri", "1987-08-01", "MRN-A", "9876543210", null));
        db.Patients.Add(Make(TenantA, "Samuel", "Aluri", "1987-08-03", "MRN-B", "+91 98765 43210", null));
        await db.SaveChangesAsync();

        var body = await Check(db, "Samuel", "Levin", "1987-08-01", "9876543210", null);
        Assert.Equal(2, body.Matches.Count);
        Assert.All(body.Matches, m => Assert.Equal("PhoneMatch", m.MatchType));

        var a = Assert.Single(body.Matches, m => m.MedicalRecordNumber == "MRN-A");
        var b = Assert.Single(body.Matches, m => m.MedicalRecordNumber == "MRN-B");

        Assert.Contains(RegistrationDuplicateAttributeSignals.DateOfBirth, a.MatchedAttributes);
        Assert.DoesNotContain(RegistrationDuplicateAttributeSignals.DateOfBirth, a.DifferentAttributes);
        Assert.Contains(RegistrationDuplicateAttributeSignals.DateOfBirth, b.DifferentAttributes);
        Assert.DoesNotContain(RegistrationDuplicateAttributeSignals.DateOfBirth, b.MatchedAttributes);
        Assert.Contains(RegistrationDuplicateAttributeSignals.Phone, a.MatchedAttributes);
        Assert.Contains(RegistrationDuplicateAttributeSignals.Phone, b.MatchedAttributes);
        Assert.Contains(RegistrationDuplicateAttributeSignals.LastName, a.DifferentAttributes);
        Assert.Contains(RegistrationDuplicateAttributeSignals.LastName, b.DifferentAttributes);
    }

    [Fact]
    public async Task Email_match_and_differ_signals()
    {
        await using var db = CreateDb();
        db.Patients.Add(Make(TenantA, "A", "One", "1990-01-01", "MRN-E", null, "same@example.com"));
        await db.SaveChangesAsync();

        var matchBody = await Check(db, "B", "Two", "1991-02-02", null, "SAME@example.com");
        var matchCandidate = Assert.Single(matchBody.Matches);
        Assert.Equal("EmailMatch", matchCandidate.MatchType);
        Assert.Contains(RegistrationDuplicateAttributeSignals.Email, matchCandidate.MatchedAttributes);

        await using var db2 = CreateDb();
        db2.Patients.Add(Make(TenantA, "A", "One", "1990-01-01", "MRN-P", "9876543210", "a@example.com"));
        await db2.SaveChangesAsync();
        var phoneBody = await Check(db2, "B", "Two", "1991-02-02", "9876543210", "b@example.com");
        var phoneCandidate = Assert.Single(phoneBody.Matches);
        Assert.Equal("PhoneMatch", phoneCandidate.MatchType);
        Assert.Contains(RegistrationDuplicateAttributeSignals.Email, phoneCandidate.DifferentAttributes);
        Assert.DoesNotContain(RegistrationDuplicateAttributeSignals.Email, phoneCandidate.MatchedAttributes);
    }

    [Fact]
    public async Task Phone_format_variants_produce_phone_matched_evidence()
    {
        await using var db = CreateDb();
        db.Patients.Add(Make(TenantA, "X", "Y", "1990-01-01", "MRN-1", "+91 98765 43210", null));
        await db.SaveChangesAsync();

        foreach (var phone in new[] { "+919876543210", "98765 43210", "9876543210" })
        {
            var body = await Check(db, "A", "B", "2000-01-01", phone, null);
            var candidate = Assert.Single(body.Matches);
            Assert.Contains(RegistrationDuplicateAttributeSignals.Phone, candidate.MatchedAttributes);
            Assert.DoesNotContain(RegistrationDuplicateAttributeSignals.Phone, candidate.DifferentAttributes);
        }
    }

    [Fact]
    public async Task Different_normalized_phones_emit_phone_different_when_comparable()
    {
        await using var db = CreateDb();
        db.Patients.Add(Make(TenantA, "Sam", "Aluri", "1987-08-01", "MRN-1", "9876543210", "sam@example.com"));
        await db.SaveChangesAsync();

        // EmailMatch wins; phones both present and differ → Phone in different
        var body = await Check(db, "Other", "Person", "1999-01-01", "9111111111", "sam@example.com");
        var candidate = Assert.Single(body.Matches);
        Assert.Equal("EmailMatch", candidate.MatchType);
        Assert.Contains(RegistrationDuplicateAttributeSignals.Email, candidate.MatchedAttributes);
        Assert.Contains(RegistrationDuplicateAttributeSignals.Phone, candidate.DifferentAttributes);
    }

    [Fact]
    public async Task Soft_deleted_and_other_tenant_excluded()
    {
        await using var db = CreateDb();
        var deleted = Make(TenantA, "Samuel", "Aluri", "1987-08-01", "MRN-D", "9876543210", null);
        deleted.DeletedAt = DateTime.UtcNow;
        db.Patients.Add(deleted);
        db.Patients.Add(Make(TenantB, "Samuel", "Aluri", "1987-08-01", "MRN-B", "9876543210", null));
        await db.SaveChangesAsync();

        var body = await Check(db, "Samuel", "Levin", "1987-08-01", "9876543210", null);
        Assert.Empty(body.Matches);
    }

    [Fact]
    public async Task Classification_thresholds_unchanged_with_evidence()
    {
        await using var db = CreateDb();
        db.Patients.Add(Make(TenantA, "Jane", "Smith", "1990-07-22", "MRN-P", "5550101010", null));
        db.Patients.Add(Make(TenantA, "Bob", "Jones", "1985-03-15", "MRN-E", null, "bob@example.com"));
        await db.SaveChangesAsync();

        Assert.Equal(0.90m, await HighestConfidence(db, "X", "Y", "2001-01-01", "5550101010", null));
        Assert.Equal(0.90m, await HighestConfidence(db, "X", "Y", "2001-01-01", null, "bob@example.com"));
        Assert.Equal(1.0m, await HighestConfidence(db, "Jane", "Smith", "1990-07-22", null, null));
    }

    [Fact]
    public async Task Serialized_registration_response_includes_evidence_and_excludes_phi()
    {
        await using var db = CreateDb();
        db.Patients.Add(Make(TenantA, "Samuel", "Aluri", "1987-08-01", "MRN-1", "+91 98765 43210", "sam@example.com"));
        await db.SaveChangesAsync();

        var body = await Check(db, "Samuel", "Levin", "1987-08-01", "9876543210", "other@example.com");
        var json = JsonSerializer.Serialize(body, Camel);

        Assert.Contains("\"matchedAttributes\"", json);
        Assert.Contains("\"differentAttributes\"", json);
        Assert.Contains("\"FirstName\"", json);
        Assert.Contains("\"Phone\"", json);
        Assert.Contains("\"LastName\"", json);
        Assert.DoesNotContain("contactNumber", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("matchConfidence", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("differenceReason", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("9876543210", json);
        Assert.DoesNotContain("98765", json);
        Assert.DoesNotContain("sam@example.com", json);
        Assert.DoesNotContain("other@example.com", json);
        Assert.DoesNotContain("0.90", json);
        Assert.DoesNotContain("Levenshtein", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Same_dob_signal_does_not_create_classification_without_match_rule()
    {
        await using var db = CreateDb();
        db.Patients.Add(Make(TenantA, "Sam", "Aluri", "1987-08-01", "MRN-1", "1111111111", null));
        await db.SaveChangesAsync();

        // Different phone/name — no MatchType → no candidates; DOB-only must not invent a match
        var body = await Check(db, "Levin", "Other", "1987-08-01", "2222222222", null);
        Assert.False(body.IsDuplicate);
        Assert.Empty(body.Matches);
    }

    [Fact]
    public async Task Candidate_ordering_remains_confidence_descending()
    {
        await using var db = CreateDb();
        // ExactNameDOB (1.0) and a separate PhoneMatch (0.90)
        db.Patients.Add(Make(TenantA, "Sam", "Aluri", "1987-08-01", "MRN-EXACT", "9999999999", null));
        db.Patients.Add(Make(TenantA, "Other", "Person", "1990-01-01", "MRN-PHONE", "9876543210", null));
        await db.SaveChangesAsync();

        var body = await Check(db, "Sam", "Aluri", "1987-08-01", "9876543210", null);
        Assert.Equal(2, body.Matches.Count);
        Assert.Equal("ExactNameDOB", body.Matches[0].MatchType);
        Assert.Equal("PhoneMatch", body.Matches[1].MatchType);
    }

    private static async Task<decimal> HighestConfidence(
        AppDbContext db,
        string first,
        string last,
        string dob,
        string? phone,
        string? email)
    {
        var service = new PatientDuplicateDetectionService(db, NullLogger<PatientDuplicateDetectionService>.Instance);
        var result = await service.CheckDuplicatesAsync(
            new DuplicateCheckRequest
            {
                FirstName = first,
                LastName = last,
                DateOfBirth = DateTime.Parse(dob),
                ContactNumber = phone,
                Email = email,
            },
            TenantA);
        return result.Matches.Max(m => m.MatchConfidence);
    }

    private static async Task<RegistrationDuplicateCheckResult> Check(
        AppDbContext db,
        string first,
        string last,
        string dob,
        string? phone,
        string? email)
    {
        var request = new DuplicateCheckRequest
        {
            FirstName = first,
            LastName = last,
            DateOfBirth = DateTime.Parse(dob),
            ContactNumber = phone,
            Email = email,
        };
        var service = new PatientDuplicateDetectionService(db, NullLogger<PatientDuplicateDetectionService>.Instance);
        var result = await service.CheckDuplicatesAsync(request, TenantA);
        var genders = result.Matches.ToDictionary(m => m.Id, _ => (string?)"male");
        return RegistrationDuplicateCheckMapper.Map(result, request, genders);
    }

    private static Patient Make(
        Guid tenantId,
        string first,
        string last,
        string dob,
        string mrn,
        string? phone,
        string? email) =>
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
            Email = email,
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
