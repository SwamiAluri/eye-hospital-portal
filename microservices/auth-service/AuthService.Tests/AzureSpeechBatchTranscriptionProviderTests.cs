using System.Net;
using System.Text;
using System.Text.Json;
using AuthService.Services.Transcription;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace AuthService.Tests;

public class AzureSpeechBatchTranscriptionProviderTests
{
    private readonly Guid _recording = Guid.Parse("c5ed30d6-d832-402d-aada-65515af810e2");

    [Fact]
    public async Task Submit_UsesCurrentApi_PrivateUrl_AndRequiredTtl()
    {
        var capture = new CaptureHandler(_ => JsonResponse(HttpStatusCode.Created, """
            {"self":"https://centralindia.api.cognitive.microsoft.com/speechtotext/transcriptions/job-1","status":"NotStarted"}
            """));
        var provider = Create(capture);

        var job = await provider.SubmitAsync(new TranscriptionSubmitRequest
        {
            RecordingId = _recording,
            PrivateContentUrl = "https://hospitalblobdev01.blob.core.windows.net/session-audio/object-key",
            Locale = "en-US",
            CandidateLocales = new[] { "en-US", "hi-IN", "te-IN" },
        });

        Assert.Equal(HttpMethod.Post, capture.Method);
        Assert.Contains("/speechtotext/transcriptions:submit?api-version=2025-10-15", capture.Uri, StringComparison.Ordinal);
        Assert.DoesNotContain("v3.0", capture.Uri, StringComparison.Ordinal);
        Assert.DoesNotContain("v3.2", capture.Uri, StringComparison.Ordinal);
        Assert.True(capture.HasSubscriptionKey);
        using var body = JsonDocument.Parse(capture.Body);
        Assert.Equal("https://hospitalblobdev01.blob.core.windows.net/session-audio/object-key", body.RootElement.GetProperty("contentUrls")[0].GetString());
        Assert.DoesNotContain("?", body.RootElement.GetProperty("contentUrls")[0].GetString());
        Assert.Equal("en-US", body.RootElement.GetProperty("locale").GetString());
        Assert.Equal("cr-" + _recording.ToString("N"), body.RootElement.GetProperty("displayName").GetString());
        Assert.Equal(AzureSpeechBatchTranscriptionProvider.MinimumTimeToLiveHours, body.RootElement.GetProperty("properties").GetProperty("timeToLiveHours").GetInt32());
        Assert.True(body.RootElement.GetProperty("properties").GetProperty("wordLevelTimestampsEnabled").GetBoolean());
        Assert.Equal("job-1", job.JobId);
        Assert.Equal("NotStarted", job.ProviderStatus);
    }

    [Fact]
    public async Task Submit_400_IsASubmissionFailure_WithSanitizedDetail()
    {
        var capture = new CaptureHandler(_ => JsonResponse(HttpStatusCode.BadRequest, """
            {"code":"InvalidRequest","message":"properties.timeToLiveHours must be greater than or equal to 6. See https://secret.example/path?sig=do-not-keep","innerError":{"code":"InvalidPayload","message":"ttl"}}
            """));
        var provider = Create(capture);

        var job = await provider.SubmitAsync(new TranscriptionSubmitRequest
        {
            RecordingId = _recording,
            PrivateContentUrl = "https://hospitalblobdev01.blob.core.windows.net/session-audio/object-key",
            Locale = "en-US",
        });

        Assert.Equal("Failed", job.ProviderStatus);
        Assert.Equal("ProviderRejected", job.ErrorCategory);
        Assert.Contains("InvalidRequest", job.ProviderDetail);
        Assert.Contains("[url]", job.ProviderDetail);
        Assert.DoesNotContain("sig=", job.ProviderDetail);
        Assert.Equal("", job.JobId);
    }

    [Fact]
    public async Task GetJob_Failed_KeepsTheAzureReason()
    {
        var capture = new CaptureHandler(_ => JsonResponse(HttpStatusCode.OK, """
            {"self":"https://centralindia.api.cognitive.microsoft.com/speechtotext/transcriptions/job-2","status":"Failed","properties":{"error":{"code":"InvalidUri","message":"The recordings could not be downloaded."}}}
            """));
        var provider = Create(capture);

        var job = await provider.GetJobAsync("job-2");

        Assert.Equal("Failed", job.ProviderStatus);
        Assert.Equal("ProviderRejected", job.ErrorCategory);
        Assert.Equal("InvalidUri: The recordings could not be downloaded.", job.ProviderDetail);
    }

    [Fact]
    public async Task DownloadResult_MapsCurrentBatchTranscript()
    {
        var capture = new CaptureHandler(request =>
        {
            if (request.RequestUri!.AbsolutePath.EndsWith("/files", StringComparison.Ordinal))
            {
                return JsonResponse(HttpStatusCode.OK, """
                    {"values":[{"kind":"Transcription","links":{"contentUrl":"https://speech.example/result.json"}}]}
                    """);
            }
            return JsonResponse(HttpStatusCode.OK, """
                {"recognizedPhrases":[{"offsetInTicks":10000000,"durationInTicks":20000000,"speaker":1,"nBest":[{"display":"Hello there","confidence":0.9}]}]}
                """);
        });
        var provider = Create(capture);

        var mapped = await provider.DownloadResultAsync("job-3", "en-US");

        Assert.Equal("Hello there", mapped.Text);
        Assert.Equal("en-US", mapped.LanguageCode);
        Assert.Single(mapped.Segments);
        Assert.Equal("speaker_1", mapped.Segments[0].Speaker);
        Assert.Equal(1d, mapped.Segments[0].Start);
    }

    [Fact]
    public void PrivateBlobUrl_HasNoQueryAndUsesSessionAudio()
    {
        var created = CounselingAudioBlobReference.TryCreatePrivateContentUrl(
            "hospitalblobdev01",
            "tenant/session/conversation/recording.webm",
            out var url);

        Assert.True(created);
        Assert.Equal("https://hospitalblobdev01.blob.core.windows.net/session-audio/tenant/session/conversation/recording.webm", url);
        Assert.DoesNotContain("?", url);
        Assert.False(CounselingAudioBlobReference.TryCreatePrivateContentUrl("hospitalblobdev01", "key?sig=abc", out _));
    }

    private static AzureSpeechBatchTranscriptionProvider Create(CaptureHandler handler)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["AzureSpeech:TrustedBlobAccess"] = "true",
            ["AzureSpeech:Key"] = "test-key",
            ["AzureSpeech:Endpoint"] = "https://centralindia.api.cognitive.microsoft.com/",
            ["AzureSpeech:StorageAccountName"] = "hospitalblobdev01",
        }).Build();
        return new AzureSpeechBatchTranscriptionProvider(
            new HttpClient(handler),
            configuration,
            NullLogger<AzureSpeechBatchTranscriptionProvider>.Instance);
    }

    private static HttpResponseMessage JsonResponse(HttpStatusCode status, string json) =>
        new(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") };

    private sealed class CaptureHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _reply;

        public CaptureHandler(Func<HttpRequestMessage, HttpResponseMessage> reply) => _reply = reply;

        public string Uri { get; private set; } = "";
        public string Body { get; private set; } = "";
        public HttpMethod? Method { get; private set; }
        public bool HasSubscriptionKey { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Method = request.Method;
            Uri = request.RequestUri?.ToString() ?? "";
            HasSubscriptionKey = request.Headers.Contains("Ocp-Apim-Subscription-Key");
            Body = request.Content == null ? "" : await request.Content.ReadAsStringAsync(cancellationToken);
            return _reply(request);
        }
    }
}
