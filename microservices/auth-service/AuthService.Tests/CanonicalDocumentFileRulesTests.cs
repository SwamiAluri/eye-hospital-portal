using AuthService.Services;
using Xunit;

namespace AuthService.Tests;

public class CanonicalDocumentFileRulesTests
{
    [Fact]
    public void Sanitize_strips_path_and_traversal()
    {
        Assert.Equal("safe.pdf", CanonicalDocumentFileRules.SanitizeDisplayName("../ok/../safe.pdf"));
        Assert.Equal("safe.pdf", CanonicalDocumentFileRules.SanitizeDisplayName("..\\safe.pdf"));
        Assert.Equal("document", CanonicalDocumentFileRules.SanitizeDisplayName("///"));
    }

    [Fact]
    public void NormalizeClassification_defaults_to_general()
    {
        Assert.Equal("general", CanonicalDocumentFileRules.NormalizeClassification(null));
        Assert.Equal("general", CanonicalDocumentFileRules.NormalizeClassification("  "));
        Assert.Equal("referral", CanonicalDocumentFileRules.NormalizeClassification(" referral "));
    }

    [Theory]
    [InlineData(new byte[] { 0x25, 0x50, 0x44, 0x46, 0x2D }, "a.pdf", "application/pdf", "application/pdf")]
    [InlineData(new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 }, "a.jpg", "image/jpeg", "image/jpeg")]
    [InlineData(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }, "a.png", "image/png", "image/png")]
    public void Detects_allowed_types(byte[] header, string name, string client, string expected)
    {
        Assert.True(CanonicalDocumentFileRules.TryDetectMime(header, name, client, out var mime, out _));
        Assert.Equal(expected, mime);
    }

    [Theory]
    [InlineData(new byte[] { 0xD0, 0xCF, 0x11, 0xE0 }, "a.doc", "application/msword")]
    [InlineData(new byte[] { 0x50, 0x4B, 0x03, 0x04 }, "a.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")]
    [InlineData(new byte[] { 0x47, 0x49, 0x46, 0x38 }, "a.gif", "image/gif")]
    [InlineData(new byte[] { 0x00, 0x00, 0x00, 0x00 }, "a.dcm", "application/dicom")]
    public void Rejects_disallowed_types(byte[] header, string name, string client)
    {
        Assert.False(CanonicalDocumentFileRules.TryDetectMime(header, name, client, out _, out var error));
        Assert.Equal("File type is not allowed.", error);
    }

    [Fact]
    public void Rejects_pdf_magic_with_doc_extension()
    {
        Assert.False(CanonicalDocumentFileRules.TryDetectMime(
            new byte[] { 0x25, 0x50, 0x44, 0x46 }, "a.doc", "application/pdf", out _, out _));
    }

    [Theory]
    [InlineData(new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 }, "lab-report.jpg", "application/octet-stream", "image/jpeg")]
    [InlineData(new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 }, "lab-report.jpg", null, "image/jpeg")]
    [InlineData(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }, "lab.png", "binary/octet-stream", "image/png")]
    public void Accepts_magic_when_client_mime_is_generic(
        byte[] header, string name, string? client, string expected)
    {
        Assert.True(CanonicalDocumentFileRules.TryDetectMime(header, name, client, out var mime, out _));
        Assert.Equal(expected, mime);
    }

    [Fact]
    public void Rejects_when_allowed_client_mime_conflicts_with_magic()
    {
        Assert.False(CanonicalDocumentFileRules.TryDetectMime(
            new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 },
            "a.jpg",
            "application/pdf",
            out _,
            out var error));
        Assert.Equal("File type is not allowed.", error);
    }
}
