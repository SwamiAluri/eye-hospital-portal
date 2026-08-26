using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;
using Microsoft.EntityFrameworkCore;

namespace IpManagementService.Services;

/// <summary>
/// W-05 A5 patient safety token. One active wristband per journey. Reprint does not mint.
/// No outbox — clinical audit only.
/// </summary>
public class JourneySafetyTokenService
{
    private readonly IpManagementDbContext _db;
    private readonly JourneyCommandAuthContext _commandAuth;

    public JourneySafetyTokenService(
        IpManagementDbContext db,
        JourneyCommandAuthContext? commandAuth = null)
    {
        _db = db;
        _commandAuth = commandAuth ?? new JourneyCommandAuthContext();
    }

    public async Task<JourneySafetyTokenDto?> GetActiveAsync(Guid journeyId, Guid tenantId)
    {
        await RequireJourneyAsync(journeyId, tenantId);
        var row = await FindActiveAsync(journeyId, tenantId);
        return row is null ? null : Map(row, alreadyIssued: true);
    }

    public async Task<JourneySafetyTokenDto> IssueAsync(Guid journeyId, Guid tenantId, Guid userId)
    {
        _commandAuth.RequireSafetyTokenPrint();
        var journey = await RequireIssuableAsync(journeyId, tenantId);

        var existing = await FindActiveAsync(journeyId, tenantId);
        if (existing is not null)
            return Map(existing, alreadyIssued: true);

        var laterality = NormalizeLaterality(journey.EyeOperated);
        Exception? last = null;
        for (var attempt = 0; attempt < 5; attempt++)
        {
            existing = await FindActiveAsync(journeyId, tenantId);
            if (existing is not null)
                return Map(existing, alreadyIssued: true);

            var tokenCode = await NextTokenCodeAsync(tenantId);
            var now = DateTime.UtcNow;
            var row = new JourneySafetyToken
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                JourneyId = journeyId,
                TokenCode = tokenCode,
                BarcodeValue = BuildBarcodeValue(tokenCode, journey.Uhid, laterality),
                Laterality = string.IsNullOrEmpty(laterality) ? null : laterality,
                PrintedAt = now,
                PrintedBy = userId,
                CreatedAt = now,
                CreatedBy = userId,
            };
            _db.JourneySafetyTokens.Add(row);
            _db.JourneyAuditLogs.Add(JourneyClinicalAudit.Entry(
                tenantId, journeyId, userId,
                "SafetyTokenIssued", "SafetyToken",
                oldValue: null, newValue: tokenCode,
                notes: $"barcode={row.BarcodeValue}"));
            try
            {
                await _db.SaveChangesAsync();
                return Map(row, alreadyIssued: false);
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex))
            {
                last = ex;
                _db.Entry(row).State = EntityState.Detached;
                foreach (var audit in _db.ChangeTracker.Entries<JourneyAuditLog>()
                             .Where(e => e.State == EntityState.Added)
                             .ToList())
                    audit.State = EntityState.Detached;
            }
        }

        throw new InvalidOperationException(
            "Could not issue a safety token. Another print may already be in progress.", last);
    }

    public async Task<JourneySafetyTokenDto> ReprintAsync(Guid journeyId, Guid tenantId, Guid userId)
    {
        _commandAuth.RequireSafetyTokenPrint();
        await RequireIssuableAsync(journeyId, tenantId);

        var row = await FindActiveAsync(journeyId, tenantId)
            ?? throw new KeyNotFoundException("No active safety token. Issue one first.");

        var previous = row.PrintedAt?.ToString("O");
        var now = DateTime.UtcNow;
        row.PrintedAt = now;
        row.PrintedBy = userId;
        _db.JourneyAuditLogs.Add(JourneyClinicalAudit.Entry(
            tenantId, journeyId, userId,
            "SafetyTokenReprinted", "SafetyToken",
            oldValue: previous, newValue: row.TokenCode,
            notes: $"reprint {row.TokenCode}"));
        await _db.SaveChangesAsync();
        return Map(row, alreadyIssued: true);
    }

    internal static string BuildBarcodeValue(string tokenCode, string? uhid, string laterality)
    {
        var code = tokenCode.Trim();
        var lat = (laterality ?? "").Trim();
        var u = (uhid ?? "").Trim();
        var separators = 2;
        var maxUhid = 64 - code.Length - lat.Length - separators;
        if (maxUhid < 0)
            return $"{code}|{lat}"[..Math.Min(64, code.Length + 1 + lat.Length)];
        if (u.Length > maxUhid)
            u = u[..maxUhid];
        return $"{code}|{u}|{lat}";
    }

    internal static string NormalizeLaterality(string? value)
    {
        var raw = (value ?? "").Trim().ToUpperInvariant();
        if (string.IsNullOrEmpty(raw)) return string.Empty;
        if (raw is "OD" or "OS" or "OU") return raw;
        if (raw is "RE" || raw.Contains("RIGHT", StringComparison.Ordinal)) return "OD";
        if (raw is "LE" || raw.Contains("LEFT", StringComparison.Ordinal)) return "OS";
        if (raw is "BOTH" || raw.Contains("BILAT", StringComparison.Ordinal)) return "OU";
        return raw.Length <= 8 ? raw : raw[..8];
    }

    internal static string FormatTokenCode(DateTime localDate, int seq)
        => $"WB-{localDate:yyMMdd}-{seq:D5}";

    private async Task<string> NextTokenCodeAsync(Guid tenantId)
    {
        var local = ToHospitalLocal(DateTime.UtcNow);
        var prefix = $"WB-{local:yyMMdd}-";
        var last = await _db.JourneySafetyTokens
            .Where(t => t.TenantId == tenantId && t.TokenCode.StartsWith(prefix))
            .Select(t => t.TokenCode)
            .OrderByDescending(t => t)
            .FirstOrDefaultAsync();
        var seq = 1;
        if (last is not null)
        {
            var dash = last.LastIndexOf('-');
            if (dash >= 0 && int.TryParse(last[(dash + 1)..], out var n) && n >= 0)
                seq = n + 1;
        }
        if (seq > 99999)
            throw new InvalidOperationException("Daily wristband sequence is exhausted.");
        return FormatTokenCode(local, seq);
    }

    private async Task<JourneySafetyToken?> FindActiveAsync(Guid journeyId, Guid tenantId)
        => await _db.JourneySafetyTokens
            .FirstOrDefaultAsync(t =>
                t.JourneyId == journeyId && t.TenantId == tenantId && t.RevokedAt == null);

    private async Task<PatientJourney> RequireIssuableAsync(Guid journeyId, Guid tenantId)
    {
        var journey = await RequireJourneyAsync(journeyId, tenantId);
        if (journey.ClinicalState is ClinicalState.Expected or ClinicalState.AdmissionCancelled
            or "Expected" or "AdmissionCancelled")
            throw new InvalidOperationException("Admit the patient before printing a wristband.");
        return journey;
    }

    private async Task<PatientJourney> RequireJourneyAsync(Guid journeyId, Guid tenantId)
        => await _db.PatientJourneys.FirstOrDefaultAsync(j =>
               j.Id == journeyId && j.TenantId == tenantId && j.DeletedAt == null)
           ?? throw new KeyNotFoundException($"PatientJourney {journeyId} not found.");

    private static DateTime ToHospitalLocal(DateTime utc)
    {
        try
        {
            var tzId = OperatingSystem.IsWindows() ? "India Standard Time" : "Asia/Kolkata";
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc),
                TimeZoneInfo.FindSystemTimeZoneById(tzId));
        }
        catch (TimeZoneNotFoundException)
        {
            return utc.AddHours(5).AddMinutes(30);
        }
    }

    private static bool IsUniqueViolation(DbUpdateException ex)
    {
        var msg = ex.InnerException?.Message ?? ex.Message;
        return msg.Contains("23505", StringComparison.Ordinal)
               || msg.Contains("ux_journey_safety_token", StringComparison.OrdinalIgnoreCase)
               || msg.Contains("unique", StringComparison.OrdinalIgnoreCase)
               || msg.Contains("duplicate", StringComparison.OrdinalIgnoreCase);
    }

    private static JourneySafetyTokenDto Map(JourneySafetyToken row, bool alreadyIssued)
        => new(
            row.Id,
            row.JourneyId,
            row.TokenCode,
            row.BarcodeValue,
            row.Laterality,
            row.PrintedAt,
            row.PrintedBy,
            row.CreatedAt,
            alreadyIssued);
}
