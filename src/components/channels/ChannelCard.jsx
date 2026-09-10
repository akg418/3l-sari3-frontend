import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';
import { Countdown } from '../common/Countdown.jsx';
import { useCountdown } from '../../hooks/useCountdown.js';
import { pluralize } from '../../utils/format.js';

/**
 * One channel in the directory. A private channel is marked with a lock; its
 * password is never part of the payload this renders.
 */
export const ChannelCard = ({ channel, onJoin, onOpen, onLeave }) => {
  const navigate = useNavigate();
  const [isBusy, setIsBusy] = useState(false);
  const { severity } = useCountdown(channel.expiresAt);

  const handleJoin = async () => {
    setIsBusy(true);
    try {
      if (channel.isMember) {
        onOpen ? onOpen(channel) : navigate(`/channels/${channel.slug ?? channel.name}`);
        return;
      }
      await onJoin(channel);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <article
      className={`card channel-card ${severity === 'critical' ? 'channel-card--expiring' : ''}`.trim()}
    >
      <div className="channel-card__head">
        <h3 className="channel-card__name">
          <span className="channel-card__lock" aria-hidden="true">
            {channel.isPrivate ? '🔒' : '#'}
          </span>
          <span title={channel.name}>{channel.name}</span>
        </h3>

        <div className="channel-card__flags">
          {channel.unreadCount > 0 && (
            <span
              className="unread-badge"
              title={`${channel.unreadCount} unread ${channel.unreadCount === 1 ? 'message' : 'messages'}`}
            >
              {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
            </span>
          )}
          {channel.isOwner ? (
            <Badge variant="accent">Owner</Badge>
          ) : (
            channel.isMember && <Badge variant="success">Joined</Badge>
          )}
        </div>
      </div>

      <div className="channel-card__meta">
        <Badge variant={channel.isPrivate ? 'accent' : 'neutral'}>
          {channel.isPrivate ? 'Private' : 'Public'}
        </Badge>
        <span>{pluralize(channel.memberCount ?? 0, 'member')}</span>
        <span className="subtle">by {channel.createdBy?.username}</span>
      </div>

      <div className="channel-card__foot">
        <Countdown expiresAt={channel.expiresAt} />

        <div className="row" style={{ gap: 'var(--space-2)' }}>
          {/* The creator cannot leave their own channel, so it is not offered. */}
          {channel.isMember && !channel.isOwner && onLeave && (
            <Button variant="ghost" size="sm" onClick={() => onLeave(channel)}>
              Leave
            </Button>
          )}
          <Button size="sm" onClick={handleJoin} isLoading={isBusy}>
            {channel.isMember ? 'Open' : 'Join'}
          </Button>
        </div>
      </div>
    </article>
  );
};
