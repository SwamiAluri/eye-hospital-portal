/**
 * PackageSelectionWidget — rewritten for multi-procedure per-eye support.
 *
 * Reads `data.recommendedProcedures` (JSON string from the session) to know
 * which procedures need package selection. Each procedure gets its own
 * package tier selection (Premium / Standard / Budget).
 *
 * Per-procedure selections are stored in:
 *   data.procedurePackages = { [key: string]: { packageId, packageName, amount } }
 *   where key = `${eye}-${surgeryTypeId}`
 *
 * Total amount = sum of all selected procedure package amounts.
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Package2, Check, DollarSign, ChevronDown, ChevronUp, Info, Eye as EyeIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetProps } from '@/lib/widgets/widget-types';
import { widgetsApi, type Package as PackageType } from '@/lib/api/widgets.api';
import { useUpdateCounselingSession } from '@/hooks/use-counseling-sessions';
import { useQuery } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import type { RecommendedProcedureItem } from '@/lib/api/master-data.api';

// ============================================================================
// Types
// ============================================================================

interface ProcedurePackageSelection {
  packageId: string;
  packageName: string;
  packageTier: string;
  amount: number;
}

interface ProcedurePackageState {
  [key: string]: ProcedurePackageSelection;
}

// ============================================================================
// Helpers
// ============================================================================

const EYE_LABEL: Record<string, string> = { RE: 'Right Eye', LE: 'Left Eye', Both: 'Both Eyes' };
const EYE_BADGE: Record<string, string> = {
  RE:   'bg-blue-100 text-blue-700',
  LE:   'bg-purple-100 text-purple-700',
  Both: 'bg-teal-100 text-teal-700',
};

function itemKey(item: RecommendedProcedureItem) {
  return `${item.eye}-${item.surgeryTypeId}`;
}

function parseProcedures(raw: unknown): RecommendedProcedureItem[] {
  if (!raw) return [];
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

const TIER_STYLES: Record<string, string> = {
  Premium:  'border-purple-400 bg-purple-50 hover:border-purple-500',
  Standard: 'border-blue-400 bg-blue-50 hover:border-blue-500',
  Budget:   'border-green-400 bg-green-50 hover:border-green-500',
};
const TIER_SELECTED: Record<string, string> = {
  Premium:  'border-purple-600 ring-2 ring-purple-200',
  Standard: 'border-blue-600 ring-2 ring-blue-200',
  Budget:   'border-green-600 ring-2 ring-green-200',
};
const TIER_ICON_COLOR: Record<string, string> = {
  Premium: 'text-purple-600', Standard: 'text-blue-600', Budget: 'text-green-600',
};

// ============================================================================
// Package Tier Card
// ============================================================================

interface PackageTierCardProps {
  pkg: PackageType;
  selected: boolean;
  onSelect: () => void;
}

function PackageTierCard({ pkg, selected, onSelect }: PackageTierCardProps) {
  const tier = pkg.tier || 'Standard';
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'text-left w-full rounded-xl border-2 p-3 transition-all',
        selected ? TIER_SELECTED[tier] || 'border-blue-600 ring-2 ring-blue-200' : TIER_STYLES[tier] || 'border-gray-200 bg-white hover:border-gray-300'
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={cn('text-xs font-bold uppercase tracking-wide', TIER_ICON_COLOR[tier] || 'text-gray-600')}>{tier}</p>
          <p className="text-sm font-semibold text-gray-900 mt-0.5">{pkg.name}</p>
        </div>
        {selected && <Check className="h-4 w-4 text-green-600 flex-shrink-0" />}
      </div>
      <p className="text-base font-bold text-gray-900 mt-1">₹{pkg.basePrice.toLocaleString('en-IN')}</p>
      {pkg.features?.slice(0, 3).map((f, i) => (
        <div key={i} className="flex items-center gap-1.5 mt-1 text-xs text-gray-600">
          <Check className="h-3 w-3 text-green-500 flex-shrink-0" /> {f}
        </div>
      ))}
    </button>
  );
}

// ============================================================================
// Per-procedure column card (compact, stacked in a column)
// ============================================================================

interface ProcedureColumnCardProps {
  item: RecommendedProcedureItem;
  packages: PackageType[];
  selected?: ProcedurePackageSelection;
  onSelect: (sel: ProcedurePackageSelection) => void;
  // For Both-eye items: allow counselor to choose which eye(s) to apply
  eyeOverride?: 'RE' | 'LE' | 'Both';
  onEyeOverride?: (eye: 'RE' | 'LE' | 'Both') => void;
}

function ProcedureColumnCard({ item, packages, selected, onSelect, eyeOverride, onEyeOverride }: ProcedureColumnCardProps) {
  const isBoth = item.eye === 'Both';
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Header */}
      <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', EYE_BADGE[item.eye] || 'bg-gray-100 text-gray-600')}>
              {item.eye}
            </span>
            <p className="text-xs font-semibold text-gray-900 leading-tight">{item.surgeryName}</p>
          </div>
          {selected && <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />}
        </div>
        {/* Eye override selector for Both-eye procedures */}
        {isBoth && onEyeOverride && (
          <div className="mt-2">
            <p className="text-[10px] text-gray-500 mb-1 flex items-center gap-1"><EyeIcon className="h-3 w-3" /> Apply to:</p>
            <div className="grid grid-cols-3 gap-1">
              {(['RE', 'LE', 'Both'] as const).map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => onEyeOverride(e)}
                  className={cn(
                    'py-1 text-[10px] font-medium rounded border transition-all',
                    (eyeOverride ?? 'Both') === e
                      ? 'bg-teal-600 border-teal-600 text-white'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-teal-400'
                  )}
                >
                  {e === 'RE' ? 'Right' : e === 'LE' ? 'Left' : 'Both'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Package cards stacked vertically */}
      <div className="p-2 space-y-1.5">
        {packages.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">No packages available</p>
        ) : (
          packages.map(pkg => (
            <PackageTierCard
              key={pkg.id}
              pkg={pkg}
              selected={selected?.packageId === pkg.id}
              onSelect={() => onSelect({
                packageId: pkg.id,
                packageName: pkg.name,
                packageTier: pkg.tier || 'Standard',
                amount: pkg.basePrice,
              })}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Widget
// ============================================================================

export default function PackageSelectionWidget({
  widgetId,
  patientId,
  sessionId,
  size,
  isMinimized,
  data,
  onAction,
  onDataChange,
}: WidgetProps) {
  const updateSessionMutation = useUpdateCounselingSession();

  const procedures = useMemo(() => parseProcedures(data.recommendedProcedures), [data.recommendedProcedures]);

  const [procedurePackages, setProcedurePackages] = useState<ProcedurePackageState>(
    () => (data.procedurePackages as ProcedurePackageState) || {}
  );

  // Eye override for «Both-eye» procedures — must be at top level (Rules of Hooks)
  const [bothEyeOverrides, setBothEyeOverrides] = useState<Record<string, 'RE' | 'LE' | 'Both'>>({});

  const { data: pkgData, isLoading } = useQuery({
    queryKey: ['packages', 'widget'],
    queryFn: () => widgetsApi.getPackages(),
    staleTime: 5 * 60 * 1000,
  });

  const packages = pkgData || [];

  const totalAmount = useMemo(
    () => Object.values(procedurePackages).reduce((sum, s) => sum + s.amount, 0),
    [procedurePackages]
  );

  const handleProcedurePackageSelect = useCallback((procedureKey: string, sel: ProcedurePackageSelection) => {
    const next = { ...procedurePackages, [procedureKey]: sel };
    setProcedurePackages(next);
    onDataChange?.({ ...data, procedurePackages: next });
    onAction?.({
      type: 'PROCEDURE_PACKAGE_SELECTED',
      payload: { procedureKey, selection: sel },
      timestamp: new Date(),
    });
  }, [procedurePackages, data, onDataChange, onAction]);

  const handleConfirmAll = async () => {
    if (!sessionId) {
      toast.error('No active session');
      return;
    }
    const selectedCount = Object.keys(procedurePackages).length;
    if (selectedCount === 0) {
      toast.error('Please select a package for at least one procedure');
      return;
    }

    try {
      await updateSessionMutation.mutateAsync({
        id: sessionId,
        data: {
          packageAmount: totalAmount,
          packageAddonsJson: JSON.stringify(procedurePackages),
          currentStage: 'financial',
        },
      });

      onAction?.({
        type: 'PACKAGE_SELECTION_CONFIRMED',
        payload: { procedurePackages, totalAmount },
        timestamp: new Date(),
      });

      onDataChange?.({ ...data, procedurePackages, confirmed: true });

      toast.success('Packages confirmed!', {
        description: `Total: ₹${totalAmount.toLocaleString('en-IN')}`,
      });
    } catch (err: any) {
      toast.error('Failed to confirm packages', { description: err.message });
    }
  };

  if (isMinimized) return null;

  // Compact size
  if (size === 'small') {
    return (
      <div className="space-y-2 p-2">
        <p className="text-xs font-semibold text-gray-500">Packages</p>
        {Object.entries(procedurePackages).length === 0 && <p className="text-xs text-gray-400">No packages selected</p>}
        {Object.entries(procedurePackages).map(([key, sel]) => (
          <div key={key} className="bg-blue-50 rounded p-2 border border-blue-200">
            <p className="text-xs font-medium text-blue-800">{sel.packageName}</p>
            <p className="text-xs text-gray-600">₹{sel.amount.toLocaleString('en-IN')}</p>
          </div>
        ))}
        {totalAmount > 0 && (
          <div className="border-t pt-2">
            <p className="text-xs font-bold text-gray-900">Total: ₹{totalAmount.toLocaleString('en-IN')}</p>
          </div>
        )}
      </div>
    );
  }

  // No doctor procedure recommendation — show full package catalog for free-browse (3-column)
  if (procedures.length === 0) {
    const generalKey = 'general-any';
    const generalSelected = procedurePackages[generalKey];

    // Group packages by tier for the 3 columns
    const budgetPkgs   = packages.filter(p => p.tier === 'Budget');
    const standardPkgs = packages.filter(p => p.tier === 'Standard' || !p.tier);
    const premiumPkgs  = packages.filter(p => p.tier === 'Premium');

    return (
      <div className="flex h-full gap-2 p-3">
        {/* Info banner spans top — inject as a grid row override */}
        <div className="flex flex-col gap-2 flex-1 overflow-y-auto hide-scrollbar">
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex-shrink-0">
            <Info className="h-3.5 w-3.5 flex-shrink-0" />
            No surgery recommendation — select a package from the catalog.
          </div>
          <div className="flex gap-2 flex-1 min-h-0">
            {/* Budget column */}
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto hide-scrollbar">
              <p className="text-[10px] font-bold text-green-700 uppercase tracking-wide flex-shrink-0">Budget</p>
              {isLoading ? <div className="h-24 rounded-xl bg-gray-100 animate-pulse" /> :
                budgetPkgs.length === 0 ? <p className="text-xs text-gray-300 text-center py-4">—</p> :
                budgetPkgs.map(pkg => (
                  <PackageTierCard key={pkg.id} pkg={pkg}
                    selected={generalSelected?.packageId === pkg.id}
                    onSelect={() => handleProcedurePackageSelect(generalKey, { packageId: pkg.id, packageName: pkg.name, packageTier: pkg.tier || 'Budget', amount: pkg.basePrice })}
                  />
                ))
              }
            </div>
            {/* Standard column */}
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto hide-scrollbar">
              <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wide flex-shrink-0">Standard</p>
              {isLoading ? <div className="h-24 rounded-xl bg-gray-100 animate-pulse" /> :
                standardPkgs.length === 0 ? <p className="text-xs text-gray-300 text-center py-4">—</p> :
                standardPkgs.map(pkg => (
                  <PackageTierCard key={pkg.id} pkg={pkg}
                    selected={generalSelected?.packageId === pkg.id}
                    onSelect={() => handleProcedurePackageSelect(generalKey, { packageId: pkg.id, packageName: pkg.name, packageTier: pkg.tier || 'Standard', amount: pkg.basePrice })}
                  />
                ))
              }
            </div>
            {/* Premium column */}
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto hide-scrollbar">
              <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wide flex-shrink-0">Premium</p>
              {isLoading ? <div className="h-24 rounded-xl bg-gray-100 animate-pulse" /> :
                premiumPkgs.length === 0 ? <p className="text-xs text-gray-300 text-center py-4">—</p> :
                premiumPkgs.map(pkg => (
                  <PackageTierCard key={pkg.id} pkg={pkg}
                    selected={generalSelected?.packageId === pkg.id}
                    onSelect={() => handleProcedurePackageSelect(generalKey, { packageId: pkg.id, packageName: pkg.name, packageTier: pkg.tier || 'Premium', amount: pkg.basePrice })}
                  />
                ))
              }
            </div>
          </div>
        </div>

        {/* Right: Cost summary & confirm */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-700 flex-shrink-0">Selected Package</p>
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-3 min-h-0 overflow-y-auto hide-scrollbar">
            {!generalSelected ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Package2 className="h-8 w-8 text-gray-200 mb-1" />
                <p className="text-xs text-gray-400">No package selected</p>
              </div>
            ) : (
              <div className="space-y-1">
                <span className={cn('text-[9px] font-bold uppercase', TIER_ICON_COLOR[generalSelected.packageTier] || 'text-gray-500')}>{generalSelected.packageTier}</span>
                <p className="text-xs font-semibold text-gray-900">{generalSelected.packageName}</p>
                <p className="text-sm font-bold text-gray-900">₹{generalSelected.amount.toLocaleString('en-IN')}</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleConfirmAll}
            disabled={!generalSelected || updateSessionMutation.isPending}
            className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium text-xs hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            {updateSessionMutation.isPending ? 'Saving...' : generalSelected ? `Confirm · ₹${generalSelected.amount.toLocaleString('en-IN')}` : 'Select Package'}
          </button>
        </div>
      </div>
    );
  }

  const selectedCount = Object.keys(procedurePackages).length;

  // Split procedures into RE column, LE column; Both-eye items go in the RE column
  const reProcedures = procedures.filter(p => p.eye === 'RE' || p.eye === 'Both');
  const leProcedures = procedures.filter(p => p.eye === 'LE');

  return (
    <div className="flex h-full gap-2 p-3 overflow-hidden">
      {/* ── COL 1: Right Eye (+ Both-eye procedures) ───────────────────── */}
      <div className="flex-1 flex flex-col gap-2 overflow-y-auto hide-scrollbar min-h-0">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">RE</span>
          <p className="text-xs font-semibold text-gray-700">Right Eye</p>
        </div>
        {isLoading ? (
          [1, 2].map(i => <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />)
        ) : reProcedures.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl py-6">No RE procedures</div>
        ) : (
          reProcedures.map((item, idx) => (
            <ProcedureColumnCard
              key={idx}
              item={item}
              packages={packages}
              selected={procedurePackages[itemKey(item)]}
              onSelect={(sel) => handleProcedurePackageSelect(itemKey(item), sel)}
              eyeOverride={item.eye === 'Both' ? (bothEyeOverrides[itemKey(item)] ?? 'Both') : undefined}
              onEyeOverride={item.eye === 'Both' ? (e) => setBothEyeOverrides(prev => ({ ...prev, [itemKey(item)]: e })) : undefined}
            />
          ))
        )}
      </div>

      {/* ── COL 2: Left Eye ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-2 overflow-y-auto hide-scrollbar min-h-0">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">LE</span>
          <p className="text-xs font-semibold text-gray-700">Left Eye</p>
        </div>
        {isLoading ? (
          [1, 2].map(i => <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />)
        ) : leProcedures.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl py-6">No LE procedures</div>
        ) : (
          leProcedures.map((item, idx) => (
            <ProcedureColumnCard
              key={idx}
              item={item}
              packages={packages}
              selected={procedurePackages[itemKey(item)]}
              onSelect={(sel) => handleProcedurePackageSelect(itemKey(item), sel)}
            />
          ))
        )}
      </div>

      {/* ── COL 3: Cost Summary + Confirm ──────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-2 min-w-[180px] max-w-[260px]">
        <p className="text-xs font-semibold text-gray-700 flex-shrink-0">Cost Summary</p>

        {/* Per-procedure breakdown */}
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-3 overflow-y-auto hide-scrollbar space-y-2 min-h-0">
          {selectedCount === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Package2 className="h-8 w-8 text-gray-200 mb-1" />
              <p className="text-xs text-gray-400">No packages selected</p>
            </div>
          ) : (
            Object.entries(procedurePackages).map(([key, sel]) => {
              const proc = procedures.find(p => itemKey(p) === key);
              const eyeLabel = proc ? (EYE_LABEL[proc.eye] ?? proc.eye) : (EYE_LABEL[key.split('-')[0]] ?? key.split('-')[0]);
              const displayName = proc ? proc.surgeryName : sel.packageName;
              const tier = sel.packageTier;
              return (
                <div key={key} className="bg-white border border-gray-200 rounded-lg p-2">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className={cn('text-[9px] font-bold px-1 py-0.5 rounded-full', EYE_BADGE[proc?.eye ?? 'RE'] || 'bg-gray-100 text-gray-600')}>
                      {proc?.eye ?? key.split('-')[0]}
                    </span>
                    <span className={cn('text-[9px] font-semibold', TIER_ICON_COLOR[tier] || 'text-gray-500')}>{tier}</span>
                  </div>
                  <p className="text-[10px] font-medium text-gray-800 leading-tight">{displayName}</p>
                  <p className="text-xs font-bold text-gray-900 mt-0.5">₹{sel.amount.toLocaleString('en-IN')}</p>
                </div>
              );
            })
          )}
        </div>

        {/* Total */}
        {totalAmount > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 flex-shrink-0">
            <p className="text-[10px] text-blue-600 font-medium">Total</p>
            <p className="text-sm font-bold text-blue-900">₹{totalAmount.toLocaleString('en-IN')}</p>
          </div>
        )}

        {/* Confirm */}
        <button
          type="button"
          onClick={handleConfirmAll}
          disabled={selectedCount === 0 || updateSessionMutation.isPending}
          className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium text-xs hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          {updateSessionMutation.isPending ? 'Saving...' : selectedCount === 0 ? 'Select Packages' : `Confirm · ₹${totalAmount.toLocaleString('en-IN')}`}
        </button>
      </div>
    </div>
  );
}
