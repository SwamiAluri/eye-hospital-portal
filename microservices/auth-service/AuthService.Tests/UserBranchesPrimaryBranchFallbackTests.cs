using System.Text.RegularExpressions;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Lab UAT: Users.BranchId fallback must not require exact Status == "Active"
/// (live branches often store "active"), or /user-branches/me stays empty and
/// the FE previously called GET /branches/{id} → 403 → unauthorized loop.
/// </summary>
public class UserBranchesPrimaryBranchFallbackTests
{
    [Fact]
    public void Primary_branch_fallback_matches_status_case_insensitively()
    {
        var root = FindRepoRoot();
        var path = Path.Combine(
            root,
            "microservices", "auth-service", "AuthService", "Controllers", "UserBranchesController.cs");
        var src = File.ReadAllText(path);

        Assert.Contains("primaryBranchId", src);
        Assert.Contains("OrdinalIgnoreCase", src);
        Assert.DoesNotContain(
            "b.Status == \"Active\"",
            src);
        Assert.True(
            Regex.IsMatch(src, @"Equals\(b\.Status,\s*""Active"",\s*StringComparison\.OrdinalIgnoreCase\)"),
            "Expected case-insensitive Active status match for primary branch fallback");
    }

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            if (Directory.Exists(Path.Combine(dir.FullName, "microservices")))
                return dir.FullName;
            dir = dir.Parent;
        }
        throw new InvalidOperationException("Repo root not found");
    }
}
