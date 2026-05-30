using CcmsApi.Data;
using CcmsApi.Models.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Services;

public class TpaInboundEmailService
{
    private readonly CcmsDbContext _db;
    private readonly ILogger<TpaInboundEmailService> _log;

    public TpaInboundEmailService(CcmsDbContext db, ILogger<TpaInboundEmailService> log)
    {
        _db = db;
        _log = log;
    }

    public async Task<TpaInboundEmailResult> IngestAsync(
        TpaInboundEmailRequest req,
        CancellationToken ct = default)
    {
        var parse = TpaEmailParserService.Parse(req.Subject, req.Body, req.FromAddress);

        Guid? caseId = req.CoverageCaseId;
        if (!caseId.HasValue && !string.IsNullOrWhiteSpace(parse.CaseNumber))
        {
            var matchCase = await _db.CoverageCases.AsNoTracking()
                .FirstOrDefaultAsync(c =>
                    c.CaseNumber == parse.CaseNumber && c.DeletedAt == null, ct);
            caseId = matchCase?.Id;
        }

        if (!caseId.HasValue && !string.IsNullOrWhiteSpace(req.InReplyToMessageId))
        {
            var prior = await _db.CommunicationLogs.AsNoTracking()
                .FirstOrDefaultAsync(l =>
                    l.ExternalMessageId == req.InReplyToMessageId && l.DeletedAt == null, ct);
            caseId = prior?.CoverageCase_Id;
        }

        if (!caseId.HasValue)
            throw new KeyNotFoundException(
                "Could not resolve coverage case — include caseNumber (CCMS-YYYY-NNNNNN) or inReplyToMessageId.");

        var coverageCase = await _db.CoverageCases.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == caseId.Value && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {caseId} not found.");

        var metadata = new Dictionary<string, object?>
        {
            ["parseDraft"] = parse,
            ["reviewStatus"] = parse.SuggestedDecision is null ? "needs_review" : "draft_ready",
        };

        var log = new CcmsCommunicationLog
        {
            Id                  = Guid.NewGuid(),
            TenantId            = coverageCase.TenantId,
            CoverageCase_Id     = coverageCase.Id,
            CommunicationType   = "email",
            Direction           = "inbound",
            RecipientType       = InferRecipientType(req.FromAddress),
            RecipientAddress    = req.FromAddress,
            Subject             = req.Subject,
            BodySummary         = req.Body,
            SentAt              = req.ReceivedAt ?? DateTime.UtcNow,
            DeliveryStatus      = "received",
            ExternalMessageId   = req.ExternalMessageId,
            MetadataJson        = System.Text.Json.JsonSerializer.Serialize(metadata),
            CreatedAt           = DateTime.UtcNow,
            UpdatedAt           = DateTime.UtcNow,
            Status              = "active",
        };

        _db.CommunicationLogs.Add(log);
        await _db.SaveChangesAsync(ct);

        _log.LogInformation(
            "Inbound TPA email logged for case {CaseId}, decision hint {Decision}",
            coverageCase.Id, parse.SuggestedDecision);

        return new TpaInboundEmailResult(log.Id, coverageCase.Id, coverageCase.CaseNumber, parse);
    }

    private static string InferRecipientType(string? from)
    {
        if (string.IsNullOrWhiteSpace(from)) return "tpa";
        var lower = from.ToLowerInvariant();
        if (lower.Contains("insurance") || lower.Contains("insurer")) return "insurance";
        return "tpa";
    }
}

public record TpaInboundEmailRequest(
    string? FromAddress,
    string? Subject,
    string? Body,
    string? ExternalMessageId,
    string? InReplyToMessageId,
    Guid? CoverageCaseId,
    DateTime? ReceivedAt);

public record TpaInboundEmailResult(
    Guid LogId,
    Guid CoverageCaseId,
    string CaseNumber,
    TpaInboundParseResult Parse);
