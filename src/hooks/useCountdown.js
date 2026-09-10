import { useEffect, useState } from 'react';
import { msUntil } from '../utils/serverClock.js';
import { formatDuration } from '../utils/format.js';

const TICK_MS = 1000;

export const SEVERITY = Object.freeze({
  NORMAL: 'normal',
  WARNING: 'warning',
  CRITICAL: 'critical',
});

const severityFor = (remainingMs) => {
  if (remainingMs <= 60_000) return SEVERITY.CRITICAL;
  if (remainingMs <= 5 * 60_000) return SEVERITY.WARNING;
  return SEVERITY.NORMAL;
};

/**
 * A smooth, once-a-second countdown measured against *server* time.
 *
 * `isExpired` here only drives presentation - the label stops at 00:00 and the
 * card dims. Whether a channel is actually gone is decided by the server and
 * arrives as a `channel:expired` event; this hook never deletes anything.
 */
export const useCountdown = (expiresAt) => {
  const [remainingMs, setRemainingMs] = useState(() => (expiresAt ? msUntil(expiresAt) : 0));

  useEffect(() => {
    if (!expiresAt) return undefined;

    setRemainingMs(msUntil(expiresAt));
    const interval = setInterval(() => setRemainingMs(msUntil(expiresAt)), TICK_MS);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const clamped = Math.max(0, remainingMs);

  return {
    remainingMs: clamped,
    totalSeconds: Math.floor(clamped / 1000),
    label: formatDuration(clamped),
    isExpired: remainingMs <= 0,
    severity: severityFor(clamped),
  };
};
