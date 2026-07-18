import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/providers/auth-provider";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.rep-mate.app"),
  title: { default: "RepMate — Workout Tracker & Training Planner", template: "%s | RepMate" },
  description: "Build workout routines, log sets and reps, learn exercise form, and track strength progress with RepMate.",
  applicationName: "RepMate",
  keywords: ["workout tracker", "gym workout planner", "strength training app", "exercise tracker", "progressive overload tracker"],
  authors: [{ name: "RepMate" }],
  creator: "RepMate",
  manifest: "/manifest.json",
  icons: { icon: "/assets/images/logo.png", apple: "/assets/images/logo.png" },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "RepMate",
    title: "RepMate — Train With Purpose",
    description: "Plan workouts, log every set, and turn consistent training into visible progress.",
    url: "/",
    images: [{ url: "/assets/images/repmate.png", alt: "RepMate workout tracker" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "RepMate — Train With Purpose",
    description: "Plan workouts, log every set, and turn consistent training into visible progress.",
    images: ["/assets/images/repmate.png"],
  },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#050505" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" /><link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Doto:wght@700;800;900&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" /></head><body><AuthProvider>{children}</AuthProvider><PwaRegister /></body></html>; }
