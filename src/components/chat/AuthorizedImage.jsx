import { useEffect, useState } from 'react';
import { fetchAttachmentBlobUrl } from '../../api/attachments.api.js';
import { messageForError } from '../../utils/errorMessages.js';

/**
 * An image that lives behind authorisation.
 *
 * Attachments are only served to channel members, and an `<img src>` cannot
 * send an Authorization header - so the bytes are fetched with one and wrapped
 * in an object URL. A signed URL in the `src` would have been simpler and also
 * a shareable link to private content; this keeps the bytes inside the session.
 */
export const AuthorizedImage = ({ path, alt, className }) => {
  const [state, setState] = useState({ status: 'loading', url: null, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', url: null, error: null });

    fetchAttachmentBlobUrl(path)
      .then((url) => {
        if (!cancelled) setState({ status: 'ready', url, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'failed', url: null, error: messageForError(error) });
      });

    // The object URL is shared through a cache and released when the channel
    // closes, so it is deliberately not revoked here.
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (state.status === 'loading') {
    return <div className={`attachment-image attachment-image--loading ${className ?? ''}`.trim()} />;
  }

  if (state.status === 'failed') {
    return (
      <div className="attachment-image attachment-image--failed" role="img" aria-label={alt}>
        <span aria-hidden="true">🚫</span>
        <span>{state.error}</span>
      </div>
    );
  }

  return (
    <a href={state.url} target="_blank" rel="noreferrer" className="attachment-image__link">
      <img src={state.url} alt={alt} className={`attachment-image ${className ?? ''}`.trim()} loading="lazy" />
    </a>
  );
};
