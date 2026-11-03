import { config } from "@/shared/lib/config";

const STORAGE_KEY = "token";

type Listener = () => void;

let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;
const logoutListeners = new Set<Listener>();

// With the httpOnly refresh cookie enabled the access token lives in memory
// only. Until the API ships that endpoint it is persisted like before.
export function getAccessToken() {
  if (accessToken === null && !config.cookieRefresh) {
    accessToken = localStorage.getItem(STORAGE_KEY);
  }
  return accessToken;
}

export function setAccessToken(token: string) {
  accessToken = token;
  if (!config.cookieRefresh) localStorage.setItem(STORAGE_KEY, token);
}

export function clearSession() {
  accessToken = null;
  localStorage.removeItem(STORAGE_KEY);
  logoutListeners.forEach((l) => l());
}

export function onSessionCleared(listener: Listener) {
  logoutListeners.add(listener);
  return () => {
    logoutListeners.delete(listener);
  };
}

export function refreshAccessToken(): Promise<string | null> {
  if (!config.cookieRefresh) return Promise.resolve(null);
  refreshInFlight ??= fetch(`${config.apiUrl}/api/v1/auth/refresh`, {
    method: "POST",
    credentials: "include",
  })
    .then(async (res) => {
      if (!res.ok) return null;
      const body = await res.json();
      const token: string | undefined = body?.data?.token?.access_token;
      if (!token) return null;
      setAccessToken(token);
      return token;
    })
    .catch(() => null)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

// fetch wrapper: attaches the bearer token and retries once after a 401 if a
// refresh succeeds; otherwise the session is cleared.
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const send = (token: string | null) => {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, {
      ...init,
      headers,
      credentials: config.cookieRefresh ? "include" : init.credentials,
    });
  };

  let res = await send(getAccessToken());
  if (res.status === 401) {
    const fresh = await refreshAccessToken();
    if (fresh) {
      res = await send(fresh);
    }
    if (res.status === 401) clearSession();
  }
  return res;
}
