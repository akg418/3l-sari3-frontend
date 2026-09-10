import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('../api/attachments.api.js', () => ({ uploadAttachment: vi.fn() }));
vi.mock('../hooks/useUploadConstraints.js', () => ({
  useUploadConstraints: () => ({
    maxImageBytes: 1024,
    maxFileBytes: 2048,
    maxPerMessage: 2,
    allowedMimeTypes: ['image/png', 'application/pdf'],
    imageMimeTypes: ['image/png'],
  }),
}));

const { uploadAttachment } = await import('../api/attachments.api.js');
const { useAttachmentDraft, ATTACHMENT_DRAFT_STATUS } = await import('../hooks/useAttachmentDraft.js');

const makeFile = (name, type, size) => {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('useAttachmentDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom has no object URLs.
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    delete globalThis.URL.createObjectURL;
    delete globalThis.URL.revokeObjectURL;
  });

  const setup = () => renderHook(() => useAttachmentDraft('general'));

  it('starts empty', () => {
    const { result } = setup();
    expect(result.current.items).toEqual([]);
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.readyIds).toEqual([]);
  });

  it('uploads an accepted file once and exposes its id when ready', async () => {
    uploadAttachment.mockResolvedValue({ id: 'att-1', kind: 'image' });
    const { result } = setup();

    await act(async () => {
      result.current.add([makeFile('a.png', 'image/png', 512)]);
    });

    await waitFor(() => expect(result.current.readyIds).toEqual(['att-1']));
    // Once, even though React renders several times while the state settles.
    expect(uploadAttachment).toHaveBeenCalledTimes(1);
    expect(result.current.items[0].status).toBe(ATTACHMENT_DRAFT_STATUS.READY);
    expect(result.current.isUploading).toBe(false);
  });

  it('makes a local preview for an image so it appears immediately', async () => {
    uploadAttachment.mockResolvedValue({ id: 'att-1' });
    const { result } = setup();

    await act(async () => {
      result.current.add([makeFile('a.png', 'image/png', 512)]);
    });

    expect(result.current.items[0].previewUrl).toBe('blob:preview');
    expect(result.current.items[0].isImage).toBe(true);
  });

  it('does not make a preview for a document', async () => {
    uploadAttachment.mockResolvedValue({ id: 'att-1' });
    const { result } = setup();

    await act(async () => {
      result.current.add([makeFile('a.pdf', 'application/pdf', 512)]);
    });

    expect(result.current.items[0].previewUrl).toBeNull();
    expect(result.current.items[0].isImage).toBe(false);
  });

  it('reports upload progress', async () => {
    uploadAttachment.mockImplementation(({ onProgress }) => {
      onProgress(42);
      return Promise.resolve({ id: 'att-1' });
    });
    const { result } = setup();

    await act(async () => {
      result.current.add([makeFile('a.png', 'image/png', 512)]);
    });

    await waitFor(() => expect(result.current.items[0].progress).toBe(100));
  });

  describe('client-side checks', () => {
    it('rejects a type the server does not accept, without uploading', async () => {
      const { result } = setup();
      let outcome;

      await act(async () => {
        outcome = result.current.add([makeFile('evil.svg', 'image/svg+xml', 128)]);
      });

      expect(outcome.rejected[0]).toMatch(/not supported/i);
      expect(result.current.items).toHaveLength(0);
      expect(uploadAttachment).not.toHaveBeenCalled();
    });

    it('rejects an image over the image limit', async () => {
      const { result } = setup();
      let outcome;

      await act(async () => {
        outcome = result.current.add([makeFile('big.png', 'image/png', 4096)]);
      });

      expect(outcome.rejected[0]).toMatch(/too large/i);
      expect(uploadAttachment).not.toHaveBeenCalled();
    });

    it('applies the larger limit to documents', async () => {
      uploadAttachment.mockResolvedValue({ id: 'att-1' });
      const { result } = setup();

      // 1500 bytes: over the image limit, under the file limit.
      await act(async () => {
        result.current.add([makeFile('a.pdf', 'application/pdf', 1500)]);
      });

      expect(result.current.items).toHaveLength(1);
    });

    it('stops at the per-message maximum', async () => {
      uploadAttachment.mockResolvedValue({ id: 'att-1' });
      const { result } = setup();

      await act(async () => {
        result.current.add([
          makeFile('a.png', 'image/png', 100),
          makeFile('b.png', 'image/png', 100),
          makeFile('c.png', 'image/png', 100),
        ]);
      });

      expect(result.current.items).toHaveLength(2);
      expect(result.current.isFull).toBe(true);
    });
  });

  it('marks a failed upload rather than dropping it silently', async () => {
    uploadAttachment.mockRejectedValue({ code: 'ATTACHMENT_TOO_LARGE' });
    const { result } = setup();

    await act(async () => {
      result.current.add([makeFile('a.png', 'image/png', 512)]);
    });

    await waitFor(() => expect(result.current.hasFailure).toBe(true));
    expect(result.current.items[0].error).toBe('That file is too large to send.');
    expect(result.current.readyIds).toEqual([]);
  });

  it('ignores a cancelled upload', async () => {
    uploadAttachment.mockRejectedValue({ code: 'UPLOAD_CANCELLED' });
    const { result } = setup();

    await act(async () => {
      result.current.add([makeFile('a.png', 'image/png', 512)]);
    });

    await waitFor(() => expect(uploadAttachment).toHaveBeenCalled());
    expect(result.current.hasFailure).toBe(false);
  });

  it('releases the preview when an item is removed', async () => {
    uploadAttachment.mockResolvedValue({ id: 'att-1' });
    const { result } = setup();

    await act(async () => {
      result.current.add([makeFile('a.png', 'image/png', 512)]);
    });
    const { localId } = result.current.items[0];

    await act(async () => {
      result.current.remove(localId);
    });

    expect(result.current.items).toHaveLength(0);
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });

  it('clears the whole draft after a send', async () => {
    uploadAttachment.mockResolvedValue({ id: 'att-1' });
    const { result } = setup();

    await act(async () => {
      result.current.add([makeFile('a.png', 'image/png', 512)]);
    });
    await waitFor(() => expect(result.current.readyIds).toHaveLength(1));

    await act(async () => {
      result.current.reset();
    });

    expect(result.current.isEmpty).toBe(true);
    expect(result.current.readyIds).toEqual([]);
  });
});
