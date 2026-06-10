'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DISABILITY_CHECKBOXES } from '@/lib/medical-history/medical-history-constants';
import {
  useAlcoholSegmentOptions,
  useSmokingSegmentOptions,
} from '@/lib/medical-history/use-medical-history-lists';

interface LifestyleDisabilitySectionProps {
  canEdit?: boolean;
  smokingStatus: string;
  smokingQuitDate: string;
  smokingPackYears: string;
  alcoholUse: string;
  exerciseHabits: string;
  dietType: string;
  lifestyleNotes: string;
  disabilityStatus: string;
  specialNeeds: string;
  disabilityFlags: string[];
  onSmokingStatusChange: (v: string) => void;
  onSmokingQuitDateChange: (v: string) => void;
  onSmokingPackYearsChange: (v: string) => void;
  onAlcoholUseChange: (v: string) => void;
  onExerciseHabitsChange: (v: string) => void;
  onDietTypeChange: (v: string) => void;
  onLifestyleNotesChange: (v: string) => void;
  onDisabilityStatusChange: (v: string) => void;
  onSpecialNeedsChange: (v: string) => void;
  onDisabilityFlagsChange: (flags: string[]) => void;
  onChange: () => void;
}

function SegmentGroup({
  label,
  options,
  value,
  disabled,
  onChange,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2 mt-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`min-h-[44px] px-3 py-2 text-sm rounded-lg border transition-colors ${
              value === opt.value
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 disabled:opacity-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LifestyleDisabilitySection({
  canEdit = true,
  smokingStatus,
  smokingQuitDate,
  smokingPackYears,
  alcoholUse,
  exerciseHabits,
  dietType,
  lifestyleNotes,
  disabilityStatus,
  specialNeeds,
  disabilityFlags,
  onSmokingStatusChange,
  onSmokingQuitDateChange,
  onSmokingPackYearsChange,
  onAlcoholUseChange,
  onExerciseHabitsChange,
  onDietTypeChange,
  onLifestyleNotesChange,
  onDisabilityStatusChange,
  onSpecialNeedsChange,
  onDisabilityFlagsChange,
  onChange,
}: LifestyleDisabilitySectionProps) {
  const { segments: smokingSegments } = useSmokingSegmentOptions();
  const { segments: alcoholSegments } = useAlcoholSegmentOptions();
  const showSmokingDetail =
    smokingStatus === 'Former' || smokingStatus.startsWith('Current');

  const toggleFlag = (id: string) => {
    const next = disabilityFlags.includes(id)
      ? disabilityFlags.filter((f) => f !== id)
      : [...disabilityFlags, id];
    onDisabilityFlagsChange(next);
    onChange();
  };

  return (
    <div className="w-full grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
      <section
        id="mh-section-lifestyle"
        className="scroll-mt-24 w-full bg-white border border-gray-200 rounded-xl p-5 space-y-5"
      >
        <h3 className="text-base font-semibold text-gray-900">Lifestyle Factors</h3>

        <SegmentGroup
          label="Smoking status"
          options={smokingSegments}
          value={smokingStatus}
          disabled={!canEdit}
          onChange={(v) => {
            onSmokingStatusChange(v);
            onChange();
          }}
        />

        {showSmokingDetail && (
          <div className="grid sm:grid-cols-2 gap-4 pl-0 sm:pl-1">
            {smokingStatus === 'Former' && (
              <div>
                <Label>Quit date</Label>
                <Input
                  type="date"
                  disabled={!canEdit}
                  value={smokingQuitDate}
                  onChange={(e) => {
                    onSmokingQuitDateChange(e.target.value);
                    onChange();
                  }}
                />
              </div>
            )}
            <div>
              <Label>Pack-years</Label>
              <Input
                disabled={!canEdit}
                value={smokingPackYears}
                onChange={(e) => {
                  onSmokingPackYearsChange(e.target.value);
                  onChange();
                }}
                placeholder="e.g. 10"
              />
            </div>
          </div>
        )}

        <SegmentGroup
          label="Alcohol use"
          options={alcoholSegments}
          value={alcoholUse}
          disabled={!canEdit}
          onChange={(v) => {
            onAlcoholUseChange(v);
            onChange();
          }}
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Exercise habits</Label>
            <Input
              disabled={!canEdit}
              value={exerciseHabits}
              onChange={(e) => {
                onExerciseHabitsChange(e.target.value);
                onChange();
              }}
              placeholder="e.g. walks 30 min/day"
            />
          </div>
          <div>
            <Label>Diet</Label>
            <Input
              disabled={!canEdit}
              value={dietType}
              onChange={(e) => {
                onDietTypeChange(e.target.value);
                onChange();
              }}
              placeholder="e.g. vegetarian, low sodium"
            />
          </div>
        </div>

        <div>
          <Label>Lifestyle notes</Label>
          <Textarea
            disabled={!canEdit}
            value={lifestyleNotes}
            onChange={(e) => {
              onLifestyleNotesChange(e.target.value);
              onChange();
            }}
            placeholder="Any other lifestyle factors relevant to care"
            rows={2}
          />
        </div>
      </section>

      <section
        id="mh-section-disability"
        className="scroll-mt-24 w-full bg-white border border-gray-200 rounded-xl p-5 space-y-4"
      >
        <h3 className="text-base font-semibold text-gray-900">Disability & Special Needs</h3>

        <div>
          <Label className="mb-2 block">Accessibility & support</Label>
          <div className="flex flex-wrap gap-2">
            {DISABILITY_CHECKBOXES.map((cb) => (
              <label
                key={cb.id}
                className={`inline-flex items-center gap-2 min-h-[44px] px-3 py-2 rounded-lg border cursor-pointer ${
                  disabilityFlags.includes(cb.id)
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-white border-gray-200 text-gray-700'
                } ${!canEdit ? 'opacity-60 pointer-events-none' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={disabilityFlags.includes(cb.id)}
                  disabled={!canEdit}
                  onChange={() => toggleFlag(cb.id)}
                  className="rounded border-gray-300 text-emerald-600"
                />
                <span className="text-sm">{cb.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label>Disability status</Label>
          <Textarea
            disabled={!canEdit}
            value={disabilityStatus}
            onChange={(e) => {
              onDisabilityStatusChange(e.target.value);
              onChange();
            }}
            placeholder="Describe disability status if applicable"
            rows={2}
          />
        </div>

        <div>
          <Label>Special needs & accommodations</Label>
          <Textarea
            disabled={!canEdit}
            value={specialNeeds}
            onChange={(e) => {
              onSpecialNeedsChange(e.target.value);
              onChange();
            }}
            placeholder="Communication needs, mobility, caregiver support, etc."
            rows={2}
          />
        </div>
      </section>
    </div>
  );
}
