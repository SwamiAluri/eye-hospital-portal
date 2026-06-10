/**
 * Payment Mode Selection Widget
 * Visual cards for 10 patient types: Cash, Insurance, CoPay, ESH, CGHS, Arograshree, SGHS, Camp, Railway, Free
 * Implements controlled mutability - locked after Financial stage
 */

'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import {
  Wallet, Shield, GitMerge, Building2, Flag, Leaf, Award, Users,
  Loader2, AlertCircle, Lock, Upload, FileText, Eye, X,
  Train, Heart, Banknote, CreditCard, ChevronRight, BadgeCheck, Clock, CircleCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetProps } from '@/lib/widgets/widget-types';
import { usePatientTypeMaster } from '@/hooks/use-patient-type-master';
import { useCounselingSession, useUpdateCounselingSession } from '@/hooks/use-counseling-sessions';
import { toast } from 'sonner';
import { CustomDocumentModal } from '@/components/widgets/CustomDocumentModal';

// ── Icon config per type ─────────────────────────────────────────────────────
const typeConfig: Record<string, {
  icon: React.ReactNode;
  iconLg: React.ReactNode;
  accent: string;       // Tailwind bg + border + text for selected card
  badge: string;        // pill badge classes
  dot: string;          // small dot indicator color
  category: 'direct' | 'government' | 'special';
  tag: string;          // short descriptor shown in badge
}> = {
  Cash: {
    icon: <Banknote className="h-4 w-4" />,
    iconLg: <Banknote className="h-6 w-6" />,
    accent: 'bg-emerald-50 border-emerald-300 text-emerald-800',
    badge: 'bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-500',
    category: 'direct',
    tag: 'Direct Pay',
  },
  Insurance: {
    icon: <Shield className="h-4 w-4" />,
    iconLg: <Shield className="h-6 w-6" />,
    accent: 'bg-blue-50 border-blue-300 text-blue-800',
    badge: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-500',
    category: 'direct',
    tag: 'TPA / Insurance',
  },
  CoPay: {
    icon: <GitMerge className="h-4 w-4" />,
    iconLg: <GitMerge className="h-6 w-6" />,
    accent: 'bg-violet-50 border-violet-300 text-violet-800',
    badge: 'bg-violet-100 text-violet-700',
    dot: 'bg-violet-500',
    category: 'direct',
    tag: 'Split Bill',
  },
  ESH: {
    icon: <Building2 className="h-4 w-4" />,
    iconLg: <Building2 className="h-6 w-6" />,
    accent: 'bg-orange-50 border-orange-300 text-orange-800',
    badge: 'bg-orange-100 text-orange-700',
    dot: 'bg-orange-500',
    category: 'government',
    tag: 'Govt Scheme',
  },
  CGHS: {
    icon: <Flag className="h-4 w-4" />,
    iconLg: <Flag className="h-6 w-6" />,
    accent: 'bg-red-50 border-red-300 text-red-800',
    badge: 'bg-red-100 text-red-700',
    dot: 'bg-red-500',
    category: 'government',
    tag: 'Central Govt',
  },
  Arograshree: {
    icon: <Leaf className="h-4 w-4" />,
    iconLg: <Leaf className="h-6 w-6" />,
    accent: 'bg-teal-50 border-teal-300 text-teal-800',
    badge: 'bg-teal-100 text-teal-700',
    dot: 'bg-teal-500',
    category: 'government',
    tag: 'State Scheme',
  },
  SGHS: {
    icon: <Award className="h-4 w-4" />,
    iconLg: <Award className="h-6 w-6" />,
    accent: 'bg-amber-50 border-amber-300 text-amber-800',
    badge: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
    category: 'government',
    tag: 'State Health',
  },
  Camp: {
    icon: <Users className="h-4 w-4" />,
    iconLg: <Users className="h-6 w-6" />,
    accent: 'bg-pink-50 border-pink-300 text-pink-800',
    badge: 'bg-pink-100 text-pink-700',
    dot: 'bg-pink-500',
    category: 'special',
    tag: 'Camp / Event',
  },
  Railway: {
    icon: <Train className="h-4 w-4" />,
    iconLg: <Train className="h-6 w-6" />,
    accent: 'bg-indigo-50 border-indigo-300 text-indigo-800',
    badge: 'bg-indigo-100 text-indigo-700',
    dot: 'bg-indigo-500',
    category: 'government',
    tag: 'RELHS',
  },
  Free: {
    icon: <Heart className="h-4 w-4" />,
    iconLg: <Heart className="h-6 w-6" />,
    accent: 'bg-rose-50 border-rose-300 text-rose-800',
    badge: 'bg-rose-100 text-rose-700',
    dot: 'bg-rose-500',
    category: 'special',
    tag: 'Charity',
  },
};

