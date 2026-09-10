import { Avatar } from '../common/Feedback.jsx';
import { formatTime, initialsOf } from '../../utils/format.js';
import { MessageAttachments } from './MessageAttachments.jsx';

/**
 * A single message. `content` is rendered as text - React escapes it, and the
 * server already stripped control characters - so it is never treated as markup.
 */
export const MessageItem = ({ message, isOwn, isContinuation, currentUsername, onDiscard }) => {
  const author = message.sender?.username ?? currentUsername ?? 'You';

  const classes = [
    'message',
    isContinuation ? 'message--continuation' : '',
    message.isPending ? 'message--pending' : '',
    message.isFailed ? 'message--failed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <div className="message__avatar-slot">
        {!isContinuation && <Avatar initials={initialsOf(author)} />}
      </div>

      <div className="message__content">
        {!isContinuation && (
          <div className="message__head">
            <span className={`message__author ${isOwn ? 'message__author--self' : ''}`.trim()}>
              {author}
            </span>
            <time className="message__time" dateTime={message.createdAt}>
              {formatTime(message.createdAt)}
            </time>
          </div>
        )}

        {message.content && <div className="message__body">{message.content}</div>}

        <MessageAttachments attachments={message.attachments} isPending={message.isPending} />

        {message.isPending && <span className="message__status">Sending…</span>}
        {message.isFailed && (
          <span className="message__status">
            Not delivered.{' '}
            <button
              type="button"
              className="button button--ghost button--sm"
              style={{ height: 'auto', padding: 0 }}
              onClick={() => onDiscard?.(message.clientMessageId)}
            >
              Dismiss
            </button>
          </span>
        )}
      </div>
    </div>
  );
};
