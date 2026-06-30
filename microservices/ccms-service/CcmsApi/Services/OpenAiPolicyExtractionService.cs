using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using CcmsApi.Data;
using CcmsApi.Models.Dtos;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OpenAI;
using OpenAI.Chat;
using System.ClientModel.Primitives;

namespace CcmsApi.Services;

/// <summary>
/// Extracts insurance policy card fields using OpenAI vision (mirrors GRN invoice OCR pattern).
/// Accepts front and/or back card images (JPEG, PNG, WebP, PDF).
/// </summary>
public sealed class OpenAiPolicyExtractionService : IPolicyExtractionService
{
    private const double HighThreshold   = 0.90;
    private const double ReviewThreshold = 0.70;

    private readonly CcmsDbContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<OpenAiPolicyExtractionService> _log;

    public OpenAiPolicyExtractionService(
        CcmsDbContext db,
        IConfiguration config,
        ILogger<OpenAiPolicyExtractionService> log)
    {
        _db     = db;
        _config = config;
        _log    = log;
    }

    public async Task<PolicyExtractionPreview> ExtractAsync(
        PolicyCardImage? front,
        PolicyCardImage? back,
        string sessionId,
        Guid tenantId,
        Guid coverageCaseId,
        string? paymentType = null,
        CancellationToken ct = default)
    {
        if (front is null && back is null)
            throw new ArgumentException("At least one card image (front or back) is required.");

        var sw = System.Diagnostics.Stopwatch.StartNew();
        var primary = front ?? back!;
        var originalFilename = front?.FileName ?? back!.FileName;

        var apiKey = _config["OpenAI:ApiKey"]
                  ?? _config["OPENAI_API_KEY"]
                  ?? throw new InvalidOperationException(
                      "OpenAI API key not configured. Set OpenAI:ApiKey in local.settings.json.");

        var textModel   = _config["OpenAI:Model"]       ?? "gpt-4.1-mini";
        var visionModel = _config["OpenAI:VisionModel"] ?? textModel;

        var oaiOptions = new OpenAIClientOptions
        {
            NetworkTimeout = TimeSpan.FromMinutes(4),
            RetryPolicy    = new ClientRetryPolicy(maxRetries: 0),
        };
        var oaiClient = new OpenAIClient(new System.ClientModel.ApiKeyCredential(apiKey), oaiOptions);

        var systemPrompt = BuildSystemPrompt(paymentType);
        var userPrompt   = BuildUserPrompt(paymentType, front is not null, back is not null);

        var userParts = new List<ChatMessageContentPart> { ChatMessageContentPart.CreateTextPart(userPrompt) };
        var activeModel = visionModel;

        foreach (var card in new[] { front, back })
        {
            if (card is null) continue;
            activeModel = await AddCardToMessagePartsAsync(
                card, userParts, textModel, visionModel, activeModel, sessionId);
        }

        var chatClient = oaiClient.GetChatClient(activeModel);
        var messages = new List<ChatMessage>
        {
            ChatMessage.CreateSystemMessage(systemPrompt),
            ChatMessage.CreateUserMessage(userParts.ToArray()),
        };

        string rawJson;
        try
        {
            var completion = await chatClient.CompleteChatAsync(messages, new ChatCompletionOptions
            {
                MaxOutputTokenCount = 4096,
                Temperature         = 0f,
                ResponseFormat      = ChatResponseFormat.CreateJsonObjectFormat(),
            }, ct);

            rawJson = completion.Value.Content[0].Text.Trim();
            rawJson = StripJsonFences(rawJson);
            var jsonStart = rawJson.IndexOf('{');
            var jsonEnd   = rawJson.LastIndexOf('}');
            if (jsonStart < 0 || jsonEnd <= jsonStart)
                throw new InvalidOperationException(
                    "The AI model could not extract data from this card. Try a clearer scan.");
            rawJson = rawJson[jsonStart..(jsonEnd + 1)];
        }
        catch (InvalidOperationException) { throw; }
        catch (Exception ex)
        {
            _log.LogError(ex, "OpenAI policy extraction failed for session {SessionId}", sessionId);
            throw new InvalidOperationException($"Extraction provider error: {ex.Message}", ex);
        }

        sw.Stop();
        rawJson = SanitizeJsonControlChars(rawJson);
        JsonNode? root;
        try   { root = JsonNode.Parse(rawJson); }
        catch (Exception ex)
        {
            _log.LogError(ex, "JSON parse failed for policy session {SessionId}", sessionId);
            throw new InvalidOperationException("Model response could not be parsed as JSON.");
        }

        var insurerName = TryString(root, "insurer_name");
        var candidates  = await ResolveInsurerCandidatesAsync(tenantId, insurerName, ct);
        var resolvedId  = candidates.Count > 0 && candidates[0].Score >= (decimal)HighThreshold
            ? candidates[0].Id : (Guid?)null;

        var policyNo = TryString(root, "policy_number");
        var fields = new ExtractedPolicyFields(
            InsurerName:           MakeField(insurerName, insurerName, string.IsNullOrWhiteSpace(insurerName) ? 0.3 : 0.9),
            PolicyNumber:          MakeField(policyNo, policyNo, string.IsNullOrWhiteSpace(policyNo) ? 0.3 : 0.92),
            CardNumber:            MakeField(TryString(root, "card_number"), TryString(root, "card_number"), 0.85),
            MembershipNumber:      MakeField(TryString(root, "membership_number"), TryString(root, "membership_number"), 0.85),
            InsuredName:           MakeField(TryString(root, "insured_name"), TryString(root, "insured_name"), 0.88),
            RelationshipToInsured:   MakeField(NormaliseRelationship(TryString(root, "relationship_to_insured")),
                TryString(root, "relationship_to_insured"), 0.75),
            CompanyName:           MakeField(TryString(root, "company_name"), TryString(root, "company_name"), 0.7),
            ContactNumber:         MakeField(TryString(root, "contact_number"), TryString(root, "contact_number"), 0.8),
            SumInsured:            MakeDecimal(root, "sum_insured", 0.85),
            CoPayPercent:          MakeDecimal(root, "co_pay_percent", 0.75),
            ValidFrom:             MakeDate(TryString(root, "valid_from"), 0.8),
            ValidTo:               MakeDate(TryString(root, "valid_to"), 0.8),
            TpaName:               MakeField(TryString(root, "tpa_name"), TryString(root, "tpa_name"), 0.7)
        );

        bool hasDup = false;
        string? dupDetail = null;
        if (!string.IsNullOrWhiteSpace(policyNo))
        {
            hasDup = await _db.VisitInsurancePolicies.AnyAsync(p =>
                p.DeletedAt == null
                && p.CoverageCase_Id == coverageCaseId
                && p.PolicyNumber.ToLower() == policyNo.Trim().ToLower(), ct);
            if (hasDup) dupDetail = $"Policy '{policyNo}' already exists on this case.";
        }

        return new PolicyExtractionPreview(
            SessionId:                  sessionId,
            FrontDocumentUrl:           front?.BlobUrl,
            BackDocumentUrl:            back?.BlobUrl,
            OriginalFilename:           originalFilename,
            ProviderModel:              activeModel,
            ProcessingMs:               (int)sw.ElapsedMilliseconds,
            HasDuplicateWarning:        hasDup,
            DuplicateWarningDetail:     dupDetail,
            Fields:                     fields,
            InsurerCandidates:          candidates,
            ResolvedInsuranceProviderId: resolvedId
        );
    }

