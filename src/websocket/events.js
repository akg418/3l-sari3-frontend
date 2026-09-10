/** Mirrors backend/src/websocket/events.js - the two must stay in step. */
export const CLIENT_EVENTS = Object.freeze({
  AUTHENTICATE: 'auth:authenticate',
  PING: 'ping',
  CHANNEL_JOIN: 'channel:join',
  CHANNEL_LEAVE: 'channel:leave',
  MESSAGE_SEND: 'message:send',
  /** "I am looking at this channel" - moves the unread cutoff forward. */
  CHANNEL_READ: 'channel:read',
});

export const SERVER_EVENTS = Object.freeze({
  CONNECTION_READY: 'connection:ready',
  AUTHENTICATED: 'auth:authenticated',
  PONG: 'pong',

  CHANNEL_CREATED: 'channel:created',
  CHANNEL_JOINED: 'channel:joined',
  CHANNEL_LEFT: 'channel:left',
  CHANNEL_MEMBER_JOINED: 'channel:member_joined',
  CHANNEL_MEMBER_LEFT: 'channel:member_left',
  CHANNEL_EXPIRING: 'channel:expiring',
  CHANNEL_EXPIRED: 'channel:expired',

  /** Full roster snapshot: on join, and whenever membership changes. */
  CHANNEL_MEMBERS: 'channel:members',
  /** One member came online or went offline. */
  CHANNEL_PRESENCE: 'channel:presence',

  MESSAGE_NEW: 'message:new',
  MESSAGE_ACK: 'message:ack',

  /** A message landed in a channel you belong to but are not watching. */
  CHANNEL_ACTIVITY: 'channel:activity',
  /** Your read cutoff moved - possibly in another tab. */
  CHANNEL_READ: 'channel:read',

  ERROR: 'error',
});

/** Local, client-only events describing the state of the connection itself. */
export const LOCAL_EVENTS = Object.freeze({
  STATUS: 'local:status',
});

export const CONNECTION_STATUS = Object.freeze({
  IDLE: 'idle',
  CONNECTING: 'connecting',
  AUTHENTICATING: 'authenticating',
  READY: 'ready',
  RECONNECTING: 'reconnecting',
  OFFLINE: 'offline',
});

export const CLOSE_CODES = Object.freeze({
  AUTH_REQUIRED: 4401,
  AUTH_TIMEOUT: 4408,
  RATE_LIMITED: 4429,
});
