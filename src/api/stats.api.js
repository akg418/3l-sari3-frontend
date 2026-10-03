import { httpClient } from './httpClient.js';

/** Guarded by an access code, not by the signed-in user. */
export const statsApi = {
  get: (code) => httpClient.get('/stats', { auth: false, headers: { 'X-Stats-Code': code } }),
};
