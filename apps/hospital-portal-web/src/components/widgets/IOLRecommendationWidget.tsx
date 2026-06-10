/**
 * IOLRecommendationWidget — per-procedure per-eye IOL selection.
 *
 * Reads data.recommendedProcedures (JSON string) to know which eyes need IOL.
 * - requiresIol=true  → show IOL catalog picker with RE/LE/Both eye toggle
 * - laserProcedure    → "no IOL" banner
 * - iclProcedure      → "power from doctor" banner
 * Eye toggle: shown only when item.eye === 'Both'. LE/RE = price×1, Both = price×2.
 */

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Eye, Check, Zap, Info, ChevronDown, ChevronUp, IndianRupee } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetProps } from '@/lib/widgets/widget-types';
import {
  useClinicalIolWithPricing,
  useCounsellorProcedureVariants,
} from '@/hooks/use-clinical-catalog-master';
import { buildCounsellorIolDtos } from '@/lib/master-data/clinical-catalog-master';
import { useAuthStore } from '@/lib/auth-store';
import type { RecommendedProcedureItem } from '@/lib/api/master-data.api';
import type { IolMasterDto, FlatVariantDto } from '@/lib/api/service-catalog.api';

// ─── Types ───────────────────────────────────────────────────────────────────

type EyeSelection = 'RE' | 'LE' | 'Both';

