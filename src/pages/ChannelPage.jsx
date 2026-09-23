import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { Countdown } from '../components/common/Countdown.jsx';
import { Alert, Spinner } from '../components/common/Feedback.jsx';
import { MessageComposer } from '../components/chat/MessageComposer.jsx';
import { MessageList } from '../components/chat/MessageList.jsx';
import { MembersPanel } from '../components/channels/MembersPanel.jsx';
import { JoinPrivateChannelModal } from '../components/channels/JoinPrivateChannelModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useChannels } from '../context/ChannelsContext.jsx';
import { useRealtime, useRealtimeEvent } from '../context/RealtimeContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useChannelChat } from '../hooks/useChannelChat.js';
import { useCountdown } from '../hooks/useCountdown.js';
import { channelsApi } from '../api/channels.api.js';
import { releaseAttachmentCache } from '../api/attachments.api.js';
import { messageForError } from '../utils/errorMessages.js';
import { SERVER_EVENTS } from '../websocket/events.js';

/**
 * The chat view, addressed by channel name.
 *
 * Three things are worth noting. The URL carries the channel's unique name, so
 * the id is resolved once and never appears in the address bar. The channel's
 * existence is server-truth: when the backend says it expired, this page closes
 * itself - the local countdown never makes that call. And a deep link into a
 * private channel is handled by prompting for the password rather than failing.
 */
