/** mm:ss, or h:mm:ss once the remaining time passes an hour. */
export const formatDuration = (totalMs) => {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value) => String(value).padStart(2, '0');

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
};

export const formatTime = (isoDate) =>
  new Date(isoDate).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export const formatDateHeading = (isoDate) => {
  const date = new Date(isoDate);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) return 'Today';

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const isSameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

export const initialsOf = (name = '') =>
  name
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('') || '?';

export const pluralize = (count, singular, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

/** Human-readable file size, e.g. "1.4 MB". */
export const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unitIndex]}`;
};
