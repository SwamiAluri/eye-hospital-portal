/**
 * Pre-Operative Instructions Widget — Redesigned
 *
 * Full-width 3-column layout:
 *  Col 1 (22%): Clinical Brief — VA, IOP, diagnosis, comorbidities, shared patient history
 *  Col 2 (38%): Medical History — DM/HTN/Heart/Allergies + current medications
 *  Col 3 (40%): Required Investigations — catalog with prices + cart / order flow
 *
 * Investigation prices are loaded from the DB-backed lab catalog API with a
 * static fallback config so the widget never breaks if the API is unavailable.
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  FileText,
  Users,
  Plus,
  Loader2,
  ChevronDown,
  ChevronRight,
  X,
  FlaskConical,
  Heart,
  Microscope,
  Stethoscope,
  ShoppingCart,
  AlertCircle,
  Trash2,
  Clock,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { WidgetProps } from '@/lib/widgets/widget-types';
import { getApi } from '@/lib/api';
import { labOrdersApi } from '@/lib/api/lab-orders.api';
import type { LabTestCatalogItem, CounselorLabOrderItem } from '@/lib/api/lab-orders.api';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ChronicCondition    { id: string; name: string; diagnosedYear?: string; severity?: string; status?: string; notes?: string; addedBy?: 'Optometrist' | 'Counselor'; }
interface PatientMedication   { id: string; name: string; dosage?: string; frequency?: string; startDate?: string; route?: string; notes?: string; addedBy?: 'Optometrist' | 'Counselor'; }
interface PatientAllergy      { id: string; name: string; type?: string; severity?: string; reactions?: string; notes?: string; addedBy?: 'Optometrist' | 'Counselor'; }
interface PatientSurgery      { id: string; name: string; date?: string; outcome?: string; notes?: string; addedBy?: 'Optometrist' | 'Counselor'; }
interface FamilyCondition     { id: string; condition: string; relationship?: string; ageOfOnset?: string; notes?: string; }
interface PatientImmunization { id: string; vaccine: string; date?: string; doseNumber?: string; notes?: string; }

function tryParseJSON<T>(val: any): T[] {
  if (!val) return [];
  if (Array.isArray(val)) return val as T[];
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; }
}

interface ClinicalBrief {
  diagnosis?: string;
  visualAcuityRight?: string;
  visualAcuityLeft?: string;
  iopRight?: number;
  iopLeft?: number;
  recommendedSurgery?: string;
  comorbidities?: string[];
}

type Urgency = 'Routine' | 'Urgent' | 'STAT';

// ─── Static fallback investigation catalog ─────────────────────────────────────
// Used when the API catalog call fails or is loading — ensures the widget is
// always functional offline / during network hiccups.

interface StaticTestEntry {
  testCode: string;
  testName: string;
  category: string;
  price: number;
}

const STATIC_CATALOG: StaticTestEntry[] = [
  // General
  { testCode: 'FBS001',        testName: 'FBS',              category: 'General Investigations', price: 150  },
  { testCode: 'PLBS001',       testName: 'PLBS',             category: 'General Investigations', price: 150  },
  { testCode: 'RBS001',        testName: 'RBS',              category: 'General Investigations', price: 80   },
  { testCode: 'HBA1C001',      testName: 'HbA1c',            category: 'General Investigations', price: 350  },
  // Cardiac
  { testCode: 'ECG001',        testName: 'ECG',              category: 'Cardiac Investigations', price: 250  },
  { testCode: 'ECHO001',       testName: '2D ECHO',          category: 'Cardiac Investigations', price: 1200 },
  { testCode: 'LIPID001',      testName: 'LIPID Profile',    category: 'Cardiac Investigations', price: 400  },
  { testCode: 'BUN001',        testName: 'Blood Urea',       category: 'Cardiac Investigations', price: 150  },
  // Viral Markers
  { testCode: 'HIV001',        testName: 'HIV-I & II',       category: 'Viral Markers',          price: 300  },
  { testCode: 'HBSAG001',      testName: 'HBsAg',            category: 'Viral Markers',          price: 200  },
  { testCode: 'HCV001',        testName: 'HCV',              category: 'Viral Markers',          price: 350  },
  { testCode: 'BP-VITALS-001', testName: 'BP',               category: 'Viral Markers',          price: 0    },
  { testCode: 'CBC001',        testName: 'CBP',              category: 'Viral Markers',          price: 200  },
  { testCode: 'SCREAT001',     testName: 'Serum Creatinine', category: 'Viral Markers',          price: 150  },
  { testCode: 'BTCT001',       testName: 'BT/CT',            category: 'Viral Markers',          price: 100  },
  { testCode: 'RTPCR001',      testName: 'RT PCR',           category: 'Viral Markers',          price: 800  },
  // Pre-Op Panel
  { testCode: 'SURG-PROF-001', testName: 'Surgical Profile', category: 'Pre-Operative Panel',    price: 1950 },
];

const CATEGORY_ORDER = [
  'General Investigations',
  'Cardiac Investigations',
  'Viral Markers',
  'Pre-Operative Panel',
];

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  'General Investigations': <FlaskConical className="h-3.5 w-3.5" />,
  'Cardiac Investigations':  <Heart         className="h-3.5 w-3.5" />,
  'Viral Markers':           <Microscope    className="h-3.5 w-3.5" />,
  'Pre-Operative Panel':     <Stethoscope   className="h-3.5 w-3.5" />,
};

const CATEGORY_COLOR: Record<string, string> = {
  'General Investigations': 'text-blue-600',
  'Cardiac Investigations':  'text-rose-600',
  'Viral Markers':           'text-purple-600',
  'Pre-Operative Panel':     'text-amber-600',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(price: number) {
  return price === 0 ? 'Free' : `₹${price.toLocaleString('en-IN')}`;
}

// Map API LabTestCatalogItem → StaticTestEntry shape for unified rendering
function catalogToStatic(items: LabTestCatalogItem[]): StaticTestEntry[] {
  return items.map((item) => {
    let displayCategory = item.category || 'General Investigations';
    if (/blood.?sugar|diabete/i.test(displayCategory))             displayCategory = 'General Investigations';
    if (/cardiac|ecg|echo/i.test(displayCategory))                 displayCategory = 'Cardiac Investigations';
    if (/serology|viral|molecular|haematol/i.test(displayCategory)) displayCategory = 'Viral Markers';
    if (/biochemi/i.test(displayCategory) && !/lipid|urea/i.test(item.testName)) displayCategory = 'Viral Markers';
    if (/haematol|blood.?count/i.test(displayCategory))            displayCategory = 'Viral Markers';
    if (/pre.?op|panel/i.test(displayCategory))                    displayCategory = 'Pre-Operative Panel';
    if (/vitals/i.test(displayCategory))                           displayCategory = 'Viral Markers';
    return {
      testCode: item.testCode || item.id,
      testName: item.testName,
      category: displayCategory,
      price: item.price ?? 0,
    };
  });
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function PreOperativeInstructionsWidget({
  patientId,
  sessionId,
  data,
  onDataChange,
}: WidgetProps) {
  // ── Medical history state (synced from patient record) ──
  const [chronicConditions,  setChronicConditions]  = useState<ChronicCondition[]>([]);
  const [patientMedications, setPatientMedications] = useState<PatientMedication[]>([]);
  const [knownAllergies,     setKnownAllergies]     = useState<PatientAllergy[]>([]);
  const [pastSurgeries,      setPastSurgeries]      = useState<PatientSurgery[]>([]);
  const [familyHistory,      setFamilyHistory]      = useState<FamilyCondition[]>([]);
  const [immunizations,      setImmunizations]      = useState<PatientImmunization[]>([]);
  const [smokingStatus,      setSmokingStatus]      = useState('');
  const [alcoholUse,         setAlcoholUse]         = useState('');
  const [patientDataLoading, setPatientDataLoading] = useState(true);
  const [addingTo,    setAddingTo]    = useState<string | null>(null);
  const [newEntry,    setNewEntry]    = useState<Record<string, string>>({});
  const [savingEntry, setSavingEntry] = useState(false);

  // ── Clinical brief (read from session API) ──
  const [clinicalBrief, setClinicalBrief] = useState<ClinicalBrief>(
    (data as any)?.clinicalBrief ?? {}
  );
  const [clinicalLoading, setClinicalLoading] = useState(false);

  // ── Investigation catalog ──
  const [catalog, setCatalog] = useState<StaticTestEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // ── Staged selections (not yet ordered) ──
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

  // ── Already ordered items persisted in backend ──
  const [orderedItems, setOrderedItems] = useState<CounselorLabOrderItem[]>(
    (data as any)?.orderedItems ?? []
  );

  // ── Urgency for ordering ──
  const [urgency, setUrgency] = useState<Urgency>('Routine');

  // ── Loading states ──
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Load clinical brief from session API ──
  useEffect(() => {
    if (!sessionId) return;
    setClinicalLoading(true);
    getApi().get(`/counseling/sessions/${sessionId}`)
      .then((res) => {
        const s = res.data;
        setClinicalBrief({
          diagnosis: s.diagnosis,
          visualAcuityRight: s.visualAcuityRight,
          visualAcuityLeft: s.visualAcuityLeft,
          iopRight: s.iopRight,
          iopLeft: s.iopLeft,
          recommendedSurgery: s.recommendedSurgery || s.recommendedSurgeryType,
          comorbidities: s.comorbidities
            ? (Array.isArray(s.comorbidities) ? s.comorbidities : [s.comorbidities])
            : undefined,
        });
      })
      .catch(() => { /* non-critical */ })
      .finally(() => setClinicalLoading(false));
  }, [sessionId]);

  // ── Load patient medical history (from patient entity, synced with optometrist data) ──
  useEffect(() => {
    if (!patientId) { setPatientDataLoading(false); return; }
    setPatientDataLoading(true);
    getApi().get(`/patients/${patientId}`)
      .then(res => {
        const p = res.data;
        setChronicConditions(tryParseJSON<ChronicCondition>(p.chronicConditions));
        setPatientMedications(tryParseJSON<PatientMedication>(p.currentMedications));
        setKnownAllergies(tryParseJSON<PatientAllergy>(p.knownAllergiesDetails));
        setPastSurgeries(tryParseJSON<PatientSurgery>(p.pastSurgeries));
        setFamilyHistory(tryParseJSON<FamilyCondition>(p.familyMedicalHistory));
        setImmunizations(tryParseJSON<PatientImmunization>(p.immunizationRecords));
        setSmokingStatus(p.smokingStatus || '');
        setAlcoholUse(p.alcoholUse || '');
      })
      .catch(() => {})
      .finally(() => setPatientDataLoading(false));
  }, [patientId]);

  // ── Load lab catalog (API-first, fallback to STATIC_CATALOG) ──
  useEffect(() => {
    labOrdersApi.getLabCatalog(true)
      .then((items) => {
        if (items.length > 0) {
          setCatalog(catalogToStatic(items));
        } else {
          setCatalog(STATIC_CATALOG);
        }
      })
      .catch(() => setCatalog(STATIC_CATALOG))
      .finally(() => setCatalogLoading(false));
  }, []);

  // ── Load existing session lab orders ──
  useEffect(() => {
    if (!sessionId) return;
    labOrdersApi.getSessionLabOrders(sessionId)
      .then((items) => { if (items.length > 0) setOrderedItems(items); })
      .catch(() => { /* non-critical */ });
  }, [sessionId]);

  // ── Add entry to a medical history section ──
  const handleAddEntry = async () => {
    if (!patientId || !addingTo || savingEntry) return;
    setSavingEntry(true);
    try {
      let updatePayload: Record<string, string> = {};
      let auditName = ''; let auditCategory = ''; let auditDetail = '';

      if (addingTo === 'chronic' && newEntry.name?.trim()) {
        const item: ChronicCondition = { id: `c-${Date.now()}`, name: newEntry.name.trim(), severity: newEntry.severity || undefined, status: newEntry.status || 'Active', addedBy: 'Counselor' };
        const updated = [...chronicConditions, item]; setChronicConditions(updated);
        updatePayload = { chronicConditions: JSON.stringify(updated) };
        auditName = item.name; auditCategory = 'Chronic Condition';
        auditDetail = [item.severity && `Severity: ${item.severity}`, item.status && `Status: ${item.status}`].filter(Boolean).join('; ');
      } else if (addingTo === 'medication' && newEntry.name?.trim()) {
        const item: PatientMedication = { id: `m-${Date.now()}`, name: newEntry.name.trim(), dosage: newEntry.dosage || undefined, frequency: newEntry.frequency || undefined, route: newEntry.route || undefined, addedBy: 'Counselor' };
        const updated = [...patientMedications, item]; setPatientMedications(updated);
        updatePayload = { currentMedications: JSON.stringify(updated) };
        auditName = item.name; auditCategory = 'Medication';
        auditDetail = [item.dosage, item.frequency, item.route].filter(Boolean).join(', ');
      } else if (addingTo === 'allergy' && newEntry.name?.trim()) {
        const item: PatientAllergy = { id: `a-${Date.now()}`, name: newEntry.name.trim(), type: newEntry.type || undefined, severity: newEntry.severity || undefined, addedBy: 'Counselor' };
        const updated = [...knownAllergies, item]; setKnownAllergies(updated);
        updatePayload = { knownAllergiesDetails: JSON.stringify(updated) };
        auditName = item.name; auditCategory = 'Allergy';
        auditDetail = [item.type, item.severity].filter(Boolean).join('; ');
      } else if (addingTo === 'surgery' && newEntry.name?.trim()) {
        const item: PatientSurgery = { id: `s-${Date.now()}`, name: newEntry.name.trim(), date: newEntry.date || undefined, outcome: newEntry.outcome || undefined, addedBy: 'Counselor' };
        const updated = [...pastSurgeries, item]; setPastSurgeries(updated);
        updatePayload = { pastSurgeries: JSON.stringify(updated) };
        auditName = item.name; auditCategory = 'Past Surgery';
        auditDetail = item.date ? `Date: ${item.date}` : '';
      } else if (addingTo === 'family' && newEntry.condition?.trim()) {
        const item: FamilyCondition = { id: `f-${Date.now()}`, condition: newEntry.condition.trim(), relationship: newEntry.relationship || undefined, ageOfOnset: newEntry.ageOfOnset || undefined };
        const updated = [...familyHistory, item]; setFamilyHistory(updated);
        updatePayload = { familyMedicalHistory: JSON.stringify(updated) };
        auditName = item.condition; auditCategory = 'Family History';
        auditDetail = [item.relationship && `Relation: ${item.relationship}`, item.ageOfOnset && `Onset: ${item.ageOfOnset}`].filter(Boolean).join('; ');
      } else if (addingTo === 'immunization' && newEntry.vaccine?.trim()) {
        const item: PatientImmunization = { id: `i-${Date.now()}`, vaccine: newEntry.vaccine.trim(), date: newEntry.date || undefined, doseNumber: newEntry.doseNumber || undefined };
        const updated = [...immunizations, item]; setImmunizations(updated);
        updatePayload = { immunizationRecords: JSON.stringify(updated) };
        auditName = item.vaccine; auditCategory = 'Immunization';
        auditDetail = [item.date && `Date: ${item.date}`, item.doseNumber && `Dose: ${item.doseNumber}`].filter(Boolean).join('; ');
      } else if (addingTo === 'lifestyle') {
        const ls = newEntry.smokingStatus ?? smokingStatus;
        const ac = newEntry.alcoholUse ?? alcoholUse;
        setSmokingStatus(ls); setAlcoholUse(ac);
        updatePayload = { smokingStatus: ls, alcoholUse: ac };
        auditName = 'Lifestyle Update'; auditCategory = 'Lifestyle';
        auditDetail = [ls && `Smoking: ${ls}`, ac && `Alcohol: ${ac}`].filter(Boolean).join('; ');
      } else {
        setSavingEntry(false); return;
      }
      await getApi().put(`/patients/${patientId}`, updatePayload);
      await getApi().post('/patient-medical-history', {
        patientId, conditionName: auditName, conditionCategory: auditCategory,
        details: `Added by Counselor during pre-op. ${auditDetail}`.trim(),
      });
      setAddingTo(null); setNewEntry({});
      onDataChange?.({ orderedItems, confirmed: false });
      toast.success('Saved to patient record');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save');
    } finally {
      setSavingEntry(false);
    }
  };

  // ── Investigation selection ──
  const toggleTest = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  const findItem = (code: string) => catalog.find((c) => c.testCode === code);

  // ── Order selected investigations ──
  const handleOrderSelected = async () => {
    if (selectedCodes.size === 0) { toast.error('Select at least one test to order'); return; }
    if (!patientId || !sessionId) { toast.error('Patient or session context is missing'); return; }

    const tests = Array.from(selectedCodes)
      .map((code) => {
        const item = findItem(code);
        if (!item) return null;
        return { testCode: item.testCode, testName: item.testName, price: item.price };
      })
      .filter(Boolean) as { testCode: string; testName: string; price: number }[];

    setSubmittingOrder(true);
    try {
      const result = await labOrdersApi.createLabOrders({ patientId, sessionId, tests, urgency });

      const newItems: CounselorLabOrderItem[] = (result.items as any[])?.length
        ? (result.items as any[]).map((i: any) => ({
            id: i.id ?? '',
            testName: i.testName,
            testCode: i.testCode,
            price: i.price,
            status: 'Pending' as const,
            urgency,
            orderedAt: i.orderedAt ?? new Date().toISOString(),
          }))
        : tests.map((t) => ({
            id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
            testName: t.testName,
            testCode: t.testCode,
            price: t.price,
            status: 'Pending' as const,
            urgency,
            orderedAt: new Date().toISOString(),
          }));

      const updated = [...orderedItems, ...newItems];
      setOrderedItems(updated);
      setSelectedCodes(new Set());
      onDataChange?.({ orderedItems: updated, confirmed: false });
      toast.success(`${tests.length} test${tests.length > 1 ? 's' : ''} ordered`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to place order');
    } finally {
      setSubmittingOrder(false);
    }
  };

  // ── Remove ordered item ──
  const handleRemoveOrder = async (item: CounselorLabOrderItem, idx: number) => {
    setDeletingId(item.id);
    try {
      if (item.id && !/^[0-9]/.test(item.id)) {
        await labOrdersApi.deleteLabOrder(item.id);
      }
      const updated = orderedItems.filter((_, i) => i !== idx);
      setOrderedItems(updated);
      onDataChange?.({ orderedItems: updated, confirmed: false });
    } catch {
      toast.error('Failed to remove test');
    } finally {
      setDeletingId(null);
    }
  };

  const totalOrdered = orderedItems.length;
  const totalCost = orderedItems.reduce((sum, i) => sum + (i.price ?? 0), 0);
  const selectedTotal = Array.from(selectedCodes).reduce((sum, code) => sum + (findItem(code)?.price ?? 0), 0);

  // Group catalog by category
  const catalogByCategory: Record<string, StaticTestEntry[]> = {};
  for (const item of catalog) {
    if (!catalogByCategory[item.category]) catalogByCategory[item.category] = [];
    catalogByCategory[item.category].push(item);
  }

  return (
    <div className="flex gap-0 h-full overflow-hidden">
      {/* ═══════════════════════════════════════════════════════════
          COLUMN 1 — Clinical Brief
      ═══════════════════════════════════════════════════════════ */}
      <div className="w-[22%] flex-shrink-0 flex flex-col h-full border-r border-gray-100 overflow-y-auto hide-scrollbar bg-gradient-to-b from-slate-50 to-white">
        {/* Header */}
        <div className="px-3 pt-3 pb-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="h-4 w-4 text-red-500" />
            <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">Pre-Op Assessment</span>
          </div>
          <div className="text-[10px] text-gray-400">{totalOrdered} investigation{totalOrdered !== 1 ? 's' : ''} ordered</div>
        </div>

        {/* Clinical Brief Card */}
        <div className="mx-2 mb-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-shrink-0">
          <div className="bg-blue-600 px-3 py-2">
            <p className="text-[11px] font-semibold text-white">Clinical Summary</p>
            {clinicalBrief.recommendedSurgery && (
              <p className="text-[10px] text-blue-200 mt-0.5 truncate">{clinicalBrief.recommendedSurgery}</p>
            )}
          </div>

          {clinicalLoading ? (
            <div className="p-3 flex items-center gap-2 text-gray-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="text-xs">Loading…</span>
            </div>
          ) : (
            <div className="p-3 space-y-3">
              {clinicalBrief.diagnosis && (
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-gray-400 font-bold mb-1">Diagnosis</p>
                  <p className="text-xs font-semibold text-gray-800">{clinicalBrief.diagnosis}</p>
                </div>
              )}

              {(clinicalBrief.visualAcuityRight || clinicalBrief.visualAcuityLeft) && (
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-gray-400 font-bold mb-1">Visual Acuity</p>
                  <table className="w-full text-[10px]">
                    <tbody>
                      {clinicalBrief.visualAcuityRight && (
                        <tr>
                          <td className="text-gray-500 pr-2 font-medium">RE</td>
                          <td className="text-gray-900 font-semibold">{clinicalBrief.visualAcuityRight}</td>
                        </tr>
                      )}
                      {clinicalBrief.visualAcuityLeft && (
                        <tr>
                          <td className="text-gray-500 pr-2 font-medium">LE</td>
                          <td className="text-gray-900 font-semibold">{clinicalBrief.visualAcuityLeft}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {(clinicalBrief.iopRight || clinicalBrief.iopLeft) && (
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-gray-400 font-bold mb-1">IOP</p>
                  <div className="flex flex-wrap gap-1">
                    {clinicalBrief.iopRight && (
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-semibold">
                        RE {clinicalBrief.iopRight} mmHg
                      </span>
                    )}
                    {clinicalBrief.iopLeft && (
                      <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-semibold">
                        LE {clinicalBrief.iopLeft} mmHg
                      </span>
                    )}
                  </div>
                </div>
              )}

              {clinicalBrief.comorbidities && clinicalBrief.comorbidities.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-gray-400 font-bold mb-1">Comorbidities</p>
                  <div className="flex flex-wrap gap-1">
                    {clinicalBrief.comorbidities.map((c) => (
                      <span key={c} className="text-[9px] bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-full font-medium">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {!clinicalBrief.diagnosis && !clinicalBrief.visualAcuityRight && !clinicalBrief.iopRight && (
                <p className="text-[10px] text-gray-400 italic">No clinical data recorded yet.</p>
              )}
            </div>
          )}
        </div>

      </div>

      {/* ═══════════════════════════════════════════════════════════
          COLUMN 2 — Medical History
      ═══════════════════════════════════════════════════════════ */}
      <div className="w-[38%] flex-shrink-0 flex flex-col h-full border-r border-gray-100">
        {/* Sticky column header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <h4 className="text-sm font-bold text-gray-900">Medical History</h4>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
            <span className="bg-teal-100 text-teal-700 font-bold px-1.5 py-0.5 rounded">Opt.</span>
            <span className="text-gray-300">=</span>
            <span>Optometrist</span>
            <span className="ml-1.5 bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded">Cnslr</span>
            <span className="text-gray-300">=</span>
            <span>Counselor</span>
          </div>
        </div>
        {/* Scrollable content */}
        <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-4 pt-3 pb-2 space-y-3">

          {patientDataLoading ? (
            <div className="flex items-center gap-2 pt-4 text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Loading patient history…</span>
            </div>
          ) : (
            <>
              {/* ── Chronic Conditions ── */}
              <MedHistorySection
                icon={<Heart className="h-3.5 w-3.5" />}
                title="Chronic Conditions"
                color="rose"
                canAdd
                addingTo={addingTo}
                sectionKey="chronic"
                onStartAdd={() => { setAddingTo('chronic'); setNewEntry({}); }}
                onCancelAdd={() => setAddingTo(null)}
                saving={savingEntry}
                onSave={handleAddEntry}
                addForm={
                  <div className="space-y-1.5 pt-2">
                    <input autoFocus type="text" placeholder="Condition name *" value={newEntry.name || ''} onChange={e => setNewEntry(p => ({ ...p, name: e.target.value }))} className="w-full px-2 py-1.5 border border-blue-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    <div className="grid grid-cols-2 gap-1.5">
                      <select value={newEntry.severity || ''} onChange={e => setNewEntry(p => ({ ...p, severity: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                        <option value="">Severity…</option>
                        <option>Mild</option><option>Moderate</option><option>Severe</option>
                      </select>
                      <select value={newEntry.status || 'Active'} onChange={e => setNewEntry(p => ({ ...p, status: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                        <option>Active</option><option>Controlled</option><option>Resolved</option>
                      </select>
                    </div>
                  </div>
                }
              >
                {chronicConditions.length === 0 ? (
                  <p className="text-[10px] text-gray-400 italic py-1">No conditions recorded yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {chronicConditions.map(c => (
                      <div key={c.id} className="flex items-start gap-1.5 py-1">
                        <SourceBadge source={c.addedBy} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800">{c.name}</p>
                          {(c.severity || c.status) && (
                            <p className="text-[10px] text-gray-400">{[c.severity, c.status].filter(Boolean).join(' · ')}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </MedHistorySection>

              {/* ── Medications ── */}
              <MedHistorySection
                icon={<Activity className="h-3.5 w-3.5" />}
                title="Current Medications"
                color="blue"
                canAdd
                addingTo={addingTo}
                sectionKey="medication"
                onStartAdd={() => { setAddingTo('medication'); setNewEntry({}); }}
                onCancelAdd={() => setAddingTo(null)}
                saving={savingEntry}
                onSave={handleAddEntry}
                addForm={
                  <div className="space-y-1.5 pt-2">
                    <input autoFocus type="text" placeholder="Medication name *" value={newEntry.name || ''} onChange={e => setNewEntry(p => ({ ...p, name: e.target.value }))} className="w-full px-2 py-1.5 border border-blue-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    <div className="grid grid-cols-3 gap-1.5">
                      <input type="text" placeholder="Dose" value={newEntry.dosage || ''} onChange={e => setNewEntry(p => ({ ...p, dosage: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      <input type="text" placeholder="Frequency" value={newEntry.frequency || ''} onChange={e => setNewEntry(p => ({ ...p, frequency: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      <input type="text" placeholder="Route" value={newEntry.route || ''} onChange={e => setNewEntry(p => ({ ...p, route: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </div>
                  </div>
                }
              >
                {patientMedications.length === 0 ? (
                  <p className="text-[10px] text-gray-400 italic py-1">No medications recorded yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {patientMedications.map(m => (
                      <div key={m.id} className="flex items-start gap-1.5 py-1">
                        <SourceBadge source={m.addedBy} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800">{m.name}</p>
                          {(m.dosage || m.frequency || m.route) && (
                            <p className="text-[10px] text-gray-400">{[m.dosage, m.frequency, m.route].filter(Boolean).join(' · ')}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </MedHistorySection>

              {/* ── Allergies ── */}
              <MedHistorySection
                icon={<AlertCircle className="h-3.5 w-3.5" />}
                title="Known Allergies"
                color="amber"
                canAdd
                addingTo={addingTo}
                sectionKey="allergy"
                onStartAdd={() => { setAddingTo('allergy'); setNewEntry({}); }}
                onCancelAdd={() => setAddingTo(null)}
                saving={savingEntry}
                onSave={handleAddEntry}
                addForm={
                  <div className="space-y-1.5 pt-2">
                    <input autoFocus type="text" placeholder="Allergen name *" value={newEntry.name || ''} onChange={e => setNewEntry(p => ({ ...p, name: e.target.value }))} className="w-full px-2 py-1.5 border border-blue-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    <div className="grid grid-cols-2 gap-1.5">
                      <select value={newEntry.type || ''} onChange={e => setNewEntry(p => ({ ...p, type: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                        <option value="">Type…</option>
                        <option>Drug</option><option>Food</option><option>Environmental</option><option>Latex</option>
                      </select>
                      <select value={newEntry.severity || ''} onChange={e => setNewEntry(p => ({ ...p, severity: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                        <option value="">Severity…</option>
                        <option>Mild</option><option>Moderate</option><option>Severe</option><option>Anaphylaxis</option>
                      </select>
                    </div>
                  </div>
                }
              >
                {knownAllergies.length === 0 ? (
                  <p className="text-[10px] text-gray-400 italic py-1">No allergies recorded yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {knownAllergies.map(a => (
                      <div key={a.id} className="flex items-start gap-1.5 py-1">
                        <SourceBadge source={a.addedBy} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800">{a.name}</p>
                          {(a.type || a.severity) && (
                            <p className="text-[10px] text-gray-400">{[a.type, a.severity].filter(Boolean).join(' · ')}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </MedHistorySection>

              {/* ── Past Surgeries ── */}
              <MedHistorySection
                icon={<Stethoscope className="h-3.5 w-3.5" />}
                title="Past Surgeries"
                color="purple"
                canAdd
                addingTo={addingTo}
                sectionKey="surgery"
                onStartAdd={() => { setAddingTo('surgery'); setNewEntry({}); }}
                onCancelAdd={() => setAddingTo(null)}
                saving={savingEntry}
                onSave={handleAddEntry}
                addForm={
                  <div className="space-y-1.5 pt-2">
                    <input autoFocus type="text" placeholder="Surgery name *" value={newEntry.name || ''} onChange={e => setNewEntry(p => ({ ...p, name: e.target.value }))} className="w-full px-2 py-1.5 border border-blue-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    <div className="grid grid-cols-2 gap-1.5">
                      <input type="text" placeholder="Date (e.g. 2022)" value={newEntry.date || ''} onChange={e => setNewEntry(p => ({ ...p, date: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      <input type="text" placeholder="Outcome" value={newEntry.outcome || ''} onChange={e => setNewEntry(p => ({ ...p, outcome: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </div>
                  </div>
                }
              >
                {pastSurgeries.length === 0 ? (
                  <p className="text-[10px] text-gray-400 italic py-1">No surgeries recorded yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {pastSurgeries.map(s => (
                      <div key={s.id} className="flex items-start gap-1.5 py-1">
                        <SourceBadge source={s.addedBy} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800">{s.name}</p>
                          {(s.date || s.outcome) && (
                            <p className="text-[10px] text-gray-400">{[s.date, s.outcome].filter(Boolean).join(' · ')}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </MedHistorySection>

              {/* ── Family History ── */}
              <MedHistorySection
                icon={<Users className="h-3.5 w-3.5" />}
                title="Family History"
                color="indigo"
                canAdd
                addingTo={addingTo}
                sectionKey="family"
                onStartAdd={() => { setAddingTo('family'); setNewEntry({}); }}
                onCancelAdd={() => setAddingTo(null)}
                saving={savingEntry}
                onSave={handleAddEntry}
                addForm={
                  <div className="space-y-1.5 pt-2">
                    <input autoFocus type="text" placeholder="Condition / Disease *" value={newEntry.condition || ''} onChange={e => setNewEntry(p => ({ ...p, condition: e.target.value }))} className="w-full px-2 py-1.5 border border-blue-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    <div className="grid grid-cols-2 gap-1.5">
                      <select value={newEntry.relationship || ''} onChange={e => setNewEntry(p => ({ ...p, relationship: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                        <option value="">Relation…</option>
                        <option>Father</option><option>Mother</option><option>Sibling</option><option>Grandparent</option><option>Other</option>
                      </select>
                      <input type="text" placeholder="Age of onset" value={newEntry.ageOfOnset || ''} onChange={e => setNewEntry(p => ({ ...p, ageOfOnset: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </div>
                  </div>
                }
              >
                {familyHistory.length === 0 ? (
                  <p className="text-[10px] text-gray-400 italic py-1">No family history recorded.</p>
                ) : (
                  <div className="space-y-1.5">
                    {familyHistory.map(f => (
                      <div key={f.id} className="py-1">
                        <p className="text-xs font-semibold text-gray-800">{f.condition}</p>
                        {(f.relationship || f.ageOfOnset) && (
                          <p className="text-[10px] text-gray-400">{[f.relationship, f.ageOfOnset && `onset: ${f.ageOfOnset}`].filter(Boolean).join(' · ')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </MedHistorySection>

              {/* ── Immunizations ── */}
              <MedHistorySection
                icon={<Microscope className="h-3.5 w-3.5" />}
                title="Immunizations"
                color="green"
                canAdd
                addingTo={addingTo}
                sectionKey="immunization"
                onStartAdd={() => { setAddingTo('immunization'); setNewEntry({}); }}
                onCancelAdd={() => setAddingTo(null)}
                saving={savingEntry}
                onSave={handleAddEntry}
                addForm={
                  <div className="space-y-1.5 pt-2">
                    <input autoFocus type="text" placeholder="Vaccine name *" value={newEntry.vaccine || ''} onChange={e => setNewEntry(p => ({ ...p, vaccine: e.target.value }))} className="w-full px-2 py-1.5 border border-blue-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    <div className="grid grid-cols-2 gap-1.5">
                      <input type="text" placeholder="Date (e.g. 2023)" value={newEntry.date || ''} onChange={e => setNewEntry(p => ({ ...p, date: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      <input type="text" placeholder="Dose # (e.g. 2)" value={newEntry.doseNumber || ''} onChange={e => setNewEntry(p => ({ ...p, doseNumber: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </div>
                  </div>
                }
              >
                {immunizations.length === 0 ? (
                  <p className="text-[10px] text-gray-400 italic py-1">No immunizations recorded.</p>
                ) : (
                  <div className="space-y-1.5">
                    {immunizations.map(imm => (
                      <div key={imm.id} className="py-1">
                        <p className="text-xs font-semibold text-gray-800">{imm.vaccine}</p>
                        {(imm.date || imm.doseNumber) && (
                          <p className="text-[10px] text-gray-400">{[imm.date, imm.doseNumber && `Dose ${imm.doseNumber}`].filter(Boolean).join(' · ')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </MedHistorySection>

              {/* ── Lifestyle ── */}
              <MedHistorySection
                icon={<Activity className="h-3.5 w-3.5" />}
                title="Lifestyle Factors"
                color="orange"
                canAdd
                addingTo={addingTo}
                sectionKey="lifestyle"
                onStartAdd={() => { setAddingTo('lifestyle'); setNewEntry({ smokingStatus, alcoholUse }); }}
                onCancelAdd={() => setAddingTo(null)}
                saving={savingEntry}
                onSave={handleAddEntry}
                addForm={
                  <div className="space-y-1.5 pt-2">
                    <div className="grid grid-cols-2 gap-1.5">
                      <select value={newEntry.smokingStatus || ''} onChange={e => setNewEntry(p => ({ ...p, smokingStatus: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                        <option value="">Smoking…</option>
                        <option>Never</option><option>Former</option><option>Current</option>
                      </select>
                      <select value={newEntry.alcoholUse || ''} onChange={e => setNewEntry(p => ({ ...p, alcoholUse: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                        <option value="">Alcohol…</option>
                        <option>None</option><option>Occasional</option><option>Regular</option>
                      </select>
                    </div>
                  </div>
                }
              >
                {!smokingStatus && !alcoholUse ? (
                  <p className="text-[10px] text-gray-400 italic py-1">No lifestyle data recorded.</p>
                ) : (
                  <div className="space-y-1 py-1">
                    {smokingStatus && <p className="text-xs text-gray-700"><span className="font-medium">Smoking:</span> {smokingStatus}</p>}
                    {alcoholUse && <p className="text-xs text-gray-700"><span className="font-medium">Alcohol:</span> {alcoholUse}</p>}
                  </div>
                )}
              </MedHistorySection>
            </>
          )}

        </div>
        {/* ── Sticky footer ── */}
        <div className="flex-shrink-0 border-t border-gray-100">
          <div className="p-3">
            <button
              onClick={() => onDataChange?.({ orderedItems, confirmed: true })}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors font-semibold text-sm shadow-sm"
            >
              <CheckCircle2 className="h-4 w-4" />
              Complete Pre-Op Assessment
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          COLUMN 3 — Required Investigations
      ═══════════════════════════════════════════════════════════ */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        {/* Column Header */}
        <div className="px-4 pt-3 pb-2 flex-shrink-0 border-b border-gray-100">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-purple-600" />
              <h4 className="text-sm font-bold text-gray-900">Required Investigations</h4>
              {totalOrdered > 0 && (
                <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full">
                  {totalOrdered} ordered
                </span>
              )}
            </div>
            {/* Urgency Selector */}
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
              {(['Routine', 'Urgent', 'STAT'] as Urgency[]).map((u) => (
                <button
                  key={u}
                  onClick={() => setUrgency(u)}
                  className={cn(
                    'px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all',
                    urgency === u
                      ? u === 'STAT'   ? 'bg-red-600 text-white shadow-sm'
                        : u === 'Urgent' ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  {u === 'STAT' ? (
                    <span className="flex items-center gap-0.5"><AlertCircle className="h-2.5 w-2.5" /> {u}</span>
                  ) : u === 'Urgent' ? (
                    <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> {u}</span>
                  ) : u}
                </button>
              ))}
            </div>
          </div>

          {/* Selection preview strip */}
          {selectedCodes.size > 0 && (
            <div className="mt-2 flex items-center justify-between bg-purple-50 rounded-lg px-2.5 py-1.5">
              <span className="text-xs text-purple-700 font-medium">
                {selectedCodes.size} test{selectedCodes.size > 1 ? 's' : ''} selected
                {selectedTotal > 0 && ` — ₹${selectedTotal.toLocaleString('en-IN')}`}
              </span>
              <button onClick={() => setSelectedCodes(new Set())} className="text-[10px] text-purple-500 hover:text-purple-700">
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Catalog */}
        <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-3 py-2 space-y-3">
          {catalogLoading ? (
            <div className="space-y-2 pt-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-3 bg-gray-200 rounded w-32 mb-2" />
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="h-8 bg-gray-100 rounded-lg mb-1" />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            CATEGORY_ORDER.map((category) => {
              const items = catalogByCategory[category];
              if (!items || items.length === 0) return null;
              return (
                <div key={category}>
                  <div className={cn('flex items-center gap-1.5 mb-1.5 px-1', CATEGORY_COLOR[category] || 'text-gray-600')}>
                    {CATEGORY_ICON[category]}
                    <span className="text-[10px] font-bold uppercase tracking-wider">{category}</span>
                  </div>
                  <div className="space-y-0.5">
                    {items.map((item) => {
                      const isSelected = selectedCodes.has(item.testCode);
                      const isOrdered  = orderedItems.some((o) => o.testCode === item.testCode);
                      return (
                        <button
                          key={item.testCode}
                          onClick={() => !isOrdered && toggleTest(item.testCode)}
                          disabled={isOrdered}
                          className={cn(
                            'w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all',
                            isOrdered  ? 'bg-green-50 border border-green-200 cursor-not-allowed'
                              : isSelected ? 'bg-purple-50 border border-purple-300 shadow-sm'
                              : 'bg-white border border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={cn(
                              'h-4 w-4 rounded flex items-center justify-center flex-shrink-0 transition-all',
                              isOrdered ? 'bg-green-500' : isSelected ? 'bg-purple-600' : 'border-2 border-gray-300'
                            )}>
                              {(isSelected || isOrdered) && (
                                <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className={cn('text-xs font-medium truncate', isOrdered ? 'text-green-800' : isSelected ? 'text-purple-900' : 'text-gray-800')}>
                              {item.testName}
                            </span>
                            {isOrdered && (
                              <span className="text-[9px] bg-green-100 text-green-700 px-1 py-0.5 rounded font-bold flex-shrink-0">Ordered</span>
                            )}
                          </div>
                          <span className={cn('text-[10px] font-bold flex-shrink-0 ml-2', isOrdered ? 'text-green-700' : isSelected ? 'text-purple-700' : 'text-gray-500')}>
                            {formatPrice(item.price)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Order Button */}
        {selectedCodes.size > 0 && (
          <div className="px-3 py-2 border-t border-gray-100 flex-shrink-0">
            <button
              onClick={handleOrderSelected}
              disabled={submittingOrder}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-60 shadow-sm"
            >
              {submittingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
              {submittingOrder ? 'Ordering…' : `Order ${selectedCodes.size} test${selectedCodes.size > 1 ? 's' : ''} — ${formatPrice(selectedTotal)}`}
            </button>
          </div>
        )}

        {/* Orders Cart */}
        {orderedItems.length > 0 && (
          <div className="flex-shrink-0 border-t border-gray-100 px-3 pt-2 pb-3 max-h-[200px] flex flex-col">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <ShoppingCart className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600">Ordered Tests</span>
              </div>
              <span className="text-[10px] font-bold text-gray-500">Total: ₹{totalCost.toLocaleString('en-IN')}</span>
            </div>
            <div className="space-y-1 overflow-y-auto hide-scrollbar flex-1">
              {orderedItems.map((item, idx) => (
                <div key={item.id || idx} className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
                    <span className="text-xs text-gray-800 font-medium truncate">{item.testName}</span>
                    <span className="text-[9px] bg-gray-200 text-gray-600 px-1 py-0.5 rounded flex-shrink-0">{item.urgency}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-[10px] font-bold text-gray-700">{formatPrice(item.price ?? 0)}</span>
                    <button
                      onClick={() => handleRemoveOrder(item, idx)}
                      disabled={deletingId === item.id}
                      className="p-0.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                    >
                      {deletingId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-component: SourceBadge ───────────────────────────────────────────────

function SourceBadge({ source }: { source?: 'Optometrist' | 'Counselor' }) {
  if (!source) return null;
  return (
    <span className={cn(
      'mt-0.5 flex-shrink-0 text-[8px] font-bold px-1 py-0.5 rounded',
      source === 'Optometrist' ? 'bg-teal-100 text-teal-700' : 'bg-blue-100 text-blue-700'
    )}>
      {source === 'Optometrist' ? 'Opt.' : 'Cnslr'}
    </span>
  );
}

// ─── Sub-component: MedHistorySection ─────────────────────────────────────────

const COLOR_MAP: Record<string, { header: string; border: string; add: string }> = {
  rose:   { header: 'bg-rose-50 border-rose-100',   border: 'border-rose-200',   add: 'text-rose-600 hover:text-rose-700' },
  blue:   { header: 'bg-blue-50 border-blue-100',   border: 'border-blue-200',   add: 'text-blue-600 hover:text-blue-700' },
  amber:  { header: 'bg-amber-50 border-amber-100', border: 'border-amber-200',  add: 'text-amber-600 hover:text-amber-700' },
  purple: { header: 'bg-purple-50 border-purple-100', border: 'border-purple-200', add: 'text-purple-600 hover:text-purple-700' },
  indigo: { header: 'bg-indigo-50 border-indigo-100', border: 'border-indigo-200', add: 'text-indigo-600 hover:text-indigo-700' },
  green:  { header: 'bg-green-50 border-green-100', border: 'border-green-200',  add: 'text-green-600 hover:text-green-700' },
  orange: { header: 'bg-orange-50 border-orange-100', border: 'border-orange-200', add: 'text-orange-600 hover:text-orange-700' },
};

function MedHistorySection({
  icon,
  title,
  color,
  canAdd,
  addingTo,
  sectionKey,
  onStartAdd,
  onCancelAdd,
  saving,
  onSave,
  addForm,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  canAdd: boolean;
  addingTo: string | null;
  sectionKey: string;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  saving: boolean;
  onSave: () => Promise<void>;
  addForm: React.ReactNode;
  children: React.ReactNode;
}) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.blue;
  const isAdding = addingTo === sectionKey;
  return (
    <div className={cn('bg-white rounded-xl border overflow-hidden', c.border)}>
      <div className={cn('px-3 py-2 border-b flex items-center justify-between', c.header)}>
        <div className="flex items-center gap-1.5">
          <span className={c.add}>{icon}</span>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">{title}</p>
        </div>
        {canAdd && !isAdding && (
          <button onClick={onStartAdd} className={cn('flex items-center gap-1 text-[10px] font-semibold', c.add)}>
            <Plus className="h-3 w-3" /> Add
          </button>
        )}
      </div>
      <div className="px-3 pb-3">
        <div className="pt-2">{children}</div>
        {isAdding && (
          <div className="mt-2 bg-blue-50 rounded-lg p-2 border border-blue-200">
            {addForm}
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={onSave}
                disabled={saving}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={onCancelAdd} className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
