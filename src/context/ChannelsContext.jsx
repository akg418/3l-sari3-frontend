import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { channelsApi } from '../api/channels.api.js';
import { messageForError } from '../utils/errorMessages.js';
import { SERVER_EVENTS } from '../websocket/events.js';
import { useAuth } from './AuthContext.jsx';
import { useRealtime, useRealtimeEvent } from './RealtimeContext.jsx';
import { useToast } from './ToastContext.jsx';

const ChannelsContext = createContext(null);

export const EMPTY_FILTERS = Object.freeze({ search: '', owner: '', type: '' });

/**
 * Channels are held once, by id, with two ordered views over them:
 *
 *  - `directory` is a *page* of a server-side query, so it owns its filters
 *    and cursor. It cannot simply be "everything we know about", because what
 *    matches a search lives partly on the server.
 *  - `joined` is the complete list of channels this user is in. It is bounded
 *    by membership, so it is fetched whole and filtered in the browser.
 *
 * Keeping the entities shared means one realtime update corrects both views.
 */
const initialState = {
  byId: {},
  directory: { ids: [], pageInfo: { hasMore: false, nextCursor: null }, isLoading: true, isLoadingMore: false, error: null },
  joined: { ids: [], isLoading: true, error: null },
  quota: { used: 0, limit: null, remaining: null, canCreate: true },
  filters: EMPTY_FILTERS,
};

const indexById = (state, channels) => {
  const byId = { ...state.byId };
  for (const channel of channels) byId[channel.id] = { ...byId[channel.id], ...channel };
  return byId;
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'FILTERS_SET':
      return { ...state, filters: action.filters };

    case 'DIRECTORY_LOADING':
      return {
        ...state,
        directory: { ...state.directory, isLoading: !action.append, isLoadingMore: action.append, error: null },
      };

    case 'DIRECTORY_LOADED': {
      const ids = action.channels.map((channel) => channel.id);
      return {
        ...state,
        byId: indexById(state, action.channels),
        directory: {
          // A fresh query replaces the page; a "load more" extends it, with a
          // guard against an id arriving twice if the set shifted underneath.
          ids: action.append ? [...new Set([...state.directory.ids, ...ids])] : ids,
          pageInfo: action.pageInfo,
          isLoading: false,
          isLoadingMore: false,
          error: null,
        },
      };
    }

    case 'DIRECTORY_FAILED':
      return {
        ...state,
        directory: { ...state.directory, isLoading: false, isLoadingMore: false, error: action.error },
      };

    case 'JOINED_LOADED':
      return {
        ...state,
        byId: indexById(state, action.channels),
        joined: { ids: action.channels.map((channel) => channel.id), isLoading: false, error: null },
        quota: action.quota ?? state.quota,
      };

    case 'JOINED_FAILED':
      return { ...state, joined: { ...state.joined, isLoading: false, error: action.error } };

    case 'QUOTA_SET':
      return { ...state, quota: action.quota };

    case 'UPSERT': {
      const { channel } = action;
      const existing = state.byId[channel.id];
      const merged = { ...existing, ...channel };

      return {
        ...state,
        byId: { ...state.byId, [channel.id]: merged },
        directory: {
          ...state.directory,
          // A brand new channel belongs at the top, since the directory is
          // newest-first - but only if it passes the filters in force.
          ids:
            state.directory.ids.includes(channel.id) || !action.prepend
              ? state.directory.ids
              : [channel.id, ...state.directory.ids],
        },
        joined: {
          ...state.joined,
          ids: merged.isMember
            ? [...new Set([channel.id, ...state.joined.ids])]
            : state.joined.ids.filter((id) => id !== channel.id),
        },
      };
    }

    case 'REMOVE': {
      if (!state.byId[action.channelId]) return state;
      const { [action.channelId]: _removed, ...byId } = state.byId;

      return {
        ...state,
        byId,
        directory: {
          ...state.directory,
          ids: state.directory.ids.filter((id) => id !== action.channelId),
        },
        joined: { ...state.joined, ids: state.joined.ids.filter((id) => id !== action.channelId) },
      };
    }

    /** A message arrived in a channel this user is not currently watching. */
    case 'ACTIVITY': {
      const channel = state.byId[action.channelId];
      if (!channel?.isMember) return state;

      return {
        ...state,
        byId: {
          ...state.byId,
          [action.channelId]: { ...channel, unreadCount: (channel.unreadCount ?? 0) + 1 },
        },
      };
    }

    case 'READ': {
      const channel = state.byId[action.channelId];
      if (!channel || !channel.unreadCount) return state;

      return {
        ...state,
        byId: { ...state.byId, [action.channelId]: { ...channel, unreadCount: 0 } },
      };
    }

    case 'MARK_EXPIRING':
      return state.byId[action.channelId]
        ? {
            ...state,
            byId: {
              ...state.byId,
              [action.channelId]: { ...state.byId[action.channelId], isExpiringSoon: true },
            },
          }
        : state;

    default:
      return state;
  }
};

