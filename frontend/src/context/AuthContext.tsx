import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

import { api, setToken, clearToken, getToken } from "@/src/api/client";

WebBrowser.maybeCompleteAuthSession();

export type AppUser = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
};

type AuthState = {
  user: AppUser | null;
  loading: boolean;
  signingIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({} as AuthState);

const AUTH_URL = "https://auth.emergentagent.com/";

function extractSessionId(url: string | null): string | null {
  if (!url) return null;
  // supports both #session_id=... and ?session_id=...
  const hashMatch = url.match(/[#&]session_id=([^&]+)/);
  if (hashMatch) return decodeURIComponent(hashMatch[1]);
  const queryMatch = url.match(/[?&]session_id=([^&]+)/);
  if (queryMatch) return decodeURIComponent(queryMatch[1]);
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  const processSessionId = useCallback(async (sessionId: string) => {
    const data = await api<{ session_token: string; user: AppUser }>("/auth/session", {
      method: "POST",
      auth: false,
      body: { session_id: sessionId },
    });
    await setToken(data.session_token);
    setUser(data.user);
  }, []);

  const loadFromToken = useCallback(async () => {
    const t = await getToken();
    if (!t) return false;
    try {
      const me = await api<AppUser>("/auth/me");
      setUser(me);
      return true;
    } catch {
      await clearToken();
      return false;
    }
  }, []);

  // Bootstrap
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === "web") {
          const sid = extractSessionId(typeof window !== "undefined" ? window.location.href : null);
          if (sid) {
            await processSessionId(sid);
            if (typeof window !== "undefined") {
              window.history.replaceState(null, "", window.location.pathname);
            }
            return;
          }
        } else {
          const initial = await Linking.getInitialURL();
          const sid = extractSessionId(initial);
          if (sid) {
            await processSessionId(sid);
            return;
          }
        }
        await loadFromToken();
      } catch (e) {
        // fall through to unauthenticated
      } finally {
        setLoading(false);
      }
    })();
  }, [processSessionId, loadFromToken]);

  const signIn = useCallback(async () => {
    setSigningIn(true);
    try {
      if (Platform.OS === "web") {
        const redirectUrl = window.location.origin + "/";
        window.location.href = `${AUTH_URL}?redirect=${encodeURIComponent(redirectUrl)}`;
        return;
      }
      const redirectUrl = Linking.createURL("");
      const authUrl = `${AUTH_URL}?redirect=${encodeURIComponent(redirectUrl)}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === "success" && result.url) {
        const sid = extractSessionId(result.url);
        if (sid) {
          await processSessionId(sid);
        }
      }
    } finally {
      setSigningIn(false);
    }
  }, [processSessionId]);

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
    <AuthContext.Provider value={{ user, loading, signingIn, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
