import { useEffect, useRef, useState } from 'react';
import { Button } from '../common/Button.jsx';
import { LIMITS } from '../../utils/validation.js';
import { useAttachmentDraft } from '../../hooks/useAttachmentDraft.js';
import { AttachmentDraftList } from './AttachmentDraftList.jsx';

/**
 * Message input.
 *
 * Enter sends and Shift+Enter adds a newline. Files can be picked, dropped or
 * pasted; each one uploads immediately, so sending only has to reference the
 * finished uploads. A message may be text, attachments, or both.
 */
export const MessageComposer = ({ channelRef, onSend, onError, disabled, placeholder }) => {
  const [value, setValue] = useState('');
  const [isDragging, setDragging] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const dragDepth = useRef(0);

  const draft = useAttachmentDraft(channelRef);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 132)}px`;
  }, [value]);

  const stageFiles = (files) => {
    if (!files || files.length === 0) return;
    if (draft.constraints.enabled === false) {
      onError?.('File uploads are turned off.');
      return;
    }
    const { rejected } = draft.add(files);
    for (const reason of rejected) onError?.(reason);
  };

  const canSend =
    !disabled && (value.trim().length > 0 || draft.readyIds.length > 0) && !draft.isUploading;

  const submit = async () => {
    if (!canSend) return;

    const result = await onSend({
      content: value,
      // The staged uploads, with their local previews, so the optimistic
      // bubble can show the images without re-fetching them.
      attachments: draft.items
        .filter((item) => item.attachment)
        .map((item) => ({ ...item.attachment, previewUrl: item.previewUrl })),
    });

    if (result?.ok !== false) {
      setValue('');
      draft.reset();
    }
  };

  const remaining = LIMITS.MESSAGE_MAX - value.length;

  return (
    <div
      className={`composer ${isDragging ? 'composer--dropping' : ''}`.trim()}
      onDragEnter={(event) => {
        if (![...(event.dataTransfer?.types ?? [])].includes('Files')) return;
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (disabled) return;
        stageFiles(event.dataTransfer?.files);
      }}
    >
      {isDragging && (
        <div className="composer__dropzone" aria-hidden="true">
          Drop files to attach
        </div>
      )}

      <AttachmentDraftList items={draft.items} onRemove={draft.remove} />

      <form
        className="chat__composer"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="visually-hidden"
          accept={draft.constraints.allowedMimeTypes.join(',') || undefined}
          onChange={(event) => {
            stageFiles(event.target.files);
            // Reset, so picking the same file twice still fires a change.
            event.target.value = '';
          }}
        />

        {/* The server can switch uploads off (ATTACHMENTS_ENABLED=false). */}
        {draft.constraints.enabled !== false && (
          <Button
            variant="ghost"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || draft.isFull}
            title={draft.isFull ? 'Attachment limit reached' : 'Attach a file'}
            aria-label="Attach a file"
          >
            📎
          </Button>
        )}

        <label className="visually-hidden" htmlFor="composer">
          Message
        </label>
        <textarea
          id="composer"
          ref={textareaRef}
          className="textarea"
          rows={1}
          value={value}
          maxLength={LIMITS.MESSAGE_MAX}
          disabled={disabled}
          placeholder={placeholder ?? 'Type a message…'}
          onChange={(event) => setValue(event.target.value)}
          onPaste={(event) => {
            const files = [...(event.clipboardData?.files ?? [])];
            if (files.length === 0) return;
            event.preventDefault();
            stageFiles(files);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
        />

        <Button type="submit" disabled={!canSend} isLoading={draft.isUploading}>
          Send
        </Button>
      </form>

      {(remaining < 200 || draft.hasFailure) && (
        <p className="chat__composer-hint">
          {draft.hasFailure
            ? 'One of the attachments failed to upload. Remove it or try again.'
            : `${remaining} characters remaining`}
        </p>
      )}
    </div>
  );
};
