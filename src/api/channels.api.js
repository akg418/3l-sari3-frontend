import { httpClient } from './httpClient.js';

/**
 * Channels are addressed by `ref`: their unique name, as used in the URL, or
 * their id. The server resolves either, so callers never have to convert one
 * into the other.
 */
const encodeRef = (ref) => encodeURIComponent(ref);

export const channelsApi = {
  /**
   * One page of the public directory. Search and filters are applied by the
   * server: with paging, a client can only filter what it has already fetched.
   */
  list: ({ search, owner, type, limit, beforeCreatedAt, beforeId } = {}) =>
    httpClient.get('/channels', {
      query: {
        search: search || undefined,
        owner: owner || undefined,
        type: type || undefined,
        limit,
        beforeCreatedAt,
        beforeId,
      },
    }),
  listMine: () => httpClient.get('/channels/mine'),
  quota: () => httpClient.get('/channels/quota'),
  uploadConstraints: () => httpClient.get('/channels/upload-constraints'),

  get: (ref) => httpClient.get(`/channels/${encodeRef(ref)}`),
  members: (ref) => httpClient.get(`/channels/${encodeRef(ref)}/members`),

  create: (payload) => httpClient.post('/channels', payload),
  join: (ref, password) => httpClient.post(`/channels/${encodeRef(ref)}/join`, { password }),
  leave: (ref) => httpClient.post(`/channels/${encodeRef(ref)}/leave`),

  messages: (ref, { limit, beforeCreatedAt, beforeId } = {}) =>
    httpClient.get(`/channels/${encodeRef(ref)}/messages`, {
      query: { limit, beforeCreatedAt, beforeId },
    }),
};
