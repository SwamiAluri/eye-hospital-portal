using System.Text.Json;
using AuthService.Context;
using AuthService.DTOs.Optometry;
using AuthService.Models.Domain;
using AuthService.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public class OptometryPatientHistoryService : IOptometryPatientHistoryService
{
    private readonly AppDbContext _context;
    private readonly IOptometrySegmentExamService _segmentService;

    private static readonly string[] VaSectionIds = { "old", "new", "refraction", "distance", "keratometry", "color", "contrast" };
    private static readonly string[] IopSectionIds = { "nct", "atn", "schirmer", "pachymetry", "visual-field" };

    public OptometryPatientHistoryService(
        AppDbContext context,
        IOptometrySegmentExamService segmentService)
    {
        _context = context;
        _segmentService = segmentService;
    }

    public async Task<OptometryPatientHistoryResponse> GetHistoryAsync(
        Guid patientId,
        Guid tenantId,
        Guid? excludeVisitId = null,
        Guid? excludeSameDayAsVisitId = null,
        int limit = 10)
    {
        limit = Math.Clamp(limit, 1, 50);
        var visits = await LoadVisitRecordsAsync(
            patientId, tenantId, excludeVisitId, excludeSameDayAsVisitId, limit);
        return new OptometryPatientHistoryResponse
        {
            PatientId = patientId,
            GeneratedAt = DateTime.UtcNow,
            Visits = visits,
        };
    }

    public async Task<OptometryLatestPriorResponse> GetLatestPriorAsync(
        Guid patientId,
        Guid tenantId,
        Guid? excludeVisitId = null,
        Guid? excludeSameDayAsVisitId = null)
    {
        var visits = await LoadVisitRecordsAsync(
            patientId, tenantId, excludeVisitId, excludeSameDayAsVisitId, 1);
        if (visits.Count == 0)
        {
            return new OptometryLatestPriorResponse { Found = false };
        }

        return new OptometryLatestPriorResponse { Found = true, Visit = visits[0] };
    }

    public async Task<OptometryVisitExamRecordDto?> GetVisitExamAsync(Guid visitId, Guid tenantId)
    {
        var visit = await _context.Visits
            .AsNoTracking()
            .Include(v => v.Appointment)
            .FirstOrDefaultAsync(v => v.Id == visitId && v.TenantId == tenantId && v.DeletedAt == null);

        if (visit == null) return null;

        return await BuildVisitRecordAsync(visit, tenantId);
    }

    public async Task ArchiveVisitExamAsync(
        Guid visitId,
        Guid tenantId,
        Guid patientId,
        Guid userId,
        object? snapshot = null)
    {
        var now = DateTime.UtcNow;
        string json;

        if (snapshot != null)
        {
            json = JsonSerializer.Serialize(snapshot);
        }
        else
        {
            // Snapshot all visit segment rows (canonical exam truth) for history merge.
            var segments = await _segmentService.GetByVisitAsync(visitId, tenantId);
            var dict = segments.ToDictionary(s => s.SegmentKey, s => s.Data);
            json = JsonSerializer.Serialize(new { segments = dict, archivedAt = now });
        }

        var existing = await _context.OptometryVisitExams.FirstOrDefaultAsync(x =>
            x.VisitId == visitId && x.TenantId == tenantId);

        if (existing != null)
        {
            existing.SnapshotJson = json;
            existing.PatientId = patientId;
            existing.CompletedAt = now;
            existing.CompletedBy = userId;
            existing.UpdatedAt = now;
        }
        else
        {
            _context.OptometryVisitExams.Add(new OptometryVisitExam
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                VisitId = visitId,
                PatientId = patientId,
                SnapshotJson = json,
                CompletedAt = now,
                CompletedBy = userId,
                CreatedAt = now,
                UpdatedAt = now,
            });
        }

        await _context.SaveChangesAsync();
    }

    private async Task<List<OptometryVisitExamRecordDto>> LoadVisitRecordsAsync(
        Guid patientId,
        Guid tenantId,
        Guid? excludeVisitId,
        Guid? excludeSameDayAsVisitId,
        int limit)
    {
        var segmentVisitIds = await _context.OptometrySegmentExams
            .AsNoTracking()
            .Where(x => x.PatientId == patientId && x.TenantId == tenantId)
            .Select(x => x.VisitId)
            .Distinct()
            .ToListAsync();

        var archiveVisitIds = await _context.OptometryVisitExams
            .AsNoTracking()
            .Where(x => x.PatientId == patientId && x.TenantId == tenantId)
            .Select(x => x.VisitId)
            .Distinct()
            .ToListAsync();

        var allVisitIds = segmentVisitIds
            .Concat(archiveVisitIds)
            .Distinct()
            .ToList();

        if (excludeVisitId.HasValue)
        {
            allVisitIds = allVisitIds.Where(id => id != excludeVisitId.Value).ToList();
        }

        if (allVisitIds.Count == 0) return new List<OptometryVisitExamRecordDto>();

        var visits = await _context.Visits
            .AsNoTracking()
            .Include(v => v.Appointment)
            .Where(v =>
                allVisitIds.Contains(v.Id) &&
                v.TenantId == tenantId &&
                v.PatientId == patientId &&
                v.DeletedAt == null)
            .ToListAsync();

        var anchorLocalDate = await ResolveAnchorLocalDateAsync(
            excludeSameDayAsVisitId, tenantId);
        if (anchorLocalDate.HasValue)
        {
            visits = visits
                .Where(v => ToIndiaLocalDate(v.CheckedInAt ?? v.CreatedAt) != anchorLocalDate.Value)
                .ToList();
        }

        var ordered = visits
            .OrderByDescending(v => v.CheckedInAt ?? v.CreatedAt)
            .Take(limit)
            .ToList();

        var records = new List<OptometryVisitExamRecordDto>();
        foreach (var visit in ordered)
        {
            var record = await BuildVisitRecordAsync(visit, tenantId);
            if (record != null && record.Segments.Count > 0)
            {
                records.Add(record);
            }
        }

        return records;
    }

    private async Task<OptometryVisitExamRecordDto?> BuildVisitRecordAsync(Visit visit, Guid tenantId)
    {
        var segments = await _segmentService.GetByVisitAsync(visit.Id, tenantId);
        var segmentDict = segments.ToDictionary(s => s.SegmentKey, s => s.Data);

        var archive = await _context.OptometryVisitExams
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.VisitId == visit.Id && x.TenantId == tenantId);

        if (archive != null)
        {
            try
            {
                using var doc = JsonDocument.Parse(archive.SnapshotJson);
                if (doc.RootElement.TryGetProperty("segments", out var segEl) &&
                    segEl.ValueKind == JsonValueKind.Object)
                {
                    foreach (var prop in segEl.EnumerateObject())
                    {
                        segmentDict[prop.Name] = JsonSerializer.Deserialize<object>(prop.Value.GetRawText());
                    }
                }
            }
            catch
            {
                /* archive parse optional */
            }
        }

        var lastSegment = segments.OrderByDescending(s => s.UpdatedAt).FirstOrDefault();
        OptometryHistoryUserDto? lastUpdatedBy = null;
        if (lastSegment != null)
        {
            var segRow = await _context.OptometrySegmentExams
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == lastSegment.Id);
            if (segRow?.UpdatedBy != null)
            {
                var user = await _context.Users.AsNoTracking()
                    .FirstOrDefaultAsync(u => u.Id == segRow.UpdatedBy.Value);
                lastUpdatedBy = new OptometryHistoryUserDto
                {
                    UserId = segRow.UpdatedBy.Value,
                    DisplayName = FormatUserDisplayName(user),
                };
            }
        }

        var optometryCompleted = await _context.VisitStationEvents
            .AsNoTracking()
            .AnyAsync(e =>
                e.VisitId == visit.Id &&
                e.TenantId == tenantId &&
                e.Station == "optometrist" &&
                e.EventType == "completed");

        DateTime? optometryCompletedAt = null;
        if (optometryCompleted)
        {
            optometryCompletedAt = await _context.VisitStationEvents
                .AsNoTracking()
                .Where(e =>
                    e.VisitId == visit.Id &&
                    e.TenantId == tenantId &&
                    e.Station == "optometrist" &&
                    e.EventType == "completed")
                .OrderByDescending(e => e.CreatedAt)
                .Select(e => (DateTime?)e.CreatedAt)
                .FirstOrDefaultAsync();
        }

        var examinationDate = visit.CheckedInAt ?? visit.CreatedAt;
        var lastUpdatedAt = segments.Count > 0
            ? segments.Max(s => s.UpdatedAt)
            : archive?.UpdatedAt ?? examinationDate;

        var typedSegments = segmentDict.ToDictionary(
            kv => kv.Key,
            kv => kv.Value);

        return new OptometryVisitExamRecordDto
        {
            VisitId = visit.Id,
            PatientId = visit.PatientId,
            ExaminationDate = examinationDate,
            VisitStatus = visit.Status,
            ChiefComplaint = visit.Appointment?.ReasonForVisit,
            LastUpdatedAt = lastUpdatedAt,
            LastUpdatedBy = lastUpdatedBy,
            OptometryCompleted = optometryCompleted || archive?.CompletedAt != null,
            OptometryCompletedAt = optometryCompletedAt ?? archive?.CompletedAt,
            Summary = BuildSummary(typedSegments),
            Segments = typedSegments,
        };
    }

    internal static OptometryVisitSummaryDto BuildSummary(Dictionary<string, object?> segments)
    {
        var summary = new OptometryVisitSummaryDto();
        var tabs = new HashSet<string>();

        if (segments.TryGetValue("visual_acuity_bundle", out var vaRaw) && vaRaw != null)
        {
            tabs.Add("visual-acuity");
            try
            {
                var json = JsonSerializer.Serialize(vaRaw);
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                summary.DistanceVaLine = BuildDistanceVaLine(root);
                summary.PreviousGlassesLine = BuildRxLine(root, "oldGlass");
                summary.TodaysRxLine = BuildRxLine(root, "newPrescription");
                summary.RefractionLine = BuildRefractionLine(root);
                summary.KeratometryLine = BuildKeratometryLine(root);

                if (root.TryGetProperty("sectionRecorded", out var rec) && rec.ValueKind == JsonValueKind.Object)
                {
                    foreach (var id in VaSectionIds)
                    {
                        if (rec.TryGetProperty(id, out var flag) && flag.ValueKind == JsonValueKind.True)
                        {
                            summary.VaSectionsRecorded.Add(id);
                        }
                    }
                }
            }
            catch
            {
                /* optional summary fields */
            }
        }

        if (segments.TryGetValue("iop_bundle", out var iopRaw) && iopRaw != null)
        {
            tabs.Add("iop");
            try
            {
                var json = JsonSerializer.Serialize(iopRaw);
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                summary.IopNctLine = BuildIopNctLine(root);

                if (root.TryGetProperty("sectionRecorded", out var rec) && rec.ValueKind == JsonValueKind.Object)
                {
                    foreach (var id in IopSectionIds)
                    {
                        if (rec.TryGetProperty(id, out var flag) && flag.ValueKind == JsonValueKind.True)
                        {
                            summary.IopSectionsRecorded.Add(id);
                        }
                    }
                }
            }
            catch
            {
                /* optional */
            }
        }

        if (segments.TryGetValue("medical_history_bundle", out var mhRaw) && mhRaw != null)
        {
            tabs.Add("medical-history");
            try
            {
                var json = JsonSerializer.Serialize(mhRaw);
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                var parts = new List<string>();
                if (root.TryGetProperty("nkda", out var nkda) && nkda.ValueKind == JsonValueKind.True)
                {
                    parts.Add("NKDA");
                }
                else if (root.TryGetProperty("allergies", out var allergies) && allergies.ValueKind == JsonValueKind.Array)
                {
                    var count = allergies.GetArrayLength();
                    if (count > 0) parts.Add($"{count} allergy alert(s)");
                }
                if (root.TryGetProperty("chronicConditions", out var cond) && cond.ValueKind == JsonValueKind.Array)
                {
                    var count = cond.GetArrayLength();
                    if (count > 0) parts.Add($"{count} condition(s)");
                }
                if (root.TryGetProperty("medications", out var meds) && meds.ValueKind == JsonValueKind.Array)
                {
                    var count = meds.GetArrayLength();
                    if (count > 0) parts.Add($"{count} medication(s)");
                }
                if (parts.Count > 0)
                {
                    summary.MedicalHistoryLine = string.Join(" · ", parts);
                }
            }
            catch
            {
                /* optional */
            }
        }

        if (segments.ContainsKey("wet_retinoscopy") || segments.ContainsKey("dry_retinoscopy"))
            tabs.Add("retinoscopy");
        object? pupilRaw = null;
        object? antRaw = null;
        segments.TryGetValue("pupil_exam", out pupilRaw);
        segments.TryGetValue("anterior_segment", out antRaw);
        if (pupilRaw != null || antRaw != null)
        {
            tabs.Add("anterior");
            try
            {
                summary.AnteriorSegmentLine = BuildAnteriorSegmentLine(pupilRaw, antRaw);
            }
            catch
            {
                /* optional */
            }
        }

        object? postRaw = null;
        object? fundusRaw = null;
        object? vitRaw = null;
        object? periphRaw = null;
        segments.TryGetValue("posterior_segment", out postRaw);
        segments.TryGetValue("fundus_exam", out fundusRaw);
        segments.TryGetValue("vitreous_exam", out vitRaw);
        segments.TryGetValue("peripheral_retina_exam", out periphRaw);
        if (postRaw != null || fundusRaw != null || vitRaw != null || periphRaw != null)
        {
            tabs.Add("posterior");
            try
            {
                summary.PosteriorSegmentLine = BuildPosteriorSegmentLine(postRaw, fundusRaw, vitRaw, periphRaw);
            }
            catch
            {
                /* optional */
            }
        }
        if (segments.ContainsKey("prescription_items"))
            tabs.Add("medications");
        if (segments.ContainsKey("optical_bundle"))
            tabs.Add("optical-prescription");
        if (segments.ContainsKey("doctor_referrals") || segments.ContainsKey("imaging_orders") ||
            segments.ContainsKey("reception_referrals"))
            tabs.Add("referral");
        if (segments.ContainsKey("diagnoses"))
            tabs.Add("diagnosis");
        if (segments.ContainsKey("advice_bundle"))
            tabs.Add("advice");

        summary.TabsWithData = tabs.ToList();
        return summary;
    }

    private static string? BuildAnteriorSegmentLine(object? pupilRaw, object? anteriorRaw)
    {
        var parts = new List<string>();
        if (pupilRaw != null)
        {
            var json = JsonSerializer.Serialize(pupilRaw);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.TryGetProperty("sizeLightOD", out var sl) && sl.ValueKind == JsonValueKind.Number)
            {
                parts.Add($"Pupil light OD {sl.GetDouble()}mm");
            }
        }
        if (anteriorRaw != null)
        {
            var json = JsonSerializer.Serialize(anteriorRaw);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.TryGetProperty("corneaOD", out var c) && !string.IsNullOrWhiteSpace(c.GetString()))
            {
                parts.Add($"Cornea OD {c.GetString()}");
            }
        }
        return parts.Count > 0 ? string.Join(" · ", parts) : null;
    }

    private static string? BuildPosteriorSegmentLine(
        object? overviewRaw,
        object? fundusRaw,
        object? vitreousRaw,
        object? peripheralRaw)
    {
        var parts = new List<string>();
        if (overviewRaw != null)
        {
            var json = JsonSerializer.Serialize(overviewRaw);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var dilatedOd = root.TryGetProperty("isDilatedOD", out var dOd) && dOd.ValueKind == JsonValueKind.True;
            var dilatedOs = root.TryGetProperty("isDilatedOS", out var dOs) && dOs.ValueKind == JsonValueKind.True;
            if (dilatedOd || dilatedOs)
                parts.Add("Dilated");
            if (root.TryGetProperty("mediaClarityOD", out var m) && !string.IsNullOrWhiteSpace(m.GetString()))
            {
                parts.Add($"Media OD {m.GetString()}");
            }
            var findingOd = root.TryGetProperty("overallFindingOD", out var fOd) ? fOd.GetString() : null;
            var findingOs = root.TryGetProperty("overallFindingOS", out var fOs) ? fOs.GetString() : null;
            if ((findingOd?.Contains("Abnormal", StringComparison.OrdinalIgnoreCase) ?? false) ||
                (findingOs?.Contains("Abnormal", StringComparison.OrdinalIgnoreCase) ?? false))
            {
                parts.Add("Abnormal fundus");
            }
        }
        if (fundusRaw != null)
        {
            var json = JsonSerializer.Serialize(fundusRaw);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.TryGetProperty("cupDiscRatioOD", out var cd) && !string.IsNullOrWhiteSpace(cd.GetString()))
            {
                parts.Add($"C/D OD {cd.GetString()}");
            }
        }
        if (vitreousRaw != null)
        {
            var json = JsonSerializer.Serialize(vitreousRaw);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.TryGetProperty("clarityOD", out var cl) && !string.IsNullOrWhiteSpace(cl.GetString()))
            {
                parts.Add($"Vitreous OD {cl.GetString()}");
            }
        }
        if (peripheralRaw != null)
        {
            var json = JsonSerializer.Serialize(peripheralRaw);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.TryGetProperty("peripheralAppearanceOD", out var pa) && !string.IsNullOrWhiteSpace(pa.GetString()))
            {
                parts.Add($"Periph. OD {pa.GetString()}");
            }
        }
        return parts.Count > 0 ? string.Join(" · ", parts) : null;
    }

    private static string? BuildDistanceVaLine(JsonElement root)
    {
        if (!root.TryGetProperty("distanceVision", out var dist)) return null;
        var parts = new List<string>();
        foreach (var eye in new[] { "OD", "OS" })
        {
            if (dist.TryGetProperty(eye, out var e))
            {
                var u = e.TryGetProperty("unaided", out var uv) ? uv.GetString() : null;
                var a = e.TryGetProperty("aided", out var av) ? av.GetString() : null;
                if (!string.IsNullOrWhiteSpace(u) || !string.IsNullOrWhiteSpace(a))
                {
                    parts.Add($"{eye} {u ?? "—"}{(string.IsNullOrWhiteSpace(a) ? "" : $"/{a}")}");
                }
            }
        }
        return parts.Count > 0 ? string.Join(" · ", parts) : null;
    }

    private static string? BuildRxLine(JsonElement root, string prop)
    {
        if (!root.TryGetProperty(prop, out var rx)) return null;
        var parts = new List<string>();
        foreach (var eye in new[] { "OD", "OS" })
        {
            if (rx.TryGetProperty(eye, out var e))
            {
                var s = e.TryGetProperty("sphere", out var sv) ? sv.GetString() : "—";
                var c = e.TryGetProperty("cylinder", out var cv) ? cv.GetString() : "—";
                var a = e.TryGetProperty("axis", out var av) ? av.GetString() : "—";
                if (s != "—" || c != "—")
                {
                    parts.Add($"{eye} {s}/{c}×{a}");
                }
            }
        }
        return parts.Count > 0 ? string.Join(" · ", parts) : null;
    }

    private static string? BuildRefractionLine(JsonElement root)
    {
        if (!root.TryGetProperty("refraction", out var rx)) return null;
        return BuildRxLine(root, "refraction")?.Replace("OD", "Ref OD").Replace("OS", "Ref OS");
    }

    private static string? BuildKeratometryLine(JsonElement root)
    {
        if (!root.TryGetProperty("keratometry", out var k)) return null;
        var parts = new List<string>();
        foreach (var eye in new[] { "OD", "OS" })
        {
            if (k.TryGetProperty(eye, out var e))
            {
                var k1 = e.TryGetProperty("k1", out var k1v) ? k1v.GetString() : null;
                var k2 = e.TryGetProperty("k2", out var k2v) ? k2v.GetString() : null;
                if (!string.IsNullOrWhiteSpace(k1) || !string.IsNullOrWhiteSpace(k2))
                {
                    parts.Add($"{eye} {k1 ?? "—"}/{k2 ?? "—"}");
                }
            }
        }
        return parts.Count > 0 ? string.Join(" · ", parts) : null;
    }

    private static string? BuildIopNctLine(JsonElement root)
    {
        if (!root.TryGetProperty("nct", out var nct)) return null;
        if (!nct.TryGetProperty("beforeDilatation", out var before)) return null;
        var parts = new List<string>();
        foreach (var eye in new[] { "OD", "OS" })
        {
            if (before.TryGetProperty(eye, out var e) &&
                e.TryGetProperty("value", out var v) &&
                !string.IsNullOrWhiteSpace(v.GetString()))
            {
                parts.Add($"{eye} {v.GetString()}");
            }
        }
        return parts.Count > 0 ? string.Join(" · ", parts) : null;
    }

    private static string FormatUserDisplayName(Models.Identity.AppUser? user)
    {
        if (user == null) return "Unknown";
        var name = $"{user.FirstName} {user.LastName}".Trim();
        return string.IsNullOrWhiteSpace(name) ? user.UserName ?? "Unknown" : name;
    }

    private async Task<DateOnly?> ResolveAnchorLocalDateAsync(Guid? anchorVisitId, Guid tenantId)
    {
        if (!anchorVisitId.HasValue) return null;

        var anchorVisit = await _context.Visits
            .AsNoTracking()
            .FirstOrDefaultAsync(v =>
                v.Id == anchorVisitId.Value &&
                v.TenantId == tenantId &&
                v.DeletedAt == null);

        if (anchorVisit == null) return null;

        return ToIndiaLocalDate(anchorVisit.CheckedInAt ?? anchorVisit.CreatedAt);
    }

    private static DateOnly ToIndiaLocalDate(DateTime timestamp)
    {
        var utc = timestamp.Kind switch
        {
            DateTimeKind.Utc => timestamp,
            DateTimeKind.Local => timestamp.ToUniversalTime(),
            _ => DateTime.SpecifyKind(timestamp, DateTimeKind.Utc),
        };

        var local = TimeZoneInfo.ConvertTimeFromUtc(utc, GetIndiaTimeZone());
        return DateOnly.FromDateTime(local);
    }

    private static TimeZoneInfo GetIndiaTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata");
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
        }
    }
}
