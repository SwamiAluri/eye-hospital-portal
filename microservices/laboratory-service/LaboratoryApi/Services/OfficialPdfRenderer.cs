using LaboratoryApi.Domain;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace LaboratoryApi.Services;

public sealed record OfficialPdfLineItem(
    string InternalOrderCode,
    string TestDisplayName,
    string ResultText,
    string? Unit,
    string? Comment,
    Guid SpecimenId,
    string? AuthorizedByDisplayName);

public sealed record OfficialPdfRenderModel(
    string HospitalLaboratoryName,
    byte[] LogoContent,
    string LogoMimeType,
    string BusinessReportNumber,
    string PatientMrn,
    string PatientName,
    IReadOnlyList<OfficialPdfLineItem> Lines,
    string SignatoryName,
    string SignatoryCredentialsText);

/// <summary>
/// LaboratoryApi-owned Official PDF renderer (PD-PDF-10). AuthService QuestPDF is reference only.
/// Content limited to approved PD-PDF fields — no DOB, ranges, interpretation, or diagnosis.
/// </summary>
public interface IOfficialPdfRenderer
{
    byte[] Render(OfficialPdfRenderModel model);
}

public sealed class OfficialPdfRenderer : IOfficialPdfRenderer
{
    static OfficialPdfRenderer()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public byte[] Render(OfficialPdfRenderModel model)
    {
        ArgumentNullException.ThrowIfNull(model);
        if (string.IsNullOrWhiteSpace(model.BusinessReportNumber))
            throw new InvalidOperationException("Business Report Number is required on Official PDF.");
        if (string.IsNullOrWhiteSpace(model.HospitalLaboratoryName))
            throw new InvalidOperationException("Hospital/laboratory name is required on Official PDF.");
        if (model.LogoContent is null || model.LogoContent.Length == 0)
            throw new InvalidOperationException("Logo is required on Official PDF.");

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Margin(36);
                page.Size(PageSizes.A4);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Header().Column(col =>
                {
                    col.Item().Row(row =>
                    {
                        row.ConstantItem(72).Height(48).Image(model.LogoContent).FitArea();
                        row.RelativeItem().PaddingLeft(12).Column(c =>
                        {
                            c.Item().Text(model.HospitalLaboratoryName).SemiBold().FontSize(14);
                            c.Item().Text("Official Laboratory Report").FontSize(11);
                        });
                    });
                    col.Item().PaddingTop(8).LineHorizontal(1).LineColor(Colors.Grey.Medium);
                    col.Item().PaddingTop(8).Text($"Report Number: {model.BusinessReportNumber}").SemiBold();
                    col.Item().Text($"MRN: {model.PatientMrn}");
                    col.Item().Text($"Patient: {model.PatientName}");
                });

                page.Content().PaddingTop(16).Column(col =>
                {
                    foreach (var line in model.Lines)
                    {
                        col.Item().PaddingBottom(10).BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Column(item =>
                        {
                            item.Item().Text($"{line.InternalOrderCode} — {line.TestDisplayName}").SemiBold();
                            item.Item().Text($"Result: {line.ResultText}" +
                                (string.IsNullOrWhiteSpace(line.Unit) ? string.Empty : $" {line.Unit}"));
                            if (!string.IsNullOrWhiteSpace(line.Comment))
                                item.Item().Text($"Comment: {line.Comment}");
                            item.Item().Text($"SpecimenId: {line.SpecimenId:D}");
                            if (!string.IsNullOrWhiteSpace(line.AuthorizedByDisplayName))
                                item.Item().Text($"Authorized By: {line.AuthorizedByDisplayName}");
                        });
                    }
                });

                page.Footer().Column(col =>
                {
                    col.Item().PaddingTop(12).LineHorizontal(1).LineColor(Colors.Grey.Medium);
                    col.Item().PaddingTop(8).Text($"Laboratory Signatory: {model.SignatoryName}").SemiBold();
                    col.Item().Text(model.SignatoryCredentialsText);
                    col.Item().PaddingTop(6).AlignRight().Text(x =>
                    {
                        x.Span("Generated ");
                        x.Span(DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm 'UTC'"));
                    });
                });
            });
        }).GeneratePdf();
    }
}

/// <summary>Test-only PNG (1×1). Not a production default — used only by automated tests.</summary>
public static class OfficialPdfTestAssets
{
    // Minimal valid 1x1 PNG
    public static readonly byte[] TinyPng =
    {
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xFE, 0xD4, 0xEF, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
        0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
    };

    public static LmsReportPdfTemplateVersion CreateTestTemplate(
        Guid tenantId, Guid actorId, string hospitalName = "UAT Laboratory",
        string templateCode = "DEFAULT", int versionNumber = 1)
    {
        return new LmsReportPdfTemplateVersion
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            TemplateCode = templateCode,
            VersionNumber = versionNumber,
            HospitalLaboratoryName = hospitalName,
            LogoContent = TinyPng,
            LogoMimeType = "image/png",
            EffectiveFromUtc = DateTime.UtcNow.AddDays(-1),
            IsActive = true,
            IsLocked = false,
            CreatedAtUtc = DateTime.UtcNow,
            CreatedByUserId = actorId,
        };
    }

    public static LmsReportPdfSignatory CreateTestSignatory(
        Guid tenantId, Guid actorId, string name = "UAT Signatory",
        string credentials = "MBBS, Pathologist")
    {
        return new LmsReportPdfSignatory
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = name,
            CredentialsText = credentials,
            EffectiveFromUtc = DateTime.UtcNow.AddDays(-1),
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow,
            CreatedByUserId = actorId,
        };
    }
}
