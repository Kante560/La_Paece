const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

/** Retries for transient failures — a cold database connection, a dropped link. */
const RETRIES = 2;
const BACKOFF_MS = 400;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isSafeToRetry(method: string): boolean {
  // GETs are free to repeat. PUT/PATCH/DELETE here are idempotent by design —
  // they set a value or remove a row rather than appending — so a retry can't
  // double-apply. POST can create, so it's left alone.
  return method !== "POST";
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || "GET").toUpperCase();
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, {
        ...init,
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json", ...(init.headers || {}) },
      });
    } catch (err) {
      // Network-level failure: the API restarting, wifi dropping.
      lastError = err;
      if (attempt < RETRIES && isSafeToRetry(method)) {
        await sleep(BACKOFF_MS * (attempt + 1));
        continue;
      }
      throw new ApiError(0, "Can't reach the server. Check your connection.");
    }

    /*
     * Only a real 401 means the session is gone. The API answers 5xx when the
     * database is briefly unreachable, so those must never bounce you to the
     * login screen — that was the "randomly logged out" behaviour.
     */
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/auth")) {
      if (window.location.pathname !== "/login") window.location.href = "/login";
      throw new ApiError(401, "Not authenticated");
    }

    if (res.status >= 500 && attempt < RETRIES && isSafeToRetry(method)) {
      await sleep(BACKOFF_MS * (attempt + 1));
      continue;
    }

    const body = res.status === 204 ? {} : await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        (body as { error?: string }).error ||
        (res.status >= 500 ? "The server is having trouble. Try again in a moment." : "Request failed");
      throw new ApiError(res.status, message, body as Record<string, unknown>);
    }
    return body as T;
  }

  throw new ApiError(0, lastError instanceof Error ? lastError.message : "Request failed");
}

export const get = <T>(p: string) => api<T>(p);
export const post = <T>(p: string, b?: unknown) =>
  api<T>(p, { method: "POST", body: JSON.stringify(b ?? {}) });
export const put = <T>(p: string, b?: unknown) =>
  api<T>(p, { method: "PUT", body: JSON.stringify(b ?? {}) });
export const patch = <T>(p: string, b?: unknown) =>
  api<T>(p, { method: "PATCH", body: JSON.stringify(b ?? {}) });
export const del = <T>(p: string) => api<T>(p, { method: "DELETE" });
