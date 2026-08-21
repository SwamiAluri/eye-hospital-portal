'use client';

import type { IolMasterDto } from '@/lib/api/service-catalog.api';
import type { ClinicalEvaluationFields, WardIolPlan } from '@/lib/ip-management/clinical-evaluation';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

export interface ClinicalEvaluationIolSectionProps {
  fields: ClinicalEvaluationFields;
  counsellingIol: IolMasterDto | null;
  iolOptions: IolMasterDto[];
  biometryPowerSuggestion?: string | null;
  journeyIolPower?: string | null;
  disabled: boolean;
  onChange: (iol: WardIolPlan) => void;
}

function iolLabel(iol: IolMasterDto): string {
  return `${iol.brandManufacturer} ${iol.modelName}`.trim();
}

export function ClinicalEvaluationIolSection({
  fields,
  counsellingIol,
  iolOptions,
  biometryPowerSuggestion,
  journeyIolPower,
  disabled,
  onChange,
}: ClinicalEvaluationIolSectionProps) {
  const { iol } = fields;
  const selected =
    iolOptions.find(o => o.id === iol.wardIolId)
    ?? (counsellingIol && iol.wardIolId === counsellingIol.id ? counsellingIol : null);

  function confirmCounselling() {
    if (!counsellingIol) return;
    onChange({
      counsellingIolId: counsellingIol.id,
      wardIolId: counsellingIol.id,
      power: iol.power,
      toricAxis: iol.toricAxis,
      status: 'confirmed',
      changeReason: '',
    });
  }

  function selectWardIol(iolId: string) {
    const changed = counsellingIol != null && iolId !== counsellingIol.id;
    onChange({
      counsellingIolId: counsellingIol?.id ?? iol.counsellingIolId,
      wardIolId: iolId,
      power: iol.power,
      toricAxis: iol.toricAxis,
      status: changed ? 'changed' : 'confirmed',
      changeReason: changed ? iol.changeReason : '',
    });
  }

  function applySuggestedPower(power: string) {
    onChange({ ...iol, power });
  }

  return (
    <div className="space-y-3" data-testid={WARD_PREOP_TEST_IDS.clinicalEvalIolPlan}>
      <label className="text-xs font-medium text-gray-700">IOL / implant plan</label>

      {counsellingIol && (
        <div className="rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2 text-xs text-violet-900">
          <p className="font-medium">From counselling</p>
          <p className="mt-0.5">{iolLabel(counsellingIol)}</p>
          {!disabled && iol.status !== 'confirmed' && (
            <button
              type="button"
              data-testid={WARD_PREOP_TEST_IDS.clinicalEvalConfirmIol}
              onClick={confirmCounselling}
              className="mt-2 rounded-md bg-white px-2 py-1 text-[11px] font-medium text-violet-800 ring-1 ring-violet-200 hover:bg-violet-100"
            >
              Confirm counselling IOL
            </button>
          )}
        </div>
      )}

      {iolOptions.length > 0 ? (
        <div>
          <label className="mb-1 block text-xs text-gray-600" htmlFor="eval-iol-select">
            Ward IOL selection
          </label>
          <select
            id="eval-iol-select"
            disabled={disabled}
            value={iol.wardIolId ?? ''}
            onChange={e => selectWardIol(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
          >
            <option value="">Select IOL…</option>
            {iolOptions.map(opt => (
              <option key={opt.id} value={opt.id}>
                {iolLabel(opt)}
              </option>
            ))}
          </select>
        </div>
      ) : !counsellingIol ? (
        <p className="text-xs text-gray-500">No IOL catalog loaded for this procedure.</p>
      ) : null}

      <div>
        <label className="mb-1 block text-xs text-gray-600" htmlFor="eval-iol-power">
          Target IOL power
        </label>
        {(biometryPowerSuggestion || journeyIolPower) && !iol.power && (
          <div className="mb-2 flex flex-wrap gap-2 text-[11px]">
            {biometryPowerSuggestion && (
              <button
                type="button"
                onClick={() => applySuggestedPower(biometryPowerSuggestion)}
                disabled={disabled}
                className="rounded-md bg-sky-50 px-2 py-1 font-medium text-sky-800 ring-1 ring-sky-200 hover:bg-sky-100"
              >
                Use biometry: {biometryPowerSuggestion}
              </button>
            )}
            {journeyIolPower && journeyIolPower !== biometryPowerSuggestion && (
              <button
                type="button"
                onClick={() => applySuggestedPower(journeyIolPower)}
                disabled={disabled}
                className="rounded-md bg-gray-50 px-2 py-1 font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
              >
                Use journey record: {journeyIolPower}
              </button>
            )}
          </div>
        )}
        <input
          id="eval-iol-power"
          type="text"
          disabled={disabled}
          value={iol.power}
          onChange={e => onChange({ ...iol, power: e.target.value })}
          placeholder="e.g. +21.0 D"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600" htmlFor="eval-iol-toric">
          Toric axis / alignment <span className="font-normal text-gray-500">(if applicable)</span>
        </label>
        <input
          id="eval-iol-toric"
          data-testid={WARD_PREOP_TEST_IDS.clinicalEvalIolToric}
          type="text"
          disabled={disabled}
          value={iol.toricAxis}
          onChange={e => onChange({ ...iol, toricAxis: e.target.value })}
          placeholder="e.g. 180°"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
        />
      </div>

      {selected && (
        <p className="text-xs text-gray-600">
          Selected: <span className="font-medium text-gray-800">{iolLabel(selected)}</span>
          {iol.status === 'changed' && (
            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
              Changed from counselling
            </span>
          )}
        </p>
      )}

      {iol.status === 'changed' && (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700" htmlFor="eval-iol-reason">
            IOL change reason <span className="text-red-600">*</span>
          </label>
          <input
            id="eval-iol-reason"
            type="text"
            disabled={disabled}
            value={iol.changeReason}
            onChange={e => onChange({ ...iol, changeReason: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
          />
        </div>
      )}
    </div>
  );
}
