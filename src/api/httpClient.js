import { config } from '../config.js';
import { syncWithServer } from '../utils/serverClock.js';
import { ApiError } from './ApiError.js';

/**
 * Thin transport around fetch.
 *
 * It owns three cross-cutting concerns so no caller has to: attaching the
 * access token, unwrapping the API's response envelope into either data or an
 * ApiError, and keeping the client clock synced to the server's.
 */
class HttpClient {
  #getToken = () => null;
  #onUnauthorized = null;

  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  configure({ getToken, onUnauthorized }) {
    if (getToken) this.#getToken = getToken;
    if (onUnauthorized) this.#onUnauthorized = onUnauthorized;
  }

  /**
   * The Authorization header value, for the two transports that cannot use
   * `#request`: XHR (the only way to observe upload progress) and the
   * authorised blob fetches that back `<img>` tags.
   */
  authorizationHeader() {
    const token = this.#getToken();
    return token ? `Bearer ${token}` : null;
  }

  /** Turns an API-relative path from a payload into an absolute URL. */
  resolveUrl(path) {
    if (/^https?:/i.test(path)) return path;
    return new URL(path, this.baseUrl).origin + path;
  }

  notifyUnauthorized(error) {
    this.#onUnauthorized?.(error);
  }

  get(path, options) {
    return this.#request('GET', path, undefined, options);
  }

  post(path, body, options) {
    return this.#request('POST', path, body, options);
  }

  async #request(method, path, body, { auth = true, query } = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }

    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const token = auth ? this.#getToken() : null;
    if (token) headers.Authorization = `Bearer ${token}`;

    const sentAt = Date.now();
    let response;

    try {
      response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (cause) {
      throw ApiError.network(cause);
    }

    const payload = await response.json().catch(() => null);

    if (payload?.meta?.serverTime) {
      syncWithServer(payload.meta.serverTime, { requestSentAt: sentAt });
    }

    if (response.ok && payload?.success) return payload.data;

    const error = new ApiError({
      code: payload?.error?.code ?? 'INTERNAL_ERROR',
      message: payload?.error?.message,
      details: payload?.error?.details,
      status: response.status,
    });

    // A rejected token has to invalidate the session everywhere at once, not
    // just fail the call that happened to notice.
    if (response.status === 401) this.#onUnauthorized?.(error);

    throw error;
  }
}

export const httpClient = new HttpClient(config.apiUrl);
