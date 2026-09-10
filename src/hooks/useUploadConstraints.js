import { useEffect, useState } from 'react';
import { channelsApi } from '../api/channels.api.js';

/**
 * The server's upload rules, fetched once per session.
 *
 * These drive the file picker's filter and the "too large" message shown
 * before a byte is sent. They are a convenience only - the server applies the
 * same rules again, and its answer is the one that counts.
 */
const FALLBACK = {
  maxImageBytes: 5 * 1024 * 1024,
  maxFileBytes: 10 * 1024 * 1024,
  maxPerMessage: 5,
  allowedMimeTypes: [],
  imageMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
};

let cached = null;

export const useUploadConstraints = () => {
  const [constraints, setConstraints] = useState(cached ?? FALLBACK);

  useEffect(() => {
    if (cached) return undefined;
    let cancelled = false;

    channelsApi
      .uploadConstraints()
      .then(({ upload }) => {
        cached = upload;
        if (!cancelled) setConstraints(upload);
      })
      .catch(() => {
        // Keep the defaults; the server still enforces the real limits.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return constraints;
};
