"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/components/providers/auth-provider";

type BodyMusclesApi = { BodyChart: new (target: Element, options: Record<string, unknown>) => unknown; ViewSide: { FRONT: string } };

export function LandingEnhancements() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      router.replace(!loading && session ? "/app" : "/login");
      return;
    }
    if (!loading && session) router.replace("/app");
  }, [loading, router, session]);

  useEffect(() => {
    const target = document.querySelector("#landing-body-chart");
    if (!target) return;
    const mount = () => {
      const bodyMuscles = (window as unknown as { BodyMuscles?: BodyMusclesApi }).BodyMuscles;
      if (!bodyMuscles || target.childElementCount) return;
      const chest = ["chest-upper-left", "chest-lower-left", "chest-upper-right", "chest-lower-right"];
      new bodyMuscles.BodyChart(target, {
        view: bodyMuscles.ViewSide.FRONT,
        bodyState: Object.fromEntries(chest.map((id) => [id, { intensity: 8, selected: true }])),
        ariaLabel: "Front body highlighting the chest",
        enableTransitions: false,
      });
    };
    if ((window as unknown as { BodyMuscles?: BodyMusclesApi }).BodyMuscles) mount();
    else {
      const script = document.createElement("script");
      script.src = "/assets/vendor/body-muscles/body-muscles.umd.min.js";
      script.onload = mount;
      document.body.appendChild(script);
    }
  }, []);

  return null;
}
