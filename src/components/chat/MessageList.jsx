import { useEffect, useLayoutEffect, useRef } from 'react';
import { MessageItem } from './MessageItem.jsx';
import { Button } from '../common/Button.jsx';
import { EmptyState } from '../common/Feedback.jsx';
import { formatDateHeading, isSameDay } from '../../utils/format.js';

const CONTINUATION_WINDOW_MS = 5 * 60_000;
const STICK_TO_BOTTOM_THRESHOLD_PX = 120;

/** Groups consecutive messages from the same author within a few minutes. */
const isContinuationOf = (message, previous) => {
  if (!previous) return false;
  if ((previous.sender?.id ?? 'self') !== (message.sender?.id ?? 'self')) return false;
  if (!isSameDay(previous.createdAt, message.createdAt)) return false;
  return Date.parse(message.createdAt) - Date.parse(previous.createdAt) < CONTINUATION_WINDOW_MS;
};

export const MessageList = ({
  messages,
  currentUser,
  hasMore,
  isLoadingOlder,
  onLoadOlder,
  onDiscard,
}) => {
  const containerRef = useRef(null);
  const topSentinelRef = useRef(null);
  const shouldStickToBottom = useRef(true);
  const previousScrollHeight = useRef(0);

  // Auto-scroll only when the reader is already at the bottom, so arriving
  // messages never yank them away from older history they are reading.
  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldStickToBottom.current = distanceFromBottom < STICK_TO_BOTTOM_THRESHOLD_PX;
  };

  /**
   * Infinite scroll: the sentinel at the top of the transcript asks for the
   * next page as it comes into view. The button below it stays as an explicit
   * fallback for keyboard users and for browsers without IntersectionObserver.
   */
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = containerRef.current;
    if (!sentinel || !container || !hasMore) return undefined;
    if (typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadOlder?.();
      },
      { root: container, rootMargin: '120px 0px 0px 0px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, onLoadOlder]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !shouldStickToBottom.current) return;
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  // Prepending a page of history would otherwise jump the viewport; restore
  // the reader's position by the height that was added above them.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (isLoadingOlder) {
      previousScrollHeight.current = container.scrollHeight;
    } else if (previousScrollHeight.current) {
      container.scrollTop += container.scrollHeight - previousScrollHeight.current;
      previousScrollHeight.current = 0;
    }
  }, [isLoadingOlder, messages]);

  return (
    <div className="chat__messages" ref={containerRef} onScroll={handleScroll}>
      {hasMore && (
        <>
          <div ref={topSentinelRef} aria-hidden="true" />
          <div className="row" style={{ justifyContent: 'center', marginBottom: 'var(--space-3)' }}>
            <Button variant="secondary" size="sm" onClick={onLoadOlder} isLoading={isLoadingOlder}>
              {isLoadingOlder ? 'Loading earlier messages' : 'Load earlier messages'}
            </Button>
          </div>
        </>
      )}

      {messages.length === 0 ? (
        <EmptyState
          icon="👋"
          title="No messages yet"
          message="Say something - it disappears with the channel anyway."
        />
      ) : (
        messages.map((message, index) => {
          const previous = messages[index - 1];
          const showDateDivider = !previous || !isSameDay(previous.createdAt, message.createdAt);

          return (
            <div key={message.id}>
              {showDateDivider && (
                <div className="message-divider">{formatDateHeading(message.createdAt)}</div>
              )}
              <MessageItem
                message={message}
                isOwn={!message.sender || message.sender.id === currentUser?.id}
                isContinuation={!showDateDivider && isContinuationOf(message, previous)}
                currentUsername={currentUser?.username}
                onDiscard={onDiscard}
              />
            </div>
          );
        })
      )}
    </div>
  );
};
