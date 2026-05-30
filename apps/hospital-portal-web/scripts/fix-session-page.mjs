import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pagePath = path.join(__dirname, '../src/app/dashboard/counsellors-desk/[id]/page.tsx');
const lines = fs.readFileSync(pagePath, 'utf8').split(/\r?\n/);

const anchor = lines.findIndex((l) => l.includes('<CounsellingTabPanel'));
let start2 = -1;
for (let i = anchor; i < lines.length; i++) {
  if (lines[i].trim() === ')}' && lines[i - 1]?.includes('CounsellingTabPanel')) {
    start2 = i + 1;
    break;
  }
}
let end2 = -1;
for (let i = start2; i < lines.length; i++) {
  if (lines[i].includes('Sticky Footer')) {
    end2 = i - 2;
    break;
  }
}

if (start2 >= 0 && end2 >= start2) {
  lines.splice(start2, end2 - start2 + 1);
}

let content = lines.join('\n');

if (!content.includes('const counsellingTabProps')) {
  const propsBlock = `  const counsellingTabProps = {
    isSurgeryDoneState, isDoneState, isRepeatState, isReadOnly, queueStatus,
    handleReEvaluate, handleStartRepeatSession, procExpanded, setProcExpanded,
    categoryFilter, setCategoryFilter, procSearch, setProcSearch, catalog, catalogLoading,
    catalogError, loadCatalog, selectedVariantId, selectedSurgeryId, selectedEye, setSelectedEye,
    setSelectedVariantId, setSelectedSurgeryId, variantSubOption, setVariantSubOption,
    iolOptions, selectedIolId, setSelectedIolId, selectedInvestigations, setSelectedInvestigations,
    toggleInvestigation, invTab, setInvTab, invExpanded, setInvExpanded, imagingSearch, setImagingSearch,
    labSearch, setLabSearch, masterCatalog, urgencyMode, savedOverrides, showOverridePanel,
    setShowOverridePanel, overridePrice, setOverridePrice, overrideReason, setOverrideReason,
    overrideRemarks, setOverrideRemarks, overrideRequesterType, setOverrideRequesterType,
    overrideStaffName, setOverrideStaffName, overrideStaffContact, setOverrideStaffContact,
    overrideSaving, overrideError, setOverrideError, setOverrideSaving, staffList,
    handleEditOverride, handleRemoveOverride, editingOverrideId, setEditingOverrideId,
    markDirty, session, paymentType, setPaymentType, insuranceCompany, setInsuranceCompany,
    insuranceProviderOptions, freeSurgeryReason, setFreeSurgeryReason, packageName, setPackageName,
    packageRate, setPackageRate, showPackageEdit, setShowPackageEdit, decision, setDecision,
    followUpReason, setFollowUpReason, followUpDate, setFollowUpDate, schedule,
    setIsScheduleModalOpen, counsellorNotes, setCounsellorNotes, patientRemarks, setPatientRemarks,
    doctorNotes, setDoctorNotes, openNotes, setOpenNotes, wantToSeeDoctor, setWantToSeeDoctor,
    interestedToUpgrade, setInterestedToUpgrade, notRequiredPreAuth, setNotRequiredPreAuth,
    sessionId, setQueueStatus, setSavedOverrides,
  };`;
  content = content.replace(
    '\n  return (\n    <div className="flex flex-col"',
    `\n${propsBlock}\n\n  return (\n    <div className="flex flex-col"`,
  );
}

fs.writeFileSync(pagePath, content);
console.log('Fixed page, lines', content.split('\n').length);
