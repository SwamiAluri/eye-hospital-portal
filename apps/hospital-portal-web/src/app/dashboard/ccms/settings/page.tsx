'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Settings, RefreshCw, Save, AlertCircle, Lock, LockOpen, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getCcmsApi } from '@/lib/api/ccms/ccms-base';
import { useCcmsPermissions } from '@/hooks/useCcmsPermissions';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CcmsConfig {
  admissionValidation: {
    mode: 'fail_open' | 'fail_closed';
    warningOnMissingPreauth: boolean;
    blockOnExpiredPreauth: boolean;
    bypassRoles: string[];
  };
  integrations: {
    billingImportEnabled: boolean;
    notificationDispatchEnabled: boolean;
  };
  workflow: {
    autoDraftOnCounselingComplete: boolean;
    autoPreauthOnAdmission: boolean;
  };
}

const DEFAULT_CONFIG: CcmsConfig = {
  admissionValidation: {
    mode: 'fail_open',
    warningOnMissingPreauth: true,
    blockOnExpiredPreauth: false,
    bypassRoles: ['admin', 'super_admin'],
  },
  integrations: {
    billingImportEnabled: true,
    notificationDispatchEnabled: true,
  },
  workflow: {
    autoDraftOnCounselingComplete: true,
    autoPreauthOnAdmission: false,
  },
};

// ── API helpers ───────────────────────────────────────────────────────────────

async function getConfig(): Promise<CcmsConfig> {
  try {
    const { data } = await getCcmsApi().get('/ccms/admin/config');
    return { ...DEFAULT_CONFIG, ...data };
  } catch {
    return DEFAULT_CONFIG;
  }
}

async function saveConfig(cfg: CcmsConfig): Promise<void> {
  await getCcmsApi().put('/ccms/admin/config', cfg);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CcmsSettingsPage() {
  const { isWorkflowAdmin } = useCcmsPermissions();
  const [config,  setConfig]  = useState<CcmsConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [dirty,   setDirty]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setConfig(await getConfig());
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (updater: (c: CcmsConfig) => CcmsConfig) => {
    setConfig(prev => updater(prev));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveConfig(config);
      toast.success('CCMS configuration saved');
      setDirty(false);
    } catch {
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (!isWorkflowAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8">
          <Lock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-500">Access Restricted</p>
          <p className="text-xs text-gray-400 mt-1">CCMS configuration requires Workflow Admin permission.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-500" />
          <div>
            <h1 className="text-lg font-extrabold text-gray-900">CCMS Configuration</h1>
            <p className="text-xs text-gray-400">Runtime settings for Coverage & Claims Management System</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {dirty && (
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error} — Showing defaults. Changes here will apply on next request.
        </div>
      )}

      {/* Admission Validation */}
      <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          {config.admissionValidation.mode === 'fail_closed'
            ? <Lock className="w-4 h-4 text-red-500" />
            : <LockOpen className="w-4 h-4 text-green-500" />
          }
          <h2 className="text-sm font-bold text-gray-900">Admission Validation</h2>
        </div>
        <div className="p-5 space-y-5">
          {/* Fail-open / Fail-closed toggle — the key config item */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-2">
              {([
                { val: 'fail_open',   label: 'Fail-Open',   desc: 'Allow admission even if CCMS check fails. Warning shown.',   icon: <LockOpen className="w-4 h-4" />, cls: 'text-green-700 bg-green-50' },
                { val: 'fail_closed', label: 'Fail-Closed', desc: 'Block admission if CCMS pre-auth is missing or expired.',     icon: <Lock className="w-4 h-4" />,     cls: 'text-red-700 bg-red-50' },
              ] as const).map(opt => (
                <button key={opt.val} type="button"
                  onClick={() => update(c => ({ ...c, admissionValidation: { ...c.admissionValidation, mode: opt.val } }))}
                  className={`p-4 text-left border-r last:border-r-0 border-gray-100 transition-colors ${
                    config.admissionValidation.mode === opt.val
                      ? opt.cls + ' border-b-2 border-b-indigo-500'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className={`flex items-center gap-2 font-bold text-xs mb-1 ${
                    config.admissionValidation.mode === opt.val ? '' : 'text-gray-600'
                  }`}>
                    {opt.icon}{opt.label}
                    {config.admissionValidation.mode === opt.val && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 uppercase">Active</span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700">
              <strong>Fail-Open</strong> is recommended for live deployments. Use <strong>Fail-Closed</strong> only after CCMS is fully adopted across all departments.
              Changes take effect immediately on the next admission validation call.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                key: 'warningOnMissingPreauth',
                label: 'Warn on Missing Pre-auth',
                desc: 'Display a warning when patient is admitted without a pre-authorization',
              },
              {
                key: 'blockOnExpiredPreauth',
                label: 'Block on Expired Pre-auth',
                desc: 'Prevent admission if the pre-authorization has expired (overrides fail-open for expiry)',
              },
            ].map(f => (
              <label key={f.key} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(config.admissionValidation as any)[f.key]}
                  onChange={e => update(c => ({
                    ...c,
                    admissionValidation: { ...c.admissionValidation, [f.key]: e.target.checked },
                  }))}
                  className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <p className="text-xs font-semibold text-gray-700">{f.label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{f.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Integrations</h2>
        </div>
        <div className="p-5 space-y-3">
          {[
            {
              key: 'billingImportEnabled',
              label: 'Billing Import (IP)',
              desc: 'Allow import of IP billing transaction lines into allocation flow',
            },
            {
              key: 'notificationDispatchEnabled',
              label: 'Notification Dispatch',
              desc: 'Enable automated communications (SMS, email) on workflow state changes',
            },
          ].map(f => (
            <label key={f.key} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={(config.integrations as any)[f.key]}
                onChange={e => update(c => ({
                  ...c,
                  integrations: { ...c.integrations, [f.key]: e.target.checked },
                }))}
                className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <p className="text-xs font-semibold text-gray-700">{f.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{f.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Workflow Automation */}
      <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Workflow Automation</h2>
        </div>
        <div className="p-5 space-y-3">
          {[
            {
              key: 'autoDraftOnCounselingComplete',
              label: 'Auto-Create CCMS Draft on Counselling Complete',
              desc: 'Automatically create a CCMS draft case when a counselling session completes with insurance payment type',
            },
            {
              key: 'autoPreauthOnAdmission',
              label: 'Auto-Generate Pre-Auth on Admission',
              desc: 'Trigger pre-auth generation automatically when patient is admitted (experimental)',
            },
          ].map(f => (
            <label key={f.key} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={(config.workflow as any)[f.key]}
                onChange={e => update(c => ({
                  ...c,
                  workflow: { ...c.workflow, [f.key]: e.target.checked },
                }))}
                className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <p className="text-xs font-semibold text-gray-700">{f.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{f.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {dirty && (
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save Configuration'}
          </button>
        </div>
      )}
    </div>
  );
}
