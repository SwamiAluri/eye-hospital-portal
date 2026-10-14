using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AuthService.Services;

/// <summary>
/// L2 UAT/Development: idempotent bootstrap of LaboratoryTestDefinition from legitimate
/// LabTestCatalog rows (test_type=Lab only). Does not invent clinical data. Does not
/// invent panels/analytes. Does not promote Imaging/Scan or non-LIS cardiac procedures.
/// Runtime Laboratory search continues to use LaboratoryTestDefinition only.
/// </summary>
public static class LaboratoryClinicalCatalogBootstrap
{
    public sealed class BootstrapReport
    {
        public int SourceTotal { get; set; }
        public int Eligible { get; set; }
        public int Imported { get; set; }
        public int AlreadyExisting { get; set; }
        public int Excluded { get; set; }
        public List<string> ExclusionReasons { get; set; } = new();
        public int WithSpecimen { get; set; }
        public int WithoutSpecimen { get; set; }
        public bool CbcFound { get; set; }
        public List<string> CbcCodes { get; set; } = new();
    }

    /// <summary>Non-LIS rows that appear under test_type=Lab in the Counsellor catalog.</summary>
    private static readonly HashSet<string> ExcludedLocalCodes = new(StringComparer.OrdinalIgnoreCase)
    {
        "ECG", "ECG001", "ECHO001", "2D_ECHO", "BP",
    };

    private static readonly HashSet<string> ExcludedCategories = new(StringComparer.OrdinalIgnoreCase)
    {
        "Cardiac", "Cardiac Investigations",
    };

    public static async Task<BootstrapReport> EnsureFromLabTestCatalogAsync(
        AppDbContext context,
        Guid tenantId,
        IHostEnvironment env,
        ILogger? logger = null,
        CancellationToken cancellationToken = default)
    {
        var report = new BootstrapReport();
        if (!env.IsDevelopment() && !env.IsEnvironment("UAT") && !env.IsEnvironment("Testing"))
        {
            logger?.LogInformation("Laboratory clinical catalog bootstrap skipped outside Development/UAT/Testing.");
            return report;
        }

        // Project only columns that exist on public.lab_test_catalog (no description / is_pre_operative).
        var sources = await context.LabTestCatalog
            .AsNoTracking()
            .Where(c => c.DeletedAt == null && c.IsActive)
            .Select(c => new LabTestCatalogBootstrapRow
            {
                Id = c.Id,
                TenantId = c.TenantId,
                TestName = c.TestName,
                TestCode = c.TestCode,
                Category = c.Category,
                TestType = c.TestType,
                SampleType = c.SampleType,
                TurnaroundHours = c.TurnaroundHours,
            })
            .ToListAsync(cancellationToken);

        report.SourceTotal = sources.Count;

        var existingCodes = await context.LaboratoryTestDefinitions
            .Where(d => d.TenantId == tenantId)
            .Select(d => d.LocalCode)
            .ToListAsync(cancellationToken);
        var existingSet = new HashSet<string>(existingCodes, StringComparer.OrdinalIgnoreCase);

        var exclusionBuckets = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        void Exclude(string reason)
        {
            report.Excluded++;
            exclusionBuckets.TryGetValue(reason, out var n);
            exclusionBuckets[reason] = n + 1;
        }

        var toImport = new List<LabTestCatalogBootstrapRow>();
        foreach (var src in sources)
        {
            var type = (src.TestType ?? "").Trim();
            if (!string.Equals(type, "Lab", StringComparison.OrdinalIgnoreCase))
            {
                Exclude($"non-Lab test_type={type}");
                continue;
            }

            if (string.IsNullOrWhiteSpace(src.TestCode))
            {
                Exclude("missing local code");
                continue;
            }

            if (ExcludedLocalCodes.Contains(src.TestCode.Trim()))
            {
                Exclude($"non-LIS local code={src.TestCode}");
                continue;
            }

            if (!string.IsNullOrWhiteSpace(src.Category) && ExcludedCategories.Contains(src.Category.Trim()))
            {
                Exclude($"non-LIS category={src.Category}");
                continue;
            }

            var specimen = (src.SampleType ?? "").Trim();
            if (string.Equals(specimen, "N/A", StringComparison.OrdinalIgnoreCase))
            {
                Exclude("specimen N/A (non-LIS procedure)");
                continue;
            }

            if (src.TestName.Contains("Blood Pressure", StringComparison.OrdinalIgnoreCase) ||
                src.TestName.Contains("Echo", StringComparison.OrdinalIgnoreCase) ||
                src.TestName.Contains("Electrocardiogram", StringComparison.OrdinalIgnoreCase))
            {
                Exclude($"non-LIS name={src.TestName}");
                continue;
            }

            // Tenant-scoped: null-tenant legacy rows bootstrap into the UAT/dev tenant.
            if (src.TenantId.HasValue && src.TenantId.Value != tenantId)
            {
                Exclude("other-tenant row");
                continue;
            }

            report.Eligible++;
            if (existingSet.Contains(src.TestCode.Trim()))
            {
                report.AlreadyExisting++;
                continue;
            }

            toImport.Add(src);
        }

        foreach (var src in toImport)
        {
            var code = src.TestCode!.Trim();
            var entity = new LaboratoryTestDefinition
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = src.TestName.Trim(),
                LocalCode = code,
                Description = null, // not present on live lab_test_catalog schema
                Category = string.IsNullOrWhiteSpace(src.Category) ? null : src.Category.Trim(),
                TurnaroundHours = src.TurnaroundHours,
                ServiceVariantId = null,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };

            var specimen = (src.SampleType ?? "").Trim();
            if (!string.IsNullOrEmpty(specimen))
            {
                entity.SpecimenOptions.Add(new LaboratoryTestSpecimenOption
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    TestDefinitionId = entity.Id,
                    SpecimenType = specimen,
                    IsDefault = true,
                    DisplayOrder = 0,
                });
                report.WithSpecimen++;
            }
            else
            {
                report.WithoutSpecimen++;
            }

            context.LaboratoryTestDefinitions.Add(entity);
            existingSet.Add(code);
            report.Imported++;
        }

        if (report.Imported > 0)
            await context.SaveChangesAsync(cancellationToken);

        report.ExclusionReasons = exclusionBuckets
            .OrderByDescending(kv => kv.Value)
            .Select(kv => $"{kv.Key}: {kv.Value}")
            .ToList();

        var cbcRows = await context.LaboratoryTestDefinitions
            .AsNoTracking()
            .Where(d => d.TenantId == tenantId && d.IsActive &&
                        (d.LocalCode.ToLower().Contains("cbc") || d.Name.ToLower().Contains("cbc")))
            .Select(d => d.LocalCode)
            .ToListAsync(cancellationToken);
        report.CbcFound = cbcRows.Count > 0;
        report.CbcCodes = cbcRows;

        logger?.LogInformation(
            "Laboratory clinical catalog bootstrap tenant={TenantId}: source={Source} eligible={Eligible} imported={Imported} existing={Existing} excluded={Excluded} cbc={Cbc}",
            tenantId, report.SourceTotal, report.Eligible, report.Imported, report.AlreadyExisting, report.Excluded, report.CbcFound);

        return report;
    }

    private sealed class LabTestCatalogBootstrapRow
    {
        public Guid Id { get; set; }
        public Guid? TenantId { get; set; }
        public string TestName { get; set; } = string.Empty;
        public string? TestCode { get; set; }
        public string? Category { get; set; }
        public string TestType { get; set; } = "Lab";
        public string? SampleType { get; set; }
        public int? TurnaroundHours { get; set; }
    }
}
