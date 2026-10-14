import { beforeEach, describe, expect, it, vi } from 'vitest';

const postMock = vi.fn();

vi.mock('@/lib/api', () => ({
  getApi: () => ({
    post: postMock,
  }),
}));

describe('uploadCounselingPatientDocument multipart contract', () => {
  beforeEach(() => {
    postMock.mockReset();
    postMock.mockResolvedValue({
      data: { id: 'c1', fileName: 'lab.jpg', classification: 'LabReport' },
    });
  });

  it('posts FormData without forcing a boundary-less multipart Content-Type', async () => {
    const { uploadCounselingPatientDocument } = await import('./counseling-sessions.api');
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'lab.jpg', {
      type: 'application/octet-stream',
    });

    await uploadCounselingPatientDocument({
      patientId: '11111111-1111-1111-1111-111111111111',
      file,
      documentType: 'LabReport',
    });

    expect(postMock).toHaveBeenCalledOnce();
    const [url, body, config] = postMock.mock.calls[0] as [
      string,
      FormData,
      { headers?: Record<string, string> } | undefined,
    ];
    expect(url).toContain('/counseling-session-documents/by-patient/');
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('documentType')).toBe('LabReport');
    expect(config?.headers?.['Content-Type']).toBeUndefined();
  });
});
