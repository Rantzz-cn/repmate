"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/lib/supabase";

const legal = {
  terms: { eyebrow: "RepMate Legal", title: "Terms of Service", intro: "These terms govern your use of RepMate.", sections: [
    ["Using RepMate", "Keep your Google account secure and use RepMate only for lawful personal fitness purposes."],
    ["Fitness and Health Notice", "RepMate provides workout tracking and general educational information, not medical advice."],
    ["Your Content", "You retain ownership of workout entries, routines, notes, and photos you upload."],
    ["Availability", "Features may be updated, improved, suspended, or discontinued."],
  ] },
  privacy: { eyebrow: "Your Data", title: "Privacy Policy", intro: "This policy explains what RepMate stores and why it is used.", sections: [
    ["Information We Collect", "Google provides your name, email, and account identifier. RepMate stores the training information you provide."],
    ["Storage", "Account and workout data use Supabase. A local offline cache synchronizes when internet access returns."],
    ["Sharing", "RepMate does not sell personal data. You decide whether to save or share workout recaps."],
    ["Your Choices", "You may update profile information, delete completed sessions, or stop using the service."],
  ] },
} as const;

export default function LoginPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [legalType, setLegalType] = useState<keyof typeof legal>("terms");

  useEffect(() => {
    document.body.classList.add("auth-page");
    return () => document.body.classList.remove("auth-page");
  }, []);
  useEffect(() => { if (!loading && session) router.replace("/app"); }, [loading, router, session]);
  useEffect(() => {
    const showAuthError = (event: Event) => { setError((event as CustomEvent<string>).detail); setBusy(false); };
    window.addEventListener("repmate:auth-error", showAuthError);
    let removeListener: (() => Promise<void>) | undefined;
    if (Capacitor.isNativePlatform()) void Browser.addListener("browserFinished", () => setBusy(false)).then((listener) => { removeListener = () => listener.remove(); });
    return () => { window.removeEventListener("repmate:auth-error", showAuthError); void removeListener?.(); };
  }, []);

  const signIn = async () => {
    setBusy(true);
    setError("");
    const native = Capacitor.isNativePlatform();
    const result = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: native ? "app.repmate.mobile://login-callback" : `${location.origin}/app`, skipBrowserRedirect: native } });
    if (result.error) { setError(result.error.message); setBusy(false); }
    else if (native && result.data.url) await Browser.open({ url: result.data.url });
  };
  const openLegal = (type: keyof typeof legal) => { setLegalType(type); dialog.current?.showModal(); };
  const policy = legal[legalType];

  return <>
    <link rel="stylesheet" href="/styles/reset.css" />
    <link rel="stylesheet" href="/styles/variables.css" />
    <link rel="stylesheet" href="/styles/components.css" />
    <link rel="stylesheet" href="/styles/auth-page.css" />
    <Link className="auth-home" href="/"><img src="/assets/images/whitelogo.webp" alt="RepMate" /></Link>
    <main className="auth-layout">
      <section className="auth-promo"><p className="eyebrow">Train With Purpose</p><h1>Your progress<br />starts here.</h1><p>One Google sign-in keeps your routines, sessions, and progress together.</p><img src="/assets/images/repmate.webp" alt="RepMate wolf coach" /></section>
      <section className="auth-panel"><div id="auth-root" aria-live="polite"><section className="login-card google-only-card"><header className="login-card__head"><img src="/assets/images/whitelogo.webp" alt="RepMate" /><p className="eyebrow">One Account. Every Rep.</p><h1>Continue to RepMate</h1><p>Use your Google account to securely save and sync your training.</p></header>{error && <p className="login-message" role="alert">{error}</p>}<button className="google-button" type="button" onClick={signIn} disabled={busy}><span className="google-mark">G</span><span>{busy ? "Connecting to Google…" : "Continue with Google"}</span></button><p className="google-auth-note">New here? Your RepMate account is created automatically.</p><p className="auth-legal-links">By continuing, you agree to the <button type="button" onClick={() => openLegal("terms")}>Terms of Service</button> and acknowledge the <button type="button" onClick={() => openLegal("privacy")}>Privacy Policy</button>.</p></section></div></section>
    </main>
    <dialog ref={dialog} className="legal-dialog" onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}><div><header className="legal-dialog__head"><div><p className="eyebrow">{policy.eyebrow}</p><h2>{policy.title}</h2><p>Effective July 13, 2026</p></div><button type="button" onClick={() => dialog.current?.close()} aria-label={`Close ${policy.title}`}>×</button></header><div className="legal-dialog__body"><p className="legal-dialog__intro">{policy.intro}</p>{policy.sections.map(([title, text]) => <section key={title}><h3>{title}</h3><p>{text}</p></section>)}</div></div></dialog>
  </>;
}
