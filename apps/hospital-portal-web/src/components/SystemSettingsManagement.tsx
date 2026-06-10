'use client';

import * as React from 'react';
import { useState } from 'react';
import { useMasterValues } from '@/hooks/use-master-values';
import { 
  Settings, 
  Mail, 
  Bell, 
  Shield, 
  Palette, 
  Database, 
  Server, 
  Lock, 
  Globe, 
  Clock, 
  User, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  RotateCcw,
  Smartphone,
  Key,
  Eye,
  EyeOff,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PatientTypeRulesPanel } from '@/components/settings/PatientTypeRulesPanel';

// Types
interface SystemSettings {
  general: GeneralSettings;
  email: EmailSettings;
  notifications: NotificationSettings;
  security: SecuritySettings;
  appearance: AppearanceSettings;
  integration: IntegrationSettings;
}

interface GeneralSettings {
  organizationName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  language: string;
  currency: string;
}

interface EmailSettings {
  smtpHost: string;
  smtpPort: string;
  smtpUsername: string;
  smtpPassword: string;
  smtpEncryption: 'none' | 'ssl' | 'tls';
  fromEmail: string;
  fromName: string;
  replyToEmail: string;
  emailSignature: string;
}

interface NotificationSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  appointmentReminders: boolean;
  appointmentReminderTime: string;
  newPatientAlerts: boolean;
  systemAlerts: boolean;
  securityAlerts: boolean;
  reportGeneration: boolean;
}

interface SecuritySettings {
  passwordMinLength: string;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecialChars: boolean;
  passwordExpiryDays: string;
  maxLoginAttempts: string;
  sessionTimeout: string;
  twoFactorAuth: boolean;
  ipWhitelist: string;
  auditLogging: boolean;
}

interface AppearanceSettings {
  theme: 'light' | 'dark' | 'auto';
  primaryColor: string;
  logoUrl: string;
  faviconUrl: string;
  loginBackgroundUrl: string;
  customCss: string;
  showBranding: boolean;
  compactMode: boolean;
}

interface IntegrationSettings {
  apiEnabled: boolean;
  apiKey: string;
  webhookUrl: string;
  webhookEvents: string[];
  smsProvider: 'twilio' | 'nexmo' | 'none';
  smsApiKey: string;
  paymentGateway: 'stripe' | 'paypal' | 'none';
  paymentApiKey: string;
  calendarSync: boolean;
  calendarProvider: 'google' | 'outlook' | 'none';
}

type SettingTab = 'general' | 'email' | 'notifications' | 'security' | 'appearance' | 'integration' | 'patientTypes';

// Initial settings data
const initialSettings: SystemSettings = {
  general: {
    organizationName: 'Vision Care Hospital Network',
    contactEmail: 'contact@visioncare.com',
    contactPhone: '+1 (555) 123-4567',
    address: '123 Healthcare Blvd, Medical City, CA 90210',
    timezone: 'America/Los_Angeles',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    language: 'en',
    currency: 'USD'
  },
  email: {
    smtpHost: 'smtp.gmail.com',
    smtpPort: '587',
    smtpUsername: 'noreply@visioncare.com',
    smtpPassword: '••••••••••••',
    smtpEncryption: 'tls',
    fromEmail: 'noreply@visioncare.com',
    fromName: 'Vision Care Hospital',
    replyToEmail: 'support@visioncare.com',
    emailSignature: 'Best regards,\nVision Care Hospital Team\nwww.visioncare.com'
  },
  notifications: {
    emailNotifications: true,
    smsNotifications: true,
    pushNotifications: false,
    appointmentReminders: true,
    appointmentReminderTime: '24',
    newPatientAlerts: true,
    systemAlerts: true,
    securityAlerts: true,
    reportGeneration: false
  },
  security: {
    passwordMinLength: '12',
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumbers: true,
    passwordRequireSpecialChars: true,
    passwordExpiryDays: '90',
    maxLoginAttempts: '5',
    sessionTimeout: '30',
    twoFactorAuth: false,
    ipWhitelist: '',
    auditLogging: true
  },
  appearance: {
    theme: 'light',
    primaryColor: '#10b981',
    logoUrl: '/logo.png',
    faviconUrl: '/favicon.ico',
    loginBackgroundUrl: '/login-bg.jpg',
    customCss: '',
    showBranding: true,
    compactMode: false
  },
  integration: {
    apiEnabled: true,
    apiKey: 'sk_live_••••••••••••••••••••',
    webhookUrl: 'https://api.visioncare.com/webhooks',
    webhookEvents: ['appointment.created', 'patient.registered'],
    smsProvider: 'twilio',
    smsApiKey: '••••••••••••••••••••',
    paymentGateway: 'stripe',
    paymentApiKey: 'pk_live_••••••••••••••••••••',
    calendarSync: true,
    calendarProvider: 'google'
  }
};

