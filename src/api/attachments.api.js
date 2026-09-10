import { httpClient } from './httpClient.js';
import { ApiError } from './ApiError.js';

/**
 * Uploads a file, reporting progress.
 *
 * This is the one request that uses XHR rather than fetch: `fetch` cannot
 * report upload progress, and a progress bar is the difference between a UI
 * that looks broken on a slow connection and one that does not.
 */
export const uploadAttachment = ({ channelRef, file, onProgress, signal }) =>
  new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const url = httpClient.resolveUrl(`/api/channels/${encodeURIComponent(channelRef)}/attachments`);

    request.open('POST', url);
    request.responseType = 'json';

    const authorization = httpClient.authorizationHeader();
    if (authorization) request.setRequestHeader('Authorization', authorization);

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.round((event.loaded / event.total) * 100));
    };

    const parseError = () => {
      const payload = request.response;
      return new ApiError({
        code: payload?.error?.code ?? 'UPLOAD_FAILED',
        message: payload?.error?.message,
        details: payload?.error?.details,
        status: request.status,
      });
    };

    request.onload = () => {
      const payload = request.response;
      if (request.status >= 200 && request.status < 300 && payload?.success) {
        onProgress?.(100);
        resolve(payload.data.attachment);
        return;
      }

      const error = parseError();
      if (request.status === 401) httpClient.notifyUnauthorized(error);
      reject(error);
    };

    request.onerror = () => reject(ApiError.network());
    request.onabort = () =>
      reject(new ApiError({ code: 'UPLOAD_CANCELLED', message: 'Upload cancelled.', status: 0 }));

    signal?.addEventListener('abort', () => request.abort(), { once: true });

    const body = new FormData();
    body.append('file', file, file.name);
    request.send(body);
  });

/**
 * Fetches an attachment as a blob URL.
 *
 * Attachments are only served to authorised members, and an `<img src>` cannot
 * carry an Authorization header - so the bytes are fetched with the header and
 * wrapped in an object URL. The alternative, a signed URL in the `src`, would
 * be a shareable link to private content; this way nothing leaves the session.
 */
const blobUrlCache = new Map();

export const fetchAttachmentBlobUrl = async (path) => {
  const cached = blobUrlCache.get(path);
  if (cached) return cached;

  const pending = (async () => {
    const headers = {};
    const authorization = httpClient.authorizationHeader();
    if (authorization) headers.Authorization = authorization;

    const response = await fetch(httpClient.resolveUrl(path), { headers }).catch(() => {
      throw ApiError.network();
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const error = new ApiError({
        code: payload?.error?.code ?? 'ATTACHMENT_NOT_FOUND',
        message: payload?.error?.message,
        status: response.status,
      });
      if (response.status === 401) httpClient.notifyUnauthorized(error);
      throw error;
    }

    return URL.createObjectURL(await response.blob());
  })();

  // The promise is cached, not just the result, so several <img> tags mounting
  // at once share a single request.
  blobUrlCache.set(path, pending);

  try {
    return await pending;
  } catch (error) {
    blobUrlCache.delete(path);
    throw error;
  }
};

/** Saves an attachment to disk, going through the authorised endpoint. */
export const downloadAttachment = async (path, filename) => {
  const objectUrl = await fetchAttachmentBlobUrl(path);

  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
};

/**
 * Releases every cached object URL. Called when a channel closes or expires, so
 * a long session does not accumulate blobs for conversations that are gone.
 */
export const releaseAttachmentCache = (predicate) => {
  for (const [path, entry] of blobUrlCache) {
    if (predicate && !predicate(path)) continue;
    Promise.resolve(entry)
      .then((url) => URL.revokeObjectURL(url))
      .catch(() => {});
    blobUrlCache.delete(path);
  }
};
