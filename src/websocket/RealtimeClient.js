import { config } from '../config.js';
import { syncWithServer } from '../utils/serverClock.js';
import { CLIENT_EVENTS, CLOSE_CODES, CONNECTION_STATUS, LOCAL_EVENTS, SERVER_EVENTS } from './events.js';

const RECONNECT_BASE_DELAY_MS = 500;
const RECONNECT_MAX_DELAY_MS = 15_000;
const REQUEST_TIMEOUT_MS = 10_000;
const PING_INTERVAL_MS = 25_000;
const PONG_GRACE_MS = 10_000;

let requestCounter = 0;
const nextRequestId = () => {
  requestCounter += 1;
  return `r${Date.now().toString(36)}-${requestCounter}`;
};

/**
 * Resilient WebSocket client.
 *
 * A socket is never assumed to be permanent. The client tracks the
 * subscriptions the application *wants* and, after every reconnect,
 * re-authenticates and replays them - so a dropped connection recovers by
 * itself, without duplicating sockets or losing the open channel.
 */
export class RealtimeClient {
  #socket = null;
  #status = CONNECTION_STATUS.IDLE;
  #listeners = new Map();
  #pending = new Map();
  /** Channels the app wants to be subscribed to: replayed after a reconnect. */
  #desiredChannels = new Map();
  #reconnectAttempts = 0;
  #reconnectTimer = null;
  #pingTimer = null;
  #pongTimer = null;
  #getToken = () => null;
  #intentionallyClosed = false;

  constructor({ url = config.wsUrl } = {}) {
    this.url = url;
  }

  configure({ getToken }) {
    if (getToken) this.#getToken = getToken;
  }

  get status() {
    return this.#status;
  }

  get isReady() {
    return this.#status === CONNECTION_STATUS.READY;
  }

  // ---------------------------------------------------------------- events

