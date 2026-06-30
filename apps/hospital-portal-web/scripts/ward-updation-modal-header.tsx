'use client';

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  Search, X, Lock, Activity, ClipboardList, Stethoscope, CirclePlus, Pencil, Pill, AlertTriangle,
} from 'lucide-react';
import { PacAssessmentForm } from '@/components/ip-management/PacAssessmentForm';
import { PreOpMedicationLog } from '@/components/ip-management/PreOpMedicationLog';
import {
  ipManagementApi,
  PatientJourneyRowDto,
  WardDto,
  WardBedDto,
  VitalSignDto,
  NurseRecordDto,
  AddVitalSignRequest,
  AddNurseRecordRequest,
  UpdateVitalSignRequest,
  UpdateNurseRecordRequest,
  OphthMedicationDto,
  IpIoTypeDto,
} from '@/lib/api/ip-management.api';
import { useIpChecklistPermissions } from '@/hooks/use-ip-checklist-permissions';
import { transitionClinicalWithGates } from '@/lib/ip-checklist/transition-gates';

const PAC_EDITABLE_STATES = new Set(['Expected', 'Admitted', 'ReadyForSurgery']);

function fmt(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function fmtDate(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function Checkbox({ checked, onChange, label, disabled }: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-2 text-sm select-none ${disabled ? 'cursor-default' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange?.(e.target.checked)}
        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span className={disabled ? 'text-gray-500' : 'text-gray-700'}>{label}</span>
    </label>
  );
}

export type WardUpdationTab = 'General' | 'Remark' | 'Vitals' | 'Nurse Records' | 'Medication Log' | 'PAC';

export type WardPreOpCareTab = 'vitals' | 'medLog' | 'nurseRecords' | 'remark';

export function mapCareTabToWardUpdation(tab: WardPreOpCareTab): WardUpdationTab {
  switch (tab) {
    case 'vitals': return 'Vitals';
    case 'medLog': return 'Medication Log';
    case 'nurseRecords': return 'Nurse Records';
    case 'remark': return 'Remark';
  }
}

export interface WardUpdationModalHandle {
  saveAndMarkReady: () => Promise<void>;
}

export interface WardUpdationModalInnerProps {
  journey: PatientJourneyRowDto;
  wards: WardDto[];
  onClose: () => void;
  onSaved: (updated: PatientJourneyRowDto) => void;
  readOnly?: boolean;
  embedded?: boolean;
  forcedTab?: WardUpdationTab;
  hideFooter?: boolean;
  hideHeader?: boolean;
  hideTabs?: boolean;
}
