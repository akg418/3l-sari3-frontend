import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { realtimeClient } from '../websocket/RealtimeClient.js';
import { CONNECTION_STATUS, LOCAL_EVENTS, SERVER_EVENTS } from '../websocket/events.js';
import { config } from '../config.js';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';

const RealtimeContext = createContext(null);

/**
 * Binds the socket's lifetime to the session: it connects once the user is
 * authenticated and disconnects on sign-out. The client itself owns reconnects.
 */
export const RealtimeProvider = ({ children }) => {
  const { isAuthenticated, logout } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState(realtimeClient.status);

  useEffect(() => {
    realtimeClient.configure({
      getToken: () => {
        try {
          return localStorage.getItem(config.storageKeys.token);
        } catch {
          return null;
        }
      },
    });
  }, []);

  useEffect(() => realtimeClient.on(LOCAL_EVENTS.STATUS, setStatus), []);

  useEffect(() => {
    if (isAuthenticated) realtimeClient.connect();
    else realtimeClient.disconnect();
  }, [isAuthenticated]);

  // A socket-level auth failure means the token is no longer good anywhere.
  useEffect(
    () =>
      realtimeClient.on(SERVER_EVENTS.ERROR, (error) => {
        if (['TOKEN_INVALID', 'TOKEN_EXPIRED'].includes(error?.code)) {
          toast.error('Your session has expired. Please sign in again.', { key: 'session' });
          logout();
        }
      }),
    [logout, toast],
  );

  // Reconnecting is normal and self-healing, so it is reported quietly and
  // only once the client has actually started retrying.
  useEffect(() => {
    if (status === CONNECTION_STATUS.RECONNECTING) {
      toast.warning('Connection lost. Reconnecting…', { key: 'connection', duration: 4000 });
    }
  }, [status, toast]);

  const value = useMemo(
    () => ({
      client: realtimeClient,
      status,
      isReady: status === CONNECTION_STATUS.READY,
    }),
    [status],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context) throw new Error('useRealtime must be used inside a RealtimeProvider');
  return context;
};

/** Subscribes to a server event for the lifetime of the calling component. */
export const useRealtimeEvent = (event, handler) => {
  const { client } = useRealtime();

  useEffect(() => {
    if (!handler) return undefined;
    return client.on(event, handler);
  }, [client, event, handler]);
};
