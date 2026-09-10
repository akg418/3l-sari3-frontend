import { formatBytes } from '../../utils/format.js';
import { ATTACHMENT_DRAFT_STATUS } from '../../hooks/useAttachmentDraft.js';

/**
 * The files staged in the composer, with their upload progress.
 *
 * Images show the locally generated preview, so a picked file appears
 * immediately rather than after a round trip.
 */
export const AttachmentDraftList = ({ items, onRemove }) => {
  if (items.length === 0) return null;

  return (
    <ul className="draft-list">
      {items.map((item) => {
        const isFailed = item.status === ATTACHMENT_DRAFT_STATUS.FAILED;
        const isBusy =
          item.status === ATTACHMENT_DRAFT_STATUS.UPLOADING ||
          item.status === ATTACHMENT_DRAFT_STATUS.PENDING;

        return (
          <li key={item.localId} className={`draft ${isFailed ? 'draft--failed' : ''}`.trim()}>
            {item.previewUrl ? (
              <img src={item.previewUrl} alt="" className="draft__thumb" />
            ) : (
              <span className="draft__thumb draft__thumb--file" aria-hidden="true">
                📎
              </span>
            )}

            <div className="draft__body">
              <span className="draft__name" title={item.name}>
                {item.name}
              </span>
              <span className="draft__meta">
                {isFailed ? item.error : formatBytes(item.sizeBytes)}
              </span>

              {isBusy && (
                <div
                  className="draft__progress"
                  role="progressbar"
                  aria-valuenow={item.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Uploading ${item.name}`}
                >
                  <div className="draft__progress-bar" style={{ width: `${item.progress}%` }} />
                </div>
              )}
            </div>

            <button
              type="button"
              className="draft__remove"
              onClick={() => onRemove(item.localId)}
              aria-label={`Remove ${item.name}`}
            >
              &times;
            </button>
          </li>
        );
      })}
    </ul>
  );
};
