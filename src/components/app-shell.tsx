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
  return <AppProvider><div className="grid-bg min-h-dvh"><header className="mx-auto flex h-[86px] max-w-[1120px] items-center px-6"><Image src="/assets/images/whitelogo.png" width={188} height={58} alt="RepMate" className="h-12 w-auto object-contain" priority /></header><main className="app-main">{children}</main><nav className="fixed inset-x-3 bottom-3 z-50 mx-auto grid max-w-[470px] grid-cols-5 rounded-[24px] border border-white/10 bg-[#101010]/95 p-1.5 shadow-2xl backdrop-blur-xl safe-bottom" aria-label="Primary navigation">{nav.map(({ href,label,icon:Icon }) => { const active = href === "/app" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-[17px] text-[10px] font-semibold text-zinc-500 transition",active&&"bg-white text-black")}><Icon className="size-5" strokeWidth={1.8}/><span>{label}</span></Link>; })}</nav></div></AppProvider>;
}
