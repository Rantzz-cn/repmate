"use client";

import { useEffect, useRef } from "react";

const styles = [
  "reset.css",
  "variables.css",
  "components.css",
  "layout.css",
  "responsive.css",
  "numeric.css",
];

export function LegacyApp({ route }: { route: "today" | "program" | "exercises" | "workout" | "progress" | "profile" }) {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const load = (src: string, type?: string) => new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
      if (existing?.dataset.loaded === "true") { resolve(); return; }
      const script = existing ?? document.createElement("script");
      script.src = src;
      if (type) script.type = type;
      script.onload = () => { script.dataset.loaded = "true"; resolve(); };
      script.onerror = () => reject(new Error(`Could not load ${src}`));
      if (!existing) document.body.appendChild(script);
    });

    void Promise.all([
      load("/legacy/vendor/supabase.js"),
      load("/assets/vendor/body-muscles/body-muscles.umd.min.js"),
    ]).then(() => load("/legacy/js/app.js", "module"))
      .catch((error) => {
        console.error(error);
        const app = document.querySelector("#app");
        if (app) app.innerHTML = '<div class="card empty app-load-error"><h2>RepMate could not load</h2><p>Refresh the page to try again.</p></div>';
      });
  }, [route]);

  return <>
    {styles.map((file) => <link key={file} rel="stylesheet" href={`/legacy/css/${file}`} />)}
    <a className="skip-link" href="#app">Skip to content</a>
    <div className="shell">
      <aside className="sidebar" aria-label="Main navigation">
        <a className="brand" href="/app" aria-label="RepMate home"><img src="/assets/images/whitelogo.png" alt="RepMate" /></a>
        <nav id="desktop-nav" />
      </aside>
      <div className="mobile-brand"><a href="/app" aria-label="RepMate home"><img src="/assets/images/whitelogo.png" alt="RepMate" /></a></div>
      <main id="app" tabIndex={-1}><div className="loading">Loading your training data…</div></main>
    </div>
    <nav id="mobile-nav" className="bottom-nav" aria-label="Main navigation" />
    <div id="timer-float" className="timer-float hidden" aria-live="polite" />
    <div id="toast" className="toast" role="status" aria-live="polite" />
    <div id="sync-status" className="sync-status" role="status" aria-live="polite" hidden />
    <dialog id="modal"><div id="modal-content" /></dialog>
  </>;
}