  on(event, listener) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event).add(listener);
    return () => this.off(event, listener);
  }

  off(event, listener) {
    this.#listeners.get(event)?.delete(listener);
  }

  #emit(event, payload) {
    for (const listener of this.#listeners.get(event) ?? []) {
      try {
        listener(payload);
      } catch (error) {
        console.error(`Realtime listener for "${event}" failed`, error);
      }
    }
  }

  #setStatus(status) {
    if (this.#status === status) return;
    this.#status = status;
    this.#emit(LOCAL_EVENTS.STATUS, status);
  }

  // ------------------------------------------------------------ lifecycle

  connect() {
    // Guard against a second socket: React effects and reconnect timers can
    // both ask to connect, and two sockets would double every event.
    if (this.#socket && this.#socket.readyState <= WebSocket.OPEN) return;
    if (!this.#getToken()) return;

    this.#intentionallyClosed = false;
    this.#clearTimer('reconnect');
    this.#setStatus(
      this.#reconnectAttempts === 0 ? CONNECTION_STATUS.CONNECTING : CONNECTION_STATUS.RECONNECTING,
    );

    const socket = new WebSocket(this.url);
    this.#socket = socket;

    socket.onopen = () => {
      this.#setStatus(CONNECTION_STATUS.AUTHENTICATING);
      this.#authenticate();
    };

    socket.onmessage = (event) => this.#handleFrame(event.data);

    socket.onclose = (event) => {
      this.#teardownSocket();
      this.#rejectAllPending({ code: 'NETWORK_ERROR', message: 'The live connection closed.' });

      if (this.#intentionallyClosed) {
        this.#setStatus(CONNECTION_STATUS.IDLE);
        return;
      }

      // A rejected token will be rejected again: stop and let the app decide
      // (it will sign the user out and, on a fresh token, reconnect).
      if (event.code === CLOSE_CODES.AUTH_REQUIRED) {
        this.#setStatus(CONNECTION_STATUS.OFFLINE);
        this.#emit(SERVER_EVENTS.ERROR, { code: 'TOKEN_INVALID', message: 'Session rejected.' });
        return;
      }

      this.#scheduleReconnect();
    };

    socket.onerror = () => {
      // `onclose` always follows, and owns the reconnect decision.
    };
  }

  disconnect() {
    this.#intentionallyClosed = true;
    this.#clearTimer('reconnect');
    this.#desiredChannels.clear();
    this.#rejectAllPending({ code: 'NETWORK_ERROR', message: 'Disconnected.' });

    if (this.#socket && this.#socket.readyState <= WebSocket.OPEN) this.#socket.close(1000, 'Client disconnect');
    this.#teardownSocket();
    this.#setStatus(CONNECTION_STATUS.IDLE);
  }

  #teardownSocket() {
    this.#clearTimer('ping');
    this.#clearTimer('pong');

    if (this.#socket) {
      this.#socket.onopen = null;
      this.#socket.onmessage = null;
      this.#socket.onclose = null;
      this.#socket.onerror = null;
    }
    this.#socket = null;
  }

  /** Exponential backoff with jitter, so many clients do not return in lockstep. */
  #scheduleReconnect() {
    this.#setStatus(CONNECTION_STATUS.RECONNECTING);
    this.#reconnectAttempts += 1;

    const backoff = Math.min(
      RECONNECT_BASE_DELAY_MS * 2 ** (this.#reconnectAttempts - 1),
      RECONNECT_MAX_DELAY_MS,
    );
    const delay = backoff / 2 + Math.random() * (backoff / 2);

    this.#reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  async #authenticate() {
    const token = this.#getToken();
    if (!token) {
      this.disconnect();
      return;
    }

    try {
      await this.request(CLIENT_EVENTS.AUTHENTICATE, { token }, SERVER_EVENTS.AUTHENTICATED);

      this.#reconnectAttempts = 0;
      this.#setStatus(CONNECTION_STATUS.READY);
      this.#startPinging();
      await this.#replaySubscriptions();
    } catch (error) {
      this.#emit(SERVER_EVENTS.ERROR, error);
      // The socket is unusable; closing it hands control to the backoff logic.
      this.#socket?.close();
    }
  }

  /**
   * Re-joins every channel the application still wants after a reconnect.
   * Membership already exists server-side, so private channels do not need
   * their password again.
   */
  async #replaySubscriptions() {
    const channels = [...this.#desiredChannels.entries()];

    for (const [channelId, options] of channels) {
      try {
        const payload = await this.request(
          CLIENT_EVENTS.CHANNEL_JOIN,
          { channelId, ...(options.password ? { password: options.password } : {}) },
          SERVER_EVENTS.CHANNEL_JOINED,
        );
        this.#emit('local:resubscribed', payload);
      } catch (error) {
        this.#desiredChannels.delete(channelId);
        this.#emit('local:resubscribe_failed', { channelId, error });
      }
    }
  }

  // ------------------------------------------------------------- messaging

  #handleFrame(raw) {
    let frame;
    try {
      frame = JSON.parse(raw);
    } catch {
      console.warn('Discarded malformed frame from server');
      return;
    }

    if (frame.meta?.serverTime) syncWithServer(frame.meta.serverTime);

    if (frame.event === SERVER_EVENTS.PONG) this.#clearTimer('pong');

    // A frame carrying a requestId is the reply to one specific call: settle
    // that promise and stop. Re-emitting it as a broadcast would make callers
    // and global listeners both handle the same outcome.
    const pending = frame.requestId ? this.#pending.get(frame.requestId) : null;

    if (pending) {
      this.#pending.delete(frame.requestId);
      clearTimeout(pending.timer);

      if (frame.event === SERVER_EVENTS.ERROR) pending.reject(frame.data);
      else pending.resolve(frame.data);
      return;
    }

    this.#emit(frame.event, frame.data);
  }

  #send(event, data, requestId) {
    if (this.#socket?.readyState !== WebSocket.OPEN) return false;
    this.#socket.send(JSON.stringify({ event, data, ...(requestId ? { requestId } : {}) }));
    return true;
  }

  /** Fire-and-forget emit. */
  emit(event, data) {
    return this.#send(event, data);
  }

  /**
   * Correlated request: resolves with the server's reply to this exact frame,
   * or rejects with the API's structured error.
   */
  request(event, data, expectedEvent, { timeout = REQUEST_TIMEOUT_MS } = {}) {
    return new Promise((resolve, reject) => {
      const requestId = nextRequestId();

      if (!this.#send(event, data, requestId)) {
        reject({ code: 'NETWORK_ERROR', message: 'The live connection is not available.' });
        return;
      }

      const timer = setTimeout(() => {
        this.#pending.delete(requestId);
        reject({ code: 'NETWORK_ERROR', message: 'The server did not respond in time.' });
      }, timeout);

      this.#pending.set(requestId, { resolve, reject, timer, expectedEvent });
    });
  }

  #rejectAllPending(error) {
    for (const [, pending] of this.#pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.#pending.clear();
  }

  // --------------------------------------------------------- subscriptions

  async joinChannel(channelId, { password } = {}) {
    const result = await this.request(
      CLIENT_EVENTS.CHANNEL_JOIN,
      { channelId, ...(password ? { password } : {}) },
      SERVER_EVENTS.CHANNEL_JOINED,
    );

    // Remembered without the password: after a reconnect the user is already a
    // member, so replaying the join does not need the secret again.
    this.#desiredChannels.set(channelId, {});
    return result;
  }

  async leaveChannel(channelId) {
    this.#desiredChannels.delete(channelId);
    return this.request(CLIENT_EVENTS.CHANNEL_LEAVE, { channelId }, SERVER_EVENTS.CHANNEL_LEFT);
  }

  /** Forgets a channel without telling the server - used when one expires. */
  forgetChannel(channelId) {
    this.#desiredChannels.delete(channelId);
  }

  /**
   * Tells the server this channel is being looked at. Fire-and-forget: the
   * badge is a convenience, and a lost acknowledgement corrects itself on the
   * next join or refresh.
   */
  markRead(channelId) {
    return this.emit(CLIENT_EVENTS.CHANNEL_READ, { channelId });
  }

  sendMessage({ channelId, content, clientMessageId, attachmentIds = [] }) {
    return this.request(
      CLIENT_EVENTS.MESSAGE_SEND,
      {
        channelId,
        // Omitted rather than sent empty, so an attachment-only message passes
        // the server's "text or attachment" rule.
        ...(content ? { content } : {}),
        ...(attachmentIds.length > 0 ? { attachmentIds } : {}),
        clientMessageId,
      },
      SERVER_EVENTS.MESSAGE_ACK,
    );
  }

  // ------------------------------------------------------------- heartbeat

  /**
   * Browsers cannot send protocol-level pings, so the client sends an
   * application ping. A missing reply means the connection is silently dead -
   * common after a laptop sleeps - and the socket is recycled.
   */
  #startPinging() {
    this.#clearTimer('ping');

    this.#pingTimer = setInterval(() => {
      if (this.#socket?.readyState !== WebSocket.OPEN) return;

      this.emit(CLIENT_EVENTS.PING, {});
      this.#clearTimer('pong');
      this.#pongTimer = setTimeout(() => {
        console.warn('No pong received; recycling the socket');
        this.#socket?.close();
      }, PONG_GRACE_MS);
    }, PING_INTERVAL_MS);
  }

  #clearTimer(name) {
    if (name === 'reconnect' && this.#reconnectTimer) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }
    if (name === 'ping' && this.#pingTimer) {
      clearInterval(this.#pingTimer);
      this.#pingTimer = null;
    }
    if (name === 'pong' && this.#pongTimer) {
      clearTimeout(this.#pongTimer);
      this.#pongTimer = null;
    }
  }
}

/** One connection per tab. */
export const realtimeClient = new RealtimeClient();
