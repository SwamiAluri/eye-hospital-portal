using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using AuthService.Models.Counselor;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AuthService.Services.Transcription;

/// <summary>
/// Azure Speech batch transcription, REST API 2025-10-15.
/// Reads private blobs by URL only when trusted managed-identity access is configured.
/// </summary>
public sealed class AzureSpeechBatchTranscriptionProvider : ITranscriptionProvider
{
    public const string ApiVersion = "2025-10-15";
    public const int MinimumTimeToLiveHours = 6;

    private readonly HttpClient _http;
    private readonly ILogger<AzureSpeechBatchTranscriptionProvider> _logger;
    private readonly string? _key;
    private readonly string? _endpoint;
    private readonly string? _storageAccount;
    private readonly bool _trustedBlobAccess;
    private readonly IReadOnlyList<string> _locales;

    public AzureSpeechBatchTranscriptionProvider(
        HttpClient http,
        IConfiguration configuration,
        ILogger<AzureSpeechBatchTranscriptionProvider> logger)
    {
        _http = http;
        _logger = logger;
        _key = configuration["AzureSpeech:Key"];
        _endpoint = NormalizeEndpoint(configuration["AzureSpeech:Endpoint"], configuration["AzureSpeech:Region"]);
        _storageAccount = configuration["AzureSpeech:StorageAccountName"];
        _trustedBlobAccess = configuration.GetValue("AzureSpeech:TrustedBlobAccess", false);
        _locales = configuration.GetSection("AzureSpeech:SupportedLanguages").Get<string[]>()
            ?.Where(code => !string.IsNullOrWhiteSpace(code))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray()
            ?? new[] { "en-US", "hi-IN", "te-IN" };
        _logger.LogInformation(
            "Counselling transcription provider ready {Ready} trusted {Trusted} keyPresent {KeyPresent} keyPlaceholder {KeyPlaceholder} endpointPresent {EndpointPresent} storagePresent {StoragePresent}",
            IsReady,
            _trustedBlobAccess,
            !string.IsNullOrWhiteSpace(_key),
            string.Equals(_key, "YOUR_AZURE_SPEECH_KEY", StringComparison.Ordinal),
            !string.IsNullOrWhiteSpace(_endpoint),
            !string.IsNullOrWhiteSpace(_storageAccount));
    }

    public bool IsReady =>
        _trustedBlobAccess
        && !string.IsNullOrWhiteSpace(_key)
        && !string.Equals(_key, "YOUR_AZURE_SPEECH_KEY", StringComparison.Ordinal)
        && !string.IsNullOrWhiteSpace(_endpoint)
        && !string.IsNullOrWhiteSpace(_storageAccount);

    public IReadOnlyList<string> ConfiguredLocales => _locales;

    public async Task<TranscriptionJobLookup> FindJobAsync(Guid recordingId, CancellationToken cancellationToken = default)
    {
        if (!IsReady)
            return new TranscriptionJobLookup { LookupFailed = true, ErrorCategory = CounselingTranscriptionErrors.ConfigurationMissing };

        try
        {
            var displayName = DisplayName(recordingId);
            using var request = Create(HttpMethod.Get, $"speechtotext/transcriptions?api-version={ApiVersion}");
            using var response = await _http.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Speech job lookup failed for recording {RecordingId} with status {StatusCode}",
                    recordingId, (int)response.StatusCode);
                return new TranscriptionJobLookup { LookupFailed = true, ErrorCategory = CategoryFor(response.StatusCode) };
            }

            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
            if (!document.RootElement.TryGetProperty("values", out var values) || values.ValueKind != JsonValueKind.Array)
                return new TranscriptionJobLookup();

            foreach (var job in values.EnumerateArray())
            {
                var name = job.TryGetProperty("displayName", out var display) ? display.GetString() : null;
                if (!string.Equals(name, displayName, StringComparison.Ordinal))
                    continue;
                var parsed = ParseJob(job);
                if (parsed != null)
                    return new TranscriptionJobLookup { Job = parsed };
            }

