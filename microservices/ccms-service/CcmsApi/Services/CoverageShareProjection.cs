using CcmsApi.Models.Domain;

namespace CcmsApi.Services;

/// <summary>
/// Canonical payer vs patient amounts for IP/counselling projection.
/// Prefers billing summary when present; otherwise latest authorization requested vs approved.
/// </summary>
public static class CoverageShareProjection
{
    public static (decimal PayerShare, decimal PatientShare) From(
        CcmsCoverageCase? coverageCase,
        CcmsCoverageAuthorization? authorization,
        CcmsBillingSummary? billingSummary)
    {
        if (billingSummary is not null)
        {
            return (billingSummary.InsuranceShareAmount, billingSummary.PatientShareAmount);
        }

        var payer = authorization is not null && authorization.ApprovedAmount > 0
            ? authorization.ApprovedAmount
            : coverageCase?.ApprovedAmount ?? 0m;

        var requested = authorization?.RequestedAmount ?? 0m;
        var patient = requested > payer ? requested - payer : 0m;
        return (payer, patient);
    }
}
