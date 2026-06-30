'use client';

import { useEffect, useState } from 'react';
import { Bookmark, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  patientHubFiltersApi,
  type SavedHubFilter,
} from '@/lib/api/patient-hub-filters.api';
import type { PatientLookupUrlState } from '@/lib/patients/patient-lookup-filters';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import { cn } from '@/lib/utils';

const fieldClass =
  'flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500';

export function PatientSavedFiltersSection({
  draft,
  onApply,
}: {
  draft: PatientLookupUrlState;
  onApply: (filters: PatientLookupUrlState) => void;
}) {
  const [saved, setSaved] = useState<SavedHubFilter[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    void patientHubFiltersApi
      .list()
      .then(setSaved)
      .catch(() => setSaved([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Enter a name for this filter');
      return;
    }
    setSaving(true);
    try {
      await patientHubFiltersApi.save(trimmed, draft);
      setName('');
      toast.success('Filter saved');
      load();
    } catch {
      toast.error('Could not save filter');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await patientHubFiltersApi.remove(id);
      setSaved((prev) => prev.filter((s) => s.id !== id));
    } catch {
      toast.error('Could not delete saved filter');
    }
  };

  return (
    <section
      className="rounded-xl border border-gray-100 bg-white p-4"
      data-testid={patientLookupTestIds.savedFiltersSection}
    >
      <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
        <Bookmark className="h-4 w-4 text-emerald-600" />
        Saved filters
      </h4>

      {loading ? (
        <div className="mb-3 h-10 animate-pulse rounded-lg bg-gray-50" />
      ) : saved.length > 0 ? (
        <ul className="mb-3 max-h-36 space-y-1.5 overflow-y-auto">
          {saved.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50/50 px-2.5 py-2"
            >
              <button
                type="button"
                className="truncate text-left text-sm font-medium text-emerald-800 hover:underline"
                data-testid={patientLookupTestIds.savedFilterItem(item.id)}
                onClick={() => onApply({ ...item.filters, page: 1 })}
              >
                {item.searchName}
              </button>
              <button
                type="button"
                aria-label={`Delete ${item.searchName}`}
                className="shrink-0 text-gray-400 hover:text-red-600"
                onClick={() => void handleDelete(item.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-xs text-gray-500">No saved filters yet.</p>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this filter set…"
          className={fieldClass}
          data-testid={patientLookupTestIds.savedFilterNameInput}
        />
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className={cn(
            'shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700',
            saving && 'opacity-50',
          )}
          data-testid={patientLookupTestIds.savedFilterSave}
        >
          Save
        </button>
      </div>
    </section>
  );
}
