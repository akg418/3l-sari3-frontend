import { useCountdown } from '../../hooks/useCountdown.js';

const SEVERITY_CLASS = {
  normal: '',
  warning: 'countdown--warning',
  critical: 'countdown--critical',
};

/**
 * Remaining channel lifetime, counted against server time.
 *
 * Purely a display: the server decides when a channel is actually gone.
 */
export const Countdown = ({ expiresAt, size, suffix = 'remaining', showSuffix = true }) => {
  const { label, severity, isExpired } = useCountdown(expiresAt);

  const classes = ['countdown', SEVERITY_CLASS[severity], size === 'sm' ? 'countdown--sm' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} title={`Expires at ${new Date(expiresAt).toLocaleTimeString()}`}>
      <time dateTime={expiresAt}>{label}</time>
      {showSuffix && <span className="countdown__unit">{isExpired ? 'expired' : suffix}</span>}
    </span>
  );
};
