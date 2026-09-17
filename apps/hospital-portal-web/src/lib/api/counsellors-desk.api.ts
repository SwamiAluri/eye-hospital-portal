import { getApi } from '../api';
import { serviceCatalogApi } from './service-catalog.api';
import { buildInvestigationCatalogFromServiceCatalog } from '@/lib/counsellors-desk/investigation-catalog';
import { sessionTypeApiToCode, sessionTypeCodeToDb, callbackTypeCodeToDb, callbackChannelToDb } from '@/lib/counsellors-desk/counsellor-master-maps';
import {
  parseEstimateFromBlob,
  restoreLensSelectionFromBlob,
} from '@/lib/counsellors-desk/package-addons-blob';
import { toCounsellingDateOnly } from '@/lib/counsellors-desk/session-utils';
import { resolveHydratedSelectedSurgeryId } from '@/lib/counsellors-desk/resolve-hydrated-selected-surgery-id';
import type { CounsellingPackageAddonsBlob } from '@/types/counselling-estimate';
import type {
  WaitingListPatient,
  CounsellingSession,
  FinalizeSurgeryRecord,
  FinalizeFormData,
  OTListRecord,
  WardPatient,
  WaitingListFilters,
  AddPatientFormData,
  WaitingListStatus,
  SessionAuditEntry,
  SurgeryOption,
  ScheduleData,
  MasterCatalogItem,
  InvestigationItem,
  PrepareOtListPayload,
  UpdateSlotPayload,
  OtScheduleDetail,
  UpdateOtDetailsPayload,
} from '@/types/counsellors-desk';

export type CounselingCounselorOption = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string | null;
};

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_SESSION: Omit<CounsellingSession, 'id'> = {
  patientId: '',
  patientName: 'Ravi Kumar',
  age: 62,
  gender: 'Male',
  uhid: 'UHID001',
  visitDate: '2026-03-20',
  surgeries: [
    { id: 's1', surgeryName: 'Phacoemulsification (RE)', eye: 'RE', cost: 45000 },
    { id: 's2', surgeryName: 'Phacoemulsification (LE)', eye: 'LE', cost: 45000 },
    { id: 's3', surgeryName: 'TIOL Premium', eye: 'RE', cost: 75000 },
  ],
  selectedSurgeryId: null,
  patientType: '',
  paymentMode: '',
  company: '',
  freeSurgeryReason: '',
  packageName: '',
  packageRate: '',
  decision: '',
  schedule: null,
  counsellorNotes: '',
  patientRemarks: '',
  doctorNotes: '',
  wantToSeeDoctor: false,
  interestedToUpgrade: false,
  notRequiredPreAuth: false,
  isFollowUpRequired: false,
  status: 'Pending' as WaitingListStatus,
  followUpReason: '',
  followUpDate: '',
};

const MOCK_FINALIZE_LIST: FinalizeSurgeryRecord[] = [
  { id: 'f1', uhid: 'UHID004', patientName: 'Sunita Rao', surgeryName: 'Vitrectomy', eyes: 'RE', patientType: 'General', paymentMode: 'Cash', surgeon: 'Dr. Sharma', startTime: '09:00 AM', theaterName: 'OT-1', status: 'Confirmed', version: 1, isLocked: false },
  { id: 'f2', uhid: 'UHID007', patientName: 'Suresh Babu', surgeryName: 'Phacoemulsification', eyes: 'RE', patientType: 'General', paymentMode: 'Card', surgeon: 'Dr. Singh', startTime: '10:00 AM', theaterName: 'OT-2', status: 'NotConfirmed', version: 1, isLocked: false },
  { id: 'f3', uhid: 'UHID010', patientName: 'Anitha Menon', surgeryName: 'LASIK', eyes: 'BE', patientType: 'General', paymentMode: 'Insurance', surgeon: 'Dr. Verma', startTime: '11:00 AM', theaterName: 'OT-1', status: 'Finalised', version: 1, isLocked: false },
  { id: 'f4', uhid: 'UHID013', patientName: 'Rajesh Iyer', surgeryName: 'Phacoemulsification', eyes: 'BE', patientType: 'General', paymentMode: 'Cash', surgeon: 'Dr. Verma', startTime: '12:00 PM', theaterName: 'OT-3', status: 'SurgeryDone', version: 1, isLocked: false },
  { id: 'f5', uhid: 'UHID014', patientName: 'Deepa Nambiar', surgeryName: 'Vitrectomy', eyes: 'RE', patientType: 'Insurance', paymentMode: 'TPA', surgeon: 'Dr. Nair', startTime: '01:00 PM', theaterName: 'OT-2', status: 'Cancelled', version: 1, isLocked: false },
  { id: 'f6', uhid: 'UHID006', patientName: 'Lakshmi Bai', surgeryName: 'Corneal Transplant', eyes: 'BE', patientType: 'Insurance', paymentMode: 'TPA', surgeon: 'Dr. Verma', startTime: '02:00 PM', theaterName: 'OT-1', status: 'NotConfirmed', version: 1, isLocked: false },
  { id: 'f7', uhid: 'UHID009', patientName: 'Venkat Reddy', surgeryName: 'DSAEK', eyes: 'RE', patientType: 'General', paymentMode: 'Cash', surgeon: 'Dr. Nair', startTime: '03:00 PM', theaterName: 'OT-3', status: 'Confirmed', version: 1, isLocked: false },
];

