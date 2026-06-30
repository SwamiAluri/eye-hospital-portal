using AuthService.Context;
using AuthService.Models.Domain.Dtos;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace AuthService.Services;

public interface IPatientSummaryPdfService
{
    Task<byte[]?> GenerateAsync(Guid tenantId, Guid branchId, Guid patientId, string? generatedBy);
}

public class PatientSummaryPdfService : IPatientSummaryPdfService
{
    private readonly AppDbContext _context;
    private readonly IPatientSummaryService _summary;

    public PatientSummaryPdfService(AppDbContext context, IPatientSummaryService summary)
    {
        _context = context;
        _summary = summary;
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public async Task<byte[]?> GenerateAsync(Guid tenantId, Guid branchId, Guid patientId, string? generatedBy)
    {
        var summary = await _summary.GetSummaryAsync(tenantId, branchId, patientId);
        if (summary == null) return null;

        var patient = await _context.Patients.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == patientId && p.TenantId == tenantId);
        if (patient == null) return null;

        var recentVisits = await _summary.GetRecentVisitsAsync(tenantId, branchId, patientId, 5);

        var diagnoses = await _context.ClinicalExaminations.AsNoTracking()
            .Where(e => e.PatientId == patientId && e.TenantId == tenantId)
            .Where(e => e.Diagnosis != null && e.Diagnosis != "")
            .OrderByDescending(e => e.ExaminationDate)
            .Select(e => e.Diagnosis!)
            .Take(8)
            .ToListAsync();

        var outstandingBalance = await _context.OpdBills.AsNoTracking()
            .Where(b => b.PatientId == patientId && b.TenantId == tenantId && b.DeletedAt == null)
            .Where(b => b.Status != "paid" && b.Status != "cancelled")
            .SumAsync(b => (decimal?)b.BalanceDue) ?? 0m;

        var tenantName = await _context.Tenants.AsNoTracking()
            .Where(t => t.Id == tenantId)
            .Select(t => t.Name)
            .FirstOrDefaultAsync() ?? "Hospital";

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(1.5f, Unit.Centimetre);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Header().Column(col =>
                {
                    col.Item().Text(tenantName).Bold().FontSize(16);
                    col.Item().Text("Patient Summary Report").FontSize(12).FontColor(Colors.Grey.Darken2);
                    col.Item().PaddingTop(4).LineHorizontal(1).LineColor(Colors.Grey.Lighten2);
                });

                page.Content().PaddingTop(12).Column(col =>
                {
                    col.Item().Text($"{summary.FirstName} {summary.LastName}").Bold().FontSize(14);
                    col.Item().Text($"MRN: {summary.Mrn}  |  DOB: {summary.DateOfBirth:dd MMM yyyy}  |  {summary.Gender}");
                    if (!string.IsNullOrWhiteSpace(summary.Phone))
                        col.Item().Text($"Phone: {summary.Phone}");
                    if (!string.IsNullOrWhiteSpace(summary.Email))
                        col.Item().Text($"Email: {summary.Email}");

                    col.Item().PaddingTop(8).Element(c => Section(c, "Active engagements",
                        summary.ActiveEngagements.Count == 0
                            ? "None"
                            : string.Join(", ", summary.ActiveEngagements.Select(e =>
                                $"{e.Label} ({e.Status ?? "active"})"))));

                    col.Item().Element(c => Section(c, "Allergies & alerts",
                        string.IsNullOrWhiteSpace(summary.Allergies) ? "Not documented" : summary.Allergies!));

                    if (summary.DataQuality.Issues.Count > 0)
                    {
                        col.Item().Element(c => Section(c, "Data quality flags",
                            string.Join("; ", summary.DataQuality.Issues)));
                    }

                    col.Item().Element(c => Section(c, "Diagnoses (recent)",
                        diagnoses.Count == 0 ? "None recorded" : string.Join("; ", diagnoses.Distinct())));

                    var meds = patient.CurrentMedications;
                    col.Item().Element(c => Section(c, "Current medications",
                        string.IsNullOrWhiteSpace(meds) ? "None recorded" : meds!));

                    var vitals = summary.LatestVitals;
                    var vitalsText = vitals == null
                        ? "No vitals on file"
                        : $"BP {vitals.BloodPressureSystolic}/{vitals.BloodPressureDiastolic}, HR {vitals.HeartRate}, SpO₂ {vitals.OxygenSaturation}%, Temp {vitals.Temperature} (recorded {vitals.RecordedAt:dd MMM yyyy})";
                    col.Item().Element(c => Section(c, "Latest vitals", vitalsText));

                    col.Item().Element(c => Section(c, "Insurance",
                        $"{summary.InsuranceProvider ?? "—"} / {summary.InsurancePolicyNumber ?? "—"}"));

                    col.Item().Element(c => Section(c, "Outstanding balance", outstandingBalance.ToString("C")));

                    col.Item().PaddingTop(4).Text("Recent visits").Bold();
                    if (recentVisits.Count == 0)
                    {
                        col.Item().Text("No recent visits");
                    }
                    else
                    {
                        foreach (var v in recentVisits)
                        {
                            col.Item().Text(
                                $"• {v.CheckedInAt:dd MMM yyyy HH:mm} — {v.Status} {v.VisitType} {v.CurrentStation}");
                        }
                    }
                });

                page.Footer().AlignCenter().Text(text =>
                {
                    text.Span("Generated ");
                    text.Span($"{DateTime.UtcNow:dd MMM yyyy HH:mm} UTC");
                    if (!string.IsNullOrWhiteSpace(generatedBy))
                    {
                        text.Span(" by ");
                        text.Span(generatedBy);
                    }
                });
            });
        });

        return document.GeneratePdf();
    }

    private static void Section(IContainer container, string title, string body)
    {
        container.Column(col =>
        {
            col.Item().PaddingTop(6).Text(title).Bold().FontSize(11);
            col.Item().Text(body);
        });
    }
}
