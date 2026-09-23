import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { realtimeClient } from '../websocket/RealtimeClient.js';
import { CONNECTION_STATUS, LOCAL_EVENTS, SERVER_EVENTS } from '../websocket/events.js';
import { config } from '../config.js';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';

const RealtimeContext = createContext(null);

const { realtimeEnabled } = config;

/**
 * Binds the socket's lifetime to the session: it connects once the user is
 * authenticated and disconnects on sign-out. The client itself owns reconnects.
 *
 * With the socket switched off (VITE_REALTIME_ENABLED=false) it instead owns
 * *sync*: components register a handler that fetches what they may have
 * missed, and `sync()` runs them all - from the Sync button, and on a timer.
 */
export const RealtimeProvider = ({ children }) => {
  const { isAuthenticated, logout } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState(realtimeClient.status);

  const syncHandlers = useRef(new Set());
  const [isSyncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const registerSync = useCallback((handler) => {
    syncHandlers.current.add(handler);
    return () => syncHandlers.current.delete(handler);
  }, []);

  const syncingRef = useRef(false);
  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      await Promise.allSettled([...syncHandlers.current].map((handler) => handler()));
      setLastSyncedAt(new Date());
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (realtimeEnabled || !isAuthenticated) return undefined;
    const interval = setInterval(() => void sync(), config.pollIntervalMs);
    return () => clearInterval(interval);
  }, [isAuthenticated, sync]);

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
    if (realtimeEnabled && isAuthenticated) realtimeClient.connect();
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
      realtimeEnabled,
      // Without a socket, HTTP is the transport and is always usable.
      isReady: realtimeEnabled ? status === CONNECTION_STATUS.READY : true,
      sync,
      isSyncing,
      lastSyncedAt,
      registerSync,
    }),
    [status, sync, isSyncing, lastSyncedAt, registerSync],
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

/**
 * Registers a catch-up handler, run on every sync while the socket is off.
 * The latest handler is always the one called, so it may close over state.
 */
export const useSyncHandler = (handler) => {
  const { registerSync, realtimeEnabled } = useRealtime();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (realtimeEnabled) return undefined;
    return registerSync(() => handlerRef.current?.());
  }, [registerSync, realtimeEnabled]);
};
