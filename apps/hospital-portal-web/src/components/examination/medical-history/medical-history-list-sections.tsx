'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ModalSelectContent,
} from '@/components/ui/select';
import {
  SelectWithOther,
  validateSelectWithOther,
} from '@/components/examination/medical-history/SelectWithOther';
import { ClinicalListSection } from '@/components/examination/medical-history/ClinicalListSection';
import {
  CONDITION_STATUS,
  EYE_MEDICATION_ROUTES,
  EYE_RELEVANT_CONDITIONS,
  EYE_SURGERIES,
  SEVERITY_LEVELS,
  type ChronicCondition,
  type FamilyCondition,
  type Immunization,
  type Medication,
  type Surgery,
} from '@/lib/medical-history/medical-history-constants';
import { isEyeRelevantLabel } from '@/lib/medical-history/eye-relevant';
import {
  useChronicConditionOptions,
  useFamilyConditionOptions,
  useFamilyRelationshipOptions,
  useImmunizationOptions,
  useMedicationOptions,
  useMedicationRouteOptions,
  useSurgeryHistoryOptions,
} from '@/lib/medical-history/use-medical-history-lists';

function FormActions({
  onClose,
  onSubmit,
  submitLabel,
}: {
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex flex-col-reverse sm:flex-row gap-2 pt-4 mt-2 border-t border-gray-100">
      <Button type="button" variant="secondary" className="min-h-[44px]" onClick={onClose}>
        Cancel
      </Button>
      <Button type="button" variant="primary" className="min-h-[44px]" onClick={onSubmit}>
        {submitLabel}
      </Button>
    </div>
  );
}

// ——— Conditions ———

export function ConditionsListSection({
  items,
  canEdit,
  onAdd,
  onEdit,
  onDelete,
}: {
  items: ChronicCondition[];
  canEdit?: boolean;
  onAdd: (d: Omit<ChronicCondition, 'id'>) => void;
  onEdit: (item: ChronicCondition) => void;
  onDelete: (id: string) => void;
}) {
  const { options: conditionMasterOptions } = useChronicConditionOptions();
  const isEyeCondition = (name: string) =>
    isEyeRelevantLabel(name, conditionMasterOptions, EYE_RELEVANT_CONDITIONS);

  return (
    <ClinicalListSection
      sectionId="conditions"
      title="Chronic Medical Conditions"
      count={items.length}
      canEdit={canEdit}
      addLabel="Add condition"
      emptyTitle="No chronic conditions recorded"
      emptyDescription="Add diabetes, hypertension, glaucoma, and other conditions."
      items={items}
      highlightItem={(c) => isEyeCondition(c.name)}
      formTitle={(item) => (item ? 'Edit condition' : 'Add condition')}
      onAdd={onAdd}
      onEdit={onEdit}
      onDelete={onDelete}
      renderItemContent={(c) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-sm text-gray-900">{c.name}</span>
          {isEyeCondition(c.name) && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200 font-medium">
              Eye
            </span>
          )}
          {c.diagnosedYear && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              Since {c.diagnosedYear}
            </span>
          )}
          {c.severity && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              {c.severity}
            </span>
          )}
          {c.status && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {c.status}
            </span>
          )}
          {c.notes && <p className="text-xs text-gray-500 w-full mt-1">{c.notes}</p>}
        </div>
      )}
      renderForm={({ item, onSave, onClose }) => (
        <ConditionForm item={item} onSave={onSave} onClose={onClose} />
      )}
    />
  );
}