            return new TranscriptionJobLookup();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Speech job lookup failed for recording {RecordingId}", recordingId);
            return new TranscriptionJobLookup { LookupFailed = true, ErrorCategory = CounselingTranscriptionErrors.ProviderUnavailable };
        }
    }

    public async Task<TranscriptionProviderJob> SubmitAsync(TranscriptionSubmitRequest request, CancellationToken cancellationToken = default)
    {
        if (!IsReady)
            throw new InvalidOperationException(CounselingTranscriptionErrors.ConfigurationMissing);
        if (request.PrivateContentUrl.Contains('?', StringComparison.Ordinal))
            throw new InvalidOperationException(CounselingTranscriptionErrors.StorageAccessDenied);

        var locale = string.IsNullOrWhiteSpace(request.Locale) ? _locales[0] : request.Locale;
        var candidates = request.CandidateLocales.Count >= 2
            ? request.CandidateLocales
            : _locales;
        var properties = new Dictionary<string, object?>
        {
            ["timeToLiveHours"] = MinimumTimeToLiveHours,
            ["wordLevelTimestampsEnabled"] = true,
        };
        if (candidates.Count >= 2)
        {
            properties["languageIdentification"] = new Dictionary<string, object?>
            {
                ["candidateLocales"] = candidates,
            };
        }
        var body = new Dictionary<string, object?>
        {
            ["contentUrls"] = new[] { request.PrivateContentUrl },
            ["locale"] = locale,
            ["displayName"] = DisplayName(request.RecordingId),
            ["properties"] = properties,
        };

        using var message = Create(HttpMethod.Post, $"speechtotext/transcriptions:submit?api-version={ApiVersion}");
        message.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        using var response = await _http.SendAsync(message, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var detail = await ReadSanitizedDetailAsync(response, cancellationToken);
            _logger.LogWarning(
                "Speech submit failed for recording {RecordingId} with status {StatusCode} detail {Detail}",
                request.RecordingId, (int)response.StatusCode, detail);
            return new TranscriptionProviderJob
            {
                ProviderStatus = "Failed",
                ErrorCategory = CategoryFor(response.StatusCode),
                ProviderDetail = detail,
            };
        }

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        return ParseJob(document.RootElement)
            ?? new TranscriptionProviderJob
            {
                ProviderStatus = "Failed",
                ErrorCategory = CounselingTranscriptionErrors.ProcessingFailed,
            };
    }

    public async Task<TranscriptionProviderJob> GetJobAsync(string jobId, CancellationToken cancellationToken = default)
    {
        if (!IsReady)
            return new TranscriptionProviderJob { JobId = jobId, ProviderStatus = "Failed", ErrorCategory = CounselingTranscriptionErrors.ConfigurationMissing };

        using var request = Create(HttpMethod.Get, $"speechtotext/transcriptions/{Uri.EscapeDataString(jobId)}?api-version={ApiVersion}");
        using var response = await _http.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Speech job {JobId} status read failed with {StatusCode}", jobId, (int)response.StatusCode);
            return new TranscriptionProviderJob
            {
                JobId = jobId,
                ProviderStatus = "Failed",
                ErrorCategory = CategoryFor(response.StatusCode),
            };
        }

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        var parsed = ParseJob(document.RootElement)
            ?? new TranscriptionProviderJob { JobId = jobId, ProviderStatus = "Running" };
        if (!string.IsNullOrWhiteSpace(parsed.ProviderDetail))
        {
            _logger.LogWarning(
                "Speech job {JobId} reported detail {Detail}",
                jobId, parsed.ProviderDetail);
        }
        return parsed;
    }

    public async Task<MappedTranscript> DownloadResultAsync(
        string jobId,
        string submittedLocale,
        CancellationToken cancellationToken = default)
    {
        using var filesRequest = Create(
            HttpMethod.Get,
            $"speechtotext/transcriptions/{Uri.EscapeDataString(jobId)}/files?api-version={ApiVersion}&sasValidityInSeconds=0");
        using var filesResponse = await _http.SendAsync(filesRequest, cancellationToken);
        filesResponse.EnsureSuccessStatusCode();
        using var filesDocument = JsonDocument.Parse(await filesResponse.Content.ReadAsStringAsync(cancellationToken));
        if (!filesDocument.RootElement.TryGetProperty("values", out var values))
            throw new InvalidOperationException(CounselingTranscriptionErrors.ProcessingFailed);

        string? contentUrl = null;
        foreach (var file in values.EnumerateArray())
        {
            var kind = file.TryGetProperty("kind", out var kindValue) ? kindValue.GetString() : null;
            if (!string.Equals(kind, "Transcription", StringComparison.OrdinalIgnoreCase))
                continue;
            if (file.TryGetProperty("links", out var links)
                && links.TryGetProperty("contentUrl", out var url)
                && url.ValueKind == JsonValueKind.String)
            {
                contentUrl = url.GetString();
                break;
            }
        }

        if (string.IsNullOrWhiteSpace(contentUrl))
            throw new InvalidOperationException(CounselingTranscriptionErrors.ProcessingFailed);

        using var contentResponse = await _http.GetAsync(contentUrl, cancellationToken);
        contentResponse.EnsureSuccessStatusCode();
        using var transcript = JsonDocument.Parse(await contentResponse.Content.ReadAsStringAsync(cancellationToken));
        return BatchTranscriptMapper.Map(transcript.RootElement, submittedLocale);
    }

    internal static string DisplayName(Guid recordingId) => "cr-" + recordingId.ToString("N");

    private HttpRequestMessage Create(HttpMethod method, string relative)
    {
        var endpoint = _endpoint!.TrimEnd('/');
        var request = new HttpRequestMessage(method, endpoint + "/" + relative);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Headers.Add("Ocp-Apim-Subscription-Key", _key);
        return request;
    }

    private static TranscriptionProviderJob? ParseJob(JsonElement job)
    {
        var self = job.TryGetProperty("self", out var selfValue) ? selfValue.GetString() : null;
        var id = job.TryGetProperty("id", out var idValue) && idValue.ValueKind == JsonValueKind.String
            ? idValue.GetString()
            : ExtractId(self);
        var status = job.TryGetProperty("status", out var statusValue) ? statusValue.GetString() : null;
        if (string.IsNullOrWhiteSpace(id) && string.IsNullOrWhiteSpace(status))
            return null;
        return new TranscriptionProviderJob
        {
            JobId = id ?? "",
            ProviderStatus = status ?? "Running",
            ErrorCategory = string.Equals(status, "Failed", StringComparison.OrdinalIgnoreCase)
                ? CounselingTranscriptionErrors.ProviderRejected
                : null,
            ProviderDetail = ReadJobError(job),
        };
    }

    private async Task<string?> ReadSanitizedDetailAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(body))
            return null;
        try
        {
            using var document = JsonDocument.Parse(body);
            return ReadJobError(document.RootElement) ?? ReadTopLevelError(document.RootElement);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? ReadJobError(JsonElement job)
    {
        if (job.TryGetProperty("properties", out var properties)
            && properties.ValueKind == JsonValueKind.Object
            && properties.TryGetProperty("error", out var error))
        {
            return FormatError(error);
        }
        return ReadTopLevelError(job);
    }

    private static string? ReadTopLevelError(JsonElement element)
    {
        if (!element.TryGetProperty("innerError", out var inner) && !element.TryGetProperty("code", out _))
            return element.TryGetProperty("error", out var nested) ? FormatError(nested) : null;
        return FormatError(element);
    }

    private static string? FormatError(JsonElement error)
    {
        if (error.ValueKind != JsonValueKind.Object)
            return null;
        var code = error.TryGetProperty("code", out var codeValue) && codeValue.ValueKind == JsonValueKind.String
            ? codeValue.GetString()
            : null;
        var message = error.TryGetProperty("message", out var messageValue) && messageValue.ValueKind == JsonValueKind.String
            ? messageValue.GetString()
            : null;
        if (string.IsNullOrWhiteSpace(code) && string.IsNullOrWhiteSpace(message))
            return null;
        var detail = string.IsNullOrWhiteSpace(code) ? message : code + ": " + message;
        return Sanitize(detail);
    }

    private static string? Sanitize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;
        var withoutQuery = System.Text.RegularExpressions.Regex.Replace(value, @"https?://\S+", "[url]");
        return withoutQuery.Length <= 300 ? withoutQuery : withoutQuery[..300];
    }

    private static string? ExtractId(string? self)
    {
        if (string.IsNullOrWhiteSpace(self))
            return null;
        var path = self.Split('?')[0].TrimEnd('/');
        var slash = path.LastIndexOf('/');
        return slash < 0 ? path : path[(slash + 1)..];
    }

    private static string CategoryFor(HttpStatusCode status) => status switch
    {
        HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden => CounselingTranscriptionErrors.StorageAccessDenied,
        HttpStatusCode.RequestTimeout or HttpStatusCode.ServiceUnavailable or HttpStatusCode.BadGateway => CounselingTranscriptionErrors.ProviderUnavailable,
        HttpStatusCode.BadRequest => CounselingTranscriptionErrors.ProviderRejected,
        _ => CounselingTranscriptionErrors.ProcessingFailed,
    };

    private static string? NormalizeEndpoint(string? endpoint, string? region)
    {
        if (!string.IsNullOrWhiteSpace(endpoint))
        {
            if (Uri.TryCreate(endpoint, UriKind.Absolute, out var uri))
                return uri.GetLeftPart(UriPartial.Authority);
        }

        if (string.IsNullOrWhiteSpace(region))
            return null;
        return $"https://{region}.api.cognitive.microsoft.com";
    }
}
