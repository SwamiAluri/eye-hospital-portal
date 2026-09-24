import { describe, expect, it } from 'vitest';
import {
  REASSIGNMENT_REQUIRED_QUERY_PARAM,
  parseReassignmentRequiredParam,
  toggleReassignmentRequiredInSearchParams,
} from './reassignment-required-filter';

describe('reassignment-required-filter (Phase 3I Slice 12)', () => {
  it('parses true/1 as enabled', () => {
    expect(parseReassignmentRequiredParam('true')).toBe(true);
    expect(parseReassignmentRequiredParam('1')).toBe(true);
  });

  it('parses missing/false as disabled', () => {
    expect(parseReassignmentRequiredParam(null)).toBe(false);
    expect(parseReassignmentRequiredParam(undefined)).toBe(false);
    expect(parseReassignmentRequiredParam('false')).toBe(false);
  });

  it('toggles query param on', () => {
    const next = toggleReassignmentRequiredInSearchParams(new URLSearchParams('branchId=b1'), true);
    expect(next.get(REASSIGNMENT_REQUIRED_QUERY_PARAM)).toBe('true');
    expect(next.get('branchId')).toBe('b1');
  });

  it('toggles query param off without dropping other filters', () => {
    const current = new URLSearchParams('reassignmentRequired=true&counselorId=c1');
    const next = toggleReassignmentRequiredInSearchParams(current, false);
    expect(next.get(REASSIGNMENT_REQUIRED_QUERY_PARAM)).toBeNull();
    expect(next.get('counselorId')).toBe('c1');
  });
});
