// Counselling Speech only. Does not create a storage account, a key, or a SAS.
// deployCounselingSpeech stays the gate. The default is false, so a deployment
// with no parameters creates nothing.

@description('Create or update the counselling Speech resource, system-assigned identity, and session-audio reader role.')
param deployCounselingSpeech bool = false

@description('Existing storage account name. The account must already exist.')
param storageAccountName string

@description('Speech region. Required only when deployCounselingSpeech is true.')
param speechLocation string = resourceGroup().location

@description('Speech resource name. Required only when deployCounselingSpeech is true.')
param speechResourceName string = ''

module counselingSpeechResources 'modules/counseling-speech.bicep' = if (deployCounselingSpeech) {
  name: 'counseling-speech'
  params: {
    storageAccountName: storageAccountName
    location: speechLocation
    speechResourceName: speechResourceName
  }
}

output speechResourceName string = speechResourceName
output storageAccountName string = storageAccountName
output sessionAudioContainerName string = 'session-audio'