const categoryMeta: Record<string, { label: string; description: string; headerClass: string }> = {
  direct: {
    label: 'Direct Payment',
    description: 'Patient pays directly or via insurance',
    headerClass: 'text-slate-700',
  },
  government: {
    label: 'Government Schemes',
    description: 'Central / state health benefits',
    headerClass: 'text-slate-700',
  },
  special: {
    label: 'Special / Camp',
    description: 'Camp, charity or sponsored care',
    headerClass: 'text-slate-700',
  },
};

const PaymentModeSelectionWidget = memo(function PaymentModeSelectionWidget({
  widgetId,
  patientId,
  sessionId,
  size,
  isMinimized,
  data,
  onAction,
  onDataChange,
}: WidgetProps) {
  const { configs, loading: configsLoading, error: configsError } = usePatientTypeMaster();
  
  // Fetch current session to check if patient type is locked
  const { data: session, isLoading: sessionLoading } = useCounselingSession(sessionId || '', {
    enabled: !!sessionId,
  });
  
  // Update mutation
  const updateSessionMutation = useUpdateCounselingSession();

  // Local state
  const [selectedPatientType, setSelectedPatientType] = useState<string>(
    (data as any)?.selectedPaymentMode || (data as any)?.patientType || session?.patientType || ''
  );
  const [isConfirmed, setIsConfirmed] = useState<boolean>(
    (data as any)?.isConfirmed || false
  );
  const [uploadedFiles, setUploadedFiles] = useState<Array<{name: string; size: number; type: string; previewUrl?: string}>>([]);
  const [previewFile, setPreviewFile] = useState<{name: string; type: string; previewUrl: string} | null>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const initializedRef = useRef(false);

  // Check if patient type is locked (after Financial stage) - Memoized to prevent recalculation
  const lockStages = ['Financial', 'Consent', 'PreSurgery', 'Scheduling', 'Admission', 'Followup', 'Completed'];
  const currentStage = session?.currentStage || 'Initial';
  const isLocked = useMemo(() => lockStages.includes(currentStage), [currentStage]);

  const mergedConfigs = useMemo(
    () => (configs.length ? [...configs].sort((a, b) => a.displayOrder - b.displayOrder) : undefined),
    [configs],
  );

  // Sync with session data but DON'T auto-confirm in counselor workflow
  useEffect(() => {
    // Only initialize once
    if (initializedRef.current) return;
    
    if (session?.patientType && !selectedPatientType) {
      setSelectedPatientType(session.patientType);
      // Only auto-confirm if already in locked stages
      if (isLocked) {
        setIsConfirmed(true);
      }
      initializedRef.current = true;
    }
  }, [session?.patientType, selectedPatientType, isLocked]);

  // Debug logging - Only log when critical state changes
  useEffect(() => {
    console.log('💳 Payment Mode Widget State:', {
      configsLoading,
      hasError: !!configsError,
      errorMessage: configsError ? String(configsError) : null,
      configsCount: configs.length || 0,
      selectedPatientType,
      isConfirmed,
      isLocked,
      currentStage,
      sessionPatientType: session?.patientType,
      showDocumentModal,
    });
  }, [configsLoading, configsError, configs.length, selectedPatientType, isConfirmed, isLocked, currentStage, session?.patientType, showDocumentModal]);

  const handleCardClick = (patientType: string) => {
    if (isLocked) {
      toast.error(`Payment mode is locked after ${currentStage} stage`, {
        description: 'Cannot change patient type after financial stage begins',
      });
      return;
    }

    if (isConfirmed) {
      toast.warning('Payment mode already confirmed', {
        description: 'Click "Change" button to unlock selection',
      });
      return;
    }

    setSelectedPatientType(patientType);
    onDataChange?.({ 
      selectedPaymentMode: patientType,
      patientType: patientType // Keep both for compatibility
    });
    onAction?.({
      type: 'PATIENT_TYPE_SELECTED',
      payload: { patientType },
      timestamp: new Date(),
    });
  };

  const handleConfirm = async () => {
    if (!selectedPatientType) {
      toast.error('Please select a payment mode');
      return;
    }

    if (!sessionId) {
      toast.error('No active session');
      return;
    }

    // Optimistic update — confirm locally immediately so Next button is enabled
    setIsConfirmed(true);
    onDataChange?.({
      selectedPaymentMode: selectedPatientType,
      patientType: selectedPatientType,
      isConfirmed: true,
      confirmed: true,
    });
    onAction?.({
      type: 'PAYMENT_MODE_CONFIRMED',
      payload: { patientType: selectedPatientType },
      timestamp: new Date(),
    });
    toast.success('Payment mode confirmed', {
      description: `Selected: ${selectedPatientType}`,
    });

    // Async sync to backend (non-blocking for UX)
    const isMockSession = sessionId.includes('temp-session') || sessionId.includes('mock');
    if (!isMockSession) {
      try {
        await updateSessionMutation.mutateAsync({
          id: sessionId,
          data: { patientType: selectedPatientType },
        });
      } catch (error: any) {
        console.warn('⚠️ Payment mode sync to backend failed — confirmed locally:', error.message);
        // Don't revert UI — user can still proceed; backend will sync on next save
      }
    }
  };

  const handleChange = () => {
    if (isLocked) {
      toast.error(`Payment mode is locked after ${currentStage} stage`);
      return;
    }
    setIsConfirmed(false);
    onDataChange?.({ isConfirmed: false, confirmed: false });
  };

  // ── Shared document list renderer ────────────────────────────────────────
  const renderDocList = () => (
    <div className="flex-1 overflow-y-auto hide-scrollbar p-2.5">
      {uploadedFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center py-6">
          <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
            <FileText className="h-5 w-5 text-gray-300" />
          </div>
          <p className="text-xs font-medium text-gray-400">No documents yet</p>
          <p className="text-[10px] text-gray-300 mt-0.5">Click Upload to attach files</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {uploadedFiles.map((f, i) => (
            <li key={i} className="flex items-center gap-2 bg-white rounded-lg border border-gray-100 shadow-sm p-2 hover:border-gray-200 transition">
              {f.previewUrl && f.type.startsWith('image/') ? (
                <img src={f.previewUrl} alt={f.name} className="h-7 w-7 rounded object-cover flex-shrink-0 border border-gray-200" />
              ) : (
                <div className="h-7 w-7 rounded bg-blue-50 flex items-center justify-center flex-shrink-0 border border-blue-100">
                  <FileText className="h-3.5 w-3.5 text-blue-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">{f.name}</p>
                <p className="text-[10px] text-gray-400">{(f.size / 1024).toFixed(0)} KB</p>
              </div>
              {f.previewUrl && (
                <button
                  onClick={() => setPreviewFile({ name: f.name, type: f.type, previewUrl: f.previewUrl! })}
                  className="flex-shrink-0 p-1 rounded text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  title="Preview"
                >
                  <Eye className="h-3 w-3" />
                </button>
              )}
              <button
                onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))}
                className="flex-shrink-0 p-1 rounded text-red-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  // ── Render UI content based on state ────────────────────────────────────
  const renderContent = () => {
    // Loading state
    if (configsLoading || sessionLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-center p-6">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
          <p className="text-sm text-gray-500">Loading payment modes...</p>
        </div>
      );
    }

    // No patient selected
    if (!patientId) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-6">
          <Wallet className="h-12 w-12 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No patient selected</p>
          <p className="text-xs text-gray-400 mt-1">Select a patient to choose payment mode</p>
        </div>
      );
    }

    // Compact / minimized
    const isCompact = size === 'small' || isMinimized;
    if (isCompact && isConfirmed) {
      const cfg = mergedConfigs?.find((c) => c.patientType === selectedPatientType);
      const tc = typeConfig[selectedPatientType];
      return (
        <div className="p-3">
          <div className={cn('rounded-xl border-2 p-3 flex items-center gap-3', tc?.accent || 'bg-gray-50 border-gray-200')}>
            <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0', tc?.badge || 'bg-gray-100')}>
              {tc?.icon || <Wallet className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{cfg?.displayName || selectedPatientType}</p>
              {tc?.tag && <p className="text-[10px] text-gray-500 mt-0.5">{tc.tag}</p>}
            </div>
            <BadgeCheck className="h-5 w-5 text-green-500 flex-shrink-0" />
          </div>
        </div>
      );
    }

    // ── Helper: render a category group of mode buttons (left panel) ──────
    const renderModeGroup = (
      category: 'direct' | 'government' | 'special',
      configs: typeof mergedConfigs,
      locked: boolean,
    ) => {
      if (!configs) return null;
      const items = configs.filter((c) => (typeConfig[c.patientType]?.category ?? 'direct') === category);
      if (items.length === 0) return null;
      const meta = categoryMeta[category];
      return (
        <div key={category} className="space-y-1.5">
          <div className="flex items-center gap-2 px-1">
            <span className={cn('text-[10px] font-bold uppercase tracking-wider', meta.headerClass)}>{meta.label}</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          {items.map((c) => {
            const tc = typeConfig[c.patientType];
            const isSelected = selectedPatientType === c.patientType;
            return (
              <button
                key={c.id}
                onClick={() => handleCardClick(c.patientType)}
                disabled={locked}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left',
                  'transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
                  isSelected
                    ? cn(tc?.accent || 'bg-gray-50 border-gray-400', 'shadow-sm')
                    : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50 hover:shadow-sm',
                )}
              >
                {/* Colored icon box */}
                <div className={cn(
                  'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                  isSelected ? (tc?.badge || 'bg-gray-200') : 'bg-gray-100',
                )}>
                  {tc?.icon || <Wallet className="h-4 w-4 text-gray-500" />}
                </div>
                {/* Name + tag */}
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs font-semibold leading-tight truncate', isSelected ? '' : 'text-gray-800')}>
                    {c.displayName}
                  </p>
                  {tc?.tag && (
                    <p className={cn('text-[10px] mt-0.5', isSelected ? 'opacity-70' : 'text-gray-400')}>
                      {tc.tag}
                    </p>
                  )}
                </div>
                {/* Selected indicator */}
                {isSelected
                  ? <CircleCheck className="h-4 w-4 text-green-500 flex-shrink-0" />
                  : <ChevronRight className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                }
              </button>
            );
          })}
        </div>
      );
    };

    // ── Shared right-panel payment info chips ────────────────────────────
    const renderPaymentChips = (cfg: (typeof mergedConfigs)[0]) => {
      if (!cfg?.configuration) return null;
      return (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {cfg.configuration.zeroAdvancePayment && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              <CircleCheck className="h-2.5 w-2.5" /> Zero Advance
            </span>
          )}
          {cfg.configuration.requiresAdvancePayment && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              <CreditCard className="h-2.5 w-2.5" /> {cfg.configuration.advancePercentage ?? 0}% Advance
            </span>
          )}
          {cfg.configuration.requiresPreApproval && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              <Clock className="h-2.5 w-2.5" /> Pre-Approval
            </span>
          )}
        </div>
      );
    };

    // ── Shared documents panel ────────────────────────────────────────────
    const renderDocsPanel = () => (
      <div className="flex-1 flex flex-col border border-gray-100 rounded-xl overflow-hidden bg-white min-h-0">
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-gray-400" />
            <p className="text-xs font-semibold text-gray-700">
              Documents
              {uploadedFiles.length > 0 && (
                <span className="ml-1.5 text-green-600">({uploadedFiles.length})</span>
              )}
            </p>
          </div>
          <button
            onClick={() => setShowDocumentModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Upload className="h-3 w-3" />
            Upload
          </button>
        </div>
        {renderDocList()}
      </div>
    );

    // ── CONFIRMED state ───────────────────────────────────────────────────
    if (isConfirmed) {
      const cfg = mergedConfigs?.find((c) => c.patientType === selectedPatientType);
      const tc = typeConfig[selectedPatientType];
      return (
        <div className="flex h-full gap-0 overflow-hidden">
          {/* LEFT: slim read-only list */}
          <div className="w-[44%] flex flex-col gap-2 p-3 overflow-y-auto hide-scrollbar border-r border-gray-100">
            {/* Lock/confirmed banner */}
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0',
              isLocked ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-green-50 text-green-700 border border-green-200',
            )}>
              {isLocked
                ? <><Lock className="h-3 w-3" /> Locked at {currentStage}</>
                : <><BadgeCheck className="h-3 w-3" /> Payment Confirmed</>
              }
            </div>

            {/* Mode list — read-only */}
            {mergedConfigs && (
              <div className="space-y-1">
                {(['direct', 'government', 'special'] as const).map((cat) => {
                  const items = mergedConfigs.filter((c) => (typeConfig[c.patientType]?.category ?? 'direct') === cat);
                  if (!items.length) return null;
                  return (
                    <div key={cat} className="space-y-1">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 px-1 pt-1">
                        {categoryMeta[cat].label}
                      </p>
                      {items.map((c) => {
                        const itc = typeConfig[c.patientType];
                        const isSel = selectedPatientType === c.patientType;
                        return (
                          <div
                            key={c.id}
                            className={cn(
                              'flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-all',
                              isSel
                                ? cn(itc?.accent || 'bg-gray-50 border-gray-400', 'shadow-sm')
                                : 'bg-gray-50 border-transparent opacity-40',
                            )}
                          >
                            <div className={cn('h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0', isSel ? (itc?.badge || 'bg-gray-200') : 'bg-gray-200')}>
                              {itc?.icon || <Wallet className="h-3 w-3 text-gray-400" />}
                            </div>
                            <p className={cn('text-xs font-medium flex-1 truncate', isSel ? '' : 'text-gray-400')}>
                              {c.displayName}
                            </p>
                            {isSel && <CircleCheck className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {!isLocked && (
              <button
                onClick={handleChange}
                className="mt-auto w-full px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition flex-shrink-0"
              >
                Change Mode
              </button>
            )}
          </div>

          {/* RIGHT: confirmed hero + docs */}
          <div className="flex-1 flex flex-col gap-3 p-3 overflow-hidden min-h-0">
            {/* Hero card */}
            {cfg && (
              <div className={cn('rounded-xl border-2 p-3.5 flex-shrink-0', tc?.accent || 'bg-gray-50 border-gray-200')}>
                <div className="flex items-start gap-3">
                  <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0', tc?.badge || 'bg-gray-200')}>
                    {tc?.iconLg || <Wallet className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold leading-tight">{cfg.displayName}</p>
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', tc?.badge || 'bg-gray-100 text-gray-600')}>
                        {tc?.tag}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{cfg.description}</p>
                    {renderPaymentChips(cfg)}
                  </div>
                  <BadgeCheck className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                </div>
              </div>
            )}
            {renderDocsPanel()}
          </div>
        </div>
      );
    }

    // ── SELECTION state ───────────────────────────────────────────────────
    const selectedCfg = mergedConfigs?.find((c) => c.patientType === selectedPatientType);
    const selectedTc = typeConfig[selectedPatientType];

    return (
      <div className="flex h-full overflow-hidden">
        {/* LEFT: Categorized mode list */}
        <div className="w-[44%] flex flex-col gap-3 p-3 overflow-y-auto hide-scrollbar border-r border-gray-100">
          <div className="flex-shrink-0">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Payment Mode</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Choose how this patient pays</p>
          </div>

          {!mergedConfigs || mergedConfigs.length === 0 ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
              <AlertCircle className="h-6 w-6 text-red-400 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-red-900">No modes configured</p>
              {configsError && (
                <p className="text-[10px] text-red-600 mt-1">{String(configsError)}</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {(['direct', 'government', 'special'] as const).map((cat) =>
                renderModeGroup(cat, mergedConfigs, isLocked)
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Detail + confirm */}
        <div className="flex-1 flex flex-col gap-3 p-3 overflow-hidden min-h-0">
          {selectedPatientType && selectedCfg ? (
            <>
              {/* Selected mode hero */}
              <div className={cn('rounded-xl border-2 p-4 flex-shrink-0', selectedTc?.accent || 'bg-gray-50 border-gray-200')}>
                <div className="flex items-start gap-3">
                  <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm', selectedTc?.badge || 'bg-gray-200')}>
                    {selectedTc?.iconLg || <Wallet className="h-6 w-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold">{selectedCfg.displayName}</p>
                      {selectedTc?.tag && (
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', selectedTc.badge || 'bg-gray-100 text-gray-600')}>
                          {selectedTc.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-3">{selectedCfg.description}</p>
                    {renderPaymentChips(selectedCfg)}
                  </div>
                </div>
              </div>

              {/* Documents panel */}
              {renderDocsPanel()}

              {/* Confirm button */}
              <button
                onClick={handleConfirm}
                disabled={updateSessionMutation.isPending && !sessionId.includes('temp-session') && !sessionId.includes('mock')}
                className={cn(
                  'w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 flex-shrink-0',
                  'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
                  'disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 shadow-sm',
                )}
              >
                {updateSessionMutation.isPending && !sessionId.includes('temp-session') && !sessionId.includes('mock') ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Confirming...</>
                ) : (
                  <><BadgeCheck className="h-4 w-4" /> Confirm Payment Mode</>
                )}
              </button>
            </>
          ) : (
            /* Empty right state */
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                <CreditCard className="h-7 w-7 text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-500">Select a payment mode</p>
              <p className="text-xs text-gray-400 mt-1">Choose from the list on the left to see details and confirm</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Memoize requiredDocuments to prevent unnecessary re-renders
  const requiredDocuments = useMemo(() => {
    return mergedConfigs?.find((c) => c.patientType === selectedPatientType)
      ?.configuration?.requiredDocuments || [];
  }, [mergedConfigs, selectedPatientType]);

  // Handle modal complete
  const handleModalComplete = useCallback((docs: Array<{name: string; size: number; type: string; previewUrl?: string}>) => {
    setShowDocumentModal(false);
    if (docs.length > 0) {
      setUploadedFiles(prev => [...prev, ...docs]);
      toast.success(`${docs.length} document(s) uploaded successfully`);
    }
  }, []);

  // Main return with modal always accessible
  return (
    <>
      {renderContent()}
      
      {/* Custom Document Modal - No Radix UI Dialog issues */}
      <CustomDocumentModal
        sessionId={sessionId || ''}
        requiredDocuments={requiredDocuments}
        isOpen={showDocumentModal}
        onClose={() => setShowDocumentModal(false)}
        onComplete={handleModalComplete}
      />

      {/* File Preview Modal */}
      {previewFile && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setPreviewFile(null)}
          />
          {/* Modal */}
          <div className="relative z-10 bg-white rounded-xl shadow-2xl flex flex-col max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <p className="text-sm font-medium text-gray-800 truncate">{previewFile.name}</p>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="flex-shrink-0 ml-3 p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-50 p-4">
              {previewFile.type.startsWith('image/') ? (
                <img
                  src={previewFile.previewUrl}
                  alt={previewFile.name}
                  className="max-w-full max-h-[70vh] object-contain rounded shadow"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 text-gray-500 py-12">
                  <FileText className="h-16 w-16 text-gray-300" />
                  <p className="text-sm font-medium">{previewFile.name}</p>
                  <p className="text-xs text-gray-400">Preview not available for this file type.</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
});

export default PaymentModeSelectionWidget;
