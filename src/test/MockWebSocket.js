/**
 * Minimal WebSocket stand-in.
 *
 * Enough to drive RealtimeClient deterministically: tests open, reply to and
 * kill sockets by hand, with no timers or network involved.
 */
export class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  static instances = [];

  static reset() {
    MockWebSocket.instances = [];
  }

  static get last() {
    return MockWebSocket.instances.at(-1);
  }

  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.sent = [];
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    MockWebSocket.instances.push(this);
  }

  send(raw) {
    this.sent.push(JSON.parse(raw));
  }

  close(code = 1000, reason = '') {
    if (this.readyState === MockWebSocket.CLOSED) return;
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason });
  }

  // ---- test controls

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({});
  }

  /** Pushes a server frame, echoing the requestId of the nth frame sent. */
  reply(event, data, requestId) {
    this.onmessage?.({
      data: JSON.stringify({
        event,
        data,
        ...(requestId ? { requestId } : {}),
        meta: { serverTime: new Date().toISOString() },
      }),
    });
  }

  /** The requestId of the last frame the client sent for `event`. */
  requestIdFor(event) {
    return this.sent.filter((frame) => frame.event === event).at(-1)?.requestId;
  }

  serverClose(code) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason: 'closed by server' });
  }
}
