using Microsoft.EntityFrameworkCore;

namespace CcmsApi.Services;

public static class DatabaseExceptionFormatter
{
    /// <summary>Prefer the database provider message over EF's generic DbUpdateException text.</summary>
    public static string ToClientMessage(Exception ex)
    {
        var root = ex;
        while (root.InnerException is not null)
            root = root.InnerException;

        if (ex is DbUpdateException && root != ex && !string.IsNullOrWhiteSpace(root.Message))
            return root.Message;

        return ex.Message;
    }
}