    private async Task<string> AddCardToMessagePartsAsync(
        PolicyCardImage card,
        List<ChatMessageContentPart> parts,
        string textModel,
        string visionModel,
        string activeModel,
        string sessionId)
    {
        using var ms = new MemoryStream();
        await card.Content.CopyToAsync(ms);
        var bytes = ms.ToArray();

        var isPdf = card.ContentType == "application/pdf"
                 || card.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase);

        if (isPdf)
        {
            var pdfText = "";
            try
            {
                pdfText = ExtractPdfText(bytes);
                var wordCount = pdfText
                    .Replace("--- Page", " ")
                    .Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
                if (wordCount >= 10)
                {
                    parts.Add(ChatMessageContentPart.CreateTextPart(
                        $"Card side ({card.FileName}) text:\n\n{pdfText[..Math.Min(pdfText.Length, 8000)]}"));
                    return textModel;
                }
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "PdfPig failed for policy card {File}", card.FileName);
            }

            var vision = visionModel;
            var pageImages = RenderPdfPagesToPng(bytes, maxPages: 1).ToList();
            if (pageImages.Count == 0)
                throw new InvalidOperationException("Could not render PDF card image.");
            foreach (var png in pageImages)
                parts.Add(ChatMessageContentPart.CreateImagePart(
                    BinaryData.FromBytes(png), "image/png", ChatImageDetailLevel.High));
            return vision;
        }

        parts.Add(ChatMessageContentPart.CreateImagePart(
            BinaryData.FromBytes(bytes), card.ContentType, ChatImageDetailLevel.High));
        return visionModel;
    }

    private async Task<IReadOnlyList<ExtractionCandidate>> ResolveInsurerCandidatesAsync(
        Guid tenantId, string? name, CancellationToken ct)
    {
        var all = await _db.InsuranceProviders
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null)
            .Select(p => new { p.Id, p.ProviderName })
            .ToListAsync(ct);

        if (string.IsNullOrWhiteSpace(name))
            return all.Take(5).Select(p => new ExtractionCandidate(p.Id, p.ProviderName, 0.4m)).ToList();

        var nameLower = name.ToLowerInvariant();
        return all
            .Select(p => new ExtractionCandidate(p.Id, p.ProviderName, FuzzyScore(p.ProviderName, nameLower)))
            .Where(c => c.Score >= 0.4m)
            .OrderByDescending(c => c.Score)
            .Take(5)
            .ToList();
    }

    private static string BuildSystemPrompt(string? paymentType)
    {
        var variant = (paymentType ?? "Insurance").Trim();
        var docHint = variant switch
        {
            "TPA" or "CoPay" =>
                "Document may be a TPA letter or cashless card. Prioritise TPA name, coordinator contact, room class, and policy/member IDs.",
            "CGHS" or "SGHS" or "GovernmentScheme" or "ESH" or "Arograshree" or "Railway" =>
                "Document may be a government / scheme health card. Prioritise scheme name, beneficiary ID, and entitlement class.",
            _ =>
                "Document is a private health insurance card or e-card.",
        };

        return $"""
            You are an expert OCR assistant for Indian health insurance documents.
            {docHint}
            Extract fields from card images (front and/or back) and return ONLY a valid JSON object.

            Front side typically has: insurer_name, policy_number, insured_name, membership_number, sum_insured.
            Back side typically has: tpa_name, contact_number, room class notes, validity dates.

            Fields (use null when not visible):
              insurer_name            (string — insurance company or scheme name)
              policy_number           (string)
              card_number             (string — physical card number if different from policy)
              membership_number       (string — member ID / UHID / beneficiary ID)
              insured_name            (string)
              relationship_to_insured (string: self|spouse|child|parent|other)
              company_name            (string — employer for corporate policy)
              contact_number          (string — TPA / helpline)
              sum_insured             (number — INR, no symbols)
              co_pay_percent          (number)
              valid_from              (string YYYY-MM-DD)
              valid_to                (string YYYY-MM-DD — policy expiry)
              tpa_name                (string)
              room_class              (string — e.g. Single AC, Twin Sharing)

            Also include a "field_confidence" object with 0.0-1.0 scores for each field above.
            """;
    }

    private static string BuildUserPrompt(string? paymentType, bool hasFront, bool hasBack)
    {
        var parts = new List<string>
        {
            "Extract all insurance policy card fields from the provided image(s).",
        };
        if (hasFront && hasBack)
            parts.Add("Merge front and back: use front for policy #, insured name, insurer; use back for TPA, contacts, room class.");
        else if (hasBack)
            parts.Add("This is the BACK of the card — focus on TPA, contacts, room class, validity.");
        else
            parts.Add("This is the FRONT of the card — focus on policy #, insurer, insured name, sum insured.");

        if (!string.IsNullOrWhiteSpace(paymentType))
            parts.Add($"Payment context: {paymentType.Trim()}.");

        parts.Add("Return ONLY a JSON object following the schema in the system prompt.");
        return string.Join(" ", parts);
    }

    private static string? TryString(JsonNode? node, string key)
    {
        if (node is null) return null;
        if (!node.AsObject().TryGetPropertyValue(key, out var val) || val is null) return null;
        return val.GetValueKind() == JsonValueKind.String ? val.GetValue<string>()?.Trim() : val.ToString();
    }

    private static decimal TryDecimal(JsonNode? node, string key)
    {
        if (node is null) return 0;
        if (!node.AsObject().TryGetPropertyValue(key, out var val) || val is null) return 0;
        if (val.GetValueKind() == JsonValueKind.Number)
        {
            try { return val.GetValue<decimal>(); }
            catch { /* fall through */ }
        }
        var s = val.ToString().Replace(",", "").Replace("₹", "").Trim();
        return decimal.TryParse(s, out var parsed) ? parsed : 0;
    }

    private static double TryConfidence(JsonNode? root, string field)
    {
        if (root?["field_confidence"] is not JsonObject conf) return 0.85;
        if (!conf.TryGetPropertyValue(field, out var val) || val is null) return 0.85;
        if (val.GetValueKind() == JsonValueKind.Number)
        {
            try { return val.GetValue<double>(); }
            catch { /* use default */ }
        }
        return 0.85;
    }

    private static ExtractedField<string> MakeField(string? value, string? source, double score)
    {
        var conf = ScoreToConfidence(score);
        return new ExtractedField<string>(value, source, conf,
            conf == ExtractionConfidence.High ? null : "Please verify this field");
    }

    private static ExtractedField<decimal?> MakeDecimal(JsonNode? root, string key, double defaultScore)
    {
        var val = TryDecimal(root, key);
        var score = TryConfidence(root, key);
        if (score <= 0) score = defaultScore;
        var hasVal = val > 0;
        var conf = ScoreToConfidence(hasVal ? score : score * 0.5);
        return new ExtractedField<decimal?>(hasVal ? val : null, hasVal ? val.ToString() : null, conf,
            conf == ExtractionConfidence.High ? null : "Please verify amount");
    }

    private static ExtractedField<DateTime?> MakeDate(string? raw, double defaultScore)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return new ExtractedField<DateTime?>(null, null, ExtractionConfidence.Low, "Date not found");
        if (DateTime.TryParse(raw, out var dt))
            return new ExtractedField<DateTime?>(dt.Date, raw, ScoreToConfidence(defaultScore), null);
        return new ExtractedField<DateTime?>(null, raw, ExtractionConfidence.Review, "Could not parse date");
    }

    private static ExtractionConfidence ScoreToConfidence(double score) =>
        score >= HighThreshold   ? ExtractionConfidence.High
        : score >= ReviewThreshold ? ExtractionConfidence.Review
        : ExtractionConfidence.Low;

    private static string? NormaliseRelationship(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var r = raw.Trim().ToLowerInvariant();
        return r switch
        {
            "self" or "self/" or "primary" => "self",
            "spouse" or "wife" or "husband" => "spouse",
            "child" or "son" or "daughter" => "child",
            "parent" or "father" or "mother" => "parent",
            _ => "other",
        };
    }

    private static string StripJsonFences(string raw)
    {
        if (raw.StartsWith("```"))
        {
            var firstNewline = raw.IndexOf('\n');
            raw = firstNewline >= 0 ? raw[(firstNewline + 1)..].Trim() : raw;
        }
        if (raw.EndsWith("```"))
            raw = raw[..raw.LastIndexOf("```")].Trim();
        return raw;
    }

    private static string SanitizeJsonControlChars(string raw)
    {
        if (string.IsNullOrEmpty(raw)) return raw;
        var sb = new StringBuilder(raw.Length);
        bool inStr = false, escaped = false;
        foreach (char c in raw)
        {
            if (escaped)  { sb.Append(c); escaped = false; continue; }
            if (c == '\\') { escaped = true; sb.Append(c); continue; }
            if (c == '"')  { inStr = !inStr; sb.Append(c); continue; }
            if (inStr)
            {
                switch (c)
                {
                    case '\n': sb.Append("\\n"); continue;
                    case '\r': sb.Append("\\r"); continue;
                    case '\t': sb.Append("\\t"); continue;
                }
            }
            sb.Append(c);
        }
        return sb.ToString();
    }

    private static decimal FuzzyScore(string candidate, string queryLower)
    {
        if (string.IsNullOrWhiteSpace(candidate)) return 0m;
        var cLower = candidate.ToLowerInvariant();
        if (cLower == queryLower) return 1.0m;
        if (cLower.Contains(queryLower) || queryLower.Contains(cLower)) return 0.85m;
        var qWords = queryLower.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var cWords = cLower.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var matched = qWords.Count(qw => cWords.Any(cw => cw.Contains(qw) || qw.Contains(cw)));
        return qWords.Length == 0 ? 0m : (decimal)matched / qWords.Length * 0.8m;
    }

    private static IEnumerable<byte[]> RenderPdfPagesToPng(byte[] pdfBytes, int maxPages = 1)
    {
        var renderOpts = new PDFtoImage.RenderOptions { Dpi = 120 };
        int total;
        using (var countMs = new MemoryStream(pdfBytes))
            total = PDFtoImage.Conversion.GetPageCount(countMs);

        int pagesToRender = Math.Min(total, maxPages);
        for (int i = 0; i < pagesToRender; i++)
        {
            using var pageMs = new MemoryStream(pdfBytes);
            using var bitmap = PDFtoImage.Conversion.ToImage(pageMs, page: i, options: renderOpts);
            using var encoded = bitmap.Encode(SkiaSharp.SKEncodedImageFormat.Png, 90);
            yield return encoded.ToArray();
        }
    }

    private static bool IsEncryptedPdf(byte[] pdfBytes)
    {
        try
        {
            using var doc = UglyToad.PdfPig.PdfDocument.Open(pdfBytes);
            return doc.IsEncrypted;
        }
        catch
        {
            return false;
        }
    }

    private static string ExtractPdfText(byte[] pdfBytes)
    {
        if (IsEncryptedPdf(pdfBytes))
            throw new InvalidOperationException(
                "This PDF is password-protected. Please upload an unencrypted copy or use a photo scan.");

        using var doc = UglyToad.PdfPig.PdfDocument.Open(pdfBytes);
        var sb = new StringBuilder();
        foreach (var page in doc.GetPages())
        {
            sb.AppendLine($"--- Page {page.Number} ---");
            sb.AppendLine(string.Join(" ", page.GetWords().Select(w => w.Text)));
        }
        return sb.ToString();
    }
}