const MOCK_OT_LIST: OTListRecord[] = [
  { id: 'o1', slNo: 1, uhid: 'UHID004', patientName: 'Sunita Rao', scheduledStartTime: '09:00 AM', scheduledEndTime: '09:45 AM', status: 'Confirmed', surgeryName: 'Vitrectomy', eyes: 'RE', surgeon: 'Dr. Sharma', theaterName: 'OT-1', packageName: 'Vitrectomy Basic', anesthetistName: 'Dr. Anand', cancelled: false, surgeryDone: false },
  { id: 'o2', slNo: 2, uhid: 'UHID010', patientName: 'Anitha Menon', scheduledStartTime: '11:00 AM', scheduledEndTime: '11:30 AM', status: 'Finalised', surgeryName: 'LASIK', eyes: 'BE', surgeon: 'Dr. Verma', theaterName: 'OT-1', packageName: 'LASIK Premium', anesthetistName: 'Dr. Kumar', cancelled: false, surgeryDone: false },
  { id: 'o3', slNo: 3, uhid: 'UHID013', patientName: 'Rajesh Iyer', scheduledStartTime: '12:00 PM', scheduledEndTime: '12:45 PM', status: 'SurgeryDone', surgeryName: 'Phacoemulsification', eyes: 'BE', surgeon: 'Dr. Verma', theaterName: 'OT-3', packageName: 'Phaco Standard', anesthetistName: 'Dr. Anand', cancelled: false, surgeryDone: true },
  { id: 'o4', slNo: 4, uhid: 'UHID007', patientName: 'Suresh Babu', scheduledStartTime: '10:00 AM', scheduledEndTime: '10:45 AM', status: 'NotConfirmed', surgeryName: 'Phacoemulsification', eyes: 'RE', surgeon: 'Dr. Singh', theaterName: 'OT-2', packageName: 'Phaco Standard', anesthetistName: 'Dr. Priya', cancelled: false, surgeryDone: false },
  { id: 'o5', slNo: 5, uhid: 'UHID009', patientName: 'Venkat Reddy', scheduledStartTime: '03:00 PM', scheduledEndTime: '03:45 PM', status: 'Confirmed', surgeryName: 'DSAEK', eyes: 'RE', surgeon: 'Dr. Nair', theaterName: 'OT-3', packageName: 'DSAEK Package', anesthetistName: 'Dr. Kumar', cancelled: false, surgeryDone: false },
];

const MOCK_WARD_PATIENTS: WardPatient[] = [
  { id: 'w1', slNo: 1, mrNo: 'MR001', patientName: 'Sunita Rao', diagnosis: 'Vitreous Haemorrhage', procedureName: 'Vitrectomy', surgeon: 'Dr. Sharma', package: 'Vitrectomy Basic', status: 'Admitted', room: 'Ward-A/Bed-3', admissionTime: '08:30 AM', remarks: '' },
  { id: 'w2', slNo: 2, mrNo: 'MR002', patientName: 'Rajesh Iyer', diagnosis: 'Bilateral Cataract', procedureName: 'Phacoemulsification', surgeon: 'Dr. Verma', package: 'Phaco Standard', status: 'SurgeryDone', room: 'Ward-B/Bed-1', admissionTime: '07:00 AM', remarks: 'Recovery ongoing' },
  { id: 'w3', slNo: 3, mrNo: 'MR003', patientName: 'Lakshmi Bai', diagnosis: 'Keratoconus', procedureName: 'Corneal Transplant', surgeon: 'Dr. Verma', package: 'Corneal Pkg', status: 'Expected', room: '—', admissionTime: '—', remarks: 'Arriving at 10 AM' },
  { id: 'w4', slNo: 4, mrNo: 'MR004', patientName: 'Venkat Reddy', diagnosis: 'Bullous Keratopathy', procedureName: 'DSAEK', surgeon: 'Dr. Nair', package: 'DSAEK Package', status: 'ReadyForSurgery', room: 'Pre-Op/Bed-2', admissionTime: '09:00 AM', remarks: '' },
  { id: 'w5', slNo: 5, mrNo: 'MR005', patientName: 'Anitha Menon', diagnosis: 'High Myopia', procedureName: 'LASIK', surgeon: 'Dr. Verma', package: 'LASIK Premium', status: 'Discharged', room: 'Ward-A/Bed-5', admissionTime: '06:30 AM', remarks: 'Discharged at 2 PM' },
  { id: 'w6', slNo: 6, mrNo: 'MR006', patientName: 'Harish Chandra', diagnosis: 'Open Angle Glaucoma', procedureName: 'Trabeculectomy', surgeon: 'Dr. Sharma', package: 'Glaucoma Pkg', status: 'Admitted', room: 'Ward-C/Bed-2', admissionTime: '08:00 AM', remarks: 'IOP monitoring' },
  { id: 'w7', slNo: 7, mrNo: 'MR007', patientName: 'Priya Krishnan', diagnosis: 'PCO', procedureName: 'YAG Laser', surgeon: 'Dr. Sharma', package: 'Laser Pkg', status: 'SurgeryDone', room: 'Recovery/Bed-1', admissionTime: '11:00 AM', remarks: '' },
  { id: 'w8', slNo: 8, mrNo: 'MR008', patientName: 'Mohan Lal', diagnosis: 'ARMD', procedureName: 'Intravitreal Injection', surgeon: 'Dr. Sharma', package: 'Injection Pkg', status: 'Expected', room: '—', admissionTime: '—', remarks: 'Day care procedure' },
];

// ─── OT Record Mapper ───────────────────────────────────────────────────────
// Shared by getFinalizeList, getOtList, and onStatusChange callbacks so every
// path through the app that receives an OtScheduleResponse consistently maps
// field aliases (eye→eyes, doctorName→surgeon, theatreName→theaterName) and
// formats time strings. After the backend change, r.scheduleDate is always
// populated from StartTime at the server; the fallback handles legacy records.

