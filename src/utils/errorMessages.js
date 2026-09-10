/**
 * Maps the API's stable error codes to copy a person can act on.
 *
 * Raw backend messages are never shown: they are written for developers, and
 * an unknown code must degrade to something reassuring rather than leaking
 * internals.
 */
const MESSAGES = {
  VALIDATION_ERROR: 'Please check the highlighted fields and try again.',
  BAD_REQUEST: 'That request could not be processed.',
  NOT_FOUND: 'We could not find what you were looking for.',
  RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again.',

  UNAUTHORIZED: 'Please sign in to continue.',
  INVALID_CREDENTIALS: 'Incorrect username or password.',
  TOKEN_EXPIRED: 'Your session has expired. Please sign in again.',
  TOKEN_INVALID: 'Your session is no longer valid. Please sign in again.',
  USERNAME_TAKEN: 'That username is already taken.',

  CHANNEL_NOT_FOUND: 'This channel no longer exists.',
  CHANNEL_NAME_TAKEN: 'A channel with this name already exists.',
  CHANNEL_EXPIRED: 'This channel has expired.',
  CHANNEL_PASSWORD_REQUIRED: 'This channel is private. Enter its password to join.',
  CHANNEL_PASSWORD_INVALID: 'Incorrect channel password.',
  CHANNEL_NOT_JOINED: 'Join this channel before taking part.',
  CHANNEL_OWNER_CANNOT_LEAVE:
    'You created this channel, so you cannot leave it. It disappears on its own when it expires.',
  CHANNEL_LIMIT_REACHED:
    'You have reached your limit of active channels. Wait for one to expire, or leave one, and try again.',

  MESSAGE_TYPE_UNSUPPORTED: 'That kind of message is not supported yet.',

  ATTACHMENT_NOT_FOUND: 'That attachment is no longer available.',
  ATTACHMENT_TOO_LARGE: 'That file is too large to send.',
  ATTACHMENT_TYPE_UNSUPPORTED:
    'That file type is not supported. Images, PDFs, office documents, archives and plain text can be sent.',
  ATTACHMENT_CONTENT_MISMATCH: 'That file does not look like the type it claims to be.',
  ATTACHMENT_LIMIT_REACHED: 'That is more attachments than one message can carry.',
  ATTACHMENT_ALREADY_USED: 'That attachment has already been sent.',
  UPLOAD_FAILED: 'The upload did not complete. Please try again.',
  UPLOAD_CANCELLED: 'Upload cancelled.',

  NETWORK_ERROR: 'Cannot reach the server. Check your connection and try again.',
  WS_NOT_AUTHENTICATED: 'Your live connection dropped. Reconnecting.',
};

const FALLBACK = 'Something went wrong. Please try again.';

export const messageForError = (error) => MESSAGES[error?.code] ?? FALLBACK;

/** Turns the API's `details` array into a `{ field: message }` map for forms. */
export const fieldErrorsFromError = (error) => {
  if (!Array.isArray(error?.details)) return {};

  return error.details.reduce((accumulator, detail) => {
    if (detail?.field && !accumulator[detail.field]) accumulator[detail.field] = detail.message;
    return accumulator;
  }, {});
};

export const isAuthError = (error) =>
  ['UNAUTHORIZED', 'TOKEN_EXPIRED', 'TOKEN_INVALID'].includes(error?.code);
