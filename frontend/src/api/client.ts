import { storage } from "@/src/utils/storage";

export const TOKEN_KEY = "mm_session_token";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

export async function getToken(): Promise<string | null> {
  return storage.secureGet(TOKEN_KEY, null as string | null);
}

export async function setToken(token: string): Promise<void> {
  await storage.secureSet(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await storage.secureRemove(TOKEN_KEY);
}

type Options = {
  method?: "GET" | "POST" | "DELETE" | "PUT";
  body?: unknown;
  auth?: boolean;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const t = await getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = "Something went wrong";
    try {
      const j = await res.json();
      msg = j.detail || msg;
    } catch {
      // ignore
    }
    throw new ApiError(msg, res.status);
  }
  return res.json();
}
