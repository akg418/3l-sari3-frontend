import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { channelsApi } from '../api/channels.api.js';
import { SERVER_EVENTS } from '../websocket/events.js';
import { useRealtime, useRealtimeEvent, useSyncHandler } from '../context/RealtimeContext.jsx';
import { useChannels } from '../context/ChannelsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const JOIN_STATE = Object.freeze({
  JOINING: 'joining',
  JOINED: 'joined',
  PASSWORD_REQUIRED: 'password_required',
  FAILED: 'failed',
});

let localMessageCounter = 0;
const nextClientMessageId = () => {
  localMessageCounter += 1;
  return `local-${Date.now()}-${localMessageCounter}`;
};

/** Errors that mean the channel is gone, or this user is no longer in it. */
const GONE_CODES = ['CHANNEL_NOT_FOUND', 'CHANNEL_EXPIRED', 'CHANNEL_NOT_JOINED'];

/** Catch-up pages fetched per sync, at most - enough for any short-lived channel. */
const MAX_CATCH_UP_PAGES = 10;

const cursorOf = (message) => (message ? { createdAt: message.createdAt, id: message.id } : null);

const byTimeline = (a, b) =>
  Date.parse(a.createdAt) - Date.parse(b.createdAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const initialState = {
  joinState: JOIN_STATE.JOINING,
  isGone: false,
  joinError: null,
  messages: [],
  /** Optimistic bubbles the server has not confirmed yet. */
  pending: [],
  members: [],
  notices: [],
  pageInfo: { hasMore: false, nextCursor: null },
  isLoadingOlder: false,
};

const sortRoster = (members) =>
  [...members].sort((a, b) => {
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
    return a.username.localeCompare(b.username);
  });

const reducer = (state, action) => {
  switch (action.type) {
    case 'JOINING':
      return { ...initialState, joinState: JOIN_STATE.JOINING };

    case 'JOINED':
      return {
        ...state,
        joinState: JOIN_STATE.JOINED,
        joinError: null,
        messages: action.messages,
        members: sortRoster(action.members ?? []),
        pageInfo: action.pageInfo ?? initialState.pageInfo,
      };

    case 'JOIN_FAILED':
      return { ...state, joinState: action.joinState, joinError: action.error };

    case 'MESSAGE_RECEIVED': {
      if (state.messages.some((message) => message.id === action.message.id)) return state;

      return {
        ...state,
        messages: [...state.messages, action.message],
        // Drop the optimistic bubble this message confirms.
        pending: state.pending.filter((entry) => entry.serverId !== action.message.id),
      };
    }

    /** Messages fetched over HTTP: merged by id, kept in timeline order. */
    case 'MESSAGES_MERGED': {
      const known = new Set(state.messages.map((message) => message.id));
      const fresh = action.messages.filter((message) => !known.has(message.id));
      if (fresh.length === 0) return state;

      const ids = new Set(fresh.map((message) => message.id));
      return {
        ...state,
        messages: [...state.messages, ...fresh].sort(byTimeline),
        pending: state.pending.filter((entry) => !ids.has(entry.serverId)),
      };
    }

    case 'GONE':
      return { ...state, isGone: true };

    case 'MESSAGE_PENDING':
      return { ...state, pending: [...state.pending, action.entry] };

    case 'MESSAGE_ACKED': {
      const confirmed = state.messages.some((message) => message.id === action.messageId);

      return {
        ...state,
        pending: confirmed
          ? state.pending.filter((entry) => entry.clientMessageId !== action.clientMessageId)
          : state.pending.map((entry) =>
              entry.clientMessageId === action.clientMessageId
                ? { ...entry, serverId: action.messageId, status: 'sent' }
                : entry,
            ),
      };
    }

    case 'MESSAGE_FAILED':
      return {
        ...state,
        pending: state.pending.map((entry) =>
          entry.clientMessageId === action.clientMessageId
            ? { ...entry, status: 'failed', error: action.error }
            : entry,
        ),
      };

    case 'MESSAGE_DISCARDED':
      return {
        ...state,
        pending: state.pending.filter((entry) => entry.clientMessageId !== action.clientMessageId),
      };

    case 'MEMBERS_SET':
      return { ...state, members: sortRoster(action.members) };

    /**
     * A presence delta. It only ever flips a flag on someone already on the
     * roster - a *new* member arrives with a full snapshot instead, so the
     * roster cannot drift out of step with the server.
     */
    case 'PRESENCE_CHANGED': {
      const known = state.members.some((member) => member.id === action.user.id);
      if (!known) return state;

      return {
        ...state,
        members: sortRoster(
          state.members.map((member) =>
            member.id === action.user.id ? { ...member, isOnline: action.isOnline } : member,
          ),
        ),
      };
    }

    case 'OLDER_LOADING':
      return { ...state, isLoadingOlder: true };

    case 'OLDER_LOADED':
      return {
        ...state,
        isLoadingOlder: false,
        messages: [...action.messages, ...state.messages],
        pageInfo: action.pageInfo,
      };

    case 'OLDER_FAILED':
      return { ...state, isLoadingOlder: false };

    case 'NOTICE':
      return { ...state, notices: [...state.notices, action.notice] };

    default:
      return state;
  }
};

/**
 * Everything needed to render one channel's conversation.
 *
 * Joining over the socket is what subscribes this client to the channel; the
 * acknowledgement carries the recent history and the current roster in the
 * same round trip. A deep link into a private channel the user has not joined
 * surfaces as `PASSWORD_REQUIRED` rather than an error, so the UI can prompt.
 */
export const useChannelChat = (channelId) => {
  const { client, isReady, realtimeEnabled } = useRealtime();
  const { markRead: clearBadge } = useChannels();
  const { user } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);
  const channelIdRef = useRef(channelId);
  channelIdRef.current = channelId;
  const joinStateRef = useRef(state.joinState);
  joinStateRef.current = state.joinState;

  /**
   * Without a socket: the newest message this client has fetched from the
   * server. Catch-up asks for everything after it. Only server reads move it,
   * so a message sent from here cannot hide others that arrived just before.
   */
  const syncCursorRef = useRef(null);

  const markReadOverHttp = useCallback(
    (id) => {
      clearBadge(id);
      void channelsApi.markRead(id).catch(() => {});
    },
    [clearBadge],
  );

  const joinOverHttp = useCallback(
    async (password) => {
      await channelsApi.join(channelId, password);
      const [history, roster] = await Promise.all([
        channelsApi.messages(channelId),
        channelsApi.members(channelId),
      ]);
      syncCursorRef.current = cursorOf(history.messages.at(-1));
      markReadOverHttp(channelId);
      return { messages: history.messages, pageInfo: history.pageInfo, members: roster.members };
    },
    [channelId, markReadOverHttp],
  );

  const join = useCallback(
    async (password) => {
      if (!channelId) return { ok: false };

      dispatch({ type: 'JOINING' });
      try {
        const result = realtimeEnabled
          ? await client.joinChannel(channelId, { password })
          : await joinOverHttp(password);
        dispatch({
          type: 'JOINED',
          messages: result.messages ?? [],
          members: result.members ?? [],
          pageInfo: result.pageInfo,
        });
        return { ok: true };
      } catch (error) {
        const needsPassword = ['CHANNEL_PASSWORD_REQUIRED', 'CHANNEL_PASSWORD_INVALID'].includes(
          error?.code,
        );
        dispatch({
          type: 'JOIN_FAILED',
          joinState: needsPassword ? JOIN_STATE.PASSWORD_REQUIRED : JOIN_STATE.FAILED,
          error,
        });
        return { ok: false, error };
      }
    },
    [channelId, client, realtimeEnabled, joinOverHttp],
  );

  // Joining is tied to the socket being ready, so a reconnect re-runs it and
  // both the transcript and the roster are refreshed with whatever was missed.
  useEffect(() => {
    if (!isReady || !channelId) return;
    void join();
  }, [channelId, isReady, join]);

  /**
   * Catch-up for socket-less mode: fetch messages newer than the sync cursor,
   * then the roster. A "gone" error means the channel expired or we left it.
   */
  const catchUp = useCallback(
    async ({ withMembers = true } = {}) => {
      const id = channelIdRef.current;
      if (!id || joinStateRef.current !== JOIN_STATE.JOINED) return;

      try {
        let cursor = syncCursorRef.current;
        const fetched = [];

        for (let page = 0; page < MAX_CATCH_UP_PAGES; page += 1) {
          const result = await channelsApi.messages(
            id,
            cursor ? { afterCreatedAt: cursor.createdAt, afterId: cursor.id, limit: 100 } : {},
          );
          fetched.push(...result.messages);
          const hadCursor = Boolean(cursor);
          cursor = cursorOf(result.messages.at(-1)) ?? cursor;
          // Without a cursor that was the latest page; older ones load on scroll.
          if (!hadCursor || !result.pageInfo?.hasMore) break;
        }

        if (id !== channelIdRef.current) return;
        syncCursorRef.current = cursor;
        if (fetched.length > 0) dispatch({ type: 'MESSAGES_MERGED', messages: fetched });

        const fromOthers = fetched.some((message) => message.sender?.id !== user?.id);
        if (fromOthers && document.visibilityState === 'visible') markReadOverHttp(id);

        if (withMembers) {
          const roster = await channelsApi.members(id);
          if (id === channelIdRef.current) dispatch({ type: 'MEMBERS_SET', members: roster.members });
        }
      } catch (error) {
        if (GONE_CODES.includes(error?.code)) dispatch({ type: 'GONE' });
      }
    },
    [markReadOverHttp, user?.id],
  );

  useSyncHandler(catchUp);

  const forThisChannel = (handler) => (payload) => {
    if (payload.channelId !== channelIdRef.current) return;
    handler(payload);
  };

  useRealtimeEvent(
    SERVER_EVENTS.MESSAGE_NEW,
    useCallback(
      ({ message }) => {
        if (message.channelId !== channelIdRef.current) return;
        dispatch({ type: 'MESSAGE_RECEIVED', message });

        // Having the channel open in a visible tab is reading it. A hidden tab
        // is not, so a background window keeps accumulating unread messages.
        if (document.visibilityState === 'visible') client.markRead(message.channelId);
      },
      [client],
    ),
  );

  useRealtimeEvent(
    SERVER_EVENTS.CHANNEL_MEMBERS,
    useCallback(
      forThisChannel(({ members }) => dispatch({ type: 'MEMBERS_SET', members })),
      [],
    ),
  );

  useRealtimeEvent(
    SERVER_EVENTS.CHANNEL_PRESENCE,
    useCallback(
      forThisChannel(({ user, isOnline }) => dispatch({ type: 'PRESENCE_CHANGED', user, isOnline })),
      [],
    ),
  );

  useRealtimeEvent(
    SERVER_EVENTS.CHANNEL_MEMBER_JOINED,
    useCallback(
      forThisChannel(({ user }) =>
        dispatch({
          type: 'NOTICE',
          notice: { id: `join-${user.id}-${Date.now()}`, text: `${user.username} joined` },
        }),
      ),
      [],
    ),
  );

  useRealtimeEvent(
    SERVER_EVENTS.CHANNEL_MEMBER_LEFT,
    useCallback(
      forThisChannel(({ user }) =>
        dispatch({
          type: 'NOTICE',
          notice: { id: `left-${user.id}-${Date.now()}`, text: `${user.username} left` },
        }),
      ),
      [],
    ),
  );

  const send = useCallback(
    async ({ content = '', attachments = [] } = {}) => {
      const body = content.trim();
      const attachmentIds = attachments.map((entry) => entry.id ?? entry);
      if (!body && attachmentIds.length === 0) return { ok: false };

      const clientMessageId = nextClientMessageId();
      dispatch({
        type: 'MESSAGE_PENDING',
        entry: {
          clientMessageId,
          content: body,
          attachments,
          createdAt: new Date().toISOString(),
          status: 'sending',
        },
      });

      try {
        if (!realtimeEnabled) {
          const { message } = await channelsApi.sendMessage(channelId, {
            content: body || undefined,
            attachmentIds,
            clientMessageId,
          });
          dispatch({ type: 'MESSAGES_MERGED', messages: [message] });
          dispatch({ type: 'MESSAGE_DISCARDED', clientMessageId });
          // Pull in anything others sent meanwhile, so the reply lands in context.
          void catchUp({ withMembers: false });
          return { ok: true };
        }

        const ack = await client.sendMessage({
          channelId,
          content: body,
          attachmentIds,
          clientMessageId,
        });
        dispatch({ type: 'MESSAGE_ACKED', clientMessageId, messageId: ack.messageId });
        return { ok: true };
      } catch (error) {
        dispatch({ type: 'MESSAGE_FAILED', clientMessageId, error });
        if (GONE_CODES.includes(error?.code)) dispatch({ type: 'GONE' });
        return { ok: false, error };
      }
    },
    [channelId, client, realtimeEnabled, catchUp],
  );

  const discardFailed = useCallback((clientMessageId) => {
    dispatch({ type: 'MESSAGE_DISCARDED', clientMessageId });
  }, []);

  const loadOlder = useCallback(async () => {
    const cursor = state.pageInfo.nextCursor;
    if (!cursor || state.isLoadingOlder) return;

    dispatch({ type: 'OLDER_LOADING' });
    try {
      const result = await channelsApi.messages(channelId, {
        beforeCreatedAt: cursor.createdAt,
        beforeId: cursor.id,
      });
      dispatch({ type: 'OLDER_LOADED', messages: result.messages, pageInfo: result.pageInfo });
    } catch {
      dispatch({ type: 'OLDER_FAILED' });
    }
  }, [channelId, state.pageInfo.nextCursor, state.isLoadingOlder]);

  /** Confirmed history followed by any still-unconfirmed optimistic bubbles. */
  const timeline = useMemo(
    () => [
      ...state.messages,
      ...state.pending.map((entry) => ({
        id: entry.clientMessageId,
        clientMessageId: entry.clientMessageId,
        content: entry.content,
        attachments: entry.attachments ?? [],
        createdAt: entry.createdAt,
        messageType: entry.attachments?.length ? 'image' : 'text',
        isPending: entry.status !== 'failed',
        isFailed: entry.status === 'failed',
        sender: null,
      })),
    ],
    [state.messages, state.pending],
  );

  const onlineCount = state.members.filter((member) => member.isOnline).length;

  return {
    joinState: state.joinState,
    joinError: state.joinError,
    /** Socket-less mode only: the channel expired or this user left it. */
    isGone: state.isGone,
    sync: catchUp,
    isJoining: state.joinState === JOIN_STATE.JOINING,
    needsPassword: state.joinState === JOIN_STATE.PASSWORD_REQUIRED,
    timeline,
    members: state.members,
    onlineCount,
    notices: state.notices,
    hasMore: state.pageInfo.hasMore,
    isLoadingOlder: state.isLoadingOlder,
    join,
    send,
    discardFailed,
    loadOlder,
  };
};

export { JOIN_STATE };
