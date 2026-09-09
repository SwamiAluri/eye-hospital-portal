import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.fn();

vi.mock('../api', () => ({
  getApi: () => ({ get: getMock }),
}));

describe('searchDiagnosisCodes', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('normalizes PascalCase rows and wrapped payloads', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            Id: '1',
            Code: 'H25.9',
            Description: 'Unspecified age-related cataract',
            IsOphthalmology: true,
          },
        ],
      },
    });

    const { searchDiagnosisCodes } = await import('./diagnoses.api');
    const results = await searchDiagnosisCodes('H25', true, 10);

    expect(getMock).toHaveBeenCalledWith('/diagnoses/search', {
      params: { query: 'H25', limit: 10 },
    });
    expect(results).toHaveLength(1);
    expect(results[0].code.code).toBe('H25.9');
    expect(results[0].code.description).toBe('Unspecified age-related cataract');
    expect(results[0].matchType).toBe('partial');
  });

  it('filters non-ophthalmology when ophthalmologyOnly is true', async () => {
    getMock.mockResolvedValue({
      data: [
        { code: 'H25.9', description: 'Cataract', isOphthalmology: true },
        { code: 'J18.9', description: 'Pneumonia', isOphthalmology: false },
      ],
    });

    const { searchDiagnosisCodes } = await import('./diagnoses.api');
    const results = await searchDiagnosisCodes('18', true, 20);
    expect(results.map((r) => r.code.code)).toEqual(['H25.9']);
  });
});
