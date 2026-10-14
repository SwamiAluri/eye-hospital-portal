namespace CcmsApi.Services;

/// <summary>
/// Patient 360 CCMS list window. Matches the coverage-case list defaults
/// and the auth-service follow-up cap: page size is capped, not rejected.
/// Newest-first primary order is unchanged. Id is the stable secondary key
/// when the timestamp ties.
/// </summary>
public static class CcmsPatientListPaging
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    public static (int Page, int PageSize) Normalize(int page, int pageSize)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = DefaultPageSize;
        if (pageSize > MaxPageSize) pageSize = MaxPageSize;
        return (page, pageSize);
    }
}
