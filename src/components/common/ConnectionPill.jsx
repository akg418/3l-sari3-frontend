import { CONNECTION_STATUS } from '../../websocket/events.js';
import { useRealtime } from '../../context/RealtimeContext.jsx';
import { Button } from './Button.jsx';

const PRESENTATION = {
  [CONNECTION_STATUS.READY]: { modifier: 'ready', label: 'Live' },
  [CONNECTION_STATUS.CONNECTING]: { modifier: 'connecting', label: 'Connecting' },
  [CONNECTION_STATUS.AUTHENTICATING]: { modifier: 'connecting', label: 'Connecting' },
  [CONNECTION_STATUS.RECONNECTING]: { modifier: 'connecting', label: 'Reconnecting' },
  [CONNECTION_STATUS.OFFLINE]: { modifier: 'offline', label: 'Offline' },
  [CONNECTION_STATUS.IDLE]: { modifier: 'offline', label: 'Offline' },
};

const formatTime = (date) =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Without a socket, updates arrive on demand: a Sync button stands in for "Live". */
const SyncButton = () => {
  const { sync, isSyncing, lastSyncedAt } = useRealtime();

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => void sync()}
      isLoading={isSyncing}
      title={lastSyncedAt ? `Last synced ${formatTime(lastSyncedAt)}` : 'Fetch new messages'}
    >
      {isSyncing ? 'Syncing' : '⟳ Sync'}
    </Button>
  );
};

/** Makes the socket's state visible, so a reconnect is never a silent stall. */
export const ConnectionPill = () => {
  const { status, realtimeEnabled } = useRealtime();
  if (!realtimeEnabled) return <SyncButton />;

  const { modifier, label } = PRESENTATION[status] ?? PRESENTATION[CONNECTION_STATUS.IDLE];

  return (
    <span className={`connection-pill connection-pill--${modifier}`} title={`Realtime: ${label}`}>
      <span className="connection-pill__dot" aria-hidden="true" />
      {label}
    </span>
  );
};
