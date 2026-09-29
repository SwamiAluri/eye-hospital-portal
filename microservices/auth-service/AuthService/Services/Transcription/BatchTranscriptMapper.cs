using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using AuthService.Models.Counselor;

namespace AuthService.Services.Transcription;

/// <summary>
/// Maps an Azure batch transcription result into the existing segment shape.
/// Missing confidence, timestamps, and speakers stay absent.
/// </summary>
public static partial class BatchTranscriptMapper
{
    public static MappedTranscript Map(JsonElement root, string submittedLocale)
    {
        var segments = new List<TranscriptSegment>();
        var locales = new List<string>();
        if (root.TryGetProperty("recognizedPhrases", out var recognized) && recognized.ValueKind == JsonValueKind.Array)
        {
            foreach (var phrase in recognized.EnumerateArray())
            {
                segments.Add(MapRecognizedPhrase(phrase));
                var phraseLocale = ReadString(phrase, "locale");
                if (!string.IsNullOrWhiteSpace(phraseLocale))
                    locales.Add(phraseLocale);
            }
        }
        else if (root.TryGetProperty("phrases", out var phrases) && phrases.ValueKind == JsonValueKind.Array)
        {
            foreach (var phrase in phrases.EnumerateArray())
            {
                segments.Add(MapFastPhrase(phrase));
                var phraseLocale = ReadString(phrase, "locale");
                if (!string.IsNullOrWhiteSpace(phraseLocale))
                    locales.Add(phraseLocale);
            }
        }

        segments = segments.Where(s => !string.IsNullOrWhiteSpace(s.Text)).ToList();
        var text = string.Join(" ", segments.Select(s => s.Text.Trim())).Trim();
        var confidences = segments.Where(s => s.Confidence.HasValue).Select(s => s.Confidence!.Value).ToList();
        decimal? average = confidences.Count == 0
            ? null
            : (decimal)confidences.Average();

        var locale = locales.FirstOrDefault(code => !string.IsNullOrWhiteSpace(code))
            ?? FirstLocale(root)
            ?? submittedLocale;

        return new MappedTranscript
        {
            LanguageCode = string.IsNullOrWhiteSpace(locale) ? submittedLocale : locale,
            LanguageName = LanguageName(locale),
            Text = text,
            ConfidenceScore = average,
            WordCount = text.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length,
            CharacterCount = text.Length,
            Segments = segments,
        };
    }

    private static TranscriptSegment MapRecognizedPhrase(JsonElement phrase)
    {
        string? text = null;
        double? confidence = null;
        if (phrase.TryGetProperty("nBest", out var nBest) && nBest.ValueKind == JsonValueKind.Array)
        {
            var first = nBest.EnumerateArray().FirstOrDefault();
            if (first.ValueKind != JsonValueKind.Undefined)
            {
                text = ReadString(first, "display");
                confidence = ReadDouble(first, "confidence");
            }
        }

        var (start, end) = ReadOffset(phrase);
        return new TranscriptSegment
        {
            Start = start,
            End = end,
            Text = text ?? "",
            Confidence = confidence,
            Speaker = ReadSpeaker(phrase),
        };
    }

    private static TranscriptSegment MapFastPhrase(JsonElement phrase)
    {
        var startMs = ReadDouble(phrase, "offsetMilliseconds");
        var durationMs = ReadDouble(phrase, "durationMilliseconds");
        double? start = startMs.HasValue ? startMs.Value / 1000d : null;
        double? end = start.HasValue && durationMs.HasValue ? start.Value + (durationMs.Value / 1000d) : null;
        return new TranscriptSegment
        {
            Start = start,
            End = end,
            Text = ReadString(phrase, "text") ?? "",
            Confidence = ReadDouble(phrase, "confidence"),
            Speaker = ReadSpeaker(phrase),
        };
    }

    private static string? ReadSpeaker(JsonElement phrase)
    {
        if (!phrase.TryGetProperty("speaker", out var speaker))
            return null;
        if (speaker.ValueKind == JsonValueKind.Number && speaker.TryGetInt32(out var number))
            return "speaker_" + number.ToString(CultureInfo.InvariantCulture);
        if (speaker.ValueKind == JsonValueKind.String)
        {
            var raw = speaker.GetString();
            if (string.IsNullOrWhiteSpace(raw))
                return null;
            if (int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed))
                return "speaker_" + parsed.ToString(CultureInfo.InvariantCulture);
        }
        return null;
    }

    private static (double? Start, double? End) ReadOffset(JsonElement phrase)
    {
        var offsetTicks = ReadDouble(phrase, "offsetInTicks");
        var durationTicks = ReadDouble(phrase, "durationInTicks");
        if (offsetTicks.HasValue)
        {
            var start = offsetTicks.Value / 10_000_000d;
            var end = durationTicks.HasValue ? start + (durationTicks.Value / 10_000_000d) : (double?)null;
            return (start, end);
        }

        var offset = ReadString(phrase, "offset");
        var duration = ReadString(phrase, "duration");
        var startSeconds = ParseIsoDuration(offset);
        var durationSeconds = ParseIsoDuration(duration);
        if (!startSeconds.HasValue)
            return (null, null);
        return (startSeconds, durationSeconds.HasValue ? startSeconds.Value + durationSeconds.Value : null);
    }

    private static double? ParseIsoDuration(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;
        var match = IsoSeconds().Match(value);
        if (!match.Success)
            return null;
        return double.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture);
    }

    private static string? FirstLocale(JsonElement root)
    {
        if (root.TryGetProperty("locale", out var locale) && locale.ValueKind == JsonValueKind.String)
            return locale.GetString();
        return null;
    }

    public static string? LanguageName(string? languageCode) => languageCode switch
    {
        "en-US" or "en" => "English",
        "hi-IN" or "hi" => "Hindi",
        "te-IN" or "te" => "Telugu",
        _ => null,
    };

    private static string? ReadString(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String)
            return null;
        return value.GetString();
    }

    private static double? ReadDouble(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value))
            return null;
        if (value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var number))
            return number;
        return null;
    }

    [GeneratedRegex(@"PT(?<sec>\d+(?:\.\d+)?)S", RegexOptions.CultureInvariant)]
    private static partial Regex IsoSecondsRegex();

    private static Regex IsoSeconds() => IsoSecondsRegex();
}
