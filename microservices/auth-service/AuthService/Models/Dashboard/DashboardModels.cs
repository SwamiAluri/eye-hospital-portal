namespace AuthService.Models.Dashboard;

public class OverviewStats
{
    public int TotalTenants { get; set; }
    public decimal TenantGrowth { get; set; }
    public int TotalUsers { get; set; }
    public int ActiveUsers { get; set; }
    public decimal UserGrowth { get; set; }
    public int TotalDepartments { get; set; }
    public decimal DepartmentGrowth { get; set; }
    public int TotalBranches { get; set; }
    public decimal BranchGrowth { get; set; }
    public string SystemHealth { get; set; } = "Excellent";
    public int Last24HoursActivity { get; set; }
}

public class QuickStats
{
    public UserGrowthStats UserGrowth { get; set; } = new();
    public DepartmentOperationsStats DepartmentOperations { get; set; } = new();
    public ComplianceStats ComplianceStatus { get; set; } = new();
    public SystemPerformanceStats SystemPerformance { get; set; } = new();
}

public class UserGrowthStats
{
    public int ThisMonth { get; set; }
    public int LastMonth { get; set; }
    public decimal PercentageChange { get; set; }
}

public class DepartmentOperationsStats
{
    public int ActiveDepartments { get; set; }
    public decimal UtilizationRate { get; set; }
}

public class ComplianceStats
{
    public decimal CompliancePercentage { get; set; }
    public string Status { get; set; } = "Compliant";
}

public class SystemPerformanceStats
{
    public int ResponseTimeMs { get; set; }
    public string Status { get; set; } = "Excellent";
}

public class RecentActivity
{
    public Guid Id { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public Guid? EntityId { get; set; }
}

public class Alert
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Severity { get; set; } = "info"; // info, warning, error
    public DateTime CreatedAt { get; set; }
    public bool IsRead { get; set; }
    public Guid TenantId { get; set; }
}

public class ActivitySeriesPoint
{
    public string Hour { get; set; } = string.Empty;
    public int Count { get; set; }
}
