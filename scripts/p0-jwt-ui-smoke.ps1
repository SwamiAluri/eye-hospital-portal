# P0 — JWT UI smoke: login + enhancement path + Emergency FC permission probe.
# Requires Auth :5073 and CCMS :7075 (IP :5074 for Emergency FC).
# Usage: powershell -File scripts/p0-jwt-ui-smoke.ps1

$ErrorActionPreference = 'Stop'
$AuthBase = if ($env:E2E_API_URL) { $env:E2E_API_URL.TrimEnd('/') } else { 'http://localhost:5073/api' }
$CcmsBase = if ($env:E2E_CCMS_URL) { $env:E2E_CCMS_URL.TrimEnd('/') } else { 'http://localhost:7075/api' }
$IpBase = if ($env:E2E_IP_URL) { $env:E2E_IP_URL.TrimEnd('/') } else { 'http://localhost:5074/api' }
$TenantId = if ($env:E2E_TEST_TENANT_ID) { $env:E2E_TEST_TENANT_ID } else { '155fe198-6ae5-4a01-9254-ead5b427247e' }
$Email = if ($env:E2E_TEST_EMAIL) { $env:E2E_TEST_EMAIL } else { 'admin@test.com' }
$Password = if ($env:E2E_TEST_PASSWORD) { $env:E2E_TEST_PASSWORD } else { 'Admin123!' }

$results = @()
function Add-Result($name, $ok, $detail) {
    $script:results += [pscustomobject]@{ Check = $name; Pass = [bool]$ok; Detail = $detail }
    Write-Host ("[{0}] {1} - {2}" -f ($(if ($ok) { 'PASS' } else { 'FAIL' }), $name, $detail))
}

Write-Host '=== P0 JWT UI smoke ===' -ForegroundColor Cyan

try {
    $loginBody = @{ email = $Email; password = $Password; tenantId = $TenantId } | ConvertTo-Json
    $login = Invoke-RestMethod -Uri "$AuthBase/auth/login" -Method POST -ContentType 'application/json' -Body $loginBody -TimeoutSec 30
    $token = $login.accessToken
    if (-not $token) { throw 'No accessToken' }
    Add-Result 'Auth login' $true ("user=$Email")
} catch {
    Add-Result 'Auth login' $false $_.Exception.Message
    $results | Format-Table -AutoSize
    exit 1
}

$perms = @()
if ($login.permissions) { $perms = @($login.permissions | ForEach-Object { "$_" }) }
$isWildcard = $perms -contains '*'
$hasEnh = $isWildcard -or ($perms -contains 'ccms.enhancement.write') -or ($perms -contains 'ccms.enhancement.create') -or ($perms -contains 'ccms.preauth.process') -or ($perms -contains 'ccms.workflow.admin')
$hasFc = $isWildcard -or ($perms -contains 'ip.emergency_fc.apply') -or ($perms -contains 'ward.checklist.edit')
Add-Result 'JWT has enhancement permission' $hasEnh ("wildcard=$isWildcard; perms=$($perms -join ',')")
Add-Result 'JWT has Emergency FC permission' $hasFc ("wildcard=$isWildcard")

$hdr = @{
    Authorization = "Bearer $token"
    'X-Tenant-ID' = $TenantId
    'Content-Type' = 'application/json'
}

try {
    $list = Invoke-RestMethod -Uri "$CcmsBase/ccms/enhancements?status=all&take=5" -Headers $hdr -TimeoutSec 30
    Add-Result 'GET /ccms/enhancements' $true ("rows=$((@($list)).Count)")
} catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    Add-Result 'GET /ccms/enhancements' $false ("status=$code $($_.Exception.Message)")
}

$caseId = 'ca000011-0000-4000-8000-000000000000'
try {
    $case = Invoke-RestMethod -Uri "$CcmsBase/ccms/coverage-cases/$caseId" -Headers $hdr -TimeoutSec 30
    $st = if ($case.currentState) { $case.currentState } else { $case.CurrentState }
    Add-Result 'Load APPROVED fixture case' ($null -ne $case) ("state=$st")
} catch {
    $caseId = $null
    Add-Result 'Load APPROVED fixture case' $false $_.Exception.Message
}

if ($caseId -and $hasEnh) {
    try {
        $createBody = @{ enhancementType = 'amount'; requestedAmount = 100; reason = 'P0 JWT smoke'; source = 'p0_smoke' } | ConvertTo-Json
        $created = Invoke-RestMethod -Uri "$CcmsBase/ccms/coverage-cases/$caseId/enhancements" -Method POST -Headers $hdr -Body $createBody -TimeoutSec 30
        $enhId = if ($created.id) { $created.id } else { $created.Id }
        Add-Result 'Create enhancement draft' ($null -ne $enhId) ("id=$enhId")

        $submitBody = @{ tpaReferenceNumber = 'P0-SMOKE'; notes = 'jwt smoke' } | ConvertTo-Json
        $submitted = Invoke-RestMethod -Uri "$CcmsBase/ccms/enhancements/$enhId/submit" -Method POST -Headers $hdr -Body $submitBody -TimeoutSec 30
        $sst = if ($submitted.status) { $submitted.status } else { $submitted.Status }
        Add-Result 'Submit enhancement to TPA' ($sst -eq 'submitted') ("status=$sst")

        $decideBody = @{ approved = $true; approvedAmount = 100; tpaReferenceNumber = 'P0-SMOKE-OUT' } | ConvertTo-Json
        $decided = Invoke-RestMethod -Uri "$CcmsBase/ccms/enhancements/$enhId/decide" -Method POST -Headers $hdr -Body $decideBody -TimeoutSec 30
        $dst = if ($decided.status) { $decided.status } else { $decided.Status }
        Add-Result 'Decide enhancement (TPA path)' ($dst -eq 'approved') ("status=$dst")
    } catch {
        $msg = $_.Exception.Message
        $ok = $msg -match '409|Conflict|open enhancement|already'
        Add-Result 'Enhancement create/submit/decide' $ok $msg
    }
} else {
    Add-Result 'Enhancement create/submit/decide' $false 'skipped — no case or permission'
}

try {
    $fakeJourney = [guid]::NewGuid().ToString()
    $fcBody = @{ reason = 'P0 JWT smoke probe - do not apply' } | ConvertTo-Json
    $r = Invoke-WebRequest -Uri "$IpBase/ip-management/journeys/$fakeJourney/emergency-fc" -Method POST -Headers $hdr -Body $fcBody -TimeoutSec 20 -UseBasicParsing
    # IP currently returns HTTP 200 with {"error":"...not found."} for missing journeys.
    $ok = $r.Content -match 'not found|NotFound|KeyNotFound'
    Add-Result 'Emergency FC authz (handler reached)' $ok ("status=$($r.StatusCode) body=$($r.Content.Substring(0,[Math]::Min(80,$r.Content.Length)))")
} catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    $ok = $code -in 400, 404, 409, 422
    Add-Result 'Emergency FC authz (handler reached)' $ok ("status=$code")
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
$results | Format-Table -AutoSize
$failed = @($results | Where-Object { -not $_.Pass }).Count
if ($failed -gt 0) { exit 1 } else { exit 0 }