interface ProcedureIOLState {
  [key: string]: {
    iolCatalogId: string | null;
    iolModelName: string | null;
    iolType: string | null;
    confirmed: boolean;
    eyeSelection: EyeSelection;
    unitPrice: number | null;  // per-eye price
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EYE_LABEL: Record<string, string> = { RE: 'Right Eye', LE: 'Left Eye', Both: 'Both Eyes' };
const EYE_COLOR: Record<string, string> = {
  RE:   'border-blue-400 bg-blue-50',
  LE:   'border-purple-400 bg-purple-50',
  Both: 'border-teal-400 bg-teal-50',
};
const EYE_BADGE_COLOR: Record<EyeSelection, string> = {
  RE:   'bg-blue-100 text-blue-700',
  LE:   'bg-purple-100 text-purple-700',
  Both: 'bg-teal-100 text-teal-700',
};

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

function formatINR(amount: number) { return INR.format(amount); }

function totalPrice(unitPrice: number | null, eye: EyeSelection): number | null {
  if (unitPrice == null) return null;
  return eye === 'Both' ? unitPrice * 2 : unitPrice;
}

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

/** Client-side IOL type filtering — handles ToricMultifocal appearing in multiple tabs */
function filterIOLsByTab(iols: IolMasterDto[], tab: string): IolMasterDto[] {
  if (tab === 'All') return iols;
  if (tab === 'Monofocal') return iols.filter(i => i.iolType === 'Monofocal');
  if (tab === 'Multifocal') return iols.filter(i => i.iolType === 'Multifocal' || i.iolType === 'ToricMultifocal');
  if (tab === 'Trifocal') return iols.filter(i => i.iolType === 'Trifocal');
  if (tab === 'EDOF') return iols.filter(i => i.iolType === 'EDOF');
  if (tab === 'Toric') return iols.filter(i => i.iolType === 'Toric' || i.iolType === 'ToricMultifocal');
  if (tab === 'ICL') return iols.filter(i => i.iolType === 'ICL');
  return iols;
}

const IOL_TYPE_TABS = ['All', 'Monofocal', 'Multifocal', 'Trifocal', 'EDOF', 'Toric', 'ICL'] as const;

// ─── Surgery category tabs (free-browse mode) ─────────────────────────────────

const SURGERY_CATEGORY_TABS = [
  'All', 'Cataract', 'Retina', 'Glaucoma', 'Cornea',
  'Refractive', 'Oculoplasty', 'Strabismus', 'General',
] as const;

type SurgeryCategoryTab = typeof SURGERY_CATEGORY_TABS[number];

/** DB category names are used directly as tab keys — no remapping needed */
const CATEGORY_DISPLAY: Record<string, string> = {
  All: 'All',
  Cataract: 'Cataract',
  Retina: 'Retina',
  Glaucoma: 'Glaucoma',
  Cornea: 'Cornea',
  Refractive: 'Refractive',
  Oculoplasty: 'Oculoplasty',
  Strabismus: 'Strabismus',
  General: 'General',
};

function filterByCategory(types: FlatVariantDto[], tab: SurgeryCategoryTab): FlatVariantDto[] {
  // Always exclude items whose variant name suggests Diagnostic
  const nonDiagnostic = types.filter(t => t.categoryCode.toLowerCase() !== 'diagnostic');
  if (tab === 'All') return nonDiagnostic;
  return nonDiagnostic.filter(t => t.categoryCode.toLowerCase() === tab.toLowerCase() || t.categoryName.toLowerCase() === tab.toLowerCase());
}

// ─── IOL Card ────────────────────────────────────────────────────────────────

function IOLCard({ iol, selected, onSelect }: { iol: IolMasterDto; selected: boolean; onSelect: () => void }) {
  const price = iol.price ?? (iol as IolMasterDto & { defaultPrice?: number }).defaultPrice ?? 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left p-3 rounded-lg border-2 transition-all',
        selected
          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-300'
          : 'border-gray-200 bg-white hover:border-blue-300'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 leading-tight">{iol.modelName}</p>
          <p className="text-xs text-gray-500 mt-0.5">{iol.brandManufacturer} · {iol.iolType}</p>
          {price > 0 && (
            <p className="text-xs text-green-700 mt-1 font-semibold flex items-center gap-0.5">
              <IndianRupee className="w-3 h-3" />
              {formatINR(price).replace('₹', '')}
              <span className="text-gray-400 font-normal">/eye</span>
            </p>
          )}
        </div>
        {selected && <Check className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />}
      </div>
    </button>
  );
}

// ─── Eye Toggle ──────────────────────────────────────────────────────────────

function EyeToggle({
  value,
  onChange,
}: {
  value: EyeSelection;
  onChange: (v: EyeSelection) => void;
}) {
  const opts: { key: EyeSelection; label: string }[] = [
    { key: 'RE', label: 'Right Eye' },
    { key: 'LE', label: 'Left Eye' },
    { key: 'Both', label: 'Both Eyes' },
  ];
  return (
    <div className="flex gap-1">
      {opts.map(o => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            'px-2.5 py-1 text-xs rounded-full border font-medium transition-all',
            value === o.key
              ? o.key === 'RE'
                ? 'bg-blue-600 text-white border-blue-600'
                : o.key === 'LE'
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-teal-600 text-white border-teal-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Shared section wrapper ───────────────────────────────────────────────────

function SectionShell({
  item,
  activeEye,
  confirmed,
  expanded,
  onToggleExpand,
  children,
}: {
  item: RecommendedProcedureItem;
  activeEye?: EyeSelection;
  confirmed?: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  children: React.ReactNode;
}) {
  const displayEye = activeEye ?? (item.eye as EyeSelection);
  const eyeLabel = EYE_LABEL[displayEye] ?? displayEye;
  const eyeColor = EYE_COLOR[item.eye] ?? 'border-gray-200 bg-gray-50';
  const eyeBadge = EYE_BADGE_COLOR[displayEye] ?? 'bg-gray-100 text-gray-600';
  return (
    <div className={cn('border-2 rounded-xl overflow-hidden', eyeColor)}>
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Eye className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', eyeBadge)}>{eyeLabel}</span>
              {confirmed && (
                <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                  <Check className="w-3 h-3" /> Selected
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-800 truncate mt-0.5">{item.surgeryName}</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>
      {expanded && (
        <div className="border-t border-gray-200 px-4 pb-4 pt-3">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Per-procedure section ────────────────────────────────────────────────────

function ProcedureSection({
  item,
  branchId,
  iolState,
  onIOLSelect,
}: {
  item: RecommendedProcedureItem;
  branchId?: string;
  iolState: ProcedureIOLState;
  onIOLSelect: (key: string, iol: IolMasterDto | null, eyeSelection: EyeSelection) => void;
}) {
  const key = itemKey(item);
  const current = iolState[key];
  const [expanded, setExpanded] = useState(!current?.confirmed);
  const [iolTypeFilter, setIolTypeFilter] = useState<string>('All');
  // Eye toggle: only meaningful when item.eye === 'Both'; otherwise fixed to item.eye
  const [eyeOverride, setEyeOverride] = useState<EyeSelection>((item.eye as EyeSelection) ?? 'Both');

  // Fetch IOL options for this specific procedure variant
  const { data: iolData, isLoading } = useIolOptions(
    item.surgeryTypeId,
    { enabled: item.requiresIol }
  );
  const allIols = iolData ?? [];
  const iols = filterIOLsByTab(allIols, iolTypeFilter);

  // Laser procedure section
  if (item.laserProcedure) {
    return (
      <SectionShell item={item} activeEye={eyeOverride} expanded={expanded} onToggleExpand={() => setExpanded(v => !v)}>
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2.5 rounded-lg">
          <Zap className="w-4 h-4 flex-shrink-0" />
          <span>Laser procedure — no IOL required for this eye</span>
        </div>
      </SectionShell>
    );
  }

  // ICL procedure section
  if (item.iclProcedure) {
    return (
      <SectionShell item={item} activeEye={eyeOverride} expanded={expanded} onToggleExpand={() => setExpanded(v => !v)}>
        <div className="flex items-center gap-2 text-xs text-violet-700 bg-violet-50 border border-violet-200 px-3 py-2.5 rounded-lg">
          <Info className="w-4 h-4 flex-shrink-0" />
          <span>ICL — lens power is determined by the operating doctor. No catalog selection required.</span>
        </div>
      </SectionShell>
    );
  }

  // No IOL required
  if (!item.requiresIol) {
    return (
      <SectionShell item={item} activeEye={eyeOverride} expanded={expanded} onToggleExpand={() => setExpanded(v => !v)}>
        <p className="text-xs text-gray-400">No IOL required for this procedure.</p>
      </SectionShell>
    );
  }

  const unitPrice = current?.unitPrice ?? null;
  const total = totalPrice(unitPrice, eyeOverride);

  return (
    <SectionShell item={item} activeEye={eyeOverride} confirmed={current?.confirmed} expanded={expanded} onToggleExpand={() => setExpanded(v => !v)}>
      {/* Eye selector — only shown when procedure is bilateral */}
      {item.eye === 'Both' && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1.5 font-medium">Select eye(s) for this IOL:</p>
          <EyeToggle value={eyeOverride} onChange={v => {
            setEyeOverride(v);
            // re-confirm with updated eye if already selected
            if (current?.confirmed && current.iolCatalogId) {
              onIOLSelect(key, { id: current.iolCatalogId, modelName: current.iolModelName!, iolType: current.iolType, brandManufacturer: '', origin: 'Indian', defaultPrice: current.unitPrice ?? 0, isDefault: false } as IolMasterDto, v);
            }
          }} />
        </div>
      )}

      {/* IOL Type Filter Tabs */}
      <div className="flex gap-1 flex-wrap mb-3">
        {IOL_TYPE_TABS.map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setIolTypeFilter(tab)}
            className={cn(
              'px-2.5 py-1 text-xs rounded-full border font-medium transition-all',
              iolTypeFilter === tab
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* IOL Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />)}
        </div>
      ) : iols.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">
          {iolTypeFilter === 'All' ? 'No IOL catalog items available.' : `No ${iolTypeFilter} IOLs found.`}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
          {iols.map(iol => (
            <IOLCard
              key={iol.id}
              iol={iol}
              selected={current?.iolCatalogId === iol.id}
              onSelect={() => onIOLSelect(key, iol, eyeOverride)}
            />
          ))}
        </div>
      )}

      {/* Selected footer */}
      {current?.iolCatalogId && (
        <div className="flex items-center justify-between pt-3 mt-2 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-500">
              Selected: <span className="font-semibold text-gray-800">{current.iolModelName}</span>
            </p>
            {unitPrice != null && (
              <p className="text-xs text-gray-500 mt-0.5">
                {formatINR(unitPrice)}/eye
                {eyeOverride === 'Both' && (
                  <span className="ml-1 text-teal-600 font-semibold">× 2 = {formatINR(total!)}</span>
                )}
              </p>
            )}
          </div>
          <button type="button" onClick={() => onIOLSelect(key, null, eyeOverride)} className="text-xs text-red-500 hover:text-red-700">
            Clear
          </button>
        </div>
      )}
    </SectionShell>
  );
}

// ─── Price Summary Card ───────────────────────────────────────────────────────

function PriceSummaryCard({
  eyeLabel,
  surgeryName,
  iolModelName,
  iolType,
  unitPrice,
  eyeSelection,
  requiresIol,
  laserProcedure,
  iclProcedure,
}: {
  eyeLabel: string;
  surgeryName: string;
  iolModelName?: string | null;
  iolType?: string | null;
  unitPrice?: number | null;
  eyeSelection?: EyeSelection;
  requiresIol?: boolean;
  laserProcedure?: boolean;
  iclProcedure?: boolean;
}) {
  const hasSelection = !!iolModelName;
  const total = eyeSelection && unitPrice != null ? totalPrice(unitPrice, eyeSelection) : null;

  return (
    <div className={cn(
      'p-3 rounded-xl border',
      hasSelection ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
    )}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-xs font-semibold text-gray-700 truncate">{eyeLabel}</p>
        {eyeSelection && (
          <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0', EYE_BADGE_COLOR[eyeSelection])}>
            {eyeSelection === 'Both' ? '× 2' : '× 1'}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 truncate mb-1.5">{surgeryName}</p>

      {hasSelection ? (
        <>
          <p className="text-xs font-semibold text-green-700 flex items-center gap-1">
            <Check className="h-3 w-3 flex-shrink-0" />
            {iolModelName}
          </p>
          {iolType && <p className="text-xs text-green-600">{iolType}</p>}
          {unitPrice != null && eyeSelection && (
            <div className="mt-1.5 pt-1.5 border-t border-green-200">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{formatINR(unitPrice)}/eye</span>
                {eyeSelection === 'Both' && (
                  <span className="text-xs text-teal-600">× 2 eyes</span>
                )}
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-xs font-bold text-gray-900">Total</span>
                <span className="text-sm font-bold text-green-700">{formatINR(total!)}</span>
              </div>
            </div>
          )}
        </>
      ) : laserProcedure ? (
        <p className="text-xs text-amber-600 flex items-center gap-1"><Zap className="h-3 w-3" /> Laser — no IOL</p>
      ) : iclProcedure ? (
        <p className="text-xs text-violet-600 flex items-center gap-1"><Info className="h-3 w-3" /> ICL — power by doctor</p>
      ) : requiresIol ? (
        <p className="text-xs text-amber-600">IOL not yet selected</p>
      ) : (
        <p className="text-xs text-gray-400">No IOL required</p>
      )}
    </div>
  );
}

// ─── Free-Browse Panel (no doctor recommendation) ────────────────────────────

function FreeBrowsePanel({
  branchId,
  iolState,
  onIOLSelect,
  onConfirm,
}: {
  branchId?: string;
  iolState: ProcedureIOLState;
  onIOLSelect: (key: string, iol: IolMasterDto | null, eyeSelection: EyeSelection) => void;
  onConfirm: () => void;
}) {
  const [categoryTab, setCategoryTab] = useState<SurgeryCategoryTab>('All');
  const [selectedProcedure, setSelectedProcedure] = useState<FlatVariantDto | null>(null);
  const [procEye, setProcEye] = useState<EyeSelection>('RE');
  const [iolTypeFilter, setIolTypeFilter] = useState<string>('All');

  // Auto-set eye when procedure changes based on its priceType
  useEffect(() => {
    if (!selectedProcedure) return;
    if (selectedProcedure.priceType === 'BOTH_EYES') setProcEye('Both');
    else setProcEye('RE');
  }, [selectedProcedure?.id]);

  const eyeBehavior: 'per-eye' | 'both-fixed' | 'no-eye' = selectedProcedure
    ? selectedProcedure.priceType === 'BOTH_EYES' ? 'both-fixed'
      : selectedProcedure.priceType === 'FIXED' ? 'no-eye'
      : 'per-eye'
    : 'per-eye';

  // B2.3 — catalog + master join (no legacy master-data.api surgery types)
  const { variants: allSurgeryTypes, loading: stLoading } = useCounsellorProcedureVariants(true);
  const visibleTypes = filterByCategory(allSurgeryTypes, categoryTab);

  // IOL catalog — only when Cataract + hasIolOptions procedure is selected
  const showIolPicker = !!selectedProcedure?.hasIolOptions && selectedProcedure.categoryCode.toLowerCase() === 'cataract';
  const { items: iolItems, loading: iolLoading } = useClinicalIolWithPricing(
    showIolPicker ? selectedProcedure?.id : undefined,
  );
  const iolData = showIolPicker ? buildCounsellorIolDtos(iolItems) : [];
  const filteredIols = filterIOLsByTab(iolData, iolTypeFilter);

  // Synthetic key for the selected procedure + eye
  const synthKey = selectedProcedure ? `${procEye}-${selectedProcedure.id}` : null;
  const synthSel = synthKey ? iolState[synthKey] : null;
  const canConfirm = !!selectedProcedure && (!showIolPicker || !!synthSel?.confirmed);

  // Pricing
  const procPrice = selectedProcedure
    ? (selectedProcedure.price ?? (selectedProcedure as FlatVariantDto & { defaultPrice?: number }).defaultPrice ?? null)
    : null;
  const procTotal = procPrice != null
    ? (eyeBehavior === 'per-eye' && procEye === 'Both' ? procPrice * 2 : procPrice)
    : null;

  return (
    <div className="flex h-full gap-3 p-3">
      {/* LEFT: category tabs + procedure list + optional IOL picker */}
      <div className="w-1/2 flex flex-col gap-3 overflow-y-auto hide-scrollbar min-h-0">
        {/* Info banner */}
        <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 font-medium flex-shrink-0">
          <Info className="h-4 w-4 flex-shrink-0 text-blue-500 mt-0.5" />
          No doctor recommendation yet. Browse all procedures below and select one.
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 flex-wrap flex-shrink-0">
          {SURGERY_CATEGORY_TABS.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => { setCategoryTab(cat); setSelectedProcedure(null); }}
              className={cn(
                'px-2.5 py-1 text-xs rounded-full border font-medium transition-all',
                categoryTab === cat
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
              )}
            >
              {CATEGORY_DISPLAY[cat] ?? cat}
            </button>
          ))}
        </div>

        {/* Procedure list */}
        {stLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />)}
          </div>
        ) : visibleTypes.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No procedures found.</p>
        ) : (
          <div className="space-y-1.5">
            {visibleTypes.map(st => {
              const price = st.price ?? (st as FlatVariantDto & { defaultPrice?: number }).defaultPrice ?? 0;
              const isSelected = selectedProcedure?.id === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => { setSelectedProcedure(st); setIolTypeFilter('All'); }}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-lg border-2 transition-all',
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200'
                      : 'border-gray-200 bg-white hover:border-indigo-300'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 leading-tight">{st.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{st.categoryName}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {price > 0 && (
                        <span className="text-xs font-semibold text-green-700 flex items-center gap-0.5">
                          <IndianRupee className="w-3 h-3" />{formatINR(price).replace('₹', '')}
                        </span>
                      )}
                      {isSelected && <Check className="h-4 w-4 text-indigo-600" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Eye selector for selected procedure */}
        {selectedProcedure && eyeBehavior !== 'no-eye' && (
          <div className="flex-shrink-0 border-t border-gray-100 pt-3">
            {eyeBehavior === 'both-fixed' ? (
              <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-teal-100 text-teal-800 text-xs font-semibold">
                Both Eyes (included in procedure price)
              </span>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-1.5 font-medium">Select eye(s):</p>
                <EyeToggle value={procEye} onChange={v => setProcEye(v)} />
              </>
            )}
          </div>
        )}

        {/* IOL picker — Cataract + requiresIol only */}
        {showIolPicker && (
          <div className="flex-shrink-0 border-t border-gray-100 pt-3 space-y-2">
            <p className="text-xs font-semibold text-gray-700">Select IOL lens:</p>
            <div className="flex gap-1 flex-wrap">
              {IOL_TYPE_TABS.map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setIolTypeFilter(tab)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-full border font-medium transition-all',
                    iolTypeFilter === tab
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
            {iolLoading ? (
              <div className="space-y-1.5">
                {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />)}
              </div>
            ) : filteredIols.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No IOLs found for this filter.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                {filteredIols.map(iol => (
                  <IOLCard
                    key={iol.id}
                    iol={iol}
                    selected={synthSel?.iolCatalogId === iol.id}
                    onSelect={() => synthKey && onIOLSelect(synthKey, iol, procEye)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT: Summary + Confirm */}
      <div className="w-1/2 flex flex-col gap-3">
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-3 overflow-y-auto hide-scrollbar flex flex-col gap-2 min-h-0">
          <h4 className="text-sm font-semibold text-gray-900 flex-shrink-0">Selection Summary</h4>

          {selectedProcedure ? (
            <>
              {/* Procedure card */}
              <div className="p-3 rounded-xl border bg-indigo-50 border-indigo-200">
                <p className="text-xs font-semibold text-indigo-600 mb-0.5">
                  {selectedProcedure.categoryName}
                </p>
                <p className="text-sm font-semibold text-gray-900">{selectedProcedure.name}</p>
                {eyeBehavior !== 'no-eye' && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', EYE_BADGE_COLOR[procEye])}>
                      {EYE_LABEL[procEye]}
                    </span>
                  </div>
                )}
                {procPrice != null && procTotal != null && (
                  <div className="mt-1.5 pt-1.5 border-t border-indigo-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {formatINR(procPrice)}{eyeBehavior === 'per-eye' && procEye === 'Both' ? '/eye' : ''}
                      </span>
                      {eyeBehavior === 'per-eye' && procEye === 'Both' && <span className="text-xs text-teal-600">× 2 eyes</span>}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs font-bold text-gray-900">Procedure Total</span>
                      <span className="text-sm font-bold text-indigo-700">{formatINR(procTotal)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* IOL summary if applicable */}
              {showIolPicker && synthSel?.confirmed ? (
                <PriceSummaryCard
                  eyeLabel={EYE_LABEL[procEye]}
                  surgeryName={synthSel.iolModelName ?? 'IOL'}
                  iolModelName={synthSel.iolModelName}
                  iolType={synthSel.iolType}
                  unitPrice={synthSel.unitPrice}
                  eyeSelection={procEye}
                  requiresIol
                />
              ) : showIolPicker ? (
                <div className="p-3 rounded-xl border border-amber-200 bg-amber-50">
                  <p className="text-xs font-semibold text-amber-700">IOL not yet selected</p>
                  <p className="text-xs text-amber-600 mt-0.5">Pick an IOL lens from the catalog on the left.</p>
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
              <Eye className="h-8 w-8 text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">No procedure selected</p>
              <p className="text-xs text-gray-300 mt-1">Browse categories and pick a procedure</p>
            </div>
          )}
        </div>

        <button
          onClick={onConfirm}
          disabled={!canConfirm}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold text-sm flex-shrink-0"
        >
          <Check className="h-4 w-4" />
          Confirm Procedure Counseling
        </button>
      </div>
    </div>
  );
}

// ─── Main Widget ──────────────────────────────────────────────────────────────

export default function IOLRecommendationWidget({
  patientId,
  sessionId,
  size,
  isMinimized,
  data,
  onAction,
  onDataChange,
}: WidgetProps) {
  const { user } = useAuthStore();
  const branchId = user?.branchId;

  const procedures = useMemo(() => parseProcedures(data.recommendedProcedures), [data.recommendedProcedures]);

  const [iolState, setIolState] = useState<ProcedureIOLState>(() =>
    (data.iolSelections as ProcedureIOLState) ?? {}
  );

  const handleIOLSelect = (key: string, iol: IolMasterDto | null, eyeSelection: EyeSelection) => {
    const unitPrice = iol ? (iol.price ?? (iol as IolMasterDto & { defaultPrice?: number }).defaultPrice ?? null) : null;
    const next: ProcedureIOLState = {
      ...iolState,
      [key]: iol
        ? { iolCatalogId: iol.id, iolModelName: iol.modelName, iolType: iol.iolType, confirmed: true, eyeSelection, unitPrice }
        : { iolCatalogId: null, iolModelName: null, iolType: null, confirmed: false, eyeSelection, unitPrice: null },
    };
    setIolState(next);
    onDataChange?.({ ...data, iolSelections: next });

    const updatedProcs = procedures.map(item => {
      const sel = next[itemKey(item)];
      if (!sel) return item;
      return { ...item, iolCatalogId: sel.iolCatalogId, iolModelName: sel.iolModelName, iolType: sel.iolType };
    });

    onAction?.({
      type: 'UPDATE_SESSION_PROCEDURES',
      payload: { recommendedProcedures: JSON.stringify(updatedProcs) },
      timestamp: new Date(),
    });
  };

  if (isMinimized) return null;

  if (procedures.length === 0) {
    return (
      <FreeBrowsePanel
        branchId={branchId}
        iolState={iolState}
        onIOLSelect={handleIOLSelect}
        onConfirm={() => onDataChange?.({ ...data, iolSelections: iolState, confirmed: true })}
      />
    );
  }

  if (size === 'small') {
    const confirmed = Object.values(iolState).filter(s => s.confirmed);
    return (
      <div className="space-y-2 p-2">
        <p className="text-xs font-semibold text-gray-500">IOL Selection</p>
        {confirmed.length === 0 && <p className="text-xs text-gray-400">No IOL selected</p>}
        {confirmed.map((s, i) => (
          <div key={i} className="bg-blue-50 rounded-lg p-2 border border-blue-200">
            <p className="text-xs font-medium text-blue-800">{s.iolModelName}</p>
            <p className="text-xs text-gray-500">{s.iolType}</p>
            {s.unitPrice != null && s.eyeSelection && (
              <p className="text-xs font-semibold text-green-700 mt-0.5">
                {formatINR(totalPrice(s.unitPrice, s.eyeSelection)!)}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }

  const needsIOL = procedures.filter(p => p.requiresIol);
  const confirmedCount = needsIOL.filter(p => iolState[itemKey(p)]?.confirmed).length;
  const allComplete = needsIOL.length > 0 && confirmedCount === needsIOL.length;

  // Grand total across all confirmed IOL selections
  const grandTotal = Object.values(iolState)
    .filter(s => s.confirmed && s.unitPrice != null && s.eyeSelection)
    .reduce((sum, s) => sum + (totalPrice(s.unitPrice!, s.eyeSelection!) ?? 0), 0);

  return (
    <div className="flex h-full gap-3 p-3">
      {/* LEFT: IOL catalog picker per procedure */}
      <div className="w-1/2 flex flex-col gap-3 overflow-y-auto hide-scrollbar">
        <div className="flex items-center justify-between flex-shrink-0">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {procedures.length} procedure{procedures.length !== 1 ? 's' : ''}
          </span>
          {needsIOL.length > 0 && (
            <span className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full',
              allComplete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            )}>
              {confirmedCount}/{needsIOL.length} selected
            </span>
          )}
        </div>
        <div className="space-y-3">
          {procedures.map((item, idx) => (
            <ProcedureSection key={idx} item={item} branchId={branchId} iolState={iolState} onIOLSelect={handleIOLSelect} />
          ))}
        </div>
      </div>

      {/* RIGHT: Selection summary with pricing */}
      <div className="w-1/2 flex flex-col gap-3">
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-3 overflow-y-auto hide-scrollbar flex flex-col min-h-0 gap-2">
          <h4 className="text-sm font-semibold text-gray-900 flex-shrink-0">Selection Summary</h4>
          {procedures.map((item, idx) => {
            const key = itemKey(item);
            const sel = iolState[key];
            return (
              <PriceSummaryCard
                key={idx}
                eyeLabel={EYE_LABEL[sel?.eyeSelection ?? item.eye] ?? item.eye}
                surgeryName={item.surgeryName}
                iolModelName={sel?.iolModelName}
                iolType={sel?.iolType}
                unitPrice={sel?.unitPrice}
                eyeSelection={sel?.eyeSelection ?? (item.eye as EyeSelection)}
                requiresIol={item.requiresIol}
                laserProcedure={item.laserProcedure}
                iclProcedure={item.iclProcedure}
              />
            );
          })}

          {/* Grand total */}
          {grandTotal > 0 && (
            <div className="mt-auto pt-3 border-t border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium">Grand Total (IOL only)</span>
                <span className="text-base font-bold text-gray-900">{formatINR(grandTotal)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Surgery fees billed separately</p>
            </div>
          )}
        </div>

        {allComplete && (
          <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-xl flex-shrink-0">
            <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
            <p className="text-xs font-medium text-green-800">All IOL selections complete</p>
          </div>
        )}

        <button
          onClick={() => onDataChange?.({ ...data, iolSelections: iolState, confirmed: true })}
          disabled={needsIOL.length > 0 && confirmedCount < needsIOL.length}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold text-sm flex-shrink-0"
        >
          <Check className="h-4 w-4" />
          Confirm IOL Selection
        </button>
      </div>
    </div>
  );
}
