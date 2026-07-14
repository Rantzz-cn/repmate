"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, BookOpenText, Dumbbell, House, UserRound } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "./providers/auth-provider";
import { AppProvider } from "./providers/app-provider";
import { cn } from "@/lib/utils";
import { AppLoading } from "./app-loading";

const nav = [{ href: "/app", label: "Today", icon: House },{ href: "/app/programs", label: "Program", icon: BookOpenText },{ href: "/app/exercises", label: "Exercises", icon: Dumbbell },{ href: "/app/progress", label: "Progress", icon: BarChart3 },{ href: "/app/profile", label: "Profile", icon: UserRound }];
export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth(), router = useRouter(), pathname = usePathname();
  useEffect(() => { if (!loading && !session) router.replace("/login"); }, [loading, router, session]);
  if (loading || !session) return <main className="min-h-dvh bg-black"><AppLoading /></main>;
  const links = nav.map(({ href,label,icon:Icon }) => { const active = href === "/app" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} className={cn("app-nav__link",active&&"is-active")}><Icon aria-hidden="true" strokeWidth={1.8}/><span>{label}</span></Link>; });
  return <AppProvider><div className="app-shell grid-bg"><aside className="app-sidebar"><Image src="/assets/images/whitelogo.png" width={188} height={58} alt="RepMate" className="app-sidebar__logo" priority/><nav className="app-sidebar__nav" aria-label="Primary navigation">{links}</nav></aside><div className="app-content"><header className="app-mobile-brand"><Image src="/assets/images/whitelogo.png" width={188} height={58} alt="RepMate" priority/></header><main className="app-main">{children}</main></div><nav className="app-bottom-nav safe-bottom" aria-label="Primary navigation">{links}</nav></div></AppProvider>;
}
