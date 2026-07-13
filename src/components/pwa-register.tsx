"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "development") {
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      );
      if ("caches" in window) {
        void caches.keys().then((keys) =>
          Promise.all(keys.filter((key) => key.startsWith("repmate-")).map((key) => caches.delete(key))),
        );
      }
      return;
    }

    void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
  }, []);

  return null;
}
