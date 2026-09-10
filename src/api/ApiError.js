/** A structured failure from the API, carrying the backend's stable code. */
export class ApiError extends Error {
  constructor({ code, message, details, status }) {
    super(message ?? code);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.status = status;
  }

  static network(cause) {
    return new ApiError({
      code: 'NETWORK_ERROR',
      message: 'Unable to reach the server.',
      status: 0,
      details: cause?.message,
    });
  }
}
