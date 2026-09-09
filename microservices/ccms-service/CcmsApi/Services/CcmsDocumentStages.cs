namespace CcmsApi.Services;

/// <summary>
/// Canonical document stage/category values stored in <c>ccms_documents.document_category</c>.
/// Legacy consolidated migration 117 used <c>document_stage</c> with values like <c>pre_auth</c>.
/// </summary>
public static class CcmsDocumentStages
{
    public const string Preauth    = "preauth";
    public const string Claim      = "claim";
    public const string Settlement = "settlement";

    /// <summary>
    /// Normalizes caller input (multipart field, JSON body, legacy DB values) to a non-empty category.
    /// </summary>
    public static string Normalize(string? stage)
    {
        var raw = (stage ?? string.Empty).Trim().ToLowerInvariant();
        return raw switch
        {
            "" or "null" => Preauth,
            "pre_auth" or "pre-auth" or "preauthorization" or "authorization" or "general" => Preauth,
            "claims" => Claim,
            "settlements" => Settlement,
            _ => raw,
        };
    }
}
