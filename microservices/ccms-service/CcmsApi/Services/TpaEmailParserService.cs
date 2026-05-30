using System.Text.Json;
using System.Text.RegularExpressions;

namespace CcmsApi.Services;

/// <summary>Rules-based parser for TPA/insurer inbound email bodies (semi-automated review).</summary>
public static class TpaEmailParserService
{
    private static readonly Regex CaseNumberRx = new(
        @"CCMS-\d{4}-\d{6}",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex AmountRx = new(
        @"(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex PreAuthNoRx = new(
        @"(?:pre[-\s]?auth(?:orization)?|approval)\s*(?:no|number|#)?[:\s]*([A-Z0-9\-/]{6,})",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static TpaInboundParseResult Parse(string? subject, string? body, string? fromAddress)
    {
        var text = $"{subject}\n{body}".ToLowerInvariant();
        var decision = InferDecision(text);
        var confidence = decision is null ? 0.0 : InferConfidence(text, decision);

        decimal? amount = null;
        var amountMatch = AmountRx.Match($"{subject} {body}");
        if (amountMatch.Success
            && decimal.TryParse(amountMatch.Groups[1].Value.Replace(",", ""), out var amt))
            amount = amt;

        string? caseNumber = null;
        var caseMatch = CaseNumberRx.Match($"{subject} {body}");
        if (caseMatch.Success)
            caseNumber = caseMatch.Value.ToUpperInvariant();

        string? preAuthNumber = null;
        var paMatch = PreAuthNoRx.Match(body ?? "");
        if (paMatch.Success)
            preAuthNumber = paMatch.Groups[1].Value.Trim();

        var excerpt = (body ?? subject ?? "").Trim();
        if (excerpt.Length > 400)
            excerpt = excerpt[..400] + "…";

        return new TpaInboundParseResult(
            SuggestedDecision: decision,
            Confidence: confidence,
            ApprovedAmount: decision is "APPROVED" or "PARTIAL" ? amount : null,
            PreAuthNumber: preAuthNumber,
            CaseNumber: caseNumber,
            Excerpt: excerpt,
            FromAddress: fromAddress);
    }

    private static string? InferDecision(string text)
    {
        if (Regex.IsMatch(text, @"\b(reject|denied|denial|not approved|declined)\b"))
            return "REJECTED";
        if (Regex.IsMatch(text, @"\b(clarif|query|additional information|documents required|please provide)\b"))
            return "CLARIFICATION";
        if (Regex.IsMatch(text, @"\b(partial|partially approved|partial approval)\b"))
            return "PARTIAL";
        if (Regex.IsMatch(text, @"\b(approved|approval granted|authorised|authorized|sanctioned)\b"))
            return "APPROVED";
        return null;
    }

    private static double InferConfidence(string text, string decision)
    {
        var score = 0.55;
        if (decision == "APPROVED" && Regex.IsMatch(text, @"\bapproved\b")) score += 0.25;
        if (decision == "REJECTED" && Regex.IsMatch(text, @"\b(reject|denied|denial)\b")) score += 0.25;
        if (decision == "PARTIAL" && Regex.IsMatch(text, @"\bpartial\b")) score += 0.2;
        if (decision == "CLARIFICATION" && Regex.IsMatch(text, @"\bquery|clarif\b")) score += 0.2;
        if (AmountRx.IsMatch(text)) score += 0.1;
        return Math.Min(0.95, score);
    }

    public static string ToJson(TpaInboundParseResult result)
        => JsonSerializer.Serialize(result, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
}

public record TpaInboundParseResult(
    string? SuggestedDecision,
    double Confidence,
    decimal? ApprovedAmount,
    string? PreAuthNumber,
    string? CaseNumber,
    string? Excerpt,
    string? FromAddress);