function ConditionForm({
  item,
  onSave,
  onClose,
}: {
  item: ChronicCondition | null;
  onSave: (d: Omit<ChronicCondition, 'id'>) => void;
  onClose: () => void;
}) {
  const { labels: conditionOptions } = useChronicConditionOptions();
  const [name, setName] = useState(item?.name ?? '');
  const [diagnosedYear, setDiagnosedYear] = useState(item?.diagnosedYear ?? '');
  const [severity, setSeverity] = useState(item?.severity ?? '');
  const [status, setStatus] = useState(item?.status ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');

  const submit = () => {
    const err = validateSelectWithOther(name, 'condition');
    if (err) {
      toast.error(err);
      return;
    }
    onSave({ name: name.trim(), diagnosedYear, severity, status, notes: notes.trim() || undefined });
  };

  return (
    <div className="grid gap-4">
      <SelectWithOther
        label="Condition"
        required
        options={conditionOptions}
        value={name}
        onChange={setName}
        customPlaceholder="Specify condition"
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Year diagnosed</Label>
          <Input
            type="number"
            value={diagnosedYear}
            onChange={(e) => setDiagnosedYear(e.target.value)}
            min={1900}
            max={new Date().getFullYear()}
          />
        </div>
        <div>
          <Label>Severity</Label>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <ModalSelectContent>
              {SEVERITY_LEVELS.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </ModalSelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
          <ModalSelectContent>
            {CONDITION_STATUS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </ModalSelectContent>
        </Select>
      </div>
      <div>
        <Label>Notes</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </div>
      <FormActions onClose={onClose} onSubmit={submit} submitLabel={item ? 'Update' : 'Add'} />
    </div>
  );
}

// ——— Medications ———

export function MedicationsListSection({
  items,
  canEdit,
  eyeDropsOnly,
  onEyeDropsOnlyChange,
  onAdd,
  onEdit,
  onDelete,
}: {
  items: Medication[];
  canEdit?: boolean;
  eyeDropsOnly: boolean;
  onEyeDropsOnlyChange: (v: boolean) => void;
  onAdd: (d: Omit<Medication, 'id'>) => void;
  onEdit: (item: Medication) => void;
  onDelete: (id: string) => void;
}) {
  const { options: routeMasterOptions } = useMedicationRouteOptions();
  const isEyeRoute = (route?: string) =>
    Boolean(route && isEyeRelevantLabel(route, routeMasterOptions, EYE_MEDICATION_ROUTES));

  const filtered = eyeDropsOnly
    ? items.filter((m) => isEyeRoute(m.route))
    : items;

  return (
      <ClinicalListSection
        sectionId="medications"
        title="Current Medications"
        count={filtered.length}
        canEdit={canEdit}
        addLabel="Add medication"
        emptyTitle="No medications recorded"
        items={filtered}
        highlightItem={(m) => isEyeRoute(m.route)}
        headerAddon={
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={eyeDropsOnly}
              onChange={(e) => onEyeDropsOnlyChange(e.target.checked)}
              className="rounded border-gray-300 text-emerald-600"
            />
            Show eye drops / topical only
          </label>
        }
        formTitle={(item) => (item ? 'Edit medication' : 'Add medication')}
        onAdd={onAdd}
        onEdit={onEdit}
        onDelete={onDelete}
        renderItemContent={(m) => (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-sm text-gray-900">{m.name}</span>
            {m.dosage && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {m.dosage}
              </span>
            )}
            {m.frequency && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {m.frequency}
              </span>
            )}
            {m.route && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                {m.route}
              </span>
            )}
            {m.notes && <p className="text-xs text-gray-500 w-full mt-1">{m.notes}</p>}
          </div>
        )}
        renderForm={({ item, onSave, onClose }) => (
          <MedicationForm item={item} onSave={onSave} onClose={onClose} />
        )}
      />
  );
}