function fmtOtTime(v?: string | null): string {
  if (!v) return '';
  if (v.includes('T')) return new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const [h, m] = v.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return v;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${suffix}`;
}

export function mapOtRecord(r: any): FinalizeSurgeryRecord {
  return {
    ...r,
    id:               r.id,
    eyes:             r.eyes ?? r.eye ?? '',
    surgeon:          r.surgeon ?? r.doctorName ?? '',
    theaterName:      r.theaterName ?? r.theatreName ?? '',
    // Backend now sends scheduleDate ("yyyy-MM-dd") directly; fallback extracts
    // it from the raw ISO startTime before fmtOtTime reformats it.
    scheduleDate:     r.scheduleDate ?? (r.startTime?.includes('T') ? (r.startTime as string).slice(0, 10) : ''),
    startTime:        fmtOtTime(r.startTime),
    reportingTime:    fmtOtTime(r.reportingTime),
    checklistSummary: r.checklistSummary ?? undefined,
  } as FinalizeSurgeryRecord;
}

// ─── API Object ─────────────────────────────────────────────────────────────

export const counsellorsDeskApi = {
  async getWaitingList(filters?: Partial<WaitingListFilters>): Promise<WaitingListPatient[]> {
    try {
      const params: Record<string, string> = {};
      if (filters?.fromDate) params.fromDate = filters.fromDate;
      if (filters?.toDate) params.toDate = filters.toDate;
      if (filters?.patientName) params.patientName = filters.patientName;
      if (filters?.mrd) params.mrd = filters.mrd;
      if (filters?.type && filters.type !== 'All') params.type = filters.type;
      if (filters?.status) params.status = filters.status;
      if (filters?.branchId?.trim()) params.branchId = filters.branchId.trim();
      const response = await getApi().get('/Counseling/waiting-list', { params });
      return response.data ?? [];
    } catch (err) {
      throw err;
    }
  },

  async getSession(id: string, options?: { skipCatalogFallback?: boolean }): Promise<CounsellingSession> {
    try {
      const response = await getApi().get(`/Counseling/sessions/${id}`);
      const raw = response.data;


      // Collect the doctor-recommended typeIds so we can flag IsRecommended later
      const recommendedTypeIds = new Set<string>();
      if (raw.recommendedProcedures) {
        try {
          const procs: Array<{ surgeryTypeId?: string }> =
            typeof raw.recommendedProcedures === 'string'
              ? JSON.parse(raw.recommendedProcedures)
              : raw.recommendedProcedures;
          procs.forEach((p) => { if (p.surgeryTypeId) recommendedTypeIds.add(p.surgeryTypeId); });
        } catch { /* ignore */ }
      }

      // Build surgeries array
      let surgeries: SurgeryOption[] = [];

      // Path 1: backend already computed the full priced list
      if (Array.isArray(raw.surgeriesWithPricing) && raw.surgeriesWithPricing.length > 0) {
        surgeries = (raw.surgeriesWithPricing as Array<{ id: string; surgeryName: string; eye: string; cost: number; surgeryCategory?: string; isRecommended?: boolean }>)
          .map((p) => ({ id: p.id, surgeryName: p.surgeryName, eye: p.eye, cost: p.cost, category: p.surgeryCategory ?? '', isRecommended: p.isRecommended ?? false }));
      }

      // Path 2 (frontend fallback): fetch the full catalog directly when backend returned empty
      if (surgeries.length === 0 && !options?.skipCatalogFallback) {
        try {
          const catalogRes = await getApi().get('/servicecatalog/full');
          const fullCatalog = catalogRes.data as {
            categories: Array<{
              code: string;
              services: Array<{
                variants: Array<{ id: string; name: string; price: number; hasIolOptions: boolean; priceType: 'PER_EYE' | 'BOTH_EYES' | 'FIXED' }>;
              }>;
            }>;
          };

          const eye = (raw.surgeryTentativeEye as string) ?? 'RE';
          const eyes: string[] = eye === 'BE' ? ['RE', 'LE'] : [eye];
          const excludeCodes = new Set(['DIAGNOSTICS', 'INVESTIGATIONS']);

          fullCatalog.categories
            .filter((cat) => !excludeCodes.has(cat.code))
            .flatMap((cat) =>
              cat.services.flatMap((svc) =>
                svc.variants.map((v) => ({ ...v, categoryCode: cat.code }))
              )
            )
            .forEach((v) => {
              eyes.forEach((e) => {
                surgeries.push({
                  id: `type-${v.id}-${e}`,
                  surgeryName: v.name,
                  eye: e,
                  cost: v.price,
                  category: v.categoryCode,
                  isRecommended: recommendedTypeIds.has(v.id),
                  variantId: v.id,
                  hasIolOptions: v.hasIolOptions,
                  priceType: v.priceType,
                });
              });
            });
        } catch { /* silently skip */ }
      }

      // Path 3: absolute last resort — use the recommended surgery text only
      if (surgeries.length === 0 && raw.recommendedSurgery) {
        surgeries = [{ id: 'rec-0', surgeryName: raw.recommendedSurgery, eye: raw.surgeryTentativeEye ?? 'RE', cost: 0, isRecommended: true }];
      }

      // Parse counsellor-specific JSON blob stored in PackageAddonsJson.
      // handleSave() writes this on every save so we can restore all UI-level fields
      // (selectedSurgeryId, packageName, decision, paymentType, schedule, etc.) that
      // have no dedicated column in the auth-service session schema.
      let cd: CounsellingPackageAddonsBlob = {};
      if (raw.packageAddonsJson) {
        try {
          cd =
            typeof raw.packageAddonsJson === 'string'
              ? (JSON.parse(raw.packageAddonsJson) as CounsellingPackageAddonsBlob)
              : (raw.packageAddonsJson as CounsellingPackageAddonsBlob);
        } catch {
          /* ignore invalid JSON */
        }
      }

      const estimate = parseEstimateFromBlob(cd);
      const lensSelection = restoreLensSelectionFromBlob(cd);

      // Derive decision: blob → boolean fallback (patientAgreedToSurgery / pendingDecision)
      const restoredDecision: string =
        cd.decision
        || (raw.pendingDecision ? 'NeedsTime' : raw.patientAgreedToSurgery ? 'DateForSurgery' : '');

      // Derive paymentType: blob → patientType column (handleSave writes paymentType there)
      const restoredPaymentType: string = cd.paymentType ?? raw.patientType ?? '';

      // Restore eye: blob (exact) → surgeryTentativeEye column (written by handleSave)
      // This ensures the left-panel catalog switches to the correct eye even when
      // packageAddonsJson carries no variantId (e.g. first-load before a save).
      const restoredEye: string = cd.eye ?? raw.surgeryTentativeEye ?? 'RE';

      // Restore schedule: blob object (full restore from new saves) → blob string (legacy date-only saves)
      // → server-side surgeryTentativeDate column as last resort.
      // Always normalize selectedDate to yyyy-MM-dd (.NET DateTime often serializes with time).
      const restoredSchedule: ScheduleData | null =
        (cd.schedule || raw.surgeryTentativeDate)
          ? (() => {
              if (typeof cd.schedule === 'object' && cd.schedule !== null) {
                const obj = cd.schedule as ScheduleData;
                return {
                  ...obj,
                  selectedDate: toCounsellingDateOnly(
                    obj.selectedDate || (raw.surgeryTentativeDate as string | undefined),
                  ),
                };
              }
              const rawDate =
                (typeof cd.schedule === 'string' ? cd.schedule : null) ??
                (raw.surgeryTentativeDate as string | undefined);
              return {
                selectedDate: toCounsellingDateOnly(rawDate),
                operationTheatre: '',
                doctor: '',
                surgeryStartTime: (raw.surgeryTentativeTimeSlot as string | undefined) ?? '',
                avoidTimeFrom: '',
                avoidTimeTo: '',
              };
            })()
          : null;

      // Map queue status → WaitingListStatus.
      // Completed + patientAgreedToSurgery=true → Done; Completed without agreement → RepeatCounselling.
      // If the linked OT record is SurgeryDone, override immediately — surgery trumps everything.
      const rawQueueStatus: string = raw.queueStatus?.status ?? '';
      const status: WaitingListStatus =
        raw.otStatus === 'SurgeryDone' ? 'SurgeryDone'
        : rawQueueStatus === 'Waiting'       ? 'Pending'
        : rawQueueStatus === 'Called' || rawQueueStatus === 'InProgress' ? 'Processed'
        : rawQueueStatus === 'AddOnSurgery' ? 'AddOnSurgery'
        : rawQueueStatus === 'Completed'
          ? (raw.patientAgreedToSurgery === true ? 'Done' : 'RepeatCounselling')
        : 'Pending';

      return {
        id: raw.id,
        patientId: raw.patientId,
        patientName: raw.patientName ?? '',
        age: raw.patientAge ?? 0,
        gender: raw.patientGender ?? '',
        uhid: raw.patientHealthId ?? raw.patientMrn ?? '',
        visitDate: raw.sessionDate ? (raw.sessionDate as string).split('T')[0] : '',
        surgeries,
        // Restore selection: blob → variantId → first isRecommended (scheduling /
        // recommended_surgery matched by GetSession into SurgeriesWithPricing).
        selectedSurgeryId: resolveHydratedSelectedSurgeryId({
          blobSelectedSurgeryId: cd.selectedSurgeryId,
          blobVariantId: cd.variantId,
          restoredEye,
          firstRecommendedSurgeryId: surgeries.find((s) => s.isRecommended)?.id ?? null,
        }),
        // Carry the restored eye as a top-level field so page.tsx can set selectedEye
        // even when selectedSurgeryId is null (no blob saved yet).
        restoredEye: restoredEye as string,
        iolPower: typeof raw.iolPower === 'string' ? raw.iolPower : undefined,
        variantSubOption: lensSelection.variantSubOption,
        selectedIolId: lensSelection.selectedIolId,
        patientType: restoredPaymentType,
        paymentMode: restoredPaymentType,
        company: cd.insuranceCompany ?? '',
        freeSurgeryReason: '',
        packageName: cd.packageName ?? '',
        // Prefer DB package_amount column; fall back to blob's rate field for sessions
        // saved before package_amount was reliably persisted (e.g. rate only in JSON blob).
        packageRate: raw.packageAmount ?? (cd.rate ? Number(cd.rate) || '' : ''),
        decision: restoredDecision as ('' | import('@/types/counsellors-desk').DecisionType),
        schedule: restoredSchedule,
        counsellorNotes: raw.additionalNotes ?? '',
        patientRemarks: cd.patientRemarks ?? '',
        doctorNotes: cd.doctorNotes ?? '',
        wantToSeeDoctor: cd.wantToSeeDoctor ?? false,
        interestedToUpgrade: cd.interestedToUpgrade ?? false,
        notRequiredPreAuth: cd.notRequiredPreAuth ?? false,
        ccmsCoverageCaseId: cd.ccmsCoverageCaseId,
        ccmsCaseNumber: cd.ccmsCaseNumber,
        ccmsCurrentState: cd.ccmsCurrentState,
        isFollowUpRequired: raw.pendingDecision ?? false,
        sessionTypeCode: sessionTypeApiToCode(raw.sessionType as string | undefined, []),
        status,
        counselorId: raw.counselorId != null ? String(raw.counselorId) : null,
        followUpReason: raw.reasonsForDelay ?? '',
        followUpDate: cd.followUpDate ?? (raw.decisionDate ? (raw.decisionDate as string).split('T')[0] : ''),
        investigations: Array.isArray(raw.investigationOrders)
          ? (raw.investigationOrders as Array<{
              id?: string; catalogId?: string; testName: string; testCode?: string;
              testType: string; price: number; urgency: string; status?: string; source?: string;
              eye?: string;
            }>).map((o) => ({
              id: o.id,
              catalogId: o.catalogId,
              testName: o.testName,
              testCode: o.testCode,
              testType: (o.testType ?? 'Lab') as 'Lab' | 'Imaging' | 'Scan',
              price: o.price,
              urgency: o.urgency ?? 'Routine',
              status: o.status,
              source: (o.source ?? 'counsellor') as 'counsellor' | 'doctor',
              eye: (o.eye ?? undefined) as 'RE' | 'LE' | 'BE' | undefined,
            }))
          : [],
        suggestedPreOpTests: Array.isArray(raw.suggestedPreOpTests)
          ? (raw.suggestedPreOpTests as Array<{
              id: string; name: string; code?: string; category?: string; testType: string; price: number;
            }>).map((t) => ({
              id: t.id,
              name: t.name,
              code: t.code,
              category: t.category,
              testType: (t.testType ?? 'Lab') as 'Lab' | 'Imaging' | 'Scan',
              price: t.price,
            }))
          : [],
        estimateMode: estimate.estimateMode,
        packageTemplateId: estimate.packageTemplateId,
        discountType: estimate.discountType,
        discountValue: estimate.discountValue,
        discountReason: estimate.discountReason,
        discountAmount: estimate.discountAmount,
        itemizedSubtotal: estimate.itemizedSubtotal,
        bundleSavings: estimate.bundleSavings,
        finalPayableAmount: estimate.finalPayableAmount,
      };
    } catch (err) {
      throw err;
    }
  },

  async saveSession(id: string, data: Partial<CounsellingSession>): Promise<void> {
    await getApi().put(`/Counseling/sessions/${id}`, data);
  },

  async startSession(id: string, sessionType?: string): Promise<void> {
    // Master codes (FOLLOW_UP) must map to DB values (Followup) — check constraint on session_type.
    const payload = sessionType
      ? { sessionType: sessionTypeCodeToDb(sessionType) }
      : {};
    await getApi().post(`/Counseling/sessions/${id}/start`, payload);
  },

  /**
   * Phase 3I Slice 3 — explicit initial ownership assignment (NULL → target).
   * Does not use generic Update CounselorId mutation.
   */
  async assignSession(
    sessionId: string,
    counselorId: string,
  ): Promise<{
    success: boolean;
    message: string;
    sessionId: string;
    counselorId: string;
    counselorName: string | null;
  }> {
    const res = await getApi().post(
      `/Counseling/sessions/${sessionId}/assign`,
      { counselorId },
      // In-context mutation: keep 403/Conflict on Waiting List (toast), not Access Denied page.
      { skipForbiddenRedirect: true },
    );
    const data = res.data ?? {};
    return {
      success: Boolean(data.success ?? true),
      message: data.message ?? 'Session assigned successfully',
      sessionId: String(data.sessionId ?? sessionId),
      counselorId: String(data.counselorId ?? counselorId),
      counselorName: data.counselorName ?? null,
    };
  },

  /**
   * Phase 3I — lifecycle ownership claim for Done ReEvaluate / Repeat StartRepeat.
   * Supports NULL → actor and other-owner → actor. Not general Reassign.
   * Does not use UpdateSession CounselorId write or Slice 3 Assign.
   */
  async claimSessionForLifecycle(
    sessionId: string,
    input: {
      expectedCounselorId: string | null;
      intent: 'ReEvaluate' | 'StartRepeat';
    },
  ): Promise<{
    success: boolean;
    message: string;
    sessionId: string;
    counselorId: string;
    counselorName: string | null;
  }> {
    const res = await getApi().post(
      `/Counseling/sessions/${sessionId}/claim-for-lifecycle`,
      {
        expectedCounselorId: input.expectedCounselorId,
        intent: input.intent,
      },
      { skipForbiddenRedirect: true },
    );
    const data = res.data ?? {};
    return {
      success: Boolean(data.success ?? true),
      message: data.message ?? 'Session claimed for lifecycle work',
      sessionId: String(data.sessionId ?? sessionId),
      counselorId: String(data.counselorId ?? ''),
      counselorName: data.counselorName ?? null,
    };
  },

  /**
   * Phase 3I Slice 6 — supervisory General Reassign (owned A → B).
   * Requires counseling_sessions.reassign. Not Assign; not lifecycle Claim.
   */
  async reassignSession(
    sessionId: string,
    input: {
      counselorId: string;
      expectedCounselorId: string;
      reason: string;
    },
  ): Promise<{
    success: boolean;
    message: string;
    sessionId: string;
    counselorId: string;
    counselorName: string | null;
  }> {
    const res = await getApi().post(
      `/Counseling/sessions/${sessionId}/reassign`,
      {
        counselorId: input.counselorId,
        expectedCounselorId: input.expectedCounselorId,
        reason: input.reason,
      },
      { skipForbiddenRedirect: true },
    );
    const data = res.data ?? {};
    return {
      success: Boolean(data.success ?? true),
      message: data.message ?? 'Session reassigned successfully',
      sessionId: String(data.sessionId ?? sessionId),
      counselorId: String(data.counselorId ?? input.counselorId),
      counselorName: data.counselorName ?? null,
    };
  },

  /** Counsellor picker for Assign / Analytics — tenant-scoped; optional branchId for UX filtering. */
  async getCounselors(branchId?: string | null): Promise<CounselingCounselorOption[]> {
    const params: Record<string, string> = {};
    if (branchId?.trim()) params.branchId = branchId.trim();
    const res = await getApi().get('/Counseling/counselors', {
      params: Object.keys(params).length ? params : undefined,
    });
    const rows = (res.data ?? []) as Array<{
      id: string;
      firstName?: string;
      lastName?: string;
      name?: string;
      email?: string | null;
    }>;
    return rows.map((r) => ({
      id: String(r.id),
      firstName: r.firstName ?? '',
      lastName: r.lastName ?? '',
      name: (r.name ?? `${r.firstName ?? ''} ${r.lastName ?? ''}`).trim(),
      email: r.email ?? null,
    }));
  },

  /**
   * Mark the counselling session as completed.
   * The /complete endpoint sets session.Status = 'Completed' and
   * queueItem.Status = 'Completed'. The waiting list then maps:
   *   Completed + PatientAgreedToSurgery=true  → 'Done'
   *   Completed + PatientAgreedToSurgery=false → 'RepeatCounselling'
   * CS-01: must propagate failure — queue status is required for Finish/Done.
   */
  async completeSession(id: string): Promise<void> {
    await getApi().post(`/Counseling/sessions/${id}/complete`);
  },

  /**
   * Marks the counselling queue item for this session as "AddOnSurgery".
   * Called when a counsellor upgrades the package on a Done session so the
   * waiting list immediately shows the violet Add-On Surgery badge.
   * CS-01: must propagate failure — queue badge transition is required.
   */
  async markAddOnSurgery(id: string): Promise<void> {
    await getApi().post(`/Counseling/sessions/${id}/addon-surgery`);
  },

  async getSessionHistory(id: string): Promise<SessionAuditEntry[]> {
    try {
      const response = await getApi().get(`/Counseling/sessions/${id}/history`);
      return (response.data ?? []).map((h: {
        id: string; changeType: string; fieldName?: string | null; oldValue?: string | null;
        newValue?: string | null; reason?: string | null; changedAt: string;
        changedByName?: string | null; changedByUserId?: string;
      }) => ({
        id: h.id,
        changeType: h.changeType,
        fieldName: h.fieldName ?? undefined,
        oldValue: h.oldValue ?? null,
        newValue: h.newValue ?? null,
        reason: h.reason ?? null,
        changedAt: h.changedAt,
        changedBy: h.changedByName?.trim() || h.changedByUserId || 'System',
      }));
    } catch {
      return [];
    }
  },

  async getFinalizeList(filters?: { date?: string; uhid?: string; name?: string; status?: string; sessionId?: string }): Promise<FinalizeSurgeryRecord[]> {
    const response = await getApi().get('/Counseling/ot-schedule', { params: filters });
    const raw: any[] = Array.isArray(response.data) ? response.data : [];
    return raw.map(mapOtRecord);
  },

  /** Lookup a single OT record by counselling session (server-filtered). */
  async getOtRecordForSession(
    sessionId: string,
    filters?: { uhid?: string; name?: string },
  ): Promise<FinalizeSurgeryRecord | null> {
    if (!sessionId) return null;
    const list = await this.getFinalizeList({
      sessionId,
      uhid: filters?.uhid,
      name: filters?.name,
    }).catch(() => [] as FinalizeSurgeryRecord[]);
    return list[0] ?? null;
  },

  async upsertOtSchedule(data: Partial<FinalizeSurgeryRecord> & { patientId: string; counsellingSessionId?: string }): Promise<FinalizeSurgeryRecord> {
    // Remap frontend field names to match backend DTO names before sending
    const payload = {
      ...data,
      eye: data.eyes,                   // Backend DTO: Eye (not Eyes)
      doctorName: data.surgeon,         // Backend DTO: DoctorName (not surgeon)
      theatreName: data.theaterName,    // Backend DTO: TheatreName (British spelling)
    };
    const response = await getApi().post('/Counseling/ot-schedule', payload);
    return response.data;
  },

  async editOtScheduleSlot(id: string, data: UpdateSlotPayload): Promise<FinalizeSurgeryRecord> {
    const response = await getApi().put(`/Counseling/ot-schedule/${id}/slot`, data);
    return response.data;
  },

  async confirmOtSchedule(id: string): Promise<FinalizeSurgeryRecord> {
    const response = await getApi().post(`/Counseling/ot-schedule/${id}/confirm`);
    return response.data;
  },

  async finaliseOtSchedule(id: string): Promise<FinalizeSurgeryRecord> {
    const response = await getApi().post(`/Counseling/ot-schedule/${id}/finalise`);
    return response.data;
  },

  async cancelOtSchedule(id: string): Promise<FinalizeSurgeryRecord> {
    const response = await getApi().post(`/Counseling/ot-schedule/${id}/cancel`);
    return response.data;
  },

  async reopenOtCase(id: string): Promise<FinalizeSurgeryRecord> {
    const response = await getApi().post(`/Counseling/ot-schedule/${id}/reopen`);
    return response.data;
  },

  async submitPrepareOtList(payload: PrepareOtListPayload): Promise<void> {
    await getApi().post('/Counseling/ot-schedule/prepare', payload);
  },

  async getOtList(date: string): Promise<FinalizeSurgeryRecord[]> {
    const response = await getApi().get('/Counseling/ot-list', { params: { date } });
    const raw: any[] = Array.isArray(response.data) ? response.data : [];
    return raw.map(mapOtRecord);
  },

  async getOtScheduleDetail(id: string): Promise<OtScheduleDetail> {
    const response = await getApi().get(`/Counseling/ot-schedule/${id}`);
    const r = response.data;
    // Convert ISO DateTime ("2026-03-26T09:00:00") or TimeSpan ("09:00:00") to "HH:MM"
    const toHHMM = (iso?: string | null): string => {
      if (!iso) return '';
      if (iso.includes('T')) {
        const d = new Date(iso);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }
      return iso.substring(0, 5); // TimeSpan already "HH:MM:SS"
    };
    return {
      ...r,
      // Normalise field names to match FinalizeSurgeryRecord / OtScheduleDetail
      eyes:         r.eyes         ?? r.eye         ?? '',
      surgeon:      r.surgeon      ?? r.doctorName  ?? '',
      theaterName:  r.theaterName  ?? r.theatreName ?? '',
      // Derive date string for use when rebuilding ISO DateTime on save
      scheduleDate: r.startTime ? (r.startTime as string).split('T')[0] : undefined,
      // Convert times to HH:MM for <input type="time">
      startTime:    toHHMM(r.startTime),
      endTime:      toHHMM(r.endTime),
      reportingTime: toHHMM(r.reportingTime),
      counsellingSessionId: r.counsellingSessionId ?? r.CounsellingSessionId,
      // Patient demographics (backend field names → frontend type names)
      contactNumber:                r.contactNumber,
      bloodGroup:                   r.bloodGroup,
      gender:                       r.gender,
      dob:                          r.dateOfBirth,
      emergencyContactName:         r.emergencyContactName,
      emergencyContactPhone:        r.emergencyContactPhone,
      emergencyContactRelationship: r.emergencyContactRelationship,
      address:                      r.address,
      biometryMissingForEye:        r.biometryMissingForEye === true,
    } as OtScheduleDetail;
  },

  async refreshSessionFromOpd(sessionId: string): Promise<{
    procedureName?: string | null;
    eyeOperated?: string | null;
    iolPower?: string | null;
    biometryMissing?: boolean;
    eyePhrase?: string | null;
  }> {
    const response = await getApi().post(`/Counseling/sessions/${sessionId}/refresh-from-opd`);
    return response.data;
  },

  async updateOtDetails(id: string, data: UpdateOtDetailsPayload): Promise<FinalizeSurgeryRecord> {
    const response = await getApi().put(`/Counseling/ot-schedule/${id}/details`, data);
    return response.data;
  },

  async getSurgeons(): Promise<{ id: string; name: string }[]> {
    // CounselingController GET /surgeons — counseling_sessions.read (not broad user.view)
    const response = await getApi().get('/Counseling/surgeons');
    const list = response.data ?? [];
    return list
      .map(
        (u: {
          id?: string;
          Id?: string;
          fullName?: string;
          FullName?: string;
          name?: string;
          Name?: string;
        }) => ({
          id: String(u.id ?? u.Id ?? '').trim(),
          name: String(u.fullName ?? u.FullName ?? u.name ?? u.Name ?? '').trim(),
        }),
      )
      .filter((u: { id: string; name: string }) => Boolean(u.id && u.name));
  },

  async getAnesthetists(): Promise<
    { id: string; name: string; employeeId?: string; jobTitle?: string; specialization?: string }[]
  > {
    const response = await getApi().get('/users/anesthetists');
    const list = response.data ?? [];
    return list.map(
      (u: {
        id: string;
        fullName?: string;
        name?: string;
        employeeId?: string;
        jobTitle?: string;
        specialization?: string;
      }) => ({
        id: u.id,
        name: (u.fullName ?? u.name ?? '').trim(),
        employeeId: u.employeeId || undefined,
        jobTitle: u.jobTitle || undefined,
        specialization: u.specialization || undefined,
      }),
    );
  },

  async getOtTheaters(branchId?: string): Promise<{ id: string; name: string }[]> {
    // CounselingController GET /theaters — counseling_sessions.read (not ot.theaters.view)
    const params = branchId ? { branchId } : {};
    const response = await getApi().get('/Counseling/theaters', { params });
    const raw = response.data;
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
    return list
      .map((t: { id?: string; Id?: string; theaterName?: string; TheaterName?: string; name?: string }) => ({
        id: String(t.id ?? t.Id ?? '').trim(),
        name: String(t.theaterName ?? t.TheaterName ?? t.name ?? '').trim(),
      }))
      .filter((t: { id: string; name: string }) => Boolean(t.id && t.name));
  },

  /** @deprecated Use confirmOtSchedule / finaliseOtSchedule / cancelOtSchedule instead. */
  async finalizeSurgery(id: string, data: FinalizeFormData): Promise<void> {
    await getApi().put(`/CounsellorDesk/finalize/${id}`, data);
  },

  async getWardPatients(filters?: { surgeryDate?: string; showDischarged?: boolean }): Promise<WardPatient[]> {
    try {
      const response = await getApi().get('/IPManagement/ward', { params: filters });
      return response.data ?? [];
    } catch {
      if (filters?.showDischarged === false) {
        return MOCK_WARD_PATIENTS.filter((p) => p.status !== 'Discharged');
      }
      return MOCK_WARD_PATIENTS;
    }
  },

  async addPatientToWaitingList(
    data: AddPatientFormData,
    opts?: { branchId?: string | null },
  ): Promise<{ patientName: string; uhid: string }> {
    const branchId = opts?.branchId?.trim() || '';
    if (!data.doctorId?.trim()) {
      throw new Error('Please select a referring doctor.');
    }

    const {
      requireSelectedMpiPatient,
      buildCreateCounsellingSessionPayload,
      findActiveWaitingListDuplicate,
      displayIdentifierForWaitingList,
      matchPatientForAddWaitingList,
    } = await import('@/lib/counsellors-desk/add-patient-to-waiting-list');

    let patientId = data.patientId?.trim() ?? '';
    let displayName = data.patientName?.trim() ?? '';
    let displayUhid = data.uhid?.trim() ?? '';
    let mrnForDup = displayUhid;

    if (patientId) {
      const selected = requireSelectedMpiPatient({
        id: patientId,
        firstName: displayName.split(/\s+/)[0] ?? displayName,
        lastName: displayName.split(/\s+/).slice(1).join(' '),
        mrn: displayUhid || patientId,
      });
      if (!selected.ok) throw new Error(selected.message);
    } else {
      // Legacy fallback: resolve by UHID + name (kept for safety; UI passes patientId).
      const { searchPatientsUnified } = await import('@/lib/patients/unified-patient-search');
      const hits = await searchPatientsUnified(branchId || null, data.uhid.trim(), 25);
      const match = matchPatientForAddWaitingList(hits, data.uhid, data.patientName);
      if (!match.ok) throw new Error(match.message);
      patientId = match.patient.id;
      displayName = `${match.patient.firstName} ${match.patient.lastName}`.trim();
      displayUhid = displayIdentifierForWaitingList(match.patient);
      mrnForDup = match.patient.mrn;
    }

    if (!patientId) {
      throw new Error('Select or register a patient before adding to the waiting list.');
    }

    const existingRows = await this.getWaitingList({
      type: 'All',
      ...(branchId ? { branchId } : {}),
    });
    const duplicate =
      findActiveWaitingListDuplicate({
        uhid: displayUhid,
        patientDisplayName: displayName,
        rows: existingRows,
      }) ??
      (mrnForDup && mrnForDup !== displayUhid
        ? findActiveWaitingListDuplicate({
            uhid: mrnForDup,
            patientDisplayName: displayName,
            rows: existingRows,
          })
        : undefined);

    if (duplicate) {
      throw new Error(
        `${displayName} is already on the waiting list (${duplicate.status}). Open their existing row instead of adding again.`,
      );
    }

    const payload = buildCreateCounsellingSessionPayload({
      patientId,
      branchId: branchId || undefined,
      doctorId: data.doctorId.trim(),
      sessionTypeCode: data.sessionTypeCode,
      surgeryType: data.surgeryType,
      surgeryName: data.surgeryName,
      eye: data.eye,
      remarks: data.remarks,
    });

    try {
      const response = await getApi().post('/Counseling/sessions', payload);
      const result = response.data as { success?: boolean; message?: string } | undefined;
      if (result && result.success === false) {
        throw new Error(result.message || 'Failed to create counselling session.');
      }
      return { patientName: displayName, uhid: displayUhid || mrnForDup };
    } catch (err: unknown) {
      if (err instanceof Error && !('response' in err)) throw err;
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      const apiMessage = axiosErr.response?.data?.message ?? axiosErr.message;
      throw new Error(apiMessage || 'Failed to add patient to waiting list.');
    }
  },

  /** @deprecated Use action-specific methods (confirmOtSchedule, etc.) instead. */
  async updateFinalizeStatus(id: string, status: string): Promise<void> {
    await getApi().patch(`/CounsellorDesk/finalize/${id}/status`, { status });
  },

  /** Investigations for counsellor desk — sourced from Service Catalog only (B2). */
  async getMasterCatalog(): Promise<{ imaging: MasterCatalogItem[]; scan: MasterCatalogItem[]; lab: MasterCatalogItem[] }> {
    const fullCatalog = await serviceCatalogApi.getFullCatalog();
    return buildInvestigationCatalogFromServiceCatalog(fullCatalog);
  },

  async saveInvestigations(sessionId: string, investigations: InvestigationItem[]): Promise<void> {
    await getApi().post(`/Counseling/sessions/${sessionId}/investigations`, { investigations });
  },

  // ============================================================================
  // FOLLOW-UP CENTER ENDPOINTS
  // ============================================================================

  async getActiveFollowups(params?: import('@/types/counsellors-desk').FollowupListQueryParams) {
    const res = await getApi().get('/Counseling/followups/active', { params });
    return res.data as import('@/types/counsellors-desk').FollowupPagedResponse<
      import('@/types/counsellors-desk').ActiveFollowupRecord
    >;
  },

  async getColdLeads(params?: import('@/types/counsellors-desk').FollowupListQueryParams) {
    const res = await getApi().get('/Counseling/followups/cold-leads', { params });
    return res.data as import('@/types/counsellors-desk').FollowupPagedResponse<
      import('@/types/counsellors-desk').ColdLeadRecord
    >;
  },

  async getPostSurgeryFollowups(params?: import('@/types/counsellors-desk').FollowupListQueryParams) {
    const res = await getApi().get('/Counseling/followups/post-surgery', { params });
    return res.data as import('@/types/counsellors-desk').FollowupPagedResponse<
      import('@/types/counsellors-desk').PostSurgeryFollowupRecord
    >;
  },

  /** Filtered population KPIs — not derived from the current list page. */
  async getFollowupStats(params?: {
    branchId?: string;
    intention?: string;
    q?: string;
  }) {
    const res = await getApi().get('/Counseling/followups/stats', { params });
    return res.data as import('@/types/counsellors-desk').FollowupStatsResponse;
  },

  async reQueueSession(sessionId: string, payload: import('@/types/counsellors-desk').ReQueuePayload) {
    const res = await getApi().post(`/Counseling/sessions/${sessionId}/re-queue`, payload);
    return res.data as { success: boolean; tokenNumber: string; queueItemId: string; message: string };
  },

  async logCommunication(
    sessionId: string,
    payload: {
      channel: string;
      direction?: string;
      communicationAt?: string;
      outcome: string;
      callDurationMinutes?: number;
      messageBody?: string;
      responseSummary?: string;
      nextAction?: string;
      nextActionDate?: string;
    }
  ) {
    const res = await getApi().post(`/Counseling/sessions/${sessionId}/communication-logs`, {
      ...payload,
      direction: payload.direction ?? 'Outbound',
    });
    return res.data;
  },

  async scheduleCallback(
    sessionId: string,
    payload: {
      callbackDate: string;
      callbackReason?: string;
      preferredChannel?: string;
      callbackType?: string;
    }
  ) {
    const res = await getApi().post(`/Counseling/sessions/${sessionId}/callbacks`, {
      callbackType: callbackTypeCodeToDb(payload.callbackType ?? 'General'),
      callbackDate: payload.callbackDate,
      channel: callbackChannelToDb(payload.preferredChannel ?? 'Phone'),
      callbackNotes: payload.callbackReason,
    });
    return res.data;
  },

  async getSessionCommHistory(sessionId: string) {
    const res = await getApi().get(`/Counseling/sessions/${sessionId}/communication-logs`);
    return res.data as Array<{
      id: string;
      channel: string;
      direction: string;
      outcome: string | null;
      communicationAt: string;
      messageBody: string | null;
      nextAction: string | null;
      nextActionDate: string | null;
      callDurationMinutes: number | null;
    }>;
  },

  async sendReminder(patientId: string, payload: import('@/types/counsellors-desk').SendReminderPayload) {
    const res = await getApi().post(`/Counseling/patients/${patientId}/reminders`, payload);
    return res.data as { success: boolean; loggedToSession: boolean; channel: string; sentAt: string; message: string };
  },
};
