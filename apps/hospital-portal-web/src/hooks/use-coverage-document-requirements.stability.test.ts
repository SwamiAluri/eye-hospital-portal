import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_DOCUMENT_REQUIREMENTS,
} from '@/hooks/use-coverage-document-requirements';

describe('useCoverageDocumentRequirements — empty fallback stability', () => {
  it('exports a stable empty requirements constant', () => {
    expect(EMPTY_DOCUMENT_REQUIREMENTS).toEqual([]);
    expect(EMPTY_DOCUMENT_REQUIREMENTS).toBe(EMPTY_DOCUMENT_REQUIREMENTS);
  });

  it('uses the stable empty constant instead of inline [] for query.data fallback', () => {
    const source = readFileSync(
      join(__dirname, 'use-coverage-document-requirements.ts'),
      'utf8',
    );
    expect(source).toContain('EMPTY_DOCUMENT_REQUIREMENTS');
    expect(source).toMatch(/query\.data\s*\?\?\s*EMPTY_DOCUMENT_REQUIREMENTS/);
    expect(source).not.toMatch(/query\.data\s*\?\?\s*\[\]/);
  });
});
