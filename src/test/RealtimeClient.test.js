import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeClient } from '../websocket/RealtimeClient.js';
import { CONNECTION_STATUS, SERVER_EVENTS } from '../websocket/events.js';
import { MockWebSocket } from './MockWebSocket.js';

/**
 * The reconnection contract is the riskiest part of the client, so it is
 * driven here frame by frame: no duplicate sockets, re-authentication on every
 * new socket, and the open channel resubscribed afterwards.
 */
describe('RealtimeClient', () => {
  let client;

  beforeEach(() => {
    MockWebSocket.reset();
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.useFakeTimers();

    client = new RealtimeClient({ url: 'ws://test/ws' });
    client.configure({ getToken: () => 'a-valid-token' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** Brings the client to READY: open the socket and confirm its auth frame. */
  const reachReady = async (socket = MockWebSocket.last) => {
    socket.open();
    await vi.advanceTimersByTimeAsync(0);
    socket.reply(SERVER_EVENTS.AUTHENTICATED, { user: { id: 'u1' } }, socket.requestIdFor('auth:authenticate'));
    await vi.advanceTimersByTimeAsync(0);
  };

  it('authenticates as its first frame, before anything else', async () => {
    client.connect();
    MockWebSocket.last.open();
    await vi.advanceTimersByTimeAsync(0);

    expect(MockWebSocket.last.sent[0]).toMatchObject({
      event: 'auth:authenticate',
      data: { token: 'a-valid-token' },
    });
    expect(client.status).toBe(CONNECTION_STATUS.AUTHENTICATING);
  });

  it('becomes ready once the server confirms the token', async () => {
    client.connect();
    await reachReady();

    expect(client.status).toBe(CONNECTION_STATUS.READY);
    expect(client.isReady).toBe(true);
  });

  it('never opens a second socket while one is alive', async () => {
    client.connect();
    client.connect();
    await reachReady();
    client.connect();

    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('does not connect without a token', () => {
    const anonymous = new RealtimeClient({ url: 'ws://test/ws' });
    anonymous.connect();

    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('resolves a request with the reply that carries its requestId', async () => {
    client.connect();
    await reachReady();

    const pending = client.joinChannel('channel-1');
    const requestId = MockWebSocket.last.requestIdFor('channel:join');
    MockWebSocket.last.reply(SERVER_EVENTS.CHANNEL_JOINED, { channel: { id: 'channel-1' } }, requestId);

    await expect(pending).resolves.toMatchObject({ channel: { id: 'channel-1' } });
  });

  it('rejects a request with the structured error the server returned', async () => {
    client.connect();
    await reachReady();

    const pending = client.joinChannel('channel-1', { password: 'wrong-password' });
    const requestId = MockWebSocket.last.requestIdFor('channel:join');
    MockWebSocket.last.reply(
      SERVER_EVENTS.ERROR,
      { code: 'CHANNEL_PASSWORD_INVALID', message: 'Incorrect channel password.' },
      requestId,
    );

    await expect(pending).rejects.toMatchObject({ code: 'CHANNEL_PASSWORD_INVALID' });
  });

  it('does not deliver a correlated reply to broadcast listeners', async () => {
    client.connect();
    await reachReady();

    const listener = vi.fn();
    client.on(SERVER_EVENTS.CHANNEL_JOINED, listener);

    const pending = client.joinChannel('channel-1');
    MockWebSocket.last.reply(
      SERVER_EVENTS.CHANNEL_JOINED,
      { channel: { id: 'channel-1' } },
      MockWebSocket.last.requestIdFor('channel:join'),
    );
    await pending;

    expect(listener).not.toHaveBeenCalled();
  });

  it('delivers an uncorrelated frame to its listeners', async () => {
    client.connect();
    await reachReady();

    const listener = vi.fn();
    client.on(SERVER_EVENTS.MESSAGE_NEW, listener);

    MockWebSocket.last.reply(SERVER_EVENTS.MESSAGE_NEW, { message: { id: 'm1' } });

    expect(listener).toHaveBeenCalledWith({ message: { id: 'm1' } });
  });

  describe('after an unexpected disconnect', () => {
    const joinChannel = async (channelId) => {
      const pending = client.joinChannel(channelId);
      MockWebSocket.last.reply(
        SERVER_EVENTS.CHANNEL_JOINED,
        { channel: { id: channelId }, messages: [] },
        MockWebSocket.last.requestIdFor('channel:join'),
      );
      await pending;
    };

    it('reconnects and re-authenticates on the new socket', async () => {
      client.connect();
      await reachReady();

      MockWebSocket.last.serverClose(1006);
      expect(client.status).toBe(CONNECTION_STATUS.RECONNECTING);

      await vi.advanceTimersByTimeAsync(1000);
      expect(MockWebSocket.instances).toHaveLength(2);

      await reachReady();
      expect(client.status).toBe(CONNECTION_STATUS.READY);
      expect(MockWebSocket.last.sent[0].event).toBe('auth:authenticate');
    });

    it('replays the channels it was subscribed to', async () => {
      client.connect();
      await reachReady();
      await joinChannel('channel-1');

      MockWebSocket.last.serverClose(1006);
      await vi.advanceTimersByTimeAsync(1000);
      await reachReady();

      const replayed = MockWebSocket.last.sent.filter((frame) => frame.event === 'channel:join');
      expect(replayed).toHaveLength(1);
      expect(replayed[0].data).toEqual({ channelId: 'channel-1' });
    });

    it('does not resend the password when replaying a private channel', async () => {
      client.connect();
      await reachReady();

      const pending = client.joinChannel('private-1', { password: 'sup3r-channel-pw' });
      MockWebSocket.last.reply(
        SERVER_EVENTS.CHANNEL_JOINED,
        { channel: { id: 'private-1' } },
        MockWebSocket.last.requestIdFor('channel:join'),
      );
      await pending;

      MockWebSocket.last.serverClose(1006);
      await vi.advanceTimersByTimeAsync(1000);
      await reachReady();

      // Membership already exists server-side, so the secret is not kept
      // around or sent again.
      const replayed = MockWebSocket.last.sent.find((frame) => frame.event === 'channel:join');
      expect(replayed.data.password).toBeUndefined();
    });

    it('forgets a channel that expired while it was offline', async () => {
      client.connect();
      await reachReady();
      await joinChannel('channel-1');

      client.forgetChannel('channel-1');

      MockWebSocket.last.serverClose(1006);
      await vi.advanceTimersByTimeAsync(1000);
      await reachReady();

      expect(MockWebSocket.last.sent.some((frame) => frame.event === 'channel:join')).toBe(false);
    });

    it('backs off further with each failed attempt', async () => {
      client.connect();
      await reachReady();

      MockWebSocket.last.serverClose(1006);
      await vi.advanceTimersByTimeAsync(1000);
      expect(MockWebSocket.instances).toHaveLength(2);

      // A socket that dies before opening must not retry instantly.
      MockWebSocket.last.serverClose(1006);
      await vi.advanceTimersByTimeAsync(200);
      expect(MockWebSocket.instances).toHaveLength(2);

      await vi.advanceTimersByTimeAsync(1000);
      expect(MockWebSocket.instances).toHaveLength(3);
    });

    it('rejects in-flight requests instead of leaving them hanging', async () => {
      client.connect();
      await reachReady();

      const pending = client.joinChannel('channel-1');
      MockWebSocket.last.serverClose(1006);

      await expect(pending).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
      await vi.advanceTimersByTimeAsync(1000);
    });

    it('gives up when the server rejects the token', async () => {
      client.connect();
      await reachReady();

      const errors = [];
      client.on(SERVER_EVENTS.ERROR, (error) => errors.push(error));

      MockWebSocket.last.serverClose(4401);
      await vi.advanceTimersByTimeAsync(30_000);

      expect(MockWebSocket.instances).toHaveLength(1);
      expect(client.status).toBe(CONNECTION_STATUS.OFFLINE);
      expect(errors[0].code).toBe('TOKEN_INVALID');
    });
  });

  it('stays down after an intentional disconnect', async () => {
    client.connect();
    await reachReady();

    client.disconnect();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(client.status).toBe(CONNECTION_STATUS.IDLE);
  });

  it('recycles a socket that stops answering pings', async () => {
    client.connect();
    await reachReady();
    const socket = MockWebSocket.last;

    await vi.advanceTimersByTimeAsync(25_000);
    expect(socket.sent.some((frame) => frame.event === 'ping')).toBe(true);

    // No pong: the connection is dead even though the socket still looks open.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(socket.readyState).toBe(MockWebSocket.CLOSED);
  });

  it('keeps a socket alive when pings are answered', async () => {
    client.connect();
    await reachReady();
    const socket = MockWebSocket.last;

    await vi.advanceTimersByTimeAsync(25_000);
    socket.reply(SERVER_EVENTS.PONG, null);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(socket.readyState).toBe(MockWebSocket.OPEN);
  });
});
