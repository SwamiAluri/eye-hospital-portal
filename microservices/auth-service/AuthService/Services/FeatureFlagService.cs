using AuthService.Services.Interfaces;
using Microsoft.Extensions.Configuration;
using System.Collections.Generic;
using System.Linq;

namespace AuthService.Services
{
    /// <summary>
    /// Reads FeatureFlags:MasterData from appsettings.json.
    /// 
    /// appsettings.json structure expected:
    /// {
    ///   "FeatureFlags": {
    ///     "MasterData": {
    ///       "Enabled": true,
    ///       "EnabledGroups": {
    ///         "PatientSetup": true,
    ///         "Clinical": true,
    ///         ...
    ///       }
    ///     }
    ///   }
    /// }
    /// </summary>
    public class FeatureFlagService : IFeatureFlagService
    {
        private readonly IConfiguration _config;

        public FeatureFlagService(IConfiguration config)
        {
            _config = config;
        }

        public bool IsMasterDataEnabled()
            => _config.GetValue<bool>("FeatureFlags:MasterData:Enabled", false);

        public bool IsMasterDataGroupEnabled(string groupKey)
        {
            if (!IsMasterDataEnabled()) return false;
            var flagKey = ResolveFlagGroupKey(groupKey);
            return _config.GetValue<bool>($"FeatureFlags:MasterData:EnabledGroups:{flagKey}", false);
        }

        /// <summary>Maps registry snake_case group_key to appsettings PascalCase flag keys.</summary>
        private static string ResolveFlagGroupKey(string groupKey) =>
            GroupKeyToFlagKey.TryGetValue(groupKey, out var flagKey) ? flagKey : groupKey;

        private static readonly Dictionary<string, string> GroupKeyToFlagKey =
            new(StringComparer.OrdinalIgnoreCase)
            {
                ["patient_setup"]   = "PatientSetup",
                ["clinical"]        = "Clinical",
                ["appointments"]    = "Appointments",
                ["counsellor"]      = "Counsellor",
                ["billing_finance"] = "BillingFinance",
                ["insurance"]       = "Insurance",
                ["inventory"]       = "Inventory",
                ["pharmacy"]        = "Pharmacy",
                ["lab_diagnostics"] = "LabDiagnostics",
                ["ward_ip"]         = "WardIp",
                ["hr_staff"]        = "HrStaff",
                ["system"]          = "System",
                ["operations"]      = "Operations",
            };

        public IReadOnlyList<string> GetEnabledMasterDataGroups()
        {
            if (!IsMasterDataEnabled()) return [];

            var section = _config.GetSection("FeatureFlags:MasterData:EnabledGroups");
            return section.GetChildren()
                .Where(c => c.Value == "true" || c.Value == "True")
                .Select(c => c.Key)
                .ToList();
        }
    }
}
