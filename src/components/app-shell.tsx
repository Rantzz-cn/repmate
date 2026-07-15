"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpenText, Check, CloudOff, CloudUpload, House, RefreshCw, UserRound, UsersRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./providers/auth-provider";
import { AppProvider } from "./providers/app-provider";
import { useRepMate } from "./providers/app-provider";
import { cn } from "@/lib/utils";
import { AppLoading } from "./app-loading";
import { Onboarding } from "./onboarding";
import { supabase } from "@/lib/supabase";
import { GoriMateChat } from "./gori-mate-chat";

const nav = [{ href: "/app", label: "Dashboard", icon: House },{ href: "/app/programs", label: "Program", icon: BookOpenText },{ href: "/app/circle", label: "Circle", icon: UsersRound },{ href: "/app/profile", label: "Profile", icon: UserRound }];
export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth(), router = useRouter(), pathname = usePathname();
  const userId = session?.user.id ?? "";
  const [circleNotifications, setCircleNotifications] = useState(0);
  const refreshCircleNotifications = useCallback(async () => {
    if (!userId) return;
    const [profileResult, requestResult, postsResult] = await Promise.all([
      supabase.from("social_profiles").select("notifications_seen_at").eq("user_id", userId).maybeSingle(),
      supabase.from("friendships").select("id", { count: "exact", head: true }).eq("addressee_id", userId).eq("status", "pending"),
      supabase.from("social_posts").select("id").eq("user_id", userId),
    ]);
    if (profileResult.error) return setCircleNotifications(0);
    const postIds = (postsResult.data ?? []).map((post) => post.id);
    let reactionCount = 0;
    if (postIds.length) {
      let query = supabase.from("post_reactions").select("post_id", { count: "exact", head: true }).in("post_id", postIds).neq("user_id", userId);
      if (profileResult.data?.notifications_seen_at) query = query.gt("created_at", profileResult.data.notifications_seen_at);
      const result = await query;
      reactionCount = result.count ?? 0;
    }
    setCircleNotifications((requestResult.count ?? 0) + reactionCount);
  }, [userId]);
  useEffect(() => { if (!loading && !session) router.replace("/login"); }, [loading, router, session]);
  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refreshCircleNotifications(), 0);
    const refresh = () => void refreshCircleNotifications();
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("circle-notifications-changed", refresh);
    return () => { window.clearTimeout(initialRefresh); window.clearInterval(interval); window.removeEventListener("focus", refresh); window.removeEventListener("circle-notifications-changed", refresh); };
  }, [pathname, refreshCircleNotifications]);
  if (loading || !session) return <main className="min-h-dvh bg-black"><AppLoading /></main>;
  const focusedPage = pathname.startsWith("/app/exercises") || pathname === "/app/progress";
  const links = nav.map(({ href,label,icon:Icon }) => { const active = href === "/app" ? pathname === href : pathname.startsWith(href); const badge = href === "/app/circle" ? circleNotifications : 0; return <Link key={href} href={href} className={cn("app-nav__link",active&&"is-active")}><span className="app-nav__icon"><Icon aria-hidden="true" strokeWidth={1.8}/>{badge > 0 && <b aria-label={`${badge} Circle notifications`}>{Math.min(badge, 99)}</b>}</span><span>{label}</span></Link>; });
  return <AppProvider><OnboardingGate/><div className={cn("app-shell grid-bg", focusedPage && "app-shell--focus")}><aside className="app-sidebar"><div className="app-sidebar__brand-row"><div className="app-sidebar__logo"><Image src="/assets/images/whitelogo.png" width={210} height={210} alt="RepMate" priority/></div><SyncStatusIndicator compact /></div>{!focusedPage && <nav className="app-sidebar__nav" aria-label="Primary navigation">{links}</nav>}</aside><div className="app-content"><header className="app-mobile-brand"><div className="app-brand-crop"><Image src="/assets/images/whitelogo.png" width={210} height={210} alt="RepMate" priority/></div><SyncStatusIndicator /></header><main className="app-main">{children}</main></div>{!focusedPage && <nav className="app-bottom-nav safe-bottom" aria-label="Primary navigation">{links}</nav>}</div></AppProvider>;
}

function OnboardingGate() {
  const { loading, profile } = useRepMate();
  if (loading) return null;
  if (profile.onboardingComplete !== false) return <GoriMateChat/>;
  return <><Onboarding/><GoriMateChat/></>;
}

function SyncStatusIndicator({ compact = false }: { compact?: boolean }) {
  const { sync, retrySync } = useRepMate();
  const config = sync.phase === "offline" ? { icon: CloudOff, label: sync.pending ? `${sync.pending} saved` : "Offline" }
    : sync.phase === "syncing" ? { icon: RefreshCw, label: "Syncing" }
    : sync.phase === "error" ? { icon: RefreshCw, label: "Retry sync" }
    : sync.pending ? { icon: CloudUpload, label: `${sync.pending} pending` }
    : { icon: Check, label: "Synced" };
  const Icon = config.icon;
  return <button type="button" className={cn("sync-status", `is-${sync.phase}`, compact && "is-compact")} onClick={() => sync.phase === "error" && void retrySync()} disabled={sync.phase !== "error"} title={sync.error ?? config.label}><Icon aria-hidden="true" /><span>{config.label}</span></button>;
}
