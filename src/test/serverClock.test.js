import { afterEach, describe, expect, it, vi } from 'vitest';
import { msUntil, resetClock, serverNow, syncWithServer, getClockOffset } from '../utils/serverClock.js';
import { formatDuration } from '../utils/format.js';

describe('Server clock', () => {
  afterEach(() => {
    resetClock();
    vi.useRealTimers();
  });

  it('starts unsynchronised and falls back to local time', () => {
    expect(getClockOffset().synchronised).toBe(false);
    expect(Math.abs(serverNow() - Date.now())).toBeLessThan(50);
  });

  it('adopts the server offset when the client clock is wrong', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));

    // The client is ten minutes behind the server.
    syncWithServer('2026-01-01T12:10:00.000Z');

    expect(getClockOffset().offsetMs).toBe(600_000);
    expect(new Date(serverNow()).toISOString()).toBe('2026-01-01T12:10:00.000Z');
  });

  it('measures remaining lifetime against server time, not the local clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));

    // A client running five minutes fast would otherwise think this channel
    // had already expired.
    syncWithServer('2026-01-01T11:55:00.000Z');

    expect(msUntil('2026-01-01T11:56:00.000Z')).toBe(60_000);
    expect(formatDuration(msUntil('2026-01-01T11:56:00.000Z'))).toBe('01:00');
  });

  it('ignores an unparseable timestamp', () => {
    syncWithServer('not a date');
    expect(getClockOffset().synchronised).toBe(false);
  });

  it('compensates for round-trip latency', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:01.000Z'));

    // Request left at T-1s, reply seen now: the server stamp belongs to the
    // midpoint, so the offset should come out as zero rather than -500ms.
    syncWithServer('2026-01-01T12:00:00.500Z', { requestSentAt: Date.now() - 1000 });

    expect(getClockOffset().offsetMs).toBe(0);
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '00:00'],
    [1000, '00:01'],
    [59_000, '00:59'],
    [60_000, '01:00'],
    [12 * 60_000 + 43_000, '12:43'],
    [59 * 60_000 + 32_000, '59:32'],
    [3_600_000, '1:00:00'],
  ])('renders %sms as %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });

  it('never renders a negative value', () => {
    expect(formatDuration(-5000)).toBe('00:00');
  });
});
