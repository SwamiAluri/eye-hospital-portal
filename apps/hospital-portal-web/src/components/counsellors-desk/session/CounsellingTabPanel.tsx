'use client';

import { Search, X, Calendar, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { counsellingAzureApi } from '@/lib/api/counselling-azure.api';
import { priceSuffix, flattenCatalog } from '@/lib/api/service-catalog.api';
import { sanitizeVariantName } from '@/lib/utils/sanitize-names';
import { useAuthStore } from '@/lib/auth-store';
import {
  INSURANCE_COMPANY_FALLBACK,
  PACKAGE_OPTIONS,
  INSURANCE_PAYMENT_TYPES,
  formatTime,
} from '@/lib/counsellors-desk/session-utils';
import type {
  DecisionType,
  MasterCatalogItem,
  InvestigationItem,
  CombinedPaymentType,
  WaitingListStatus,
} from '@/types/counsellors-desk';
import type { PriceOverrideRecord } from '@/lib/api/counselling-azure.api';
import type { IolMasterDto, FlatVariantDto } from '@/lib/api/service-catalog.api';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';

export type CounsellingTabPanelProps = Record<(typeof BINDING_KEYS)[number], unknown>;

const BINDING_KEYS = ["isSurgeryDoneState","isDoneState","isRepeatState","isReadOnly","queueStatus","handleReEvaluate","handleStartRepeatSession","procExpanded","setProcExpanded","categoryFilter","setCategoryFilter","procSearch","setProcSearch","catalog","catalogLoading","catalogError","loadCatalog","selectedVariantId","selectedSurgeryId","selectedEye","setSelectedEye","setSelectedVariantId","setSelectedSurgeryId","variantSubOption","setVariantSubOption","iolOptions","selectedIolId","setSelectedIolId","selectedInvestigations","setSelectedInvestigations","toggleInvestigation","invTab","setInvTab","invExpanded","setInvExpanded","imagingSearch","setImagingSearch","labSearch","setLabSearch","masterCatalog","urgencyMode","savedOverrides","showOverridePanel","setShowOverridePanel","overridePrice","setOverridePrice","overrideReason","setOverrideReason","overrideRemarks","setOverrideRemarks","overrideRequesterType","setOverrideRequesterType","overrideStaffName","setOverrideStaffName","overrideStaffContact","setOverrideStaffContact","overrideSaving","overrideError","setOverrideError","setOverrideSaving","staffList","handleEditOverride","handleRemoveOverride","editingOverrideId","setEditingOverrideId","markDirty","session","paymentType","setPaymentType","insuranceCompany","setInsuranceCompany","insuranceProviderOptions","freeSurgeryReason","setFreeSurgeryReason","packageName","setPackageName","packageRate","setPackageRate","showPackageEdit","setShowPackageEdit","decision","setDecision","followUpReason","setFollowUpReason","followUpDate","setFollowUpDate","schedule","setIsScheduleModalOpen","counsellorNotes","setCounsellorNotes","patientRemarks","setPatientRemarks","doctorNotes","setDoctorNotes","openNotes","setOpenNotes","wantToSeeDoctor","setWantToSeeDoctor","interestedToUpgrade","setInterestedToUpgrade","notRequiredPreAuth","setNotRequiredPreAuth","sessionId","setQueueStatus","setSavedOverrides"] as const;

export function CounsellingTabPanel(props: CounsellingTabPanelProps) {
  const {
    isSurgeryDoneState,
    isDoneState,
    isRepeatState,
    isReadOnly,
    queueStatus,
    handleReEvaluate,
    handleStartRepeatSession,
    procExpanded,
    setProcExpanded,
    categoryFilter,
    setCategoryFilter,
    procSearch,
    setProcSearch,
    catalog,
    catalogLoading,
    catalogError,
    loadCatalog,
    selectedVariantId,
    selectedSurgeryId,
    selectedEye,
    setSelectedEye,
    setSelectedVariantId,
    setSelectedSurgeryId,
    variantSubOption,
    setVariantSubOption,
    iolOptions,
    selectedIolId,
    setSelectedIolId,
    selectedInvestigations,
    setSelectedInvestigations,
    toggleInvestigation,
    invTab,
    setInvTab,
    invExpanded,
    setInvExpanded,
    imagingSearch,
    setImagingSearch,
    labSearch,
    setLabSearch,
    masterCatalog,
    urgencyMode,
    savedOverrides,
    showOverridePanel,
    setShowOverridePanel,
    overridePrice,
    setOverridePrice,
    overrideReason,
    setOverrideReason,
    overrideRemarks,
    setOverrideRemarks,
    overrideRequesterType,
    setOverrideRequesterType,
    overrideStaffName,
    setOverrideStaffName,
    overrideStaffContact,
    setOverrideStaffContact,
    overrideSaving,
    overrideError,
    setOverrideError,
    setOverrideSaving,
    staffList,
    handleEditOverride,
    handleRemoveOverride,
    editingOverrideId,
    setEditingOverrideId,
    markDirty,
    session,
    paymentType,
    setPaymentType,
    insuranceCompany,
    setInsuranceCompany,
    insuranceProviderOptions,
    freeSurgeryReason,
    setFreeSurgeryReason,
    packageName,
    setPackageName,
    packageRate,
    setPackageRate,
    showPackageEdit,
    setShowPackageEdit,
    decision,
    setDecision,
    followUpReason,
    setFollowUpReason,
    followUpDate,
    setFollowUpDate,
    schedule,
    setIsScheduleModalOpen,
    counsellorNotes,
    setCounsellorNotes,
    patientRemarks,
    setPatientRemarks,
    doctorNotes,
    setDoctorNotes,
    openNotes,
    setOpenNotes,
    wantToSeeDoctor,
    setWantToSeeDoctor,
    interestedToUpgrade,
    setInterestedToUpgrade,
    notRequiredPreAuth,
    setNotRequiredPreAuth,
    sessionId,
    setQueueStatus,
    setSavedOverrides,
  } = props;

  return (
        <div className="flex-1 min-h-0 p-5 flex flex-col overflow-hidden">
            {/* Surgery Done read-only banner — replaces Done banner when surgery is completed */}
            {isSurgeryDoneState && (
              <div className="mb-4 flex items-center gap-3 px-4 py-2.5 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-800">
                <span>🏥</span>
                <span className="flex-1">Surgery <strong>completed</strong>. This session is <strong>read-only</strong> — re-evaluation is not available after surgery.</span>
              </div>
            )}

            {/* GAP 11: Done-state edit-mode banner */}
            {isDoneState && (
              <div className="mb-4 flex items-center gap-3 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
                <span>✅</span>
                <span className="flex-1">Session <strong>completed</strong>. You can update the package/price or reschedule below. To change the procedure, click <strong>Re-evaluate</strong> — this will reopen the session.</span>
                <button
                  type="button"
                  onClick={handleReEvaluate}
                  className="px-3 py-1 text-xs font-semibold bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors flex-shrink-0"
                >
                  Re-evaluate
                </button>
              </div>
            )}

            {/* Repeat-Counselling banner: patient needs another session */}
            {isRepeatState && (
              <div className="mb-4 flex items-center gap-3 px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-800">
                <span>🔄</span>
                <div className="flex-1">
                  <p className="font-semibold">Repeat Counselling Required</p>
                  <p className="text-xs text-orange-600 mt-0.5">Patient needs more time before deciding. Review the previous selection below and click <strong>Start Session</strong> when ready to begin counselling.</p>
                </div>
                <button
                  type="button"
                  onClick={handleStartRepeatSession}
                  className="px-3 py-1 text-xs font-semibold bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex-shrink-0 whitespace-nowrap"
                >
                  Start Session
                </button>
              </div>
            )}

            {/* AddOnSurgery banner: package was upgraded on a previously Done session */}
            {queueStatus === 'AddOnSurgery' && (
              <div className="mb-4 flex items-center gap-3 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-xl text-sm text-violet-800">
                <span>⬆️</span>
                <div className="flex-1">
                  <p className="font-semibold">Upgraded Case</p>
                  <p className="text-xs text-violet-600 mt-0.5">Package was upgraded on this completed session. Update the new package details and save to confirm the add-on surgery.</p>
                </div>
              </div>
            )}
            <div className="flex flex-col lg:flex-row gap-5 flex-1 min-h-0 lg:overflow-hidden overflow-y-auto">
              {/* LEFT: Surgery Selection */}
              <div className="w-full lg:w-1/3 flex-shrink-0 flex flex-col gap-3 lg:overflow-y-auto scrollbar-hide pb-4">
                <div className={`bg-gray-50 rounded-xl border border-gray-200 flex flex-col overflow-hidden ${procExpanded ? 'min-h-[360px]' : 'flex-shrink-0'}`}>
                  {/* Collapsible header */}
                  <button
                    type="button"
                    onClick={() => setProcExpanded(!procExpanded)}
                    className="w-full flex-shrink-0 flex items-center justify-between px-4 py-3 hover:bg-gray-100 transition-colors"
                  >
                    <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">1</span>
                      Procedures
                      {selectedSurgeryId && (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">1</span>
                      )}
                    </h3>
                    {/* Eye selector in header row */}
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400 mr-0.5">Eye:</span>
                        {(['RE', 'LE', 'BE'] as const).map((eye) => (
                          <button
                            key={eye}
                            type="button"
                            disabled={isReadOnly}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEye(eye);
                              // Update the eye badge on all Imaging/Scan investigation items
                              setSelectedInvestigations(prev => {
                                const next = new Map(prev);
                                next.forEach((inv, key) => {
                                  if (inv.testType !== 'Lab') {
                                    next.set(key, { ...inv, eye });
                                  }
                                });
                                return next;
                              });
                              if (selectedVariantId) {
                                setSelectedSurgeryId(`type-${selectedVariantId}-${eye}`);
                                markDirty();
                              }
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                              isReadOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                            } ${
                              selectedEye === eye
                                ? eye === 'RE'
                                  ? 'bg-orange-500 text-white border-orange-500'
                                  : eye === 'LE'
                                  ? 'bg-purple-500 text-white border-purple-500'
                                  : 'bg-green-500 text-white border-green-500'
                                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                            }`}
                          >
                            {eye === 'BE' ? 'Both' : eye}
                          </button>
                        ))}
                      </div>
                      {procExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    </div>
                  </button>

                  {procExpanded && (
                    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  {/* Sticky: category chips, search */}
                  <div className="flex-shrink-0 px-4 pb-2 pt-1">

                  {/* Category filter tabs (dynamic from service catalog) */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {['All', ...(catalog?.categories
                      .filter((c) => c.isActive && c.code !== 'DIAGNOSTICS' && c.code !== 'INVESTIGATIONS')
                      .map((c) => c.code) ?? [])
                    ].map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setCategoryFilter(f)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                          categoryFilter === f
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                        }`}
                      >
                        {f === 'All' ? 'All' : (catalog?.categories.find((c) => c.code === f)?.name ?? f)}
                      </button>
                    ))}
                  </div>

                  {/* Procedure search */}
                  <div className="relative mb-2">
                    <input
                      type="text"
                      value={procSearch}
                      onChange={(e) => setProcSearch(e.target.value)}
                      placeholder="Search procedures…"
                      className="w-full pl-7 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                    />
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    {procSearch && (
                      <button type="button" onClick={() => setProcSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <X size={11} />
                      </button>
                    )}
                  </div>

                  {/* Selection counter */}
                  {selectedSurgeryId && (
                    <p className="text-xs text-blue-700 font-semibold bg-blue-50 rounded-lg px-2.5 py-1 mb-3">
                      1 selected
                    </p>
                  )}
                  </div>{/* end sticky header */}
                  {/* Scrollable list */}
                  <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4 pb-4 pt-1">
                  {/* Procedures: sourced directly from service catalog — one card per variant with eye selector */}
                  {(() => {
                    // ── Loading state ──────────────────────────────────────
                    if (catalogLoading) {
                      return (
                        <div className="flex flex-col items-center justify-center py-8 gap-2">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
                          <p className="text-xs text-gray-400">Loading procedures…</p>
                        </div>
                      );
                    }

                    // ── Error state ───────────────────────────────────────
                    if (catalogError || !catalog) {
                      return (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                          <p className="text-xs text-gray-500 text-center">Unable to load procedures.</p>
                          <button
                            type="button"
                            onClick={loadCatalog}
                            className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                          >
                            Retry
                          </button>
                        </div>
                      );
                    }

                    // ── Full catalog loaded ────────────────────────────────
                    const EXCLUDED = new Set(['DIAGNOSTICS', 'INVESTIGATIONS']);
                    const allVariants: FlatVariantDto[] = flattenCatalog(catalog).filter((v) => !EXCLUDED.has(v.categoryCode));

                    // Doctor-recommended variantIds (from session if backend returned them)
                    const recommendedSet = new Set(
                      session.surgeries
                        .filter((s) => s.isRecommended && s.variantId)
                        .map((s) => s.variantId as string)
                    );

                    const filtered = allVariants.filter((v) =>
                      (categoryFilter === 'All' || v.categoryCode === categoryFilter) &&
                      (procSearch === '' || v.name.toLowerCase().includes(procSearch.toLowerCase()))
                    );

                    if (filtered.length === 0) {
                      return (
                        <p className="text-xs text-gray-400 text-center py-4">
                          {procSearch ? 'No procedures match your search' : 'No procedures match the selected filter'}
                        </p>
                      );
                    }

                    const recommended = filtered.filter((v) => recommendedSet.has(v.id));
                    const rest = filtered.filter((v) => !recommendedSet.has(v.id));

                    const grouped: Record<string, FlatVariantDto[]> = {};
                    rest.forEach((v) => {
                      const key = v.categoryName || 'Other';
                      if (!grouped[key]) grouped[key] = [];
                      grouped[key].push(v);
                    });
                    const categoryOrder = ['Cataract', 'Retina', 'Glaucoma', 'Cornea', 'IVT', 'Refractive', 'Other'];
                    const sortedKeys = Object.keys(grouped).sort((a, b) => {
                      const ai = categoryOrder.indexOf(a);
                      const bi = categoryOrder.indexOf(b);
                      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                    });

                    const VariantCard = ({ v, highlight }: { v: FlatVariantDto; highlight?: boolean }) => {
                      const isSelected = selectedVariantId === v.id;
                      const suffix = priceSuffix(v.priceType);
                      const eyeForVariant = v.priceType === 'BOTH_EYES' ? 'BE' : selectedEye;
                      const hasSubOpts = (v.subOptions?.length ?? 0) > 0;

                      const handleCardClick = () => {
                        if (isReadOnly) return;
                        // In Done state, clicking a different procedure reopens the session via re-evaluate
                        if (isDoneState && v.id !== selectedVariantId) {
                          handleReEvaluate();
                          return;
                        }
                        const eye = v.priceType === 'BOTH_EYES' ? 'BE' : selectedEye;
                        setSelectedVariantId(v.id);
                        setSelectedEye(eye);
                        setSelectedSurgeryId(`type-${v.id}-${eye}`);
                        setVariantSubOption(null);
                        markDirty();
                      };

                      return (
                        <div className={`text-left w-full rounded-lg border-2 overflow-hidden transition-all ${
                          isReadOnly ? 'opacity-60' : ''
                        } ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 shadow-sm'
                            : highlight
                            ? 'border-amber-300 bg-amber-50/60 hover:border-amber-400'
                            : 'border-gray-200 bg-white hover:border-blue-300'
                        }`}>
                          {/* Clickable card header */}
                          <div
                            role="button"
                            tabIndex={isReadOnly ? -1 : 0}
                            onClick={handleCardClick}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(); }}
                            className={`p-2.5 ${isReadOnly ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            {/* Radio + name */}
                            <div className="flex items-start gap-1.5 mb-1">
                              <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-colors ${
                                isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                              }`}>
                                {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full m-auto" />}
                              </div>
                              <p className={`text-xs font-medium leading-tight ${isSelected ? 'text-blue-900' : 'text-gray-800'}`}>
                                {sanitizeVariantName(v.name)}
                              </p>
                            </div>
                            {/* Price + selected-eye badge */}
                            <div className="flex items-center justify-between pl-5">
                              <p className={`text-xs font-bold ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                                ₹{v.price.toLocaleString('en-IN')}
                                {suffix && <span className="font-normal text-gray-400 ml-0.5">{suffix}</span>}
                              </p>
                              {isSelected && (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  eyeForVariant === 'RE'
                                    ? 'bg-orange-100 text-orange-700'
                                    : eyeForVariant === 'LE'
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  {eyeForVariant === 'BE' ? 'Both' : eyeForVariant}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Inline sub-option picker (staff-only, shown only when selected, sub-options exist, and no IOL picker) */}
                          {isSelected && hasSubOpts && !v.hasIolOptions && (
                            <div className="px-2.5 pb-2.5 border-t border-blue-200 pt-2">
                              <p className="text-[10px] text-blue-600 font-semibold mb-1.5 pl-5">
                                Select type <span className="text-red-500">*</span>
                              </p>
                              <div className="flex flex-wrap gap-1 pl-5">
                                {v.subOptions!.map(opt => (
                                  <button
                                    key={opt}
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setVariantSubOption(opt);
                                      markDirty();
                                    }}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                                      variantSubOption === opt
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'
                                    } ${isReadOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                              {!variantSubOption && (
                                <p className="text-[10px] text-amber-600 mt-1 pl-5">⚠ Required before saving</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    };

                    return (
                      <>
                        <div className="space-y-4 pr-0.5">
                          {/* ── Doctor's Recommendation ── */}
                          {recommended.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                <span>🩺</span> Doctor&apos;s Recommendation
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                {recommended.map((v) => (
                                  <VariantCard key={v.id} v={v} highlight />
                                ))}
                              </div>
                              {rest.length > 0 && (
                                <div className="mt-3 border-t border-gray-200 pt-1">
                                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">All Options</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* ── Catalog variants grouped by category ── */}
                          {sortedKeys.map((cat) => (
                            <div key={cat}>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                {cat}
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                {grouped[cat].map((v) => (
                                  <VariantCard key={v.id} v={v} />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        {!selectedSurgeryId && (
                          <p className="text-xs text-amber-600 mt-2 bg-amber-50 rounded-lg px-3 py-2">
                            ⚠ Select a procedure and eye (RE / LE / Both) to proceed
                          </p>
                        )}
                      </>
                    );
                  })()}

                  {/* IOL / Lens selector — shown when the selected procedure has lens options */}
                  {iolOptions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                        <span className="w-4 h-4 bg-indigo-600 text-white rounded-full text-[9px] flex items-center justify-center font-bold">L</span>
                        Select IOL / Lens
                      </p>
                      <div className="space-y-1 pr-0.5">
                        {iolOptions.map((iol) => (
                          <button
                            key={iol.id}
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => { setSelectedIolId(selectedIolId === iol.id ? null : iol.id); markDirty(); }}
                            className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                              selectedIolId === iol.id
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                                : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40 text-gray-700'
                            } ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <span className="font-medium truncate block">{iol.modelName}</span>
                                <span className="text-gray-400 text-[10px]">{iol.brandManufacturer}</span>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {iol.isDefault && (
                                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[9px] font-semibold">Default</span>
                                )}
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                  iol.origin === 'Indian' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                }`}>{iol.origin}</span>
                                <span className="font-semibold text-gray-600">₹{iol.price.toLocaleString('en-IN')}</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  </div>{/* end scrollable list */}
                    </div>
                  )}{/* end procExpanded */}
                </div>

                {/* ─────────────── Price Override Panel ─────────────── */}
                {selectedVariantId && (() => {
                  const selectedVariant = catalog ? flattenCatalog(catalog).find(v => v.id === selectedVariantId) : null;
                  if (!selectedVariant) return null;
                  const basePrice = selectedVariant.price;
                  const handleSaveOverride = async () => {
                    setOverrideError('');
                    const parsed = parseFloat(overridePrice);
                    if (!overridePrice || isNaN(parsed) || parsed <= 0) {
                      setOverrideError('Enter a valid price.');
                      return;
                    }
                    if (!overrideReason.trim()) {
                      setOverrideError('Reason is required.');
                      return;
                    }
                    setOverrideSaving(true);
                    try {
                      if (editingOverrideId) {
                        // ── Edit existing override ──
                        await counsellingAzureApi.updatePriceOverride(sessionId, editingOverrideId, {
                          overriddenPrice: parsed,
                          reason: overrideReason.trim(),
                          remarks: overrideRemarks.trim() || undefined,
                        });
                        // Refresh list from server to get updated data
                        const refreshed = await counsellingAzureApi.getPriceOverrides(sessionId);
                        setSavedOverrides(refreshed);
                        setEditingOverrideId(null);
                      } else {
                        // ── New override ──
                        await counsellingAzureApi.addPriceOverride(params.id as string, {
                          variantId: selectedVariant.id,
                          variantName: selectedVariant.name,
                          basePrice,
                          overriddenPrice: parsed,
                          priceType: selectedVariant.priceType,
                          reason: overrideReason.trim(),
                          remarks: overrideRemarks.trim() || undefined,
                          requestedByType: overrideRequesterType,
                          requestedByName: overrideRequesterType === 'STAFF' ? overrideStaffName : undefined,
                          requestedByContact: overrideRequesterType === 'STAFF' ? overrideStaffContact : undefined,
                          performedBy: 'counsellor',
                          tenantId: useAuthStore.getState().tenantId ?? '',
                        });
                        // Reload to get real IDs from server
                        const refreshed = await counsellingAzureApi.getPriceOverrides(sessionId);
                        setSavedOverrides(refreshed);
                        // Done → AddOnSurgery when a price override is saved from a completed session
                        if (isDoneState) {
                          counsellingAzureApi.addOnSurgery(sessionId, overrideReason.trim());
                          setQueueStatus('AddOnSurgery');
                          toast.success('Price override saved — session marked as Add-On Surgery');
                        }
                      }
                      setShowOverridePanel(false);
                      setOverridePrice('');
                      setOverrideReason('');
                      setOverrideRemarks('');
                      setOverrideStaffName('');
                      setOverrideStaffContact('');
                      setOverrideRequesterType('SELF');
                    } catch {
                      setOverrideError('Failed to save override. Please try again.');
                    } finally {
                      setOverrideSaving(false);
                    }
                  };
                  return (
                    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                      {/* Header row */}
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-amber-800">Quoted Price</span>
                          <span className="text-xs font-bold text-amber-900">₹{basePrice.toLocaleString('en-IN')}</span>
                          {savedOverrides.length > 0 && (
                            <span className="px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded-full text-[9px] font-semibold">
                              {savedOverrides.length} override{savedOverrides.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => {
                              if (showOverridePanel) {
                                setShowOverridePanel(false);
                                setEditingOverrideId(null);
                                setOverridePrice('');
                                setOverrideReason('');
                                setOverrideRemarks('');
                                setOverrideError('');
                              } else {
                                setShowOverridePanel(true);
                              }
                            }}
                            className="text-[10px] font-semibold text-amber-700 hover:text-amber-900 underline"
                          >
                            {showOverridePanel ? 'Cancel' : 'Modify Price'}
                          </button>
                        )}
                      </div>

                      {/* Saved overrides list with Edit / Remove */}
                      {savedOverrides.length > 0 && !showOverridePanel && (
                        <div className="space-y-1 mt-0.5">
                          {savedOverrides.map((ov) => (
                            <div key={ov.id} className="flex items-start justify-between gap-1 text-[10px] text-amber-700 bg-amber-100 rounded-lg px-2 py-1.5">
                              <span className="leading-snug">
                                <span className="font-semibold text-amber-900">₹{ov.overriddenPrice.toLocaleString('en-IN')}</span>
                                {' '}— {ov.reason}
                              </span>
                              {!isReadOnly && (
                                <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleEditOverride(ov)}
                                    className="font-medium text-amber-700 hover:text-amber-900 underline"
                                  >
                                    Edit
                                  </button>
                                  <span className="opacity-30">|</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOverride(ov.id)}
                                    className="font-medium text-red-500 hover:text-red-700 underline"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Override form */}
                      {showOverridePanel && (
                        <div className="mt-2 space-y-2">
                          {editingOverrideId && (
                            <p className="text-[10px] font-semibold text-amber-700 bg-amber-100 rounded px-2 py-1">
                              Editing existing override
                            </p>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-gray-600 mb-0.5">New Price (₹) <span className="text-red-500">*</span></label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={overridePrice}
                                onChange={e => setOverridePrice(e.target.value)}
                                placeholder={String(basePrice)}
                                className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-600 mb-0.5">Requester</label>
                              <select
                                value={overrideRequesterType}
                                onChange={e => setOverrideRequesterType(e.target.value as 'SELF' | 'STAFF')}
                                className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                              >
                                <option value="SELF">Self (Counsellor)</option>
                                <option value="STAFF">Another Staff Member</option>
                              </select>
                            </div>
                          </div>

                          {overrideRequesterType === 'STAFF' && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] text-gray-600 mb-0.5">Staff Member</label>
                                <select
                                  value={staffList.find(s => `${s.firstName} ${s.lastName}`.trim() === overrideStaffName)?.id ?? ''}
                                  onChange={e => {
                                    const staff = staffList.find(s => s.id === e.target.value);
                                    if (staff) {
                                      setOverrideStaffName(`${staff.firstName} ${staff.lastName}`.trim());
                                      setOverrideStaffContact(staff.phoneNumber || staff.email || '');
                                    } else {
                                      setOverrideStaffName('');
                                      setOverrideStaffContact('');
                                    }
                                  }}
                                  className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                                >
                                  <option value="">— Select staff —</option>
                                  {staffList.map(s => (
                                    <option key={s.id} value={s.id}>
                                      {`${s.firstName} ${s.lastName}`.trim()}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] text-gray-600 mb-0.5">Contact (phone / email)</label>
                                <input
                                  type="text"
                                  value={overrideStaffContact}
                                  onChange={e => setOverrideStaffContact(e.target.value)}
                                  placeholder="Auto-filled from staff record"
                                  className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                                />
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="block text-[10px] text-gray-600 mb-0.5">Reason <span className="text-red-500">*</span></label>
                            <input
                              type="text"
                              value={overrideReason}
                              onChange={e => setOverrideReason(e.target.value)}
                              placeholder="e.g. Doctor's discretion, financial hardship"
                              className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-gray-600 mb-0.5">Remarks (optional)</label>
                            <input
                              type="text"
                              value={overrideRemarks}
                              onChange={e => setOverrideRemarks(e.target.value)}
                              placeholder="Additional notes"
                              className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                            />
                          </div>

                          {overrideError && (
                            <p className="text-[10px] text-red-600">{overrideError}</p>
                          )}

                          <button
                            type="button"
                            disabled={overrideSaving}
                            onClick={handleSaveOverride}
                            className="w-full text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg py-1.5 transition-colors disabled:opacity-60"
                          >
                            {overrideSaving ? 'Saving…' : editingOverrideId ? 'Update Override' : 'Save Price Override'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Investigations */}
                <div className="bg-gray-50 rounded-xl border border-gray-200 flex-shrink-0 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setInvExpanded(!invExpanded)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-100 transition-colors"
                  >
                    <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <span className="w-5 h-5 bg-teal-600 text-white rounded-full text-xs flex items-center justify-center font-bold">2</span>
                      Investigations
                      {selectedInvestigations.size > 0 && (
                        <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded-full text-xs font-semibold">
                          {selectedInvestigations.size}
                        </span>
                      )}
                    </h3>
                    {invExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                  </button>

                  {invExpanded && (
                    <div className="flex flex-col overflow-hidden max-h-[22rem]">
                      {/* Sticky: tabs + search */}
                      <div className="flex-shrink-0 px-3 pt-1">
                      {/* Tabs */}
                      <div className="flex border-b border-gray-200 mb-0">
                        {([
                          { key: 'imaging_orders' as const, label: 'Imaging Orders' },
                          { key: 'required_investigations' as const, label: 'Required Investigations' },
                        ]).map(({ key, label }) => {
                          const items = key === 'imaging_orders'
                            ? [...masterCatalog.imaging, ...masterCatalog.scan]
                            : masterCatalog.lab;
                          const hasSelected = items.some((item) => selectedInvestigations.has(item.id));
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setInvTab(key)}
                              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                                invTab === key
                                  ? 'border-teal-500 text-teal-700'
                                  : 'border-transparent text-gray-500 hover:text-gray-700'
                              }`}
                            >
                              {label}
                              {hasSelected && (
                                <span className="w-1.5 h-1.5 bg-teal-500 rounded-full" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {/* Per-tab search (sticky) */}
                      {invTab === 'imaging_orders' && (
                        <div className="relative mt-2 mb-1">
                          <input type="text" value={imagingSearch} onChange={(e) => setImagingSearch(e.target.value)} placeholder="Search imaging & scans…" className="w-full pl-7 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400" />
                          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          {imagingSearch && (<button type="button" onClick={() => setImagingSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={11} /></button>)}
                        </div>
                      )}
                      {invTab === 'required_investigations' && (
                        <div className="relative mt-2 mb-1">
                          <input type="text" value={labSearch} onChange={(e) => setLabSearch(e.target.value)} placeholder="Search investigations…" className="w-full pl-7 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400" />
                          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          {labSearch && (<button type="button" onClick={() => setLabSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={11} /></button>)}
                        </div>
                      )}
                      </div>{/* end sticky header */}
                      {/* Scrollable list */}
                      <div className="flex-1 overflow-y-auto scrollbar-hide px-3 pb-3 pt-1">
                      {/* ── Imaging Orders tab ── */}
                      {invTab === 'imaging_orders' && (() => {
                        const allImaging = [...masterCatalog.imaging, ...masterCatalog.scan];
                        const filteredImaging = imagingSearch
                          ? allImaging.filter((i) => i.name.toLowerCase().includes(imagingSearch.toLowerCase()))
                          : allImaging;
                        const categoryOrder = ['Consultation Charges', 'Diagnostic Scans', 'Laser Procedures', 'Minor Procedures'];
                        const grouped: Record<string, MasterCatalogItem[]> = {};
                        filteredImaging.forEach((item) => {
                          const cat = item.category ?? 'Other';
                          if (!grouped[cat]) grouped[cat] = [];
                          grouped[cat].push(item);
                        });
                        const sortedCats = [
                          ...categoryOrder.filter((c) => grouped[c]),
                          ...Object.keys(grouped).filter((c) => !categoryOrder.includes(c)),
                        ];

                        return (
                          <>
                            {sortedCats.length === 0 ? (
                              <p className="text-xs text-gray-400 text-center py-3">
                                {imagingSearch ? 'No results match your search' : 'No imaging items available'}
                              </p>
                            ) : (
                              <div className="space-y-2">
                            {sortedCats.map((cat) => (
                              <div key={cat}>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-1 py-1 sticky top-0 bg-gray-50">
                                  {cat}
                                </p>
                                <div className="space-y-1">
                                  {grouped[cat].map((item) => {
                                    const isSelected = selectedInvestigations.has(item.id);
                                    const inv = selectedInvestigations.get(item.id);
                                    const isDoctorSuggested = inv?.source === 'doctor';
                                    return (
                                      <button
                                        key={item.id}
                                        type="button"
                                        disabled={isReadOnly}
                                        onClick={() => { if (!isReadOnly) toggleInvestigation(item); }}
                                        className={`w-full text-left flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-all ${
                                          isSelected
                                            ? 'bg-teal-50 border border-teal-300'
                                            : 'hover:bg-gray-100 border border-transparent'
                                        } ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                      >
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <div className={`w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                                            isSelected ? 'bg-teal-600 border-teal-600' : 'border-gray-400'
                                          }`}>
                                            {isSelected && <span className="text-white leading-none" style={{ fontSize: '8px' }}>✓</span>}
                                          </div>
                                          <span className={`truncate ${isSelected ? 'text-teal-800 font-medium' : 'text-gray-700'}`}>{item.name}</span>
                                          {isDoctorSuggested && (
                                            <span className="px-1 py-0.5 bg-blue-100 text-blue-600 rounded text-[9px] font-semibold flex-shrink-0">🩺 Dr</span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                                          <span className={`font-semibold ${isSelected ? 'text-teal-700' : 'text-gray-500'}`}>
                                            ₹{(item.price ?? 0).toLocaleString('en-IN')}
                                          </span>
                                          {['Diagnostic Scans', 'Laser Procedures', 'Minor Procedures'].includes(item.category ?? '') && (
                                            <span className="text-gray-400 text-[9px]">/eye</span>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* ── Required Investigations tab ── */}
                      {invTab === 'required_investigations' && (() => {
                        const categoryOrder = ['General Investigations', 'Cardiac Investigations', 'Viral Markers', 'Pre-Operative Panel'];
                        const grouped: Record<string, MasterCatalogItem[]> = {};
                        const labQ = labSearch.toLowerCase();
                        masterCatalog.lab.forEach((item) => {
                          if (labQ && !item.name.toLowerCase().includes(labQ)) return;
                          const cat = item.category ?? 'Other';
                          if (!grouped[cat]) grouped[cat] = [];
                          grouped[cat].push(item);
                        });
                        // Append INVESTIGATIONS variants from service catalog into Pre-Operative Panel
                        const investigationVariants = catalog?.categories
                          .find(c => c.code === 'INVESTIGATIONS')
                          ?.services.flatMap(svc => svc.variants) ?? [];
                        investigationVariants.forEach((v) => {
                          if (labQ && !v.name.toLowerCase().includes(labQ)) return;
                          const cat = 'Pre-Operative Panel';
                          if (!grouped[cat]) grouped[cat] = [];
                          if (!grouped[cat].some(existing => existing.id === v.id)) {
                            grouped[cat].push({
                              id: v.id,
                              name: v.name,
                              code: v.code,
                              category: cat,
                              testType: 'Lab' as const,
                              price: v.price,
                            });
                          }
                        });
                        const sortedCats = [
                          ...categoryOrder.filter((c) => grouped[c]),
                          ...Object.keys(grouped).filter((c) => !categoryOrder.includes(c)),
                        ];

                        return (
                          <>
                            {sortedCats.length === 0 ? (
                              <p className="text-xs text-gray-400 text-center py-3">
                                {labSearch ? 'No results match your search' : 'No lab items available'}
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {sortedCats.map((cat) => (
                                  <div key={cat}>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-1 py-1 sticky top-0 bg-gray-50">
                                      {cat}
                                    </p>
                                    <div className="space-y-1">
                                      {grouped[cat].map((item) => {
                                        const isSelected = selectedInvestigations.has(item.id);
                                        const inv = selectedInvestigations.get(item.id);
                                        const isDoctorSuggested = inv?.source === 'doctor';
                                        const urgencyTag = inv?.urgency;
                                        return (
                                          <button
                                            key={item.id}
                                            type="button"
                                            disabled={isReadOnly}
                                            onClick={() => { if (!isReadOnly) toggleInvestigation(item); }}
                                            className={`w-full text-left flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-all ${
                                              isSelected
                                                ? 'bg-teal-50 border border-teal-300'
                                                : 'hover:bg-gray-100 border border-transparent'
                                            } ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                          >
                                            <div className="flex items-center gap-1.5 min-w-0">
                                              <div className={`w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                                                isSelected ? 'bg-teal-600 border-teal-600' : 'border-gray-400'
                                              }`}>
                                                {isSelected && <span className="text-white leading-none" style={{ fontSize: '8px' }}>✓</span>}
                                              </div>
                                              <span className={`truncate ${isSelected ? 'text-teal-800 font-medium' : 'text-gray-700'}`}>{item.name}</span>
                                              {isDoctorSuggested && (
                                                <span className="px-1 py-0.5 bg-blue-100 text-blue-600 rounded text-[9px] font-semibold flex-shrink-0">🩺 Dr</span>
                                              )}
                                              {isSelected && urgencyTag && urgencyTag !== 'Routine' && (
                                                <span className={`px-1 py-0.5 rounded text-[9px] font-semibold flex-shrink-0 ${
                                                  urgencyTag === 'STAT'
                                                    ? 'bg-red-100 text-red-700'
                                                    : 'bg-orange-100 text-orange-700'
                                                }`}>
                                                  {urgencyTag}
                                                </span>
                                              )}
                                            </div>
                                            <span className={`font-semibold flex-shrink-0 ml-1 ${isSelected ? 'text-teal-700' : 'text-gray-500'}`}>
                                              ₹{(item.price ?? 0).toLocaleString('en-IN')}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* Summary */}
                      {selectedInvestigations.size > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {Array.from(selectedInvestigations.values()).map((inv) => (
                              <span
                                key={inv.catalogId ?? inv.testName}
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                  inv.urgency === 'STAT'
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : inv.urgency === 'Urgent'
                                    ? 'bg-orange-50 text-orange-700 border-orange-200'
                                    : 'bg-teal-50 text-teal-700 border-teal-200'
                                }`}
                              >
                                {inv.testName}
                                {inv.urgency !== 'Routine' && (
                                  <span className="opacity-70"> · {inv.urgency}</span>
                                )}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500">
                            {selectedInvestigations.size} selected ·{' '}
                            <span className="text-teal-700 font-semibold">
                              ₹{Array.from(selectedInvestigations.values()).reduce((s, i) => s + i.price, 0).toLocaleString('en-IN')}
                            </span>
                          </p>
                        </div>
                      )}
                      </div>{/* end scrollable list */}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: Form */}
              <div className="flex-1 min-w-0 overflow-y-auto scrollbar-hide space-y-4 pb-4">
                {/* Counselling Summary — always visible; shows placeholder when nothing is selected */}
                {(() => {
                  const summaryVariant = catalog ? flattenCatalog(catalog).find(v => v.id === selectedVariantId) : null;
                  const displayPrice: number | null = summaryVariant
                    ? (savedOverrides.length > 0 ? savedOverrides[0].overriddenPrice : summaryVariant.price)
                    : null;
                  const eyeForSummary = summaryVariant?.priceType === 'BOTH_EYES' ? 'BE' : selectedEye;
                  const summaryIol = iolOptions.find(i => i.id === selectedIolId) ?? null;

                  // Eye-specific imaging/scan IDs (charged per-eye)
                  const eyeSpecificInvIds = new Set<string>(
                    [...masterCatalog.imaging, ...masterCatalog.scan]
                      .filter(i => ['Diagnostic Scans', 'Laser Procedures', 'Minor Procedures'].includes(i.category ?? ''))
                      .map(i => i.id)
                  );

                  // Split investigations into imaging/scans vs lab
                  const allInvList = Array.from(selectedInvestigations.values());
                  const imagingList = allInvList.filter(inv => inv.testType === 'Imaging' || inv.testType === 'Scan');
                  const labList    = allInvList.filter(inv => inv.testType !== 'Imaging' && inv.testType !== 'Scan');
                  const imagingTotal = imagingList.reduce((s, i) => s + i.price, 0);
                  const labTotal     = labList.reduce((s, i) => s + i.price, 0);
                  const grandTotal   = (displayPrice ?? 0) + (summaryIol?.price ?? 0) + imagingTotal + labTotal;
                  const hasSurgery   = !!(summaryVariant || summaryIol);

                  if (!hasSurgery && allInvList.length === 0) return (
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <span className="w-5 h-5 bg-indigo-600 text-white rounded-full text-xs flex items-center justify-center">✓</span>
                        Counselling Summary
                      </h3>
                      {(queueStatus === 'RepeatCounselling' || queueStatus === 'Processed' || queueStatus === 'Done') ? (
                        <div className="text-center py-3">
                          <p className="text-xs text-amber-600 font-medium">Previous procedure selection could not be restored.</p>
                          <p className="text-xs text-gray-400 mt-1">Select a procedure from the left panel and save to anchor the selection.</p>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-4">
                          Select a procedure or add investigations to see the cost breakdown.
                        </p>
                      )}
                    </div>
                  );

                  return (
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <h3 className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-2 uppercase tracking-wide">
                        <span className="w-4 h-4 bg-indigo-600 text-white rounded-full text-[9px] flex items-center justify-center">✓</span>
                        Counselling Summary
                      </h3>

                      {/* Entire summary is a 2-col grid: [label | price] — guarantees one shared price column */}
                      <div className="grid grid-cols-[1fr_minmax(6rem,auto)] gap-y-1.5 items-center">

                        {/* ── Surgery / Procedure ── */}
                        {hasSurgery && (
                          <>
                            <p className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider pt-1 pb-0.5">Surgery / Procedure</p>

                            {summaryVariant && displayPrice !== null && (
                              <>
                                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                  <span className="font-semibold text-sm text-gray-800 truncate">{sanitizeVariantName(summaryVariant.name)}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${
                                    eyeForSummary === 'RE' ? 'bg-orange-100 text-orange-700' :
                                    eyeForSummary === 'LE' ? 'bg-purple-100 text-purple-700' :
                                    'bg-green-100 text-green-700'
                                  }`}>{eyeForSummary === 'BE' ? 'Both' : eyeForSummary}</span>
                                </div>
                                <span className="font-bold text-sm text-gray-900 text-right tabular-nums">
                                  ₹{displayPrice.toLocaleString('en-IN')}
                                  {priceSuffix(summaryVariant.priceType) && (
                                    <span className="font-normal text-gray-400 text-xs ml-0.5">{priceSuffix(summaryVariant.priceType)}</span>
                                  )}
                                </span>
                              </>
                            )}

                            {summaryIol && (
                              <>
                                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                  <span className="text-gray-400 text-[9px] font-bold uppercase flex-shrink-0 bg-gray-100 px-1.5 py-0.5 rounded">IOL</span>
                                  <span className="font-semibold text-sm text-gray-700 truncate">{summaryIol.modelName}</span>
                                  <span className="text-gray-400 text-[10px] flex-shrink-0">{summaryIol.brandManufacturer}</span>
                                </div>
                                <span className="font-bold text-sm text-gray-700 text-right tabular-nums">₹{summaryIol.price.toLocaleString('en-IN')}</span>
                              </>
                            )}
                          </>
                        )}

                        {/* ── Imaging / Scans ── */}
                        {imagingList.length > 0 && (
                          <>
                            <div className="col-span-2 border-t border-gray-100 mt-1" />
                            <p className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider pt-1 pb-0.5">Imaging / Scans</p>

                            {imagingList.map(inv => (
                              <>
                                <div key={`name-${inv.catalogId ?? inv.testName}`} className="flex items-center gap-1 min-w-0 pl-2 pr-2">
                                  <span className="text-blue-400 flex-shrink-0" style={{ fontSize: 8 }}>●</span>
                                  <span className="text-sm text-gray-700 truncate">{inv.testName}</span>
                                  {inv.eye && (
                                    <span className={`px-1 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${
                                      inv.eye === 'RE' ? 'bg-orange-100 text-orange-700' :
                                      inv.eye === 'LE' ? 'bg-purple-100 text-purple-700' :
                                      'bg-green-100 text-green-700'
                                    }`}>{inv.eye === 'BE' ? 'Both' : inv.eye}</span>
                                  )}
                                </div>
                                <span key={`price-${inv.catalogId ?? inv.testName}`} className="font-medium text-sm text-gray-800 text-right tabular-nums">₹{inv.price.toLocaleString('en-IN')}</span>
                              </>
                            ))}

                            {/* Imaging Subtotal */}
                            <div className="col-span-2 border-t border-dashed border-blue-100 mt-0.5" />
                            <span className="text-sm font-bold text-blue-600 pl-2">Imaging Total</span>
                            <span className="text-sm font-bold text-blue-700 text-right tabular-nums">₹{imagingTotal.toLocaleString('en-IN')}</span>
                          </>
                        )}

                        {/* ── Investigations (Lab) ── */}
                        {labList.length > 0 && (
                          <>
                            <div className="col-span-2 border-t border-gray-100 mt-1" />
                            <p className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider pt-1 pb-0.5">Investigations</p>

                            {labList.map(inv => (
                              <>
                                <div key={`name-${inv.catalogId ?? inv.testName}`} className="flex items-center gap-1 min-w-0 pl-2 pr-2">
                                  <span className="text-teal-400 flex-shrink-0" style={{ fontSize: 8 }}>●</span>
                                  <span className="text-sm text-gray-700 truncate">{inv.testName}</span>
                                </div>
                                <span key={`price-${inv.catalogId ?? inv.testName}`} className="font-medium text-sm text-gray-800 text-right tabular-nums">₹{inv.price.toLocaleString('en-IN')}</span>
                              </>
                            ))}

                            {/* Lab Subtotal */}
                            <div className="col-span-2 border-t border-dashed border-teal-100 mt-0.5" />
                            <span className="text-sm font-bold text-teal-600 pl-2">Lab Total</span>
                            <span className="text-sm font-bold text-teal-700 text-right tabular-nums">₹{labTotal.toLocaleString('en-IN')}</span>
                          </>
                        )}

                        {/* ── Grand Total ── */}
                        <div className="col-span-2 border-t-2 border-gray-300 mt-2" />
                        <span className="font-bold text-base text-gray-900">Grand Total</span>
                        <span className="font-extrabold text-lg text-indigo-700 text-right tabular-nums">₹{grandTotal.toLocaleString('en-IN')}</span>

                        {/* ── Package Quote (optional, inline editable) ── */}
                        {!showPackageEdit && (packageName || Number(packageRate) > 0) ? (
                          <>
                            <div className="col-span-2 border-t border-dashed border-indigo-200 mt-1" />
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <span className="text-indigo-400 text-base flex-shrink-0">📦</span>
                              <div className="min-w-0 flex-1">
                                <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider block">Package Opted</span>
                                <span className="font-bold text-base text-indigo-700 truncate block">{packageName || '—'}</span>
                              </div>
                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() => setShowPackageEdit(true)}
                                  className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                                >
                                  ✎ Edit
                                </button>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-semibold text-green-500 uppercase tracking-wider block">Best Price</span>
                              <span className="font-extrabold text-lg text-indigo-700 tabular-nums">
                                {Number(packageRate) > 0 ? `₹${Number(packageRate).toLocaleString('en-IN')}` : '—'}
                              </span>
                            </div>
                          </>
                        ) : !showPackageEdit && !isReadOnly ? (
                          <div className="col-span-2 pt-1">
                            <button type="button" onClick={() => setShowPackageEdit(true)} className="text-xs text-gray-400 hover:text-indigo-600 underline transition-colors">+ Add package quote</button>
                          </div>
                        ) : null}

                      </div>

                      {/* Package edit form (outside grid) */}
                      {showPackageEdit && (
                        <div className="pt-3 mt-2 border-t border-dashed border-indigo-200">
                          <div className="flex flex-wrap items-end gap-3">
                            {/* Package Name — Radix Select */}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Package Name</label>
                              <Select
                                value={packageName || undefined}
                                onValueChange={(v) => { setPackageName(v); markDirty(); }}
                              >
                                <SelectTrigger className="w-auto min-w-[10rem] max-w-[18rem]">
                                  <SelectValue placeholder="Select package" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PACKAGE_OPTIONS.map(o => (
                                    <SelectItem key={o} value={o}>{o}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {/* Package Rate */}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Rate (₹)</label>
                              <input
                                type="number"
                                placeholder="0"
                                value={packageRate}
                                onChange={e => { setPackageRate(e.target.value ? Number(e.target.value) : ''); markDirty(); }}
                                className="h-10 w-28 border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 tabular-nums"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end mt-3">
                            <button type="button" onClick={() => setShowPackageEdit(false)} className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg">Cancel</button>
                            <button type="button" onClick={() => { setShowPackageEdit(false); markDirty(); }} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Set</button>
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })()}
                {/* Patient Info Form */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">2</span>
                    Patient & Payment Details
                  </h3>
                  <div className="space-y-3">
                    {/* Payment Type + Insurance Company side by side */}
                    <div className="flex flex-wrap items-end gap-3">
                      {/* Payment type */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Payment Type <span className="text-red-500">*</span></label>
                        <Select
                          value={paymentType || undefined}
                          onValueChange={(v) => { setPaymentType(v as CombinedPaymentType | ''); markDirty(); }}
                          disabled={isReadOnly}
                        >
                          <SelectTrigger className="w-auto min-w-[9rem] max-w-[16rem]">
                            <SelectValue placeholder="Select payment type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>Self Pay</SelectLabel>
                              <SelectItem value="Cash">Cash</SelectItem>
                              <SelectItem value="Card">Card</SelectItem>
                              <SelectItem value="UPI">UPI</SelectItem>
                            </SelectGroup>
                            <SelectGroup>
                              <SelectLabel>Insurance</SelectLabel>
                              <SelectItem value="Insurance">Insurance / TPA</SelectItem>
                              <SelectItem value="CoPay">Co-Pay</SelectItem>
                            </SelectGroup>
                            <SelectGroup>
                              <SelectLabel>Government Schemes</SelectLabel>
                              <SelectItem value="CGHS">CGHS</SelectItem>
                              <SelectItem value="ESH">ESH</SelectItem>
                              <SelectItem value="Arograshree">Arograshree</SelectItem>
                              <SelectItem value="SGHS">SGHS</SelectItem>
                              <SelectItem value="Railway">Railway / RELHS</SelectItem>
                            </SelectGroup>
                            <SelectGroup>
                              <SelectLabel>Special</SelectLabel>
                              <SelectItem value="Camp">Camp / Event</SelectItem>
                              <SelectItem value="Free">Free</SelectItem>
                              <SelectItem value="Staff">Staff</SelectItem>
                              <SelectItem value="ForeignNational">Foreign National</SelectItem>
                              <SelectItem value="Package">Custom Package</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Insurance company — shown inline when applicable */}
                      {INSURANCE_PAYMENT_TYPES.includes(paymentType as CombinedPaymentType) && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Insurance Company</label>
                          <Select
                            value={insuranceCompany || undefined}
                            onValueChange={(v) => { setInsuranceCompany(v); markDirty(); }}
                            disabled={isReadOnly}
                          >
                            <SelectTrigger className="w-auto min-w-[9rem] max-w-[16rem]">
                              <SelectValue placeholder="Select company" />
                            </SelectTrigger>
                            <SelectContent>
                              {insuranceProviderOptions.map(o => (
                                <SelectItem key={o.value} value={o.label}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    {/* Free surgery reason — shown only when type is Free */}
                    {paymentType === 'Free' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Free Surgery Reason</label>
                        <input
                          type="text"
                          placeholder="Enter reason"
                          value={freeSurgeryReason}
                          onChange={(e) => { setFreeSurgeryReason(e.target.value); markDirty(); }}
                          disabled={isReadOnly}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Decision */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">3</span>
                    Decision
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {([
                      { value: 'DateForSurgery', label: 'Date for Surgery / Procedure' },
                      { value: 'Interested', label: 'Interested' },
                      { value: 'NotInterested', label: 'Not Interested' },
                      { value: 'NeedsTime', label: 'Needs Time / Follow-up' },
                    ] as const).map(({ value, label }) => (
                      <label key={value} className={`flex items-center gap-2 ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="radio"
                          name="decision"
                          value={value}
                          checked={decision === value}
                          onChange={() => { if (!isReadOnly) { setDecision(value); markDirty(); } }}
                          disabled={isReadOnly}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                  {/* GAP 3: follow-up fields for NeedsTime / NotInterested */}
                  {(decision === 'NotInterested' || decision === 'NeedsTime') && (
                    <div className="mt-4 space-y-3 border-t border-gray-100 pt-3">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold border border-yellow-300">
                          ⚠ Follow-up Required
                        </span>
                        <span className="text-xs text-gray-500">
                          {decision === 'NeedsTime' ? 'Patient needs more time before deciding' : 'Patient will be tagged for follow-up'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Follow-up Reason</label>
                          <select
                            value={followUpReason}
                            onChange={(e) => { setFollowUpReason(e.target.value); markDirty(); }}
                            disabled={isReadOnly}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                          >
                            <option value="">Select reason…</option>
                            <option value="Discuss with Family">Discuss with Family</option>
                            <option value="Financial Planning">Financial Planning</option>
                            <option value="Fear of Surgery">Fear of Surgery</option>
                            <option value="Wants Second Opinion">Wants Second Opinion</option>
                            <option value="Travel Plans">Travel Plans</option>
                            <option value="Medical Hold">Medical Hold</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Follow-up Date</label>
                          <input
                            type="date"
                            value={followUpDate}
                            min={new Date().toISOString().split('T')[0]}
                            onChange={(e) => { setFollowUpDate(e.target.value); markDirty(); }}
                            disabled={isReadOnly}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  {/* GAP 4: schedule required hint */}
                  {(decision === 'DateForSurgery' || decision === 'Interested') && !schedule && (
                    <div className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                      ⚠ A surgery schedule is required for this decision — please complete step 4
                    </div>
                  )}
                </div>

                {/* Schedule */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">4</span>
                    Surgery Schedule
                  </h3>
                  {schedule ? (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-3">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-green-800">
                          <Calendar className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {new Date(schedule.selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-green-800">
                          <Clock className="h-4 w-4" />
                          <span className="text-sm font-medium">{formatTime(schedule.surgeryStartTime)}</span>
                        </div>
                        <span className="text-xs text-green-700">{schedule.operationTheatre} · {schedule.doctor}</span>
                      </div>
                      <button
                        onClick={() => setIsScheduleModalOpen(true)}
                        className="px-3 py-1.5 border border-green-400 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
                      >
                        Update Schedule
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsScheduleModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-50 transition-colors w-full justify-center"
                    >
                      <Calendar className="h-4 w-4" />
                      Select a Schedule
                    </button>
                  )}
                </div>

                {/* Notes */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">5</span>
                      Notes
                    </h3>
                  </div>
                  {([
                    { key: 'counsellor' as const, label: 'Counsellor Notes', value: counsellorNotes, set: (v: string) => { setCounsellorNotes(v); markDirty(); } },
                    { key: 'patient' as const, label: 'Patient Remarks', value: patientRemarks, set: (v: string) => { setPatientRemarks(v); markDirty(); } },
                    { key: 'doctor' as const, label: 'Doctor Notes', value: doctorNotes, set: (v: string) => { setDoctorNotes(v); markDirty(); } },
                  ]).map(({ key, label, value, set }) => (
                    <div key={key} className="border-b border-gray-100 last:border-b-0">
                      <button
                        onClick={() => setOpenNotes(n => ({ ...n, [key]: !n[key] }))}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                      >
                        <span className="text-sm font-medium text-gray-700">{label}</span>
                        {openNotes[key] ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </button>
                      {openNotes[key] && (
                        <div className="px-4 pb-4">
                          <textarea
                            rows={3}
                            value={value}
                            readOnly={isReadOnly}
                            onChange={(e) => { if (!isReadOnly) set(e.target.value); }}
                            placeholder={`Enter ${label.toLowerCase()}…`}
                            className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${isReadOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Checkboxes */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">6</span>
                    Additional Options
                  </h3>
                  <div className="space-y-2">
                    {([
                      { label: 'Want To See Doctor Again', value: wantToSeeDoctor, set: (v: boolean) => { setWantToSeeDoctor(v); markDirty(); } },
                      { label: 'Interested to Upgrade', value: interestedToUpgrade, set: (v: boolean) => { setInterestedToUpgrade(v); markDirty(); } },
                      { label: 'Not Required Pre Authorization', value: notRequiredPreAuth, set: (v: boolean) => { setNotRequiredPreAuth(v); markDirty(); } },
                    ]).map(({ label, value, set }) => (
                      <label key={label} className={`flex items-center gap-3 ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer group'}`}>
                        <input
                          type="checkbox"
                          checked={value}
                          disabled={isReadOnly}
                          onChange={(e) => { if (!isReadOnly) set(e.target.checked); }}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 disabled:cursor-not-allowed"
                        />
                        <span className={`text-sm text-gray-700 ${isReadOnly ? '' : 'group-hover:text-gray-900'}`}>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
  );
}
