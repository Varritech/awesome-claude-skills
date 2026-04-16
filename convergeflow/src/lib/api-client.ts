/**
 * Client-side API fetch wrapper.
 *
 * All helpers:
 *   - prepend `/api` if the caller passes a relative path without a scheme
 *   - send/parse JSON
 *   - throw `ApiError` on non-2xx responses
 *   - return the `data` property of the envelope (routes respond with
 *     `{ data, ... }` or `{ error, ... }`) so call sites can stay slim.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/')) return path;
  return `/api/${path}`;
}

async function parseResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const raw = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const message =
      (isJson && raw && typeof raw === 'object' && 'error' in raw
        ? String((raw as { error: unknown }).error)
        : null) ?? `Request failed with status ${res.status}`;
    const details =
      isJson && raw && typeof raw === 'object' && 'details' in raw
        ? (raw as { details: unknown }).details
        : undefined;
    throw new ApiError(message, res.status, details);
  }

  if (isJson && raw && typeof raw === 'object' && 'data' in raw) {
    return (raw as { data: T }).data;
  }
  return raw as T;
}

async function request<T>(
  method: Method,
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(resolveUrl(path), {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...init,
  });
  return parseResponse<T>(res);
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>('GET', path, undefined, init);
}

export async function apiPost<T, B = unknown>(
  path: string,
  body?: B,
  init?: RequestInit,
): Promise<T> {
  return request<T>('POST', path, body, init);
}

export async function apiPatch<T, B = unknown>(
  path: string,
  body?: B,
  init?: RequestInit,
): Promise<T> {
  return request<T>('PATCH', path, body, init);
}

export async function apiPut<T, B = unknown>(
  path: string,
  body?: B,
  init?: RequestInit,
): Promise<T> {
  return request<T>('PUT', path, body, init);
}

export async function apiDelete<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>('DELETE', path, undefined, init);
}

/**
 * Stream helper for endpoints that return SSE-style chunks
 * (`data: {"response": "...", "done": false}\n\n`).
 *
 * Returns an async generator of decoded JSON chunks. Completes when a
 * `{"done": true}` event is received.
 */
export async function* apiStream<T = { response?: string; done?: boolean; error?: string }>(
  path: string,
  body?: unknown,
): AsyncGenerator<T, void, unknown> {
  const res = await fetch(resolveUrl(path), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok || !res.body) {
    throw new ApiError(
      `Stream request failed with status ${res.status}`,
      res.status,
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let reading = true;

  while (reading) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 2);
      if (!frame.startsWith('data:')) continue;
      const payload = frame.slice(5).trim();
      try {
        const parsed = JSON.parse(payload) as { done?: boolean };
        yield parsed as T;
        if (parsed.done) {
          reading = false;
          break;
        }
      } catch {
        // ignore malformed frames
      }
    }
  }
}

export const apiClient = {
  get: apiGet,
  post: apiPost,
  patch: apiPatch,
  put: apiPut,
  delete: apiDelete,
  stream: apiStream,
};
