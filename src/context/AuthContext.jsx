import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/auth.api.js';
import { httpClient } from '../api/httpClient.js';
import { config } from '../config.js';

const AuthContext = createContext(null);

export const AUTH_STATUS = Object.freeze({
  LOADING: 'loading',
  AUTHENTICATED: 'authenticated',
  ANONYMOUS: 'anonymous',
});

const readStoredToken = () => {
  try {
    return localStorage.getItem(config.storageKeys.token);
  } catch {
    return null;
  }
};

const writeStoredToken = (token) => {
  try {
    if (token) localStorage.setItem(config.storageKeys.token, token);
    else localStorage.removeItem(config.storageKeys.token);
  } catch {
    // Private browsing modes can refuse storage; the session still works,
    // it simply will not survive a reload.
  }
};

/**
 * Owns the session.
 *
 * The token is kept in a ref-like closure for the HTTP client and re-validated
 * against the server on boot, because a token in storage proves nothing about
 * whether it is still accepted.
 */
export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(readStoredToken);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(AUTH_STATUS.LOADING);

  const applySession = useCallback(({ user: nextUser, token: nextToken }) => {
    writeStoredToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
    setStatus(AUTH_STATUS.AUTHENTICATED);
  }, []);

  const clearSession = useCallback(() => {
    writeStoredToken(null);
    setToken(null);
    setUser(null);
    setStatus(AUTH_STATUS.ANONYMOUS);
  }, []);

  // The HTTP client needs to read the current token and to be able to end the
  // session centrally when the server rejects one.
  useEffect(() => {
    httpClient.configure({
      getToken: () => readStoredToken(),
      onUnauthorized: () => clearSession(),
    });
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      if (!readStoredToken()) {
        setStatus(AUTH_STATUS.ANONYMOUS);
        return;
      }

      try {
        const data = await authApi.me();
        if (cancelled) return;
        setUser(data.user);
        setStatus(AUTH_STATUS.AUTHENTICATED);
      } catch {
        if (!cancelled) clearSession();
      }
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      token,
      status,
      isAuthenticated: status === AUTH_STATUS.AUTHENTICATED,
      isLoading: status === AUTH_STATUS.LOADING,
      login: async (credentials) => applySession(await authApi.login(credentials)),
      register: async (payload) => applySession(await authApi.register(payload)),
      logout: clearSession,
    }),
    [user, token, status, applySession, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
};
