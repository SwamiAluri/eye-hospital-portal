using System.Text;
using System.Text.Json;
using IpManagementService.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace IpManagementService.Tests;

/// <summary>
/// DB-005. Compares <see cref="IpManagementDbContext"/> store columns to
/// <c>consolidated/schema/ip-ef-baseline.json</c> (frozen at this task) plus
/// numbered SQL in <c>consolidated/migrations</c>. A new EF column without a
/// migration fails CI.
/// </summary>
internal static class SchemaDrift
{
    internal sealed record StoreColumn(string Table, string Column)
    {
        public string Key => $"{Table}.{Column}";
    }

    public static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            if (Directory.Exists(Path.Combine(dir.FullName, "consolidated", "migrations")))
                return dir.FullName;
            dir = dir.Parent;
        }

        throw new DirectoryNotFoundException("Could not find consolidated/migrations from " + AppContext.BaseDirectory);
    }

    public static List<StoreColumn> ListOwnedStoreColumns(DbContext db)
    {
        var rows = new List<StoreColumn>();
        foreach (var entity in db.Model.GetEntityTypes())
        {
            var table = entity.GetTableName();
            if (string.IsNullOrEmpty(table))
                continue;
            var store = StoreObjectIdentifier.Table(table, entity.GetSchema());
            foreach (var prop in entity.GetProperties())
            {
                var col = prop.GetColumnName(store);
                if (!string.IsNullOrEmpty(col))
                    rows.Add(new StoreColumn(table, col));
            }
        }

        return rows
            .DistinctBy(r => r.Key)
            .OrderBy(r => r.Key, StringComparer.Ordinal)
            .ToList();
    }

    public static HashSet<string> ReadBaselineKeys(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var keys = new HashSet<string>(StringComparer.Ordinal);
        foreach (var table in doc.RootElement.GetProperty("tables").EnumerateArray())
        {
            var name = table.GetProperty("name").GetString() ?? "";
            foreach (var col in table.GetProperty("columns").EnumerateArray())
            {
                var c = col.GetString();
                if (!string.IsNullOrEmpty(c))
                    keys.Add($"{name}.{c}");
            }
        }

        return keys;
    }

    public static string ToBaselineJson(IEnumerable<StoreColumn> columns)
    {
        var grouped = columns
            .GroupBy(c => c.Table, StringComparer.Ordinal)
            .OrderBy(g => g.Key, StringComparer.Ordinal)
            .Select(g => new
            {
                name = g.Key,
                columns = g.Select(x => x.Column).Distinct(StringComparer.Ordinal).OrderBy(x => x, StringComparer.Ordinal).ToArray(),
            });
        return JsonSerializer.Serialize(
            new { frozenAt = "DB-005", tables = grouped },
            new JsonSerializerOptions { WriteIndented = true });
    }

    public static string ConcatNumberedSql(string repoRoot)
    {
        var dir = Path.Combine(repoRoot, "consolidated", "migrations");
        var sb = new StringBuilder();
        foreach (var file in Directory.GetFiles(dir, "*.sql"))
        {
            var name = Path.GetFileName(file);
            if (name.StartsWith('_'))
                continue;
            sb.AppendLine(File.ReadAllText(file));
        }

        return sb.ToString();
    }

    /// <summary>
    /// Columns in <paramref name="ef"/> that are neither in the frozen baseline
    /// nor mentioned (table + column identifiers) in numbered SQL.
    /// </summary>
    public static List<string> Uncovered(
        IEnumerable<StoreColumn> ef,
        IReadOnlySet<string> baseline,
        string numberedSql)
    {
        var sql = numberedSql;
        var missing = new List<string>();
        foreach (var col in ef)
        {
            if (baseline.Contains(col.Key))
                continue;
            if (sql.Contains(col.Table, StringComparison.OrdinalIgnoreCase)
                && sql.Contains(col.Column, StringComparison.OrdinalIgnoreCase))
                continue;
            missing.Add(col.Key);
        }

        return missing;
    }
}
