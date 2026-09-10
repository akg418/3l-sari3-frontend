import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { channelsApi } from '../api/channels.api.js';
import { SERVER_EVENTS } from '../websocket/events.js';
import { useRealtime, useRealtimeEvent } from '../context/RealtimeContext.jsx';

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

const initialState = {
  joinState: JOIN_STATE.JOINING,
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
  const { client, isReady } = useRealtime();
  const [state, dispatch] = useReducer(reducer, initialState);
  const channelIdRef = useRef(channelId);
  channelIdRef.current = channelId;

  const join = useCallback(
    async (password) => {
      if (!channelId) return { ok: false };

      dispatch({ type: 'JOINING' });
      try {
        const result = await client.joinChannel(channelId, { password });
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
    [channelId, client],
  );

  // Joining is tied to the socket being ready, so a reconnect re-runs it and
  // both the transcript and the roster are refreshed with whatever was missed.
  useEffect(() => {
    if (!isReady || !channelId) return;
    void join();
  }, [channelId, isReady, join]);

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
        return { ok: false, error };
      }
    },
    [channelId, client],
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
