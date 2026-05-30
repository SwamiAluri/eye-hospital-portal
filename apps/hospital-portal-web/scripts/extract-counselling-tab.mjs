import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pagePath = path.join(__dirname, '../src/app/dashboard/counsellors-desk/[id]/page.tsx');
const outPath = path.join(__dirname, '../src/components/counsellors-desk/session/CounsellingTabPanel.tsx');

const pageLines = fs.readFileSync(pagePath, 'utf8').split(/\r?\n/);
const panelJsx = pageLines.slice(913, 2382).join('\n');

const bindingNames = [
  'isSurgeryDoneState', 'isDoneState', 'isRepeatState', 'isReadOnly', 'queueStatus',
  'handleReEvaluate', 'handleStartRepeatSession', 'procExpanded', 'setProcExpanded',
  'categoryFilter', 'setCategoryFilter', 'procSearch', 'setProcSearch', 'catalog', 'catalogLoading',
  'catalogError', 'loadCatalog', 'selectedVariantId', 'selectedSurgeryId', 'selectedEye', 'setSelectedEye',
  'setSelectedVariantId', 'setSelectedSurgeryId', 'variantSubOption', 'setVariantSubOption',
  'iolOptions', 'selectedIolId', 'setSelectedIolId', 'selectedInvestigations', 'setSelectedInvestigations',
  'toggleInvestigation', 'invTab', 'setInvTab', 'invExpanded', 'setInvExpanded', 'imagingSearch', 'setImagingSearch',
  'labSearch', 'setLabSearch', 'masterCatalog', 'urgencyMode', 'savedOverrides', 'showOverridePanel',
  'setShowOverridePanel', 'overridePrice', 'setOverridePrice', 'overrideReason', 'setOverrideReason',
  'overrideRemarks', 'setOverrideRemarks', 'overrideRequesterType', 'setOverrideRequesterType',
  'overrideStaffName', 'setOverrideStaffName', 'overrideStaffContact', 'setOverrideStaffContact',
  'overrideSaving', 'overrideError', 'setOverrideError', 'setOverrideSaving', 'staffList',
  'handleEditOverride', 'handleRemoveOverride', 'editingOverrideId', 'setEditingOverrideId',
  'markDirty', 'session', 'paymentType', 'setPaymentType', 'insuranceCompany', 'setInsuranceCompany',
  'insuranceProviderOptions', 'freeSurgeryReason', 'setFreeSurgeryReason', 'packageName', 'setPackageName',
  'packageRate', 'setPackageRate', 'showPackageEdit', 'setShowPackageEdit', 'decision', 'setDecision',
  'followUpReason', 'setFollowUpReason', 'followUpDate', 'setFollowUpDate', 'schedule',
  'setIsScheduleModalOpen', 'counsellorNotes', 'setCounsellorNotes', 'patientRemarks', 'setPatientRemarks',
  'doctorNotes', 'setDoctorNotes', 'openNotes', 'setOpenNotes', 'wantToSeeDoctor', 'setWantToSeeDoctor',
  'interestedToUpgrade', 'setInterestedToUpgrade', 'notRequiredPreAuth', 'setNotRequiredPreAuth',
  'sessionId', 'setQueueStatus', 'setSavedOverrides',
];

const header = `'use client';

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

const BINDING_KEYS = ${JSON.stringify(bindingNames)} as const;

export function CounsellingTabPanel(props: CounsellingTabPanelProps) {
  const {
    ${bindingNames.join(',\n    ')},
  } = props;

  return (
`;

const footer = `
  );
}
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, header + panelJsx + footer);
console.log('Wrote', outPath);
