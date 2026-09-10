import { useEffect, useState } from 'react';

/**
 * Trails a value by a short delay.
 *
 * Used for the directory search box, so typing "general" issues one request
 * rather than seven. The input itself stays fully responsive - only the query
 * derived from it waits.
 */
export const useDebouncedValue = (value, delayMs = 300) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (value === debounced) return undefined;
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs, debounced]);

  return debounced;
};
