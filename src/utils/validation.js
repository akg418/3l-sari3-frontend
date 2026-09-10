/**
 * Client-side mirror of the backend's validation rules.
 *
 * This exists purely so the user gets immediate feedback while typing. The
 * server re-validates everything and is the only authority - see
 * backend/src/validators/rules.js, which these patterns intentionally match.
 */
export const RULES = Object.freeze({
  USERNAME: /^[A-Za-z_][A-Za-z0-9_.-]{2,23}$/,
  CHANNEL_NAME: /^[A-Za-z_][A-Za-z0-9_.-]{0,19}$/,
});

export const LIMITS = Object.freeze({
  USERNAME_MAX: 24,
  PASSWORD_MIN: 8,
  CHANNEL_NAME_MAX: 20,
  CHANNEL_PASSWORD_MIN: 8,
  CHANNEL_PASSWORD_MAX: 20,
  DURATION_MIN: 1,
  DURATION_MAX: 60,
  MESSAGE_MAX: 2000,
});

const required = (value, label) => (value?.trim() ? null : `${label} is required.`);

export const validateUsername = (value) => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return 'Username is required.';
  if (trimmed.length < 3) return 'Username must be at least 3 characters.';
  if (trimmed.length > LIMITS.USERNAME_MAX) return `Username must be at most ${LIMITS.USERNAME_MAX} characters.`;
  if (/\s/.test(trimmed)) return 'Username cannot contain spaces.';
  if (/^[0-9]/.test(trimmed)) return 'Username cannot start with a number.';
  if (!RULES.USERNAME.test(trimmed)) return 'Use only letters, numbers, and "_", "." or "-".';
  return null;
};

export const validatePassword = (value) => {
  if (!value) return 'Password is required.';
  if (value.length < LIMITS.PASSWORD_MIN) return `Password must be at least ${LIMITS.PASSWORD_MIN} characters.`;
  return null;
};

export const validateRegistration = (values) => ({
  firstName: required(values.firstName, 'First name'),
  lastName: required(values.lastName, 'Last name'),
  username: validateUsername(values.username),
  password: validatePassword(values.password),
});

export const validateLogin = (values) => ({
  username: required(values.username, 'Username'),
  password: values.password ? null : 'Password is required.',
});

export const validateChannelName = (value) => {
  const trimmed = value?.trim() ?? '';
  // An empty name is valid: the server generates one.
  if (!trimmed) return null;
  if (/\s/.test(trimmed)) return 'Channel name cannot contain spaces.';
  if (/^[0-9]/.test(trimmed)) return 'Channel name cannot start with a number.';
  if (trimmed.length > LIMITS.CHANNEL_NAME_MAX)
    return `Channel name must be at most ${LIMITS.CHANNEL_NAME_MAX} characters.`;
  if (!RULES.CHANNEL_NAME.test(trimmed)) return 'Use only letters, numbers, and "_", "." or "-".';
  return null;
};

export const validateChannelPassword = (value, { isPrivate }) => {
  if (!isPrivate) return null;
  if (!value) return 'A private channel needs a password.';
  if (value.length < LIMITS.CHANNEL_PASSWORD_MIN)
    return `Password must be at least ${LIMITS.CHANNEL_PASSWORD_MIN} characters.`;
  if (value.length > LIMITS.CHANNEL_PASSWORD_MAX)
    return `Password must be at most ${LIMITS.CHANNEL_PASSWORD_MAX} characters.`;
  return null;
};

export const validateDuration = (value) => {
  const minutes = Number(value);
  if (!Number.isInteger(minutes)) return 'Choose a whole number of minutes.';
  if (minutes < LIMITS.DURATION_MIN) return 'A channel must live for at least 1 minute.';
  if (minutes > LIMITS.DURATION_MAX) return `A channel cannot live longer than ${LIMITS.DURATION_MAX} minutes.`;
  return null;
};

export const validateChannelForm = (values) => ({
  name: validateChannelName(values.name),
  password: validateChannelPassword(values.password, { isPrivate: values.type === 'private' }),
  durationMinutes: validateDuration(values.durationMinutes),
});

/** Drops the null entries so callers can just check `Object.keys(...).length`. */
export const compactErrors = (errors) =>
  Object.fromEntries(Object.entries(errors).filter(([, message]) => Boolean(message)));
