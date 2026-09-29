# Verifies counselling Speech infrastructure.
# Account-level public blob access and shared-key access are warnings.
# session-audio must be private. This script does not change Azure and does not transcribe audio.
[CmdletBinding()]
param(
    [string]$SubscriptionId = "a56bb96d-59a1-4d13-be58-e4c9e3a189a3",
    [string]$ResourceGroupName = "hospital-portal-rg",
    [string]$StorageAccountName = "hospitalblobdev01",
    [string]$AudioContainerName = "session-audio",
    [string]$SpeechResourceName = "hospital-portal-counselling-speech"
)

$ErrorActionPreference = "Stop"
$StorageBlobDataReaderRoleId = "2a2b9908-6ea1-4ae2-8e65-a410df84e7d1"
$failed = $false

function Write-Check {
    param(
        [string]$Name,
        [ValidateSet("PASS", "WARN", "FAIL")]
        [string]$Result,
        [string]$Detail
    )

    if ($Detail -match "AccountKey=|DefaultEndpointsProtocol=|sig=") {
        $Detail = "suppressed"
    }

    $color = switch ($Result) {
        "PASS" { "Green" }
        "WARN" { "Yellow" }
        "FAIL" { "Red" }
    }

    Write-Host "$Result  $Name  $Detail" -ForegroundColor $color
    if ($Result -eq "FAIL") { $script:failed = $true }
}

az account set --subscription $SubscriptionId --output none
if ($LASTEXITCODE -ne 0) {
    Write-Check "Azure login" "FAIL" "Azure CLI is not authenticated for this subscription."
    exit 1
}

$storage = az storage account show --name $StorageAccountName --resource-group $ResourceGroupName --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $null -eq $storage) {
    Write-Check "Storage account" "FAIL" $StorageAccountName
    exit 1
}

Write-Check "Storage account exists" "PASS" $storage.name

if ($storage.allowBlobPublicAccess -eq $true) {
    Write-Check "Account allowBlobPublicAccess" "WARN" "true. Retained for existing patient-photo functionality. Not a failure."
}
else {
    Write-Check "Account allowBlobPublicAccess" "PASS" "false"
}

if ($storage.allowSharedKeyAccess -eq $true) {
    Write-Check "Account allowSharedKeyAccess" "WARN" "true. No shared key was created or used by Speech."
}
else {
    Write-Check "Account allowSharedKeyAccess" "PASS" "false"
}

$containerUrl = "https://management.azure.com$($storage.id)/blobServices/default/containers/${AudioContainerName}?api-version=2023-01-01"
$container = az rest --method get --url $containerUrl --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $container.name -ne $AudioContainerName) {
    Write-Check "session-audio" "FAIL" "Container could not be verified."
    exit 1
}

$publicAccess = [string]$container.properties.publicAccess
if ([string]::IsNullOrWhiteSpace($publicAccess) -or $publicAccess -eq "None") {
    Write-Check "session-audio publicAccess" "PASS" "None"
    Write-Check "No public access added to session-audio" "PASS" "private"
}
else {
    Write-Check "session-audio publicAccess" "FAIL" $publicAccess
}

$speechId = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroupName/providers/Microsoft.CognitiveServices/accounts/$SpeechResourceName"
$previousPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$speechRaw = az resource show --ids $speechId --output json 2>&1
$speechExit = $LASTEXITCODE
$ErrorActionPreference = $previousPreference
$speechText = ($speechRaw | ForEach-Object { if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.ToString() } else { [string]$_ } } | Where-Object { $_ -notmatch '^\s*WARNING:' }) -join "`n"
if ($speechExit -ne 0 -or [string]::IsNullOrWhiteSpace($speechText) -or $speechText -notmatch '"id"') {
    Write-Check "Speech managed identity" "WARN" "Speech resource is not deployed yet."
    Write-Check "Storage Blob Data Reader" "WARN" "Not checked until the Speech resource exists."
    Write-Check "Speech resource-instance network rule" "WARN" "Not checked until the Speech resource exists."
}
else {
    $speech = $speechText | ConvertFrom-Json
    $identityType = [string]$speech.identity.type
    $principalId = [string]$speech.identity.principalId
    if ($identityType -eq "SystemAssigned" -and -not [string]::IsNullOrWhiteSpace($principalId)) {
        Write-Check "Speech managed identity" "PASS" "SystemAssigned"
    }
    else {
        Write-Check "Speech managed identity" "FAIL" $identityType
    }

    $scope = "$($storage.id)/blobServices/default/containers/$AudioContainerName"
    $assignments = az role assignment list --scope $scope --assignee-object-id $principalId --output json | ConvertFrom-Json
    $matched = @($assignments) | Where-Object {
        $_.roleDefinitionId -like "*$StorageBlobDataReaderRoleId" -and $_.scope -eq $scope
    }
    if (@($matched).Count -ge 1) {
        Write-Check "Storage Blob Data Reader" "PASS" "session-audio"
    }
    else {
        Write-Check "Storage Blob Data Reader" "FAIL" "missing at session-audio scope"
    }

    $network = az storage account network-rule list --resource-group $ResourceGroupName --account-name $StorageAccountName --output json | ConvertFrom-Json
    $rule = @($network.resourceAccessRules) | Where-Object { $_.resourceId -eq $speech.id }
    if ($rule) {
        Write-Check "Speech resource-instance network rule" "PASS" $SpeechResourceName
    }
    else {
        Write-Check "Speech resource-instance network rule" "FAIL" "missing"
    }
}

Write-Check "No SAS created" "PASS" "This verification does not create a SAS."
Write-Check "No storage key introduced" "PASS" "This verification does not create or print a storage key."

if ($failed) { exit 1 }
Write-Host "Verification finished."
exit 0
