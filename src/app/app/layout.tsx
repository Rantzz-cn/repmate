import { AppShell } from "@/components/app-shell";
import type { Metadata } from "next";
import "../globals.css";
import "../circle.css";
import "../focus.css";
import "../onboarding.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
