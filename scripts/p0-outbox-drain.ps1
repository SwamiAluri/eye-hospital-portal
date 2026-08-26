# P0-3 — Drain IP integration outbox (pending → processed).
# Restart IP/outbox processor after DDL, then run this.
# Usage: powershell -File scripts/p0-outbox-drain.ps1

$ErrorActionPreference = 'Stop'
$IpBase = if ($env:E2E_IP_URL) { $env:E2E_IP_URL.TrimEnd('/') } else { 'http://localhost:5074/api' }

Write-Host '=== P0 outbox drain ===' -ForegroundColor Cyan
try {
    $r = Invoke-RestMethod -Uri "$IpBase/ip-management/integration/outbox/process" -Method POST -TimeoutSec 60
    $n = 0
    if ($null -ne $r.processed) { $n = [int]$r.processed }
    elseif ($null -ne $r.Processed) { $n = [int]$r.Processed }
    Write-Host "[PASS] ProcessIntegrationOutboxNow - processed=$n"
    exit 0
} catch {
    Write-Host "[FAIL] ProcessIntegrationOutboxNow - $($_.Exception.Message)"
    Write-Host 'Restart IpManagementService after applying integration_outbox_event DDL, then re-run.'
    exit 1
}
