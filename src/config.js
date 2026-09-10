const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3005/api';

/**
 * Derives the socket endpoint from the API URL when it is not configured
 * explicitly, so a deployment only has to set one address.
 */
const deriveWsUrl = (apiUrl) => {
  try {
    const url = new URL(apiUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws';
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return 'ws://localhost:3005/ws';
  }
};

export const config = Object.freeze({
  apiUrl: API_URL.replace(/\/$/, ''),
  wsUrl: import.meta.env.VITE_WS_URL || deriveWsUrl(API_URL),
  appName: import.meta.env.VITE_APP_NAME ?? '3l sari3',

  /** Shown in the footer. Branding, not configuration, so it lives here. */
  author: {
    portfolioUrl: 'https://portfolio-akg418.vercel.app',
    portfolioLabel: 'Ahmed Khaled',
  },

  // Deliberately unchanged by the rename: a new key would sign everyone out
  // for no benefit, and it is never shown to anyone.
  storageKeys: { token: 'ephemera.token' },
});