/** Whether a channel would appear under the filters currently in force. */
export const matchesFilters = (channel, filters) => {
  if (!channel) return false;

  const search = filters.search?.trim().toLowerCase();
  if (search && !channel.name.toLowerCase().includes(search)) return false;

  const owner = filters.owner?.trim().toLowerCase();
  if (owner && !channel.createdBy?.username?.toLowerCase().includes(owner)) return false;

  if (filters.type && channel.type !== filters.type) return false;
  return true;
};

export const ChannelsProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { client, isReady } = useRealtime();
  const toast = useToast();
  const [state, dispatch] = useReducer(reducer, initialState);

  // The filters a request was issued for, so a slow response for an abandoned
  // query cannot overwrite the results of the current one.
  const activeQuery = useRef(0);

  const loadDirectory = useCallback(async (filters, { append = false, cursor = null } = {}) => {
    const requestId = append ? activeQuery.current : (activeQuery.current += 1);
    dispatch({ type: 'DIRECTORY_LOADING', append });

    try {
      const data = await channelsApi.list({
        ...filters,
        ...(cursor ? { beforeCreatedAt: cursor.createdAt, beforeId: cursor.id } : {}),
      });

      if (requestId !== activeQuery.current) return;
      dispatch({ type: 'DIRECTORY_LOADED', channels: data.channels, pageInfo: data.pageInfo, append });
    } catch (error) {
      if (requestId !== activeQuery.current) return;
      dispatch({ type: 'DIRECTORY_FAILED', error: messageForError(error) });
    }
  }, []);

  const loadJoined = useCallback(async () => {
    try {
      const data = await channelsApi.listMine();
      dispatch({ type: 'JOINED_LOADED', channels: data.channels, quota: data.quota });
    } catch (error) {
      dispatch({ type: 'JOINED_FAILED', error: messageForError(error) });
    }
  }, []);

  const setFilters = useCallback(
    (filters) => {
      dispatch({ type: 'FILTERS_SET', filters });
      void loadDirectory(filters);
    },
    [loadDirectory],
  );

  const loadMore = useCallback(() => {
    const { pageInfo, isLoading, isLoadingMore } = state.directory;
    if (!pageInfo.hasMore || isLoading || isLoadingMore) return;
    void loadDirectory(state.filters, { append: true, cursor: pageInfo.nextCursor });
  }, [loadDirectory, state.directory, state.filters]);

  const refresh = useCallback(async () => {
    await Promise.all([loadDirectory(state.filters), loadJoined()]);
  }, [loadDirectory, loadJoined, state.filters]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (isAuthenticated) void refreshRef.current();
  }, [isAuthenticated]);

  // A reconnect may have missed events, so both views are re-read once the
  // socket is usable again.
  useEffect(() => {
    if (isReady) void refreshRef.current();
  }, [isReady]);

  const refreshQuota = useCallback(() => {
    void channelsApi
      .quota()
      .then(({ quota }) => dispatch({ type: 'QUOTA_SET', quota }))
      .catch(() => {});
  }, []);

  const filtersRef = useRef(state.filters);
  filtersRef.current = state.filters;

  useRealtimeEvent(
    SERVER_EVENTS.CHANNEL_CREATED,
    useCallback(({ channel }) => {
      // The payload is viewer-neutral, so it says nothing about membership -
      // which is correct: somebody else creating a channel does not join you
      // to it. It is only shown if it passes the filters currently in force.
      dispatch({
        type: 'UPSERT',
        channel,
        prepend: matchesFilters(channel, filtersRef.current),
      });
    }, []),
  );

  useRealtimeEvent(
    SERVER_EVENTS.CHANNEL_ACTIVITY,
    useCallback(({ channelId }) => dispatch({ type: 'ACTIVITY', channelId }), []),
  );

  // Sent to every one of this user's sessions, so reading in one tab clears
  // the badge in the others.
  useRealtimeEvent(
    SERVER_EVENTS.CHANNEL_READ,
    useCallback(({ channelId }) => dispatch({ type: 'READ', channelId }), []),
  );

  useRealtimeEvent(
    SERVER_EVENTS.CHANNEL_EXPIRING,
    useCallback(
      ({ channelId, channelName, message }) => {
        dispatch({ type: 'MARK_EXPIRING', channelId });
        toast.warning(message, {
          title: `#${channelName}`,
          key: `expiring:${channelId}`,
          duration: 8000,
        });
      },
      [toast],
    ),
  );

  useRealtimeEvent(
    SERVER_EVENTS.CHANNEL_EXPIRED,
    useCallback(
      ({ channelId }) => {
        dispatch({ type: 'REMOVE', channelId });
        client.forgetChannel(channelId);
        refreshQuota();
      },
      [client, refreshQuota],
    ),
  );

  const join = useCallback(async (ref, password) => {
    const { channel } = await channelsApi.join(ref, password);
    dispatch({ type: 'UPSERT', channel: { ...channel, isMember: true } });
    return channel;
  }, []);

  const leave = useCallback(
    async (ref) => {
      const { channelId } = await channelsApi.leave(ref);
      await client.leaveChannel(channelId).catch(() => {});
      dispatch({ type: 'UPSERT', channel: { id: channelId, isMember: false } });
    },
    [client],
  );

  const create = useCallback(
    async (payload) => {
      const { channel } = await channelsApi.create(payload);
      dispatch({
        type: 'UPSERT',
        channel: { ...channel, isMember: true },
        prepend: matchesFilters(channel, filtersRef.current),
      });
      refreshQuota();
      return channel;
    },
    [refreshQuota],
  );

  const allChannels = useMemo(
    () => state.directory.ids.map((id) => state.byId[id]).filter(Boolean),
    [state.directory.ids, state.byId],
  );

  const myChannels = useMemo(
    () =>
      state.joined.ids
        .map((id) => state.byId[id])
        .filter((channel) => channel?.isMember)
        .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt)),
    [state.joined.ids, state.byId],
  );

  const value = useMemo(
    () => ({
      allChannels,
      myChannels,
      filters: state.filters,
      quota: state.quota,

      isLoading: state.directory.isLoading,
      isLoadingMore: state.directory.isLoadingMore,
      hasMore: state.directory.pageInfo.hasMore,
      error: state.directory.error,

      isLoadingMine: state.joined.isLoading,
      errorMine: state.joined.error,
      totalUnread: state.joined.ids.reduce(
        (total, id) => total + (state.byId[id]?.unreadCount ?? 0),
        0,
      ),
      markRead: (channelId) => dispatch({ type: 'READ', channelId }),

      setFilters,
      loadMore,
      refresh,
      create,
      join,
      leave,
      getChannel: (channelId) => state.byId[channelId],
      /**
       * Resolves the identifier that appears in the URL. Names are unique and
       * compared case-insensitively, matching the server's own lookup.
       */
      getChannelBySlug: (slug) =>
        Object.values(state.byId).find(
          (channel) => channel.name.toLowerCase() === String(slug ?? '').toLowerCase(),
        ),
      removeChannel: (channelId) => dispatch({ type: 'REMOVE', channelId }),
    }),
    [allChannels, myChannels, state, setFilters, loadMore, refresh, create, join, leave],
  );

  return <ChannelsContext.Provider value={value}>{children}</ChannelsContext.Provider>;
};

export const useChannels = () => {
  const context = useContext(ChannelsContext);
  if (!context) throw new Error('useChannels must be used inside a ChannelsProvider');
  return context;
};
