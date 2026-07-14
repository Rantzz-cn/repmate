import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./circle.css";
import "./focus.css";
import { AuthProvider } from "@/components/providers/auth-provider";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = { title: { default: "RepMate", template: "%s | RepMate" }, description: "Plan, track, and progress every workout.", manifest: "/manifest.json", icons: { icon: "/assets/images/logo.png" } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#050505" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" /><link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Doto:wght@700;800;900&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" /></head><body><AuthProvider>{children}</AuthProvider><PwaRegister /></body></html>; }