export const ChannelPage = () => {
  const { channelName } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getChannelBySlug, join, refresh } = useChannels();
  const { isReady, realtimeEnabled } = useRealtime();
  const toast = useToast();

  const knownChannel = getChannelBySlug(channelName);
  const [channel, setChannel] = useState(knownChannel ?? null);
  const [loadError, setLoadError] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [isExpiringSoon, setExpiringSoon] = useState(false);
  const [isMembersOpen, setMembersOpen] = useState(true);

  const chat = useChannelChat(channel?.id);
  const { severity, isExpired } = useCountdown(channel?.expiresAt);

  useEffect(() => {
    if (knownChannel) setChannel(knownChannel);
  }, [knownChannel]);

  /**
   * Resolves the name in the URL to a channel. The directory usually already
   * holds it; a deep link or a hard refresh asks the server, which accepts the
   * name as readily as an id.
   */
  useEffect(() => {
    if (channel || !channelName) return undefined;
    let cancelled = false;

    channelsApi
      .get(channelName)
      .then((data) => {
        if (!cancelled) setChannel(data.channel);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(messageForError(error));
      });

    return () => {
      cancelled = true;
    };
  }, [channel, channelName]);

  // Cached attachment blobs belong to this channel; releasing them on the way
  // out keeps a long session from accumulating images for closed conversations.
  useEffect(
    () => () => {
      if (channel?.id) releaseAttachmentCache((path) => path.includes(channel.id));
    },
    [channel?.id],
  );

  const returnToDirectory = useCallback(
    (message) => {
      if (message) toast.warning(message, { key: `closed:${channelName}` });
      navigate('/channels', { replace: true });
    },
    [channelName, navigate, toast],
  );

  useRealtimeEvent(
    SERVER_EVENTS.CHANNEL_EXPIRING,
    useCallback(
      (payload) => {
        if (payload.channelId === channel?.id) setExpiringSoon(true);
      },
      [channel?.id],
    ),
  );

  // The authoritative signal: the channel and its messages are gone.
  useRealtimeEvent(
    SERVER_EVENTS.CHANNEL_EXPIRED,
    useCallback(
      (payload) => {
        if (payload.channelId !== channel?.id) return;
        returnToDirectory(`#${payload.channelName} expired and was deleted.`);
      },
      [channel?.id, returnToDirectory],
    ),
  );

  // Without a socket there is no `channel:expired` push, so ask the server:
  // once the countdown ends (and on every sync) a "gone" answer closes the page.
  const { sync: syncChat, isGone } = chat;
  useEffect(() => {
    if (realtimeEnabled || !isExpired || !channel?.id) return undefined;
    // A short delay absorbs clock skew, so the server agrees it has expired.
    const timer = setTimeout(() => void syncChat({ withMembers: false }), 2000);
    return () => clearTimeout(timer);
  }, [realtimeEnabled, isExpired, channel?.id, syncChat]);

  useEffect(() => {
    if (isGone) {
      void refresh();
      returnToDirectory(`#${channel?.name ?? channelName} is no longer available.`);
    }
  }, [isGone, refresh, returnToDirectory, channel?.name, channelName]);

  const handleSubmitPassword = async (password) => {
    try {
      const joined = await join(channelName, password);
      setChannel(joined);
      setPasswordError(null);
      await chat.join(password);
    } catch (error) {
      setPasswordError(messageForError(error));
    }
  };

  const handleLeave = async () => {
    try {
      await channelsApi.leave(channelName);
      await refresh();
      navigate('/my-channels');
    } catch (error) {
      toast.error(messageForError(error));
    }
  };

  const composerPlaceholder = useMemo(() => {
    if (!isReady) return 'Reconnecting…';
    if (!channel) return 'Type a message…';
    return `Message ${channel.isPrivate ? '' : '#'}${channel.name}…`;
  }, [channel, isReady]);

  if (loadError) {
    return (
      <div className="chat" style={{ padding: 'var(--space-6)' }}>
        <Alert>{loadError}</Alert>
        <Button
          variant="secondary"
          onClick={() => navigate('/channels')}
          style={{ marginTop: 'var(--space-4)' }}
        >
          Back to all channels
        </Button>
      </div>
    );
  }

  if (!channel) return <Spinner label="Opening channel…" />;

  const isBlocked = chat.needsPassword;
  const composerDisabled = !isReady || isBlocked || chat.isJoining;

  return (
    <section className="chat-shell">
      <section className="chat">
        <header className="chat__header">
          <div className="chat__title">
            <span aria-hidden="true">{channel.isPrivate ? '🔒' : '#'}</span>
            <span className="chat__title-name">{channel.name}</span>
            <Badge variant={channel.isPrivate ? 'accent' : 'neutral'}>
              {channel.isPrivate ? 'Private' : 'Public'}
            </Badge>
            {channel.isOwner && <Badge variant="success">Owner</Badge>}
          </div>

          <div className="chat__meta">
            <Countdown expiresAt={channel.expiresAt} />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setMembersOpen((open) => !open)}
              aria-expanded={isMembersOpen}
            >
              👥 {chat.members.length}
              {chat.onlineCount > 0 && <span className="chat__online-dot" aria-hidden="true" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/channels')}>
              Back
            </Button>
            {!channel.isOwner && (
              <Button variant="danger" size="sm" onClick={handleLeave}>
                Leave
              </Button>
            )}
          </div>
        </header>

        {(isExpiringSoon || severity === 'critical') && (
          <div className="chat__banner" role="status">
            <span aria-hidden="true">⏳</span>
            This channel will be deleted in less than a minute. Messages and files go with it.
          </div>
        )}

        {chat.isJoining ? (
          <Spinner label="Joining channel…" />
        ) : (
          <MessageList
            messages={chat.timeline}
            currentUser={user}
            hasMore={chat.hasMore}
            isLoadingOlder={chat.isLoadingOlder}
            onLoadOlder={chat.loadOlder}
            onDiscard={chat.discardFailed}
          />
        )}

        <MessageComposer
          channelRef={channelName}
          onSend={chat.send}
          onError={(message) => toast.error(message)}
          disabled={composerDisabled}
          placeholder={composerPlaceholder}
        />
      </section>

      <MembersPanel
        members={chat.members}
        onlineCount={chat.onlineCount}
        isOpen={isMembersOpen}
        onClose={() => setMembersOpen(false)}
      />

      <JoinPrivateChannelModal
        channel={channel}
        isOpen={isBlocked}
        error={passwordError}
        onClose={() => navigate('/channels')}
        onSubmit={handleSubmitPassword}
      />
    </section>
  );
};
