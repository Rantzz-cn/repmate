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
      const code = new URL(url).searchParams.get("code");
      if (!code) return;
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      await Browser.close().catch(() => undefined);
      if (error) window.dispatchEvent(new CustomEvent("repmate:auth-error", { detail: error.message }));
    };
    let removeListener: (() => Promise<void>) | undefined;
    void App.addListener("appUrlOpen", ({ url }) => void handleUrl(url)).then((listener) => { removeListener = () => listener.remove(); });
    void App.getLaunchUrl().then((launch) => void handleUrl(launch?.url));
    return () => { void removeListener?.(); };
  }, []);
  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
