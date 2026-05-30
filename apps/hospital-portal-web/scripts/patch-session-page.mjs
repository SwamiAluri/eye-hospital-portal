import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pagePath = path.join(__dirname, '../src/app/dashboard/counsellors-desk/[id]/page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');
const lines = content.split(/\r?\n/);

// Find counselling tab block
const startIdx = lines.findIndex((l) => l.includes("{activeMainTab === 'counselling' && ("));
const endIdx = lines.findIndex((l, i) => i > startIdx && l.trim() === ')}' && lines[i - 1]?.trim() === '</div>');

if (startIdx < 0 || endIdx < 0) {
  console.error('Could not find counselling block', startIdx, endIdx);
  process.exit(1);
}

const replacement = [
  "        {activeMainTab === 'counselling' && (",
  '          <CounsellingTabPanel {...counsellingTabProps} />',
  '        )}',
];

lines.splice(startIdx, endIdx - startIdx + 1, ...replacement);
content = lines.join('\n');

// Add dynamic import after CoveragePreauthPanel
if (!content.includes('CounsellingTabPanel')) {
  console.error('Replacement failed');
  process.exit(1);
}

if (!content.includes("import('@/components/counsellors-desk/session/CounsellingTabPanel')")) {
  content = content.replace(
    `  { ssr: false, loading: () => (
    <div className="flex items-center justify-center py-16 text-sm text-gray-400">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mr-3" />
      Loading coverage panel…
    </div>
  ) },
);`,
    `  { ssr: false, loading: () => (
    <div className="flex items-center justify-center py-16 text-sm text-gray-400">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mr-3" />
      Loading coverage panel…
    </div>
  ) },
);
const CounsellingTabPanel = dynamic(
  () => import('@/components/counsellors-desk/session/CounsellingTabPanel').then((m) => ({ default: m.CounsellingTabPanel })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-16 text-sm text-gray-400">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mr-3" />
        Loading counselling panel…
      </div>
    ),
  },
);`,
  );
}

// Insert counsellingTabProps before `if (isLoading)`
const propsBlock = `
  const counsellingTabProps = {
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
  };
`;

if (!content.includes('counsellingTabProps')) {
  content = content.replace('\n  return (\n    <div className="flex flex-col"', `${propsBlock}\n  return (\n    <div className="flex flex-col"`);
}

fs.writeFileSync(pagePath, content);
console.log('Patched page.tsx');
