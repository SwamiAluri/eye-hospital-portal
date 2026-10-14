'use client';

/**
 * L1 — Laboratory Management workbench
 *
 * Authoritative ops UI over LabReport (labReportsApi / LabReportsController).
 * Does not revive the orphan /lab/* client or lab_order. Result/document ops are out of scope (L2/L3).
 */
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LaboratoryWorkbench } from '@/components/laboratory/LaboratoryWorkbench';

export default function LaboratoryPage() {
  return (
    <ProtectedRoute requiredPermission="laboratory.view">
      <div className="p-6" data-testid="laboratory-l1-workbench-page">
        <LaboratoryWorkbench />
      </div>
    </ProtectedRoute>
  );
}