function MedicationForm({
  item,
  onSave,
  onClose,
}: {
  item: Medication | null;
  onSave: (d: Omit<Medication, 'id'>) => void;
  onClose: () => void;
}) {
  const { labels: medicationOptions } = useMedicationOptions();
  const { labels: routeOptions } = useMedicationRouteOptions();
  const [name, setName] = useState(item?.name ?? '');
  const [dosage, setDosage] = useState(item?.dosage ?? '');
  const [frequency, setFrequency] = useState(item?.frequency ?? '');
  const [route, setRoute] = useState(item?.route ?? '');
  const [startDate, setStartDate] = useState(item?.startDate ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');

  const submit = () => {
    const err = validateSelectWithOther(name, 'medication');
    if (err) {
      toast.error(err);
      return;
    }
    onSave({
      name: name.trim(),
      dosage: dosage.trim() || undefined,
      frequency: frequency.trim() || undefined,
      route: route || undefined,
      startDate: startDate || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="grid gap-4">
      <SelectWithOther
        label="Medication"
        required
        options={medicationOptions}
        value={name}
        onChange={setName}
        customPlaceholder="Specify medication"
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Dosage</Label>
          <Input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="e.g. 500mg" />
        </div>
        <div>
          <Label>Frequency</Label>
          <Input value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="e.g. BID" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <SelectWithOther
            label="Route"
            options={routeOptions}
            value={route}
            onChange={setRoute}
            customPlaceholder="Specify route"
          />
        </div>
        <div>
          <Label>Start date</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Notes</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <FormActions onClose={onClose} onSubmit={submit} submitLabel={item ? 'Update' : 'Add'} />
    </div>
  );
}

// ——— Surgeries ———

export function SurgeriesListSection({
  items,
  canEdit,
  onAdd,
  onEdit,
  onDelete,
}: {
  items: Surgery[];
  canEdit?: boolean;
  onAdd: (d: Omit<Surgery, 'id'>) => void;
  onEdit: (item: Surgery) => void;
  onDelete: (id: string) => void;
}) {
  const { options: surgeryMasterOptions } = useSurgeryHistoryOptions();
  const isEyeSurgery = (name: string) =>
    isEyeRelevantLabel(name, surgeryMasterOptions, EYE_SURGERIES);

  return (
    <ClinicalListSection
      sectionId="surgeries"
      title="Past Surgeries"
      count={items.length}
      canEdit={canEdit}
      addLabel="Add surgery"
      emptyTitle="No surgeries recorded"
      items={items}
      highlightItem={(s) => isEyeSurgery(s.name)}
      formTitle={(item) => (item ? 'Edit surgery' : 'Add surgery')}
      onAdd={onAdd}
      onEdit={onEdit}
      onDelete={onDelete}
      renderItemContent={(s) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-sm text-gray-900">{s.name}</span>
          {isEyeSurgery(s.name) && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
              Eye
            </span>
          )}
          {s.date && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              {s.date}
            </span>
          )}
          {s.outcome && (
            <span className="text-[10px] text-gray-600">{s.outcome}</span>
          )}
        </div>
      )}
      renderForm={({ item, onSave, onClose }) => (
        <SurgeryForm item={item} onSave={onSave} onClose={onClose} />
      )}
    />
  );
}

