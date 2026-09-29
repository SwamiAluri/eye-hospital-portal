@description('Location for all resources')
param location string = resourceGroup().location

@description('Name of the hospital portal application')
param appName string = 'hospital-portal'

@description('Environment (dev, staging, prod)')
@allowed([
  'dev'
  'staging'
  'prod'
])
param environment string = 'dev'

@description('PostgreSQL admin username')
param postgresAdminUsername string

@description('PostgreSQL admin password')
@secure()
param postgresAdminPassword string

@description('App Service plan SKU')
@allowed([
  'F1'
  'D1'
  'B1'
  'B2'
  'B3'
  'S1'
  'S2'
  'S3'
  'P1v2'
  'P2v2'
  'P3v2'
])
param appServicePlanSku string = environment == 'prod' ? 'P1v2' : 'B2'

@description('Deploy the counselling Speech resource and session-audio reader role. Storage stays private. Shared key access is not added.')
param deployCounselingSpeech bool = false

var resourceNamePrefix = '${appName}-${environment}'
var appServicePlanName = '${resourceNamePrefix}-asp'
var webAppName = '${resourceNamePrefix}-api'
var staticWebAppName = '${resourceNamePrefix}-web'
var postgresServerName = '${resourceNamePrefix}-pg'
var postgresDatabaseName = 'hospital_portal'
var storageAccountName = replace('${resourceNamePrefix}storage', '-', '')
var appInsightsName = '${resourceNamePrefix}-insights'
var logAnalyticsName = '${resourceNamePrefix}-logs'

// Log Analytics Workspace (required for Application Insights)
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: environment == 'prod' ? 90 : 30
  }
}

// Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: appServicePlanSku
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

// Web App (Backend API)
resource webApp 'Microsoft.Web/sites@2022-09-01' = {
  name: webAppName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|8.0'
      alwaysOn: environment == 'prod' ? true : false
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      http20Enabled: true
      appSettings: [
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: appInsights.properties.InstrumentationKey
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'ApplicationInsightsAgent_EXTENSION_VERSION'
          value: '~3'
        }
        {
          name: 'ASPNETCORE_ENVIRONMENT'
          value: environment == 'prod' ? 'Production' : 'Development'
        }
        {
          name: 'Jwt__Issuer'
          value: 'https://${webAppName}.azurewebsites.net'
        }
        {
          name: 'Jwt__Audience'
          value: 'https://${webAppName}.azurewebsites.net'
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
      ]
      connectionStrings: [
        {
          name: 'DefaultConnection'
          connectionString: 'Host=${postgresServer.properties.fullyQualifiedDomainName};Database=${postgresDatabaseName};Username=${postgresAdminUsername};Password=${postgresAdminPassword};SSL Mode=Require;Trust Server Certificate=true'
          type: 'PostgreSQL'
        }
      ]
    }
  }
}

// PostgreSQL Flexible Server
resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2022-12-01' = {
  name: postgresServerName
  location: location
  sku: {
    name: environment == 'prod' ? 'Standard_D4s_v3' : 'Standard_B2s'
    tier: environment == 'prod' ? 'GeneralPurpose' : 'Burstable'
  }
  properties: {
    version: '17'
    administratorLogin: postgresAdminUsername
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: environment == 'prod' ? 128 : 32
    }
    backup: {
      backupRetentionDays: environment == 'prod' ? 30 : 7
      geoRedundantBackup: environment == 'prod' ? 'Enabled' : 'Disabled'
    }
    highAvailability: {
      mode: environment == 'prod' ? 'ZoneRedundant' : 'Disabled'
    }
  }
}

// PostgreSQL Database
resource postgresDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2022-12-01' = {
  name: postgresDatabaseName
  parent: postgresServer
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// PostgreSQL Firewall Rule (Allow Azure Services)
resource postgresFirewallRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2022-12-01' = {
  name: 'AllowAzureServices'
  parent: postgresServer
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Storage Account (for document uploads)
resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: environment == 'prod' ? 'Standard_GRS' : 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
    accessTier: 'Hot'
  }
}

// Blob Container for documents
resource blobContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2022-09-01' = {
  name: '${storageAccount.name}/default/documents'
  properties: {
    publicAccess: 'None'
  }
}

resource sessionAudioContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2022-09-01' = {
  name: '${storageAccount.name}/default/session-audio'
  properties: {
    publicAccess: 'None'
  }
}

// Speech is a separate module so the storage account body is not rewritten.
// Storage firewall rules are applied by infrastructure/scripts/setup-counselling-speech-azure.ps1.
module counselingSpeech 'counseling-speech.bicep' = if (deployCounselingSpeech) {
  name: 'counseling-speech'
  params: {
    deployCounselingSpeech: true
    storageAccountName: storageAccount.name
    speechLocation: location
    speechResourceName: '${replace(resourceNamePrefix, '-', '')}speech'
  }
  dependsOn: [
    sessionAudioContainer
  ]
}

// Static Web App (Frontend)
resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: staticWebAppName
  location: location
  sku: {
    name: environment == 'prod' ? 'Standard' : 'Free'
    tier: environment == 'prod' ? 'Standard' : 'Free'
  }
  properties: {
    buildProperties: {
      appLocation: '/apps/hospital-portal-web'
      outputLocation: '.next'
    }
  }
}

// Outputs
output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostName}'
output postgresServerFqdn string = postgresServer.properties.fullyQualifiedDomainName
output storageAccountName string = storageAccount.name
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
