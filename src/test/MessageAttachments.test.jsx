import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../api/attachments.api.js', () => ({
  fetchAttachmentBlobUrl: vi.fn(),
  downloadAttachment: vi.fn(),
}));

const { fetchAttachmentBlobUrl, downloadAttachment } = await import('../api/attachments.api.js');
const { MessageAttachments } = await import('../components/chat/MessageAttachments.jsx');

const imageAttachment = {
  id: 'a1',
  kind: 'image',
  isImage: true,
  filename: 'holiday.png',
  mimeType: 'image/png',
  sizeBytes: 2048,
  url: '/api/channels/c1/attachments/a1',
};

const fileAttachment = {
  id: 'a2',
  kind: 'file',
  isImage: false,
  filename: 'report.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1_572_864,
  url: '/api/channels/c1/attachments/a2',
};

describe('MessageAttachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchAttachmentBlobUrl.mockResolvedValue('blob:fake-url');
  });

  afterEach(cleanup);

  it('renders nothing when a message has no attachments', () => {
    const { container } = render(<MessageAttachments attachments={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an image inline, fetched through the authorised endpoint', async () => {
    render(<MessageAttachments attachments={[imageAttachment]} />);

    await waitFor(() => expect(screen.getByAltText('holiday.png')).toBeInTheDocument());
    // The <img> never points at the API path directly: it cannot send a token.
    expect(screen.getByAltText('holiday.png')).toHaveAttribute('src', 'blob:fake-url');
    expect(fetchAttachmentBlobUrl).toHaveBeenCalledWith('/api/channels/c1/attachments/a1');
  });

  it('reports an image it is not allowed to load', async () => {
    fetchAttachmentBlobUrl.mockRejectedValue({ code: 'CHANNEL_NOT_JOINED' });
    render(<MessageAttachments attachments={[imageAttachment]} />);

    await waitFor(() =>
      expect(screen.getByText('Join this channel before taking part.')).toBeInTheDocument(),
    );
  });

  it('shows a document with its name, type and size', () => {
    render(<MessageAttachments attachments={[fileAttachment]} />);

    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    expect(screen.getByText('1.5 MB · application/pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
  });

  it('downloads a document through the authorised endpoint', async () => {
    downloadAttachment.mockResolvedValue(undefined);
    render(<MessageAttachments attachments={[fileAttachment]} />);

    await userEvent.click(screen.getByRole('button', { name: 'Download' }));

    expect(downloadAttachment).toHaveBeenCalledWith('/api/channels/c1/attachments/a2', 'report.pdf');
  });

  it('surfaces a failed download instead of failing silently', async () => {
    downloadAttachment.mockRejectedValue({ code: 'ATTACHMENT_NOT_FOUND' });
    render(<MessageAttachments attachments={[fileAttachment]} />);

    await userEvent.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() =>
      expect(screen.getByText('That attachment is no longer available.')).toBeInTheDocument(),
    );
  });

  it('separates images from documents in a mixed message', async () => {
    render(<MessageAttachments attachments={[imageAttachment, fileAttachment]} />);

    await waitFor(() => expect(screen.getByAltText('holiday.png')).toBeInTheDocument());
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
  });

  it('uses the local preview for an attachment still being sent', () => {
    render(
      <MessageAttachments
        attachments={[{ ...imageAttachment, previewUrl: 'blob:local-preview', localId: 'd1' }]}
        isPending
      />,
    );

    expect(screen.getByAltText('holiday.png')).toHaveAttribute('src', 'blob:local-preview');
    // No round trip for bytes the browser already has.
    expect(fetchAttachmentBlobUrl).not.toHaveBeenCalled();
    expect(screen.getByText('Uploading…')).toBeInTheDocument();
  });
});
