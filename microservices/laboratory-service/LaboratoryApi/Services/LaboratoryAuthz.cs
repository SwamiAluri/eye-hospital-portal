using Microsoft.Azure.Functions.Worker.Http;

namespace LaboratoryApi.Services;

/// <summary>
/// Permission gate for Laboratory / Enterprise LMS APIs.
/// Distinct from Pathology <c>laboratory.view</c> and from AuthService patient.* catalogue gates.
/// </summary>
public static class LaboratoryAuthz
{
    public const string LmsView = "lms.view";

    /// <summary>PD-CAT-01 — read catalogue configuration (L-CAT-01B).</summary>
    public const string CatalogueView = "lms.catalogue.view";

    /// <summary>PD-CAT-01 — draft create/update/submit/retire (not activation).</summary>
    public const string CatalogueManage = "lms.catalogue.manage";

    /// <summary>PD-CAT-04 — approve / activate lifecycle (capability; roles unresolved).</summary>
    public const string CatalogueApprove = "lms.catalogue.approve";

    /// <summary>PD-ORD-15 — read/search LMS orders.</summary>
    public const string OrdersView = "lms.orders.view";

    /// <summary>PD-ORD-15 — create drafts and submit; PD-ORD-16 orderables read.</summary>
    public const string OrdersCreate = "lms.orders.create";

    /// <summary>PD-ORD-15 — amend/cancel lifecycle.</summary>
    public const string OrdersManage = "lms.orders.manage";

    /// <summary>PD-COL-17 — read collection tasks / queue.</summary>
    public const string CollectionView = "lms.collection.view";

    /// <summary>PD-COL-17 — collection planning create/transition/assign.</summary>
    public const string CollectionManage = "lms.collection.manage";

    /// <summary>PD-COL-17 — claim / collect transitions.</summary>
    public const string CollectionCollect = "lms.collection.collect";

    /// <summary>PD-COL-SPC-16 — read Specimen records (L-COL-01C).</summary>
    public const string SpecimensView = "lms.specimens.view";

    /// <summary>PD-COL-SPC-16 — Specimen-domain mutations (Complete Collection with collect).</summary>
    public const string SpecimensManage = "lms.specimens.manage";

    /// <summary>PD-COL-SPC-16 — Receiving.</summary>
    public const string SpecimensReceive = "lms.specimens.receive";

    /// <summary>L-COL-01E — view specimen barcode.</summary>
    public const string SpecimensBarcodeView = "lms.specimens.barcode.view";

    /// <summary>L-COL-01E — generate barcode / print label.</summary>
    public const string SpecimensLabelPrint = "lms.specimens.label.print";

    /// <summary>L-COL-01E — reprint label (same barcode).</summary>
    public const string SpecimensLabelReprint = "lms.specimens.label.reprint";

    /// <summary>L-TST-01A — view Testing work queue / drafts.</summary>
    public const string TestingView = "lms.testing.view";

    /// <summary>L-TST-01A — manage Testing work queue context.</summary>
    public const string TestingManage = "lms.testing.manage";

    /// <summary>L-TST-01A — create/update Result Drafts.</summary>
    public const string TestingResult = "lms.testing.result";

    /// <summary>L-VER-01 — Technical Verification (catalog only; no role grants).</summary>
    public const string TestingVerify = "lms.testing.verify";

    /// <summary>L-AUTH-01 — Clinical Authorization (catalog only; no role grants).</summary>
    public const string ResultsAuthorize = "lms.results.authorize";

    /// <summary>L-CRT-01 — view Critical Results queue/detail (catalog only; no role grants).</summary>
    public const string ResultsCriticalView = "lms.results.critical.view";

    /// <summary>L-CRT-01 — manual Critical classification (catalog only; no role grants).</summary>
    public const string ResultsCriticalManage = "lms.results.critical.manage";

    /// <summary>L-CRT-01 — acknowledge Critical event (catalog only; no role grants).</summary>
    public const string ResultsCriticalAcknowledge = "lms.results.critical.acknowledge";

    /// <summary>L-REP-01 — view LMS Reports (catalog only; no role grants).</summary>
    public const string ReportsView = "lms.reports.view";

    /// <summary>L-REP-01 — create/manage Draft LMS Reports (catalog only; no role grants).</summary>
    public const string ReportsManage = "lms.reports.manage";

    /// <summary>L-REP-02A — Finalize Draft Report (metadata). No role grants by design.</summary>
    public const string ReportsFinalize = "lms.reports.finalize";

    /// <summary>L-REP-02B — Release Final Report (metadata). No role grants by design.</summary>
    public const string ReportsRelease = "lms.reports.release";

    /// <summary>L-REP-03 CUT C — staff download of current Official PDF (no role grants).</summary>
    public const string ReportsDownload = "lms.reports.download";

    /// <summary>L-REP-03 CUT A — assign immutable business Report Number (post-Release).</summary>
    public const string ReportsAssignNumber = "lms.reports.assign_number";

    /// <summary>L-REP-03 CUT B — generate Official PDF (catalogue only; no role grants).</summary>
    public const string ReportsGenerate = "lms.reports.generate";

    /// <summary>Pathology gate — never accepted as LMS catalogue or order authority.</summary>
    public const string LegacyLaboratoryView = "laboratory.view";

    public static bool HasAny(JwtClaims claims, params string[] required)
    {
        var perms = claims.SafePermissions;
        if (perms.Contains("*")) return true;
        if (perms.Length == 0) return false;
        return required.Any(r => perms.Contains(r));
    }

    public static bool HasAll(JwtClaims claims, params string[] required)
    {
        var perms = claims.SafePermissions;
        if (perms.Contains("*")) return true;
        if (perms.Length == 0 || required.Length == 0) return false;
        return required.All(r => perms.Contains(r));
    }

    public static async Task<HttpResponseData?> ForbidUnlessAsync(
        HttpRequestData req, JwtClaims claims, params string[] required)
    {
        if (HasAny(claims, required)) return null;
        // Missing permission is Forbidden (403), not Unauthorized (401).
        return await req.ForbiddenAsync(
            $"Missing permission. Required one of: {string.Join(", ", required)}");
    }

    /// <summary>AND-gate — all listed permissions required (L-COL-01C Complete Collection).</summary>
    public static async Task<HttpResponseData?> ForbidUnlessAllAsync(
        HttpRequestData req, JwtClaims claims, params string[] required)
    {
        if (HasAll(claims, required)) return null;
        return await req.ForbiddenAsync(
            $"Missing permission. Required all of: {string.Join(", ", required)}");
    }
}
