import { config } from "@/shared/lib/config";
import { authFetch } from "@/shared/api/session";

export interface User {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResult {
  _id: string;
  name: string;
  email: string;
  token: { access_token: string; expires_at: number };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await authFetch(`${config.apiUrl}${path}`, init);
  } catch (err) {
    throw new ApiError(err instanceof Error ? err.message : "Network error");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const errors: unknown = body?.errors;
    throw new ApiError(
      Array.isArray(errors) ? errors.join(", ") : `Request failed (${res.status})`,
      res.status,
    );
  }
  return body.data as T;
}

const json = (payload: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

export const authApi = {
  me: () => request<User>("/api/v1/auth/me", { method: "GET" }),
  login: (email: string, password: string) =>
    request<AuthResult>("/api/v1/auth/login", json({ email, password })),
  signup: (name: string, email: string, password: string) =>
    request<AuthResult>("/api/v1/auth/signup", json({ name, email, password })),
};
