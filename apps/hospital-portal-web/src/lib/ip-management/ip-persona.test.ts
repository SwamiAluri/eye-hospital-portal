import { describe, expect, it } from 'vitest';
import { resolveIpPersona, railSectionsForPersona } from './ip-persona';
import { resolveIpRoleActions } from './ip-role-actions';
import { resolveRailPrimary } from './rail-primary';

describe('resolveIpPersona', () => {
  it('treats wildcard and Admin role as admin', () => {
    expect(resolveIpPersona(['*'], [])).toBe('admin');
    expect(resolveIpPersona([], ['Admin'])).toBe('admin');
  });

  it('classifies cashier from money permissions without clinical codes', () => {
    expect(resolveIpPersona(['ip.billing.collect', 'bill.create'], ['Cashier'])).toBe('cashier');
    expect(resolveIpPersona(['bill.update'], ['Billing Clerk'])).toBe('cashier');
  });

  it('does not call a nurse a cashier even if they somehow have collect', () => {
    expect(resolveIpPersona(['ip.billing.collect', 'ip.admit', 'ward.checklist.edit'], ['Nurse'])).toBe('ward');
  });

  it('classifies surgeon from OT codes without ward admit', () => {
    expect(resolveIpPersona(['ot.safety.sign', 'ip.surgery.start'], ['Surgeon'])).toBe('clinical');
  });

  it('uses role to split ward vs coordinator when clinical codes overlap', () => {
    const clinical = ['ip.admit', 'ip.ot.mark_ready', 'ward.checklist.edit'];
    expect(resolveIpPersona(clinical, ['Nurse'])).toBe('ward');
    expect(resolveIpPersona(clinical, ['IP Coordinator'])).toBe('coordinator');
  });

  it('falls back to coordinator when the claim is empty', () => {
    expect(resolveIpPersona([], [])).toBe('coordinator');
    expect(resolveIpPersona(null, null)).toBe('coordinator');
  });
});

describe('railSectionsForPersona', () => {
  it('puts money first for cashier and hides blockers', () => {
    expect(railSectionsForPersona('cashier')[0]).toBe('status');
    expect(railSectionsForPersona('cashier')).toContain('money');
    expect(railSectionsForPersona('cashier')).not.toContain('blockers');
  });

  it('hides money and coverage for the clinical persona', () => {
    expect(railSectionsForPersona('clinical')).not.toContain('money');
    expect(railSectionsForPersona('clinical')).not.toContain('coverage');
  });
});

describe('resolveRailPrimary', () => {
  it('gives the cashier a collect action, never a clinical one', () => {
    const cashier = resolveIpRoleActions(['ip.billing.collect', 'bill.update']);
    const primary = resolveRailPrimary('cashier', 'Admitted', 'NotSent', cashier, 'PartiallyPaid');
    expect(primary.kind).toBe('billing');
    expect(primary.label).toBe('Collect payment');
  });

  it('offers create-and-collect only when the cashier has bill.create', () => {
    const withCreate = resolveIpRoleActions(['ip.billing.collect', 'bill.update', 'bill.create']);
    expect(resolveRailPrimary('cashier', 'Expected', 'NotSent', withCreate, 'NotCreated')).toEqual({
      kind: 'billing',
      label: 'Create bill and collect',
    });
    const noCreate = resolveIpRoleActions(['ip.billing.collect', 'bill.update']);
    expect(resolveRailPrimary('cashier', 'Expected', 'NotSent', noCreate, 'NotCreated')).toEqual({
      kind: 'record',
      label: 'Open full record',
    });
  });

  it('gives the nurse Mark ready and not a refund', () => {
    const nurse = resolveIpRoleActions(['ward.checklist.edit']);
    expect(nurse.canRefund).toBe(false);
    expect(nurse.canAdjustFinance).toBe(false);
    const primary = resolveRailPrimary('ward', 'Admitted', 'NotSent', nurse, 'Draft');
    expect(primary).toEqual({ kind: 'clinical', label: 'Mark ready for OT' });
  });
});
