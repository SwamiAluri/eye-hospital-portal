@description('Existing storage account that already holds the private session-audio container.')
param storageAccountName string

@description('Region for the Speech resource. Does not move the storage account.')
param location string

@description('Speech resource name. System-assigned identity is created on this resource.')
param speechResourceName string

@description('Built-in Storage Blob Data Reader. Read-only data-plane access to blobs.')
param blobDataReaderRoleId string = '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1'

// The storage account is referenced, not created. networkAcls are not declared here:
// a storage account resource body replaces firewall, VNet, and IP rules.
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: storageAccountName
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' existing = {
  parent: storageAccount
  name: 'default'
}

resource sessionAudioContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' existing = {
  parent: blobService
  name: 'session-audio'
}

resource counselingSpeech 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: speechResourceName
  location: location
  kind: 'SpeechServices'
  sku: {
    name: 'S0'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    customSubDomainName: speechResourceName
    publicNetworkAccess: 'Enabled'
  }
}

resource speechBlobReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(sessionAudioContainer.id, counselingSpeech.id, 'session-audio-blob-reader')
  scope: sessionAudioContainer
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', blobDataReaderRoleId)
    principalId: counselingSpeech.identity.principalId
    principalType: 'ServicePrincipal'
    description: 'Counselling Speech system identity. Storage Blob Data Reader on session-audio only.'
  }
}

output speechResourceName string = counselingSpeech.name
output speechResourceId string = counselingSpeech.id
output speechPrincipalId string = counselingSpeech.identity.principalId
output speechTenantId string = counselingSpeech.identity.tenantId
output speechEndpoint string = counselingSpeech.properties.endpoint
output storageAccountName string = storageAccount.name
output storageAccountId string = storageAccount.id
output sessionAudioContainerName string = sessionAudioContainer.name
output roleAssignmentId string = speechBlobReader.id
output roleDefinitionId string = blobDataReaderRoleId
