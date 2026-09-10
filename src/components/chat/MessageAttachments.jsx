import { useState } from 'react';
import { downloadAttachment } from '../../api/attachments.api.js';
import { formatBytes } from '../../utils/format.js';
import { messageForError } from '../../utils/errorMessages.js';
import { AuthorizedImage } from './AuthorizedImage.jsx';

const EXTENSION_ICONS = {
  pdf: '📕',
  zip: '🗜️',
  doc: '📘',
  docx: '📘',
  xls: '📗',
  xlsx: '📗',
  ppt: '📙',
  pptx: '📙',
  csv: '📊',
  txt: '📄',
  md: '📄',
  json: '🧾',
};

const iconFor = (filename) =>
  EXTENSION_ICONS[filename.split('.').pop()?.toLowerCase()] ?? '📎';

/** A non-image attachment: name, type, size and a way to get it. */
const FileAttachment = ({ attachment }) => {
  const [isDownloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      await downloadAttachment(attachment.url, attachment.filename);
    } catch (downloadError) {
      setError(messageForError(downloadError));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="attachment-file">
      <span className="attachment-file__icon" aria-hidden="true">
        {iconFor(attachment.filename)}
      </span>

      <div className="attachment-file__body">
        <span className="attachment-file__name" title={attachment.filename}>
          {attachment.filename}
        </span>
        <span className="attachment-file__meta">
          {formatBytes(attachment.sizeBytes)} · {attachment.mimeType}
        </span>
        {error && <span className="attachment-file__error">{error}</span>}
      </div>

      <button
        type="button"
        className="button button--secondary button--sm"
        onClick={handleDownload}
        disabled={isDownloading}
      >
        {isDownloading ? 'Opening…' : 'Download'}
      </button>
    </div>
  );
};

/** Images render inline; everything else is offered as a download. */
export const MessageAttachments = ({ attachments, isPending }) => {
  if (!attachments?.length) return null;

  const images = attachments.filter((attachment) => attachment.isImage ?? attachment.kind === 'image');
  const files = attachments.filter((attachment) => !(attachment.isImage ?? attachment.kind === 'image'));

  return (
    <div className="attachments">
      {images.length > 0 && (
        <div className={`attachment-gallery ${images.length > 1 ? 'attachment-gallery--grid' : ''}`.trim()}>
          {images.map((attachment) =>
            // An optimistic bubble already has the bytes locally, so it shows
            // the local preview rather than fetching what it just uploaded.
            attachment.previewUrl ? (
              <img
                key={attachment.localId ?? attachment.id}
                src={attachment.previewUrl}
                alt={attachment.name ?? attachment.filename}
                className="attachment-image"
              />
            ) : (
              <AuthorizedImage
                key={attachment.id}
                path={attachment.url}
                alt={attachment.filename}
              />
            ),
          )}
        </div>
      )}

      {files.map((attachment) => (
        <FileAttachment
          key={attachment.id ?? attachment.localId}
          attachment={{
            ...attachment,
            filename: attachment.filename ?? attachment.name,
          }}
        />
      ))}

      {isPending && <span className="attachments__status">Uploading…</span>}
    </div>
  );
};
