# Counselling Speech deployment

This deploys the Speech resource used by the existing counselling transcription worker. It does not change recording, transcription, or summary behavior.

The worker submits audio only when `AzureSpeech:TrustedBlobAccess` is true. That value stays false in source-controlled `appsettings.json`.

## What is deployed

- Azure AI Speech resource (`Microsoft.CognitiveServices/accounts`, kind `SpeechServices`)
- System-assigned managed identity on that Speech resource
- Storage Blob Data Reader on the existing `session-audio` container only
- A storage resource-access rule for that specific Speech resource

The counselling container `session-audio` must stay private. Account-level `allowBlobPublicAccess` and `allowSharedKeyAccess` are not changed, because the same account serves existing patient photos.

The script adds the Speech resource with `az storage account network-rule add`. It does not replace IP rules, VNet rules, private endpoints, or DNS, and it does not set `defaultAction` to Allow. If the default action changes, verification stops.

`deployCounselingSpeech` remains `false` by default in the Bicep templates. Use the PowerShell script below for the existing `hospitalblobdev01` account.

## Prerequisites

- Azure CLI, logged in to the target subscription
- Resource group that already contains the storage account
- Storage account and private `session-audio` container
- Permission to deploy resources: `Microsoft.Resources/deployments/write`
- Permission to assign roles: `Microsoft.Authorization/roleAssignments/write`
- Permission to deploy Speech: `Microsoft.CognitiveServices/accounts/write`

## Deploy

The operator script is `infrastructure/scripts/setup-counselling-speech-azure.ps1`. A run without `-Apply` only discovers and reports. It does not create a SAS, a storage key, or a public container, and it does not submit counselling audio.

```powershell
./infrastructure/scripts/setup-counselling-speech-azure.ps1
```

Defaults are subscription `a56bb96d-59a1-4d13-be58-e4c9e3a189a3`, resource group `hospital-portal-rg`, storage account `hospitalblobdev01`, container `session-audio`, and Speech name `hospital-portal-counselling-speech`.

Create the Speech resource only when none exists, and only after the dry run looks correct:

```powershell
./infrastructure/scripts/setup-counselling-speech-azure.ps1 -CreateSpeechResource -Apply
```

The script adds Storage Blob Data Reader on the existing `session-audio` container and one resource-instance network rule for that Speech resource. It does not replace IP rules, VNet rules, or the storage default action. A connection string is not read and is not how Speech reads blobs.

## Runtime configuration

Set these on the Auth Service environment after verification succeeds. Do not put them in `appsettings.json`.

- `AzureSpeech__TrustedBlobAccess=true`
- `AzureSpeech__Endpoint` from the deployment output
- `AzureSpeech__StorageAccountName` as the existing storage account name
- `AzureSpeech__Key` from the Speech resource keys, through the environment or secret store

`AzureSpeech__Region` remains available. The worker uses the endpoint when it is set.

Do not restart production as part of the deployment script. Restart Auth Service when you are ready to load the new environment values. Transcription UAT is a separate manual step and must not use this script to send counselling audio.
