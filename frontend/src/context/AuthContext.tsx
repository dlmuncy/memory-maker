import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

import { api, setToken, clearToken, getToken, ApiError } from "@/src/api/client";

export type AppUser = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
};

type AuthState = {
  user: AppUser | null;
  loading: boolean;
  requestOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFromToken = useCallback(async () => {
    const t = await getToken();
    if (!t) return;
    try {
      const me = await api<AppUser>("/auth/me");
      setUser(me);
    } catch {
      await clearToken();
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadFromToken();
      setLoading(false);
    })();
  }, [loadFromToken]);

  const requestOtp = useCallback(async (email: string) => {
    await api("/auth/request-otp", { method: "POST", auth: false, body: { email } });
  }, []);

  const verifyOtp = useCallback(async (email: string, code: string) => {
    const data = await api<{ session_token: string; user: AppUser }>("/auth/verify-otp", {
      method: "POST",
      auth: false,
      body: { email, code },
    });
    await setToken(data.session_token);
    setUser(data.user);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    await clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, requestOtp, verifyOtp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export { ApiError };
