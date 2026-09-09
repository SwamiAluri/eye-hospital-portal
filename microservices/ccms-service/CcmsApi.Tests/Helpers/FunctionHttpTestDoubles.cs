using System.Collections.Specialized;
using System.Net;
using System.Security.Claims;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Moq;

namespace CcmsApi.Tests.Helpers;

/// <summary>Minimal HttpRequestData/HttpResponseData doubles for DocumentFunctions HTTP tests.</summary>
public static class FunctionHttpTestDoubles
{
    public static FunctionContext CreateContext()
    {
        var mock = new Mock<FunctionContext>();
        mock.Setup(c => c.InstanceServices).Returns(new TestServiceProvider());
        return mock.Object;
    }

    public static TestHttpRequestData CreateGetRequest(
        FunctionContext context,
        string url,
        IReadOnlyDictionary<string, string>? headers = null)
    {
        var uri = new Uri(url);
        var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
        return new TestHttpRequestData(context, "GET", uri, query, headers);
    }

    public sealed class TestHttpRequestData : HttpRequestData
    {
        private readonly MemoryStream _body = new();
        private readonly NameValueCollection _query;

        public TestHttpRequestData(
            FunctionContext functionContext,
            string method,
            Uri url,
            NameValueCollection query,
            IReadOnlyDictionary<string, string>? headers)
            : base(functionContext)
        {
            Method = method;
            Url = url;
            _query = query;
            Headers = new HttpHeadersCollection();
            if (headers is not null)
            {
                foreach (var (key, value) in headers)
                    Headers.Add(key, value);
            }
        }

        public override Stream Body => _body;
        public override HttpHeadersCollection Headers { get; }
        public override IReadOnlyCollection<IHttpCookie> Cookies { get; } = Array.Empty<IHttpCookie>();
        public override Uri Url { get; }
        public override IEnumerable<ClaimsIdentity> Identities { get; } = Array.Empty<ClaimsIdentity>();
        public override string Method { get; }

        public override NameValueCollection Query => _query;

        public override HttpResponseData CreateResponse() =>
            new TestHttpResponseData(FunctionContext);
    }

    public sealed class TestHttpResponseData : HttpResponseData
    {
        private HttpHeadersCollection _headers = new();
        private Stream _body = new MemoryStream();
        private readonly Mock<HttpCookies> _cookies = new();

        public TestHttpResponseData(FunctionContext functionContext) : base(functionContext) { }

        public override HttpStatusCode StatusCode { get; set; }
        public override HttpHeadersCollection Headers
        {
            get => _headers;
            set => _headers = value;
        }
        public override Stream Body
        {
            get => _body;
            set => _body = value;
        }
        public override HttpCookies Cookies => _cookies.Object;
    }

    private sealed class TestServiceProvider : IServiceProvider
    {
        public object? GetService(Type serviceType) => null;
    }
}
