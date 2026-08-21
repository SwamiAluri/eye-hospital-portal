# Phase 5 staging smoke — HTTP checks when local stack is up.
# Usage (from repo root):
#   powershell -File scripts/staging-smoke-phase5.ps1
#
# Ports: Auth 5073, IP 5074, CCMS 7075 (see START_ALL.ps1)

$ErrorActionPreference = 'Continue'
$results = @()

function Add-Result($name, $ok, $detail) {
    $script:results += [pscustomobject]@{ Check = $name; Pass = [bool]$ok; Detail = $detail }
    $icon = if ($ok) { 'PASS' } else { 'FAIL' }
    Write-Host ("[{0}] {1} - {2}" -f $icon, $name, $detail)
}

function Test-Port($port) {
    try {
        $c = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        return $null -ne $c
    } catch { return $false }
}

Write-Host '=== Phase 5 staging smoke ===' -ForegroundColor Cyan

$ipUp = Test-Port 5074
$ccmsUp = Test-Port 7075
$authUp = Test-Port 5073
Add-Result 'IP :5074 listening' $ipUp $(if ($ipUp) { 'up' } else { 'down — start START_ALL.ps1' })
Add-Result 'CCMS :7075 listening' $ccmsUp $(if ($ccmsUp) { 'up' } else { 'down — start START_ALL.ps1' })
Add-Result 'Auth :5073 listening' $authUp $(if ($authUp) { 'up' } else { 'down — start START_ALL.ps1' })

# Automated policy/outbox/enhancement smoke (always runnable without HTTP)
Write-Host "`n=== Automated scenario harness (dotnet/vitest) ===" -ForegroundColor Cyan
Push-Location (Join-Path $PSScriptRoot '..\microservices\ip-management-service\IpManagementService.Tests')
dotnet test --filter "FullyQualifiedName~CcmsAdmissionClientUnavailableTests|FullyQualifiedName~IntegrationOutboxServiceTests|FullyQualifiedName~AdmissionCoverage" -v q
$ipExit = $LASTEXITCODE
Pop-Location
Add-Result 'Cash/CCMS-down + outbox unit smoke' ($ipExit -eq 0) "dotnet exit $ipExit"

Push-Location (Join-Path $PSScriptRoot '..\microservices\ccms-service\CcmsApi.Tests')
dotnet test --filter "FullyQualifiedName~AdmissionCoverageDecisionPolicyTests|FullyQualifiedName~IntegrationIdempotencyGuardTests|FullyQualifiedName~EnhancementServiceTests" -v q
$ccmsExit = $LASTEXITCODE
Pop-Location
Add-Result 'Pending/Approved + idempotency + enhancement unit smoke' ($ccmsExit -eq 0) "dotnet exit $ccmsExit"

if ($ccmsUp) {
    try {
        $r = Invoke-WebRequest -Uri 'http://localhost:7075/api/health' -UseBasicParsing -TimeoutSec 5
        Add-Result 'CCMS health' ($r.StatusCode -lt 500) "status $($r.StatusCode)"
    } catch {
        # Many Function apps have no /health — treat connect as soft check
        try {
            Invoke-WebRequest -Uri 'http://localhost:7075/api/ccms/enhancements?take=1' -UseBasicParsing -TimeoutSec 5 | Out-Null
            Add-Result 'CCMS enhancements endpoint reachable' $false 'reachable but likely 401 without JWT (expected)'
        } catch {
            $msg = $_.Exception.Message
            $ok = $msg -match '401|403|Unauthorized'
            Add-Result 'CCMS enhancements endpoint' $ok $msg
        }
    }
}

# Live integration smoke when CCMS is up (internal key)
if ($ccmsUp) {
    $key = 'hp-internal-svc-key-change-in-production-2026'
    $tenant = '155fe198-6ae5-4a01-9254-ead5b427247e'
    $hdr = @{ 'X-Internal-Key' = $key; 'X-Tenant-ID' = $tenant }
    try {
        $pending = Invoke-RestMethod -Uri "http://localhost:7075/api/ccms/integration/validate-admission?sessionId=bb000001-2222-2222-2222-000000000007&tenantId=$tenant&journeyId=00000000-0000-0000-0000-000000000099" -Headers $hdr -TimeoutSec 20
        Add-Result 'Live pending BLOCK' (($pending.decision -eq 'BLOCK') -and (-not $pending.allowed)) ("state=$($pending.coverageState)")
    } catch {
        Add-Result 'Live pending BLOCK' $false $_.Exception.Message
    }
    try {
        $payload = '{"journeyId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa9","sessionId":"bb000001-2222-2222-2222-000000000006","actorUserId":"00000000-0000-0000-0000-000000000001"}'
        $h2 = @{ 'X-Internal-Key' = $key; 'X-Tenant-ID' = $tenant; 'X-Idempotency-Key' = ("JourneyAdmitted:smoke-{0}" -f [guid]::NewGuid().ToString('N')); 'Content-Type' = 'application/json' }
        $r1 = Invoke-WebRequest -Uri 'http://localhost:7075/api/ccms/integration/journey-admitted' -Method POST -Headers $h2 -Body $payload -TimeoutSec 30 -UseBasicParsing
        $r2 = Invoke-WebRequest -Uri 'http://localhost:7075/api/ccms/integration/journey-admitted' -Method POST -Headers $h2 -Body $payload -TimeoutSec 30 -UseBasicParsing
        Add-Result 'Live JourneyAdmitted replay' (($r1.StatusCode -eq 200) -and ($r2.StatusCode -eq 200)) ("$($r1.StatusCode)/$($r2.StatusCode)")
    } catch {
        Add-Result 'Live JourneyAdmitted replay' $false $_.Exception.Message
    }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
$results | Format-Table -AutoSize
$failed = @($results | Where-Object { -not $_.Pass }).Count
if ($failed -gt 0) { exit 1 } else { exit 0 }

