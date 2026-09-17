using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Phase 2X-S3 — documents the exact UTF-8 mojibake sequence repaired in migration 194.
/// Guards against reintroducing frontend replace("â€”","—") hacks.
/// </summary>
public class ServiceVariantEmdashMojibakeContractTests
{
    /// <summary>UTF-8 bytes of corrupted "â€”" (double-encoded U+2014).</summary>
    private static readonly byte[] MojibakeEmdashUtf8 =
        { 0xC3, 0xA2, 0xE2, 0x82, 0xAC, 0xE2, 0x80, 0x9D };

    /// <summary>UTF-8 bytes of correct em dash U+2014.</summary>
    private static readonly byte[] CorrectEmdashUtf8 = { 0xE2, 0x80, 0x94 };

    [Fact]
    public void Mojibake_sequence_is_double_encoded_emdash_not_ascii_hyphen()
    {
        var bad = System.Text.Encoding.UTF8.GetString(MojibakeEmdashUtf8);
        var good = System.Text.Encoding.UTF8.GetString(CorrectEmdashUtf8);

        Assert.Equal(1, good.Length);
        Assert.Equal('\u2014', good[0]);
        Assert.NotEqual("-", bad);
        Assert.NotEqual(good, bad);
        Assert.Equal(3, bad.Length); // â € ”
    }

    [Fact]
    public void Migration_194_targets_exact_hex_not_frontend_replace()
    {
        var path = FindMigration("194_service_variants_emdash_mojibake_repair.sql");
        Assert.True(File.Exists(path), $"Missing migration at {path}");
        var sql = File.ReadAllText(path);
        Assert.Contains("c3a2e282ace2809d", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("service_variants", sql, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("replace(\"â€”\"", sql, StringComparison.Ordinal);
    }

    [Fact]
    public void Migration_193_assigns_Amelia_by_email_and_branch_code_not_app_hardcode()
    {
        var path = FindMigration("193_amelia_downtown_branch_assignment.sql");
        Assert.True(File.Exists(path), $"Missing migration at {path}");
        var sql = File.ReadAllText(path);
        Assert.Contains("counsellor4@hospital.com", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("DOWNTOWN_HOSP", sql, StringComparison.Ordinal);
        Assert.Contains("user_branches", sql, StringComparison.OrdinalIgnoreCase);
        // Must not be the only resolution path in application C# (data migration is OK).
        Assert.Contains("BranchId", sql, StringComparison.Ordinal);
    }

    private static string FindMigration(string fileName)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            var candidate = Path.Combine(dir.FullName, "consolidated", "migrations", fileName);
            if (File.Exists(candidate)) return candidate;
            candidate = Path.Combine(dir.FullName, "..", "..", "..", "..", "consolidated", "migrations", fileName);
            candidate = Path.GetFullPath(candidate);
            if (File.Exists(candidate)) return candidate;
            dir = dir.Parent;
        }

        return Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory, "..", "..", "..", "..", "consolidated", "migrations", fileName));
    }
}
