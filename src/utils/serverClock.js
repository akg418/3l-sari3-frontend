/**
 * Tracks the offset between this browser's clock and the server's.
 *
 * Every API response and every socket frame carries `meta.serverTime`, so the
 * offset is corrected continuously. Countdowns are then rendered against
 * server time: a user whose laptop clock is ten minutes fast still sees the
 * true remaining lifetime, and the server always has the final say on expiry.
 */
let offsetMs = 0;
let synchronised = false;

export const syncWithServer = (serverTimeIso, { requestSentAt } = {}) => {
  const serverTime = Date.parse(serverTimeIso);
  if (Number.isNaN(serverTime)) return;

  const receivedAt = Date.now();
  // Assume a symmetric round trip and treat the server timestamp as taken at
  // its midpoint, which removes most of the network latency from the offset.
  const clientTime = requestSentAt ? (requestSentAt + receivedAt) / 2 : receivedAt;

  offsetMs = serverTime - clientTime;
  synchronised = true;
};

/** Current time in the server's frame of reference. */
export const serverNow = () => Date.now() + offsetMs;

export const msUntil = (isoDate) => Date.parse(isoDate) - serverNow();

export const getClockOffset = () => ({ offsetMs, synchronised });

/** Test seam. */
export const resetClock = () => {
  offsetMs = 0;
  synchronised = false;
};
