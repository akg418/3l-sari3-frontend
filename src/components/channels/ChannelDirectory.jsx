import { ChannelCard } from './ChannelCard.jsx';
import { JoinPrivateChannelModal } from './JoinPrivateChannelModal.jsx';
import { EmptyState, Spinner, Alert } from '../common/Feedback.jsx';
import { useJoinChannel } from '../../hooks/useJoinChannel.js';

/**
 * A grid of channel cards plus the private-channel password prompt.
 * Both the "all" and "my" pages render this, so the join flow exists once.
 */
export const ChannelDirectory = ({ channels, isLoading, error, emptyState, onLeave }) => {
  const { requestJoin, passwordModal } = useJoinChannel();

  if (isLoading) return <Spinner label="Loading channels…" />;

  return (
    <>
      {error && <Alert>{error}</Alert>}

      {channels.length === 0 ? (
        <EmptyState {...emptyState} />
      ) : (
        <div className="channel-grid">
          {channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              onJoin={requestJoin}
              onLeave={onLeave}
            />
          ))}
        </div>
      )}

      <JoinPrivateChannelModal {...passwordModal} />
    </>
  );
};
