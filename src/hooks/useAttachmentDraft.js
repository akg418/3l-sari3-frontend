import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadAttachment } from '../api/attachments.api.js';
import { messageForError } from '../utils/errorMessages.js';
import { useUploadConstraints } from './useUploadConstraints.js';

let localIdCounter = 0;
const nextLocalId = () => {
  localIdCounter += 1;
  return `draft-${localIdCounter}`;
};

const STATUS = Object.freeze({
  PENDING: 'pending',
  UPLOADING: 'uploading',
  READY: 'ready',
  FAILED: 'failed',
});

/**
 * The files staged in the composer, before the message is sent.
 *
 * Each file is uploaded as soon as it is picked, so the send itself only has to
 * reference ids: progress is meaningful, the eventual send is instant, and an
 * abandoned draft leaves an unclaimed upload for the server to sweep rather
 * than a half-written message.
 */
export const useAttachmentDraft = (channelRef) => {
  const constraints = useUploadConstraints();
  const [items, setItems] = useState([]);
  const controllers = useRef(new Map());

  const update = useCallback((localId, patch) => {
    setItems((current) =>
      current.map((item) => (item.localId === localId ? { ...item, ...patch } : item)),
    );
  }, []);

  const isImage = useCallback(
    (file) => constraints.imageMimeTypes.includes(file.type),
    [constraints.imageMimeTypes],
  );

  /** Why this file cannot be sent, or null. Mirrors the server's own rules. */
  const rejectionReason = useCallback(
    (file) => {
      const allowed = constraints.allowedMimeTypes;
      if (allowed.length > 0 && !allowed.includes(file.type)) {
        return `${file.name}: that file type is not supported.`;
      }

      const limit = isImage(file) ? constraints.maxImageBytes : constraints.maxFileBytes;
      if (file.size > limit) {
        return `${file.name} is too large (limit ${Math.round(limit / (1024 * 1024))} MB).`;
      }
      return null;
    },
    [constraints, isImage],
  );

  const add = useCallback(
    (files) => {
      const rejected = [];
      const accepted = [];

      for (const file of [...files]) {
        const reason = rejectionReason(file);
        if (reason) rejected.push(reason);
        else accepted.push(file);
      }

      let staged = [];
      setItems((current) => {
        const room = Math.max(0, constraints.maxPerMessage - current.length);
        staged = accepted.slice(0, room).map((file) => ({
          localId: nextLocalId(),
          file,
          name: file.name,
          sizeBytes: file.size,
          mimeType: file.type,
          isImage: isImage(file),
          // A local preview shows the image the instant it is chosen, with no
          // round trip.
          previewUrl: isImage(file) ? URL.createObjectURL(file) : null,
          progress: 0,
          // Uploading is started by the effect below, not here: a state updater
          // must stay free of side effects, or StrictMode runs them twice.
          status: STATUS.PENDING,
          attachment: null,
          error: null,
        }));
        return [...current, ...staged];
      });

      if (accepted.length > Math.max(0, constraints.maxPerMessage - items.length)) {
        rejected.push(`Only ${constraints.maxPerMessage} attachments per message.`);
      }

      return { rejected };
    },
    [constraints.maxPerMessage, isImage, items.length, rejectionReason],
  );

  /** Starts the upload for anything newly staged. */
  useEffect(() => {
    const pending = items.filter((item) => item.status === STATUS.PENDING);
    if (pending.length === 0) return;

    for (const item of pending) {
      if (controllers.current.has(item.localId)) continue;

      const controller = new AbortController();
      controllers.current.set(item.localId, controller);
      update(item.localId, { status: STATUS.UPLOADING });

      uploadAttachment({
        channelRef,
        file: item.file,
        signal: controller.signal,
        onProgress: (progress) => update(item.localId, { progress }),
      })
        .then((attachment) =>
          update(item.localId, { status: STATUS.READY, attachment, progress: 100 }),
        )
        .catch((error) => {
          if (error?.code === 'UPLOAD_CANCELLED') return;
          update(item.localId, { status: STATUS.FAILED, error: messageForError(error) });
        })
        .finally(() => controllers.current.delete(item.localId));
    }
  }, [channelRef, items, update]);

  const remove = useCallback((localId) => {
    controllers.current.get(localId)?.abort();
    setItems((current) => {
      const item = current.find((entry) => entry.localId === localId);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return current.filter((entry) => entry.localId !== localId);
    });
  }, []);

  const reset = useCallback(() => {
    for (const controller of controllers.current.values()) controller.abort();
    controllers.current.clear();

    setItems((current) => {
      for (const item of current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
      return [];
    });
  }, []);

  // A closed composer must not leak object URLs or leave uploads in flight.
  useEffect(
    () => () => {
      for (const controller of controllers.current.values()) controller.abort();
      controllers.current.clear();
    },
    [],
  );

  const readyIds = items
    .filter((item) => item.status === STATUS.READY && item.attachment)
    .map((item) => item.attachment.id);

  return {
    items,
    add,
    remove,
    reset,
    readyIds,
    isEmpty: items.length === 0,
    isUploading: items.some(
      (item) => item.status === STATUS.UPLOADING || item.status === STATUS.PENDING,
    ),
    hasFailure: items.some((item) => item.status === STATUS.FAILED),
    isFull: items.length >= constraints.maxPerMessage,
    constraints,
  };
};

export { STATUS as ATTACHMENT_DRAFT_STATUS };