const tabs = [
  { id: 'general' as SettingTab, label: 'General', icon: Settings, description: 'Organization details and preferences' },
  { id: 'email' as SettingTab, label: 'Email', icon: Mail, description: 'Email server and notification settings' },
  { id: 'notifications' as SettingTab, label: 'Notifications', icon: Bell, description: 'Alert and reminder preferences' },
  { id: 'security' as SettingTab, label: 'Security', icon: Shield, description: 'Password and authentication policies' },
  { id: 'appearance' as SettingTab, label: 'Appearance', icon: Palette, description: 'Theme and branding customization' },
  { id: 'integration' as SettingTab, label: 'Integration', icon: Database, description: 'API and third-party services' },
  { id: 'patientTypes' as SettingTab, label: 'Patient Types', icon: User, description: 'Counsellor payment type workflow rules (read-only)' },
];

export function SystemSettingsManagement() {
  const [activeTab, setActiveTab] = useState<SettingTab>('general');
  const [settings, setSettings] = useState<SystemSettings>(initialSettings);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);

  const { options: timezoneOptions } = useMasterValues('system.timezone');
  const { options: languageOptions }  = useMasterValues('system.language');
  const { options: currencyOptions }  = useMasterValues('system.currency');

  const handleSettingChange = (category: keyof SystemSettings, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
    setUnsavedChanges(true);
    setSaveSuccess(false);
  };

  const handleSave = () => {
    // Simulate save operation
    console.log('Saving settings:', settings);
    setUnsavedChanges(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleReset = () => {
    setSettings(initialSettings);
    setUnsavedChanges(false);
    setSaveSuccess(false);
  };

  const handleArrayToggle = (category: keyof SystemSettings, field: string, value: string) => {
    const currentArray = settings[category][field] as string[];
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value];
    handleSettingChange(category, field, newArray);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-500">Configure application settings and preferences</p>
        </div>
        <div className="flex gap-2">
          {unsavedChanges && (
            <Button onClick={handleReset} variant="outline">
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          )}
          <Button 
            onClick={handleSave} 
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={!unsavedChanges}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Status Messages */}
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 mr-2" />
          <p className="text-emerald-800 font-medium">Settings saved successfully!</p>
        </div>
      )}

      {unsavedChanges && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center">
          <AlertCircle className="h-5 w-5 text-amber-600 mr-2" />
          <p className="text-amber-800">You have unsaved changes. Click "Save Changes" to apply them.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-2">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                        activeTab === tab.id
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className={`mr-3 h-5 w-5 ${activeTab === tab.id ? 'text-emerald-600' : 'text-gray-400'}`} />
                      <div>
                        <div className="font-medium">{tab.label}</div>
                        <div className="text-xs text-gray-500">{tab.description}</div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-3">
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Building2 className="mr-2 h-5 w-5" />
                    Organization Details
                  </CardTitle>
                  <CardDescription>Basic information about your organization</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="organizationName">Organization Name *</Label>
                      <Input
                        id="organizationName"
                        value={settings.general.organizationName}
                        onChange={(e) => handleSettingChange('general', 'organizationName', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactEmail">Contact Email *</Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        value={settings.general.contactEmail}
                        onChange={(e) => handleSettingChange('general', 'contactEmail', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contactPhone">Contact Phone</Label>
                      <Input
                        id="contactPhone"
                        value={settings.general.contactPhone}
                        onChange={(e) => handleSettingChange('general', 'contactPhone', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone *</Label>
                      <select
                        id="timezone"
                        value={settings.general.timezone}
                        onChange={(e) => handleSettingChange('general', 'timezone', e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {timezoneOptions.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={settings.general.address}
                      onChange={(e) => handleSettingChange('general', 'address', e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Globe className="mr-2 h-5 w-5" />
                    Regional Settings
                  </CardTitle>
                  <CardDescription>Date, time, language, and currency preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dateFormat">Date Format</Label>
                      <select
                        id="dateFormat"
                        value={settings.general.dateFormat}
                        onChange={(e) => handleSettingChange('general', 'dateFormat', e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timeFormat">Time Format</Label>
                      <select
                        id="timeFormat"
                        value={settings.general.timeFormat}
                        onChange={(e) => handleSettingChange('general', 'timeFormat', e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="12h">12-hour (AM/PM)</option>
                        <option value="24h">24-hour</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="language">Language</Label>
                      <select
                        id="language"
                        value={settings.general.language}
                        onChange={(e) => handleSettingChange('general', 'language', e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {languageOptions.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <select
                        id="currency"
                        value={settings.general.currency}
                        onChange={(e) => handleSettingChange('general', 'currency', e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {currencyOptions.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Email Settings */}
          {activeTab === 'email' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Server className="mr-2 h-5 w-5" />
                    SMTP Configuration
                  </CardTitle>
                  <CardDescription>Configure email server settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtpHost">SMTP Host *</Label>
                      <Input
                        id="smtpHost"
                        value={settings.email.smtpHost}
                        onChange={(e) => handleSettingChange('email', 'smtpHost', e.target.value)}
                        placeholder="smtp.example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtpPort">SMTP Port *</Label>
                      <Input
                        id="smtpPort"
                        value={settings.email.smtpPort}
                        onChange={(e) => handleSettingChange('email', 'smtpPort', e.target.value)}
                        placeholder="587"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtpUsername">SMTP Username *</Label>
                      <Input
                        id="smtpUsername"
                        value={settings.email.smtpUsername}
                        onChange={(e) => handleSettingChange('email', 'smtpUsername', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtpPassword">SMTP Password *</Label>
                      <div className="relative">
                        <Input
                          id="smtpPassword"
                          type={showSmtpPassword ? 'text' : 'password'}
                          value={settings.email.smtpPassword}
                          onChange={(e) => handleSettingChange('email', 'smtpPassword', e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showSmtpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtpEncryption">Encryption</Label>
                    <select
                      id="smtpEncryption"
                      value={settings.email.smtpEncryption}
                      onChange={(e) => handleSettingChange('email', 'smtpEncryption', e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="none">None</option>
                      <option value="ssl">SSL</option>
                      <option value="tls">TLS</option>
                    </select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Mail className="mr-2 h-5 w-5" />
                    Email Preferences
                  </CardTitle>
                  <CardDescription>Default sender information and signature</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fromEmail">From Email *</Label>
                      <Input
                        id="fromEmail"
                        type="email"
                        value={settings.email.fromEmail}
                        onChange={(e) => handleSettingChange('email', 'fromEmail', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fromName">From Name *</Label>
                      <Input
                        id="fromName"
                        value={settings.email.fromName}
                        onChange={(e) => handleSettingChange('email', 'fromName', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="replyToEmail">Reply-To Email</Label>
                    <Input
                      id="replyToEmail"
                      type="email"
                      value={settings.email.replyToEmail}
                      onChange={(e) => handleSettingChange('email', 'replyToEmail', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emailSignature">Email Signature</Label>
                    <textarea
                      id="emailSignature"
                      value={settings.email.emailSignature}
                      onChange={(e) => handleSettingChange('email', 'emailSignature', e.target.value)}
                      className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Best regards,\nYour Team"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Notification Settings */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Bell className="mr-2 h-5 w-5" />
                    Notification Channels
                  </CardTitle>
                  <CardDescription>Enable or disable notification channels</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <label className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <div className="flex items-center">
                      <Mail className="mr-3 h-5 w-5 text-gray-500" />
                      <div>
                        <p className="font-medium">Email Notifications</p>
                        <p className="text-sm text-gray-500">Receive notifications via email</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifications.emailNotifications}
                      onChange={(e) => handleSettingChange('notifications', 'emailNotifications', e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <div className="flex items-center">
                      <Smartphone className="mr-3 h-5 w-5 text-gray-500" />
                      <div>
                        <p className="font-medium">SMS Notifications</p>
                        <p className="text-sm text-gray-500">Receive notifications via text message</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifications.smsNotifications}
                      onChange={(e) => handleSettingChange('notifications', 'smsNotifications', e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <div className="flex items-center">
                      <Bell className="mr-3 h-5 w-5 text-gray-500" />
                      <div>
                        <p className="font-medium">Push Notifications</p>
                        <p className="text-sm text-gray-500">Receive browser push notifications</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifications.pushNotifications}
                      onChange={(e) => handleSettingChange('notifications', 'pushNotifications', e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Clock className="mr-2 h-5 w-5" />
                    Event Notifications
                  </CardTitle>
                  <CardDescription>Configure specific event notifications</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <label className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <div>
                      <p className="font-medium">Appointment Reminders</p>
                      <p className="text-sm text-gray-500">Send reminders before appointments</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifications.appointmentReminders}
                      onChange={(e) => handleSettingChange('notifications', 'appointmentReminders', e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>

                  {settings.notifications.appointmentReminders && (
                    <div className="ml-4 space-y-2">
                      <Label htmlFor="appointmentReminderTime">Reminder Time (hours before)</Label>
                      <select
                        id="appointmentReminderTime"
                        value={settings.notifications.appointmentReminderTime}
                        onChange={(e) => handleSettingChange('notifications', 'appointmentReminderTime', e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="1">1 hour</option>
                        <option value="3">3 hours</option>
                        <option value="6">6 hours</option>
                        <option value="12">12 hours</option>
                        <option value="24">24 hours</option>
                        <option value="48">48 hours</option>
                      </select>
                    </div>
                  )}

                  <label className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <div>
                      <p className="font-medium">New Patient Alerts</p>
                      <p className="text-sm text-gray-500">Notify when new patients register</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifications.newPatientAlerts}
                      onChange={(e) => handleSettingChange('notifications', 'newPatientAlerts', e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <div>
                      <p className="font-medium">System Alerts</p>
                      <p className="text-sm text-gray-500">Important system notifications</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifications.systemAlerts}
                      onChange={(e) => handleSettingChange('notifications', 'systemAlerts', e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <div>
                      <p className="font-medium">Security Alerts</p>
                      <p className="text-sm text-gray-500">Suspicious activity and security warnings</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifications.securityAlerts}
                      onChange={(e) => handleSettingChange('notifications', 'securityAlerts', e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <div>
                      <p className="font-medium">Report Generation</p>
                      <p className="text-sm text-gray-500">Notify when scheduled reports are ready</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifications.reportGeneration}
                      onChange={(e) => handleSettingChange('notifications', 'reportGeneration', e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Lock className="mr-2 h-5 w-5" />
                    Password Policy
                  </CardTitle>
                  <CardDescription>Configure password requirements</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="passwordMinLength">Minimum Password Length</Label>
                    <Input
                      id="passwordMinLength"
                      type="number"
                      min="8"
                      max="32"
                      value={settings.security.passwordMinLength}
                      onChange={(e) => handleSettingChange('security', 'passwordMinLength', e.target.value)}
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.security.passwordRequireUppercase}
                        onChange={(e) => handleSettingChange('security', 'passwordRequireUppercase', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 mr-2"
                      />
                      <span className="text-sm">Require uppercase letters (A-Z)</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.security.passwordRequireLowercase}
                        onChange={(e) => handleSettingChange('security', 'passwordRequireLowercase', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 mr-2"
                      />
                      <span className="text-sm">Require lowercase letters (a-z)</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.security.passwordRequireNumbers}
                        onChange={(e) => handleSettingChange('security', 'passwordRequireNumbers', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 mr-2"
                      />
                      <span className="text-sm">Require numbers (0-9)</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.security.passwordRequireSpecialChars}
                        onChange={(e) => handleSettingChange('security', 'passwordRequireSpecialChars', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 mr-2"
                      />
                      <span className="text-sm">Require special characters (!@#$%)</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="passwordExpiryDays">Password Expiry (days)</Label>
                      <Input
                        id="passwordExpiryDays"
                        type="number"
                        min="30"
                        max="365"
                        value={settings.security.passwordExpiryDays}
                        onChange={(e) => handleSettingChange('security', 'passwordExpiryDays', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxLoginAttempts">Max Login Attempts</Label>
                      <Input
                        id="maxLoginAttempts"
                        type="number"
                        min="3"
                        max="10"
                        value={settings.security.maxLoginAttempts}
                        onChange={(e) => handleSettingChange('security', 'maxLoginAttempts', e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Shield className="mr-2 h-5 w-5" />
                    Authentication & Sessions
                  </CardTitle>
                  <CardDescription>Session timeout and authentication settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                    <Input
                      id="sessionTimeout"
                      type="number"
                      min="5"
                      max="120"
                      value={settings.security.sessionTimeout}
                      onChange={(e) => handleSettingChange('security', 'sessionTimeout', e.target.value)}
                    />
                  </div>

                  <label className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <div className="flex items-center">
                      <Key className="mr-3 h-5 w-5 text-gray-500" />
                      <div>
                        <p className="font-medium">Two-Factor Authentication</p>
                        <p className="text-sm text-gray-500">Require 2FA for all users</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.security.twoFactorAuth}
                      onChange={(e) => handleSettingChange('security', 'twoFactorAuth', e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <div className="flex items-center">
                      <Database className="mr-3 h-5 w-5 text-gray-500" />
                      <div>
                        <p className="font-medium">Audit Logging</p>
                        <p className="text-sm text-gray-500">Log all user actions</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.security.auditLogging}
                      onChange={(e) => handleSettingChange('security', 'auditLogging', e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>

                  <div className="space-y-2">
                    <Label htmlFor="ipWhitelist">IP Whitelist (optional)</Label>
                    <textarea
                      id="ipWhitelist"
                      value={settings.security.ipWhitelist}
                      onChange={(e) => handleSettingChange('security', 'ipWhitelist', e.target.value)}
                      className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Enter IP addresses, one per line&#10;192.168.1.1&#10;10.0.0.0/24"
                    />
                    <p className="text-xs text-gray-500 flex items-start">
                      <Info className="h-3 w-3 mr-1 mt-0.5" />
                      Leave empty to allow access from any IP. Use CIDR notation for ranges.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Appearance Settings */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Palette className="mr-2 h-5 w-5" />
                    Theme & Branding
                  </CardTitle>
                  <CardDescription>Customize the look and feel of your application</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="theme">Theme</Label>
                    <select
                      id="theme"
                      value={settings.appearance.theme}
                      onChange={(e) => handleSettingChange('appearance', 'theme', e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="auto">Auto (System)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="primaryColor">Primary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="primaryColor"
                        type="color"
                        value={settings.appearance.primaryColor}
                        onChange={(e) => handleSettingChange('appearance', 'primaryColor', e.target.value)}
                        className="w-20 h-10"
                      />
                      <Input
                        type="text"
                        value={settings.appearance.primaryColor}
                        onChange={(e) => handleSettingChange('appearance', 'primaryColor', e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <div>
                        <p className="font-medium">Show Branding</p>
                        <p className="text-sm text-gray-500">Display logo and organization name</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.appearance.showBranding}
                        onChange={(e) => handleSettingChange('appearance', 'showBranding', e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </label>

                    <label className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <div>
                        <p className="font-medium">Compact Mode</p>
                        <p className="text-sm text-gray-500">Reduce spacing for more content</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.appearance.compactMode}
                        onChange={(e) => handleSettingChange('appearance', 'compactMode', e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </label>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Assets</CardTitle>
                  <CardDescription>Upload and configure visual assets</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="logoUrl">Logo URL</Label>
                    <Input
                      id="logoUrl"
                      value={settings.appearance.logoUrl}
                      onChange={(e) => handleSettingChange('appearance', 'logoUrl', e.target.value)}
                      placeholder="/logo.png"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="faviconUrl">Favicon URL</Label>
                    <Input
                      id="faviconUrl"
                      value={settings.appearance.faviconUrl}
                      onChange={(e) => handleSettingChange('appearance', 'faviconUrl', e.target.value)}
                      placeholder="/favicon.ico"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="loginBackgroundUrl">Login Background URL</Label>
                    <Input
                      id="loginBackgroundUrl"
                      value={settings.appearance.loginBackgroundUrl}
                      onChange={(e) => handleSettingChange('appearance', 'loginBackgroundUrl', e.target.value)}
                      placeholder="/login-bg.jpg"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customCss">Custom CSS</Label>
                    <textarea
                      id="customCss"
                      value={settings.appearance.customCss}
                      onChange={(e) => handleSettingChange('appearance', 'customCss', e.target.value)}
                      className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                      placeholder=".custom-class {&#10;  color: #10b981;&#10;}"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Integration Settings */}
          {activeTab === 'integration' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Server className="mr-2 h-5 w-5" />
                    API Configuration
                  </CardTitle>
                  <CardDescription>API access and webhook settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <label className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <div>
                      <p className="font-medium">Enable API Access</p>
                      <p className="text-sm text-gray-500">Allow external applications to access the API</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.integration.apiEnabled}
                      onChange={(e) => handleSettingChange('integration', 'apiEnabled', e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>

                  {settings.integration.apiEnabled && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="apiKey">API Key</Label>
                        <div className="relative">
                          <Input
                            id="apiKey"
                            type={showApiKey ? 'text' : 'password'}
                            value={settings.integration.apiKey}
                            onChange={(e) => handleSettingChange('integration', 'apiKey', e.target.value)}
                            readOnly
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="webhookUrl">Webhook URL</Label>
                        <Input
                          id="webhookUrl"
                          value={settings.integration.webhookUrl}
                          onChange={(e) => handleSettingChange('integration', 'webhookUrl', e.target.value)}
                          placeholder="https://example.com/webhooks"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Webhook Events</Label>
                        <div className="space-y-2">
                          {['appointment.created', 'appointment.updated', 'appointment.cancelled', 'patient.registered', 'patient.updated'].map(event => (
                            <label key={event} className="flex items-center">
                              <input
                                type="checkbox"
                                checked={settings.integration.webhookEvents.includes(event)}
                                onChange={() => handleArrayToggle('integration', 'webhookEvents', event)}
                                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 mr-2"
                              />
                              <span className="text-sm font-mono">{event}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Smartphone className="mr-2 h-5 w-5" />
                    SMS Provider
                  </CardTitle>
                  <CardDescription>Configure SMS notification service</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="smsProvider">SMS Provider</Label>
                    <select
                      id="smsProvider"
                      value={settings.integration.smsProvider}
                      onChange={(e) => handleSettingChange('integration', 'smsProvider', e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="none">None</option>
                      <option value="twilio">Twilio</option>
                      <option value="nexmo">Vonage (Nexmo)</option>
                    </select>
                  </div>

                  {settings.integration.smsProvider !== 'none' && (
                    <div className="space-y-2">
                      <Label htmlFor="smsApiKey">API Key</Label>
                      <Input
                        id="smsApiKey"
                        type="password"
                        value={settings.integration.smsApiKey}
                        onChange={(e) => handleSettingChange('integration', 'smsApiKey', e.target.value)}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Additional Integrations</CardTitle>
                  <CardDescription>Connect with third-party services</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="paymentGateway">Payment Gateway</Label>
                    <select
                      id="paymentGateway"
                      value={settings.integration.paymentGateway}
                      onChange={(e) => handleSettingChange('integration', 'paymentGateway', e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="none">None</option>
                      <option value="stripe">Stripe</option>
                      <option value="paypal">PayPal</option>
                    </select>
                  </div>

                  {settings.integration.paymentGateway !== 'none' && (
                    <div className="space-y-2">
                      <Label htmlFor="paymentApiKey">API Key</Label>
                      <Input
                        id="paymentApiKey"
                        type="password"
                        value={settings.integration.paymentApiKey}
                        onChange={(e) => handleSettingChange('integration', 'paymentApiKey', e.target.value)}
                      />
                    </div>
                  )}

                  <label className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <div>
                      <p className="font-medium">Calendar Sync</p>
                      <p className="text-sm text-gray-500">Sync appointments with external calendar</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.integration.calendarSync}
                      onChange={(e) => handleSettingChange('integration', 'calendarSync', e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>

                  {settings.integration.calendarSync && (
                    <div className="space-y-2">
                      <Label htmlFor="calendarProvider">Calendar Provider</Label>
                      <select
                        id="calendarProvider"
                        value={settings.integration.calendarProvider}
                        onChange={(e) => handleSettingChange('integration', 'calendarProvider', e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="none">None</option>
                        <option value="google">Google Calendar</option>
                        <option value="outlook">Microsoft Outlook</option>
                      </select>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'patientTypes' && (
            <Card>
              <CardContent className="pt-6">
                <PatientTypeRulesPanel />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
