"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/lib/supabase";

const AuthContext = createContext<{ session: Session | null; loading: boolean }>({ session: null, loading: true });
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null), [loading, setLoading] = useState(true);
  useEffect(() => {
    const applySession = (next: Session | null) => {
      setSession(next);
      setLoading(false);
      Sentry.setUser(next?.user?.id ? { id: next.user.id } : null);
    };
    supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => applySession(next));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handleUrl = async (url?: string) => {
      if (!url?.startsWith("app.repmate.mobile://login-callback")) return;
      const callback = new URL(url);
      const code = callback.searchParams.get("code");
      const callbackError = callback.searchParams.get("error_description") || callback.searchParams.get("error");
      const hash = new URLSearchParams(callback.hash.slice(1));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const result = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : accessToken && refreshToken
          ? await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          : { error: new Error(callbackError || "Google sign-in did not return a valid session. Please try again.") };
      await Browser.close().catch(() => undefined);
      if (result.error) {
        sessionStorage.setItem("repmate:auth-error", result.error.message);
        window.location.replace("/login");
        return;
      }
      window.location.replace("/app");
    };
    let removeListener: (() => Promise<void>) | undefined;
    void App.addListener("appUrlOpen", ({ url }) => void handleUrl(url)).then((listener) => { removeListener = () => listener.remove(); });
    void App.getLaunchUrl().then((launch) => void handleUrl(launch?.url));
    return () => { void removeListener?.(); };
  }, []);
  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
