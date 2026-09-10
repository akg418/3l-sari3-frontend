import { CONNECTION_STATUS } from '../../websocket/events.js';
import { useRealtime } from '../../context/RealtimeContext.jsx';

const PRESENTATION = {
  [CONNECTION_STATUS.READY]: { modifier: 'ready', label: 'Live' },
  [CONNECTION_STATUS.CONNECTING]: { modifier: 'connecting', label: 'Connecting' },
  [CONNECTION_STATUS.AUTHENTICATING]: { modifier: 'connecting', label: 'Connecting' },
  [CONNECTION_STATUS.RECONNECTING]: { modifier: 'connecting', label: 'Reconnecting' },
  [CONNECTION_STATUS.OFFLINE]: { modifier: 'offline', label: 'Offline' },
  [CONNECTION_STATUS.IDLE]: { modifier: 'offline', label: 'Offline' },
};

/** Makes the socket's state visible, so a reconnect is never a silent stall. */
export const ConnectionPill = () => {
  const { status } = useRealtime();
  const { modifier, label } = PRESENTATION[status] ?? PRESENTATION[CONNECTION_STATUS.IDLE];

  return (
    <span className={`connection-pill connection-pill--${modifier}`} title={`Realtime: ${label}`}>
      <span className="connection-pill__dot" aria-hidden="true" />
      {label}
    </span>
  );
};