function SurgeryForm({
  item,
  onSave,
  onClose,
}: {
  item: Surgery | null;
  onSave: (d: Omit<Surgery, 'id'>) => void;
  onClose: () => void;
}) {
  const { labels: surgeryOptions } = useSurgeryHistoryOptions();
  const [name, setName] = useState(item?.name ?? '');
  const [date, setDate] = useState(item?.date ?? '');
  const [outcome, setOutcome] = useState(item?.outcome ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');

  const submit = () => {
    const err = validateSelectWithOther(name, 'surgery');
    if (err) {
      toast.error(err);
      return;
    }
    onSave({
      name: name.trim(),
      date: date || undefined,
      outcome: outcome.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="grid gap-4">
      <SelectWithOther
        label="Surgery"
        required
        options={SURGERIES_LIST}
        value={name}
        onChange={setName}
        customPlaceholder="Specify surgery"
      />
      <div>
        <Label>Date</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div>
        <Label>Outcome</Label>
        <Input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Optional" />
      </div>
      <div>
        <Label>Notes</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <FormActions onClose={onClose} onSubmit={submit} submitLabel={item ? 'Update' : 'Add'} />
    </div>
  );
}

// ——— Family ———

export function FamilyListSection({
  items,
  canEdit,
  onAdd,
  onEdit,
  onDelete,
}: {
  items: FamilyCondition[];
  canEdit?: boolean;
  onAdd: (d: Omit<FamilyCondition, 'id'>) => void;
  onEdit: (item: FamilyCondition) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <ClinicalListSection
      sectionId="family"
      title="Family Medical History"
      count={items.length}
      canEdit={canEdit}
      addLabel="Add family history"
      emptyTitle="No family history recorded"
      items={items}
      formTitle={(item) => (item ? 'Edit family history' : 'Add family history')}
      onAdd={onAdd}
      onEdit={onEdit}
      onDelete={onDelete}
      renderItemContent={(f) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-sm text-gray-900">{f.condition}</span>
          {f.relationship && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
              {f.relationship}
            </span>
          )}
          {f.ageOfOnset && (
            <span className="text-[10px] text-gray-500">Onset age: {f.ageOfOnset}</span>
          )}
        </div>
      )}
      renderForm={({ item, onSave, onClose }) => (
        <FamilyForm item={item} onSave={onSave} onClose={onClose} />
      )}
    />
  );
}

function FamilyForm({
  item,
  onSave,
  onClose,
}: {
  item: FamilyCondition | null;
  onSave: (d: Omit<FamilyCondition, 'id'>) => void;
  onClose: () => void;
}) {
  const [condition, setCondition] = useState(item?.condition ?? '');
  const [relationship, setRelationship] = useState(item?.relationship ?? '');
  const [ageOfOnset, setAgeOfOnset] = useState(item?.ageOfOnset ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');

  const submit = () => {
    const err = validateSelectWithOther(condition, 'condition');
    if (err) {
      toast.error(err);
      return;
    }
    onSave({
      condition: condition.trim(),
      relationship: relationship || undefined,
      ageOfOnset: ageOfOnset.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="grid gap-4">
      <SelectWithOther
        label="Condition"
        required
        options={FAMILY_CONDITIONS_LIST}
        value={condition}
        onChange={setCondition}
        customPlaceholder="Specify condition"
      />
      <SelectWithOther
        label="Relationship"
        options={FAMILY_RELATIONSHIPS}
        value={relationship}
        onChange={setRelationship}
        customPlaceholder="Specify relationship"
      />
      <div>
        <Label>Age of onset</Label>
        <Input value={ageOfOnset} onChange={(e) => setAgeOfOnset(e.target.value)} placeholder="Optional" />
      </div>
      <div>
        <Label>Notes</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <FormActions onClose={onClose} onSubmit={submit} submitLabel={item ? 'Update' : 'Add'} />
    </div>
  );
}

// ——— Immunizations ———

export function ImmunizationsListSection({
  items,
  canEdit,
  onAdd,
  onEdit,
  onDelete,
}: {
  items: Immunization[];
  canEdit?: boolean;
  onAdd: (d: Omit<Immunization, 'id'>) => void;
  onEdit: (item: Immunization) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <ClinicalListSection
      sectionId="immunizations"
      title="Immunization Records"
      count={items.length}
      canEdit={canEdit}
      addLabel="Add immunization"
      emptyTitle="No immunizations recorded"
      items={items}
      formTitle={(item) => (item ? 'Edit immunization' : 'Add immunization')}
      onAdd={onAdd}
      onEdit={onEdit}
      onDelete={onDelete}
      renderItemContent={(i) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-sm text-gray-900">{i.vaccine}</span>
          {i.date && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              {i.date}
            </span>
          )}
          {i.doseNumber && (
            <span className="text-[10px] text-gray-600">Dose {i.doseNumber}</span>
          )}
        </div>
      )}
      renderForm={({ item, onSave, onClose }) => (
        <ImmunizationForm item={item} onSave={onSave} onClose={onClose} />
      )}
    />
  );
}

function ImmunizationForm({
  item,
  onSave,
  onClose,
}: {
  item: Immunization | null;
  onSave: (d: Omit<Immunization, 'id'>) => void;
  onClose: () => void;
}) {
  const [vaccine, setVaccine] = useState(item?.vaccine ?? '');
  const [date, setDate] = useState(item?.date ?? '');
  const [doseNumber, setDoseNumber] = useState(item?.doseNumber ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');

  const submit = () => {
    const err = validateSelectWithOther(vaccine, 'vaccine');
    if (err) {
      toast.error(err);
      return;
    }
    onSave({
      vaccine: vaccine.trim(),
      date: date || undefined,
      doseNumber: doseNumber.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="grid gap-4">
      <SelectWithOther
        label="Vaccine"
        required
        options={immunizationOptions}
        value={vaccine}
        onChange={setVaccine}
        customPlaceholder="Specify vaccine"
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label>Dose</Label>
          <Input value={doseNumber} onChange={(e) => setDoseNumber(e.target.value)} placeholder="e.g. 1" />
        </div>
      </div>
      <div>
        <Label>Notes</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <FormActions onClose={onClose} onSubmit={submit} submitLabel={item ? 'Update' : 'Add'} />
    </div>
  );
}
