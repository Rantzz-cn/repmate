"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { defaultProfile } from "@/lib/data";
import { deleteRecord, getSyncSnapshot, listRecords, saveRecord, subscribeSync, syncOutbox, type SyncSnapshot } from "@/lib/repository";
import { updateTodayWidget } from "@/lib/native-widget";
import type { Profile, Program, Workout } from "@/lib/types";
import { useAuth } from "./auth-provider";

interface AppState {
  loading: boolean; profile: Profile; programs: Program[]; workouts: Workout[]; activeWorkout: Workout | null; sync: SyncSnapshot;
  retrySync(): Promise<void>;
  saveProgram(program: Program): Promise<void>; removeProgram(id: string): Promise<void>; setActive(workout: Workout | null): Promise<void>; updateActive(update: (workout: Workout) => Workout): void; saveWorkout(workout: Workout): Promise<void>; removeWorkout(id: string): Promise<void>; saveProfile(profile: Profile): Promise<void>; refresh(): Promise<void>;
}
const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true), [profile, setProfile] = useState(defaultProfile), [programs, setPrograms] = useState<Program[]>([]), [workouts, setWorkouts] = useState<Workout[]>([]), [activeWorkout, setActiveWorkout] = useState<Workout | null>(null), [sync, setSync] = useState(getSyncSnapshot);
  const activeWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const activeWriteTimer = useRef<number | null>(null);
  const pendingActiveWrite = useRef<Workout | null>(null);
  const queueActiveWrite = useCallback((workout: Workout | null, immediate = false) => {
    pendingActiveWrite.current = workout;
    if (activeWriteTimer.current) window.clearTimeout(activeWriteTimer.current);
    const persist = () => {
      activeWriteTimer.current = null;
      const next = pendingActiveWrite.current;
      pendingActiveWrite.current = null;
    activeWriteQueue.current = activeWriteQueue.current
      .catch(() => undefined)
      .then(async () => {
          if (next) await saveRecord("activeWorkout", { ...next, id: "active" });
        else await deleteRecord("activeWorkout", "active");
      });
      return activeWriteQueue.current;
    };
    if (immediate) return persist();
    activeWriteTimer.current = window.setTimeout(persist, 280);
    return Promise.resolve();
  }, []);
  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const [profiles, storedPrograms, storedWorkouts, active] = await Promise.all([listRecords<Profile>("profile"), listRecords<Program>("programs"), listRecords<Workout>("workouts"), listRecords<Workout>("activeWorkout")]);
    const metadataName = session.user.user_metadata.full_name || session.user.user_metadata.name;
    const emailName = session.user.email?.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
    const googleName = metadataName || emailName || "RepMate Member";
    const storedProfile = profiles[0];
    const existingUser = Boolean(storedProfile || storedPrograms.length || storedWorkouts.length);
    const nextProfile = storedProfile
      ? { ...storedProfile, name: storedProfile.name === "Athlete" ? googleName : storedProfile.name, avatarUrl: storedProfile.avatarUrl || session.user.user_metadata.avatar_url, onboardingComplete: storedProfile.onboardingComplete ?? true }
      : { ...defaultProfile, name: googleName, avatarUrl: session.user.user_metadata.avatar_url, onboardingComplete: existingUser };
    const profileChanged = !profiles.length || storedProfile?.name === "Athlete" || storedProfile?.onboardingComplete === undefined;
    if (profileChanged) await saveRecord("profile", nextProfile);
    setProfile(nextProfile); setPrograms(storedPrograms); setWorkouts(storedWorkouts); setActiveWorkout(active[0] ?? null); setLoading(false);
  }, [session]);
  useEffect(() => {
    const initialLoad = window.setTimeout(() => void refresh(), 0);
    const online = () => void syncOutbox().catch(() => undefined);
    window.addEventListener("online", online);
    const offline = () => setSync((current) => ({ ...current, phase: "offline" }));
    window.addEventListener("offline", offline);
    const unsubscribe = subscribeSync(setSync);
    return () => { window.clearTimeout(initialLoad); window.removeEventListener("online", online); window.removeEventListener("offline", offline); unsubscribe(); };
  }, [refresh]);
  useEffect(() => {
    const theme = profile.theme ?? localStorage.getItem("theme") ?? "dark";
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [profile.theme]);
  useEffect(() => {
    if (loading) return;
    const activeProgram = programs.find((program) => program.active) ?? programs[0];
    const today = activeProgram?.days.find((day) => day.weekday === new Date().getDay());
    const payload = activeWorkout
      ? { title: activeWorkout.name, subtitle: `Exercise ${activeWorkout.current + 1} of ${activeWorkout.exercises.length}`, action: "Resume workout" }
      : today
        ? { title: today.name, subtitle: `${today.exercises.length} exercises · ${activeProgram.name}`, action: "Start workout" }
        : { title: "Recovery day", subtitle: activeProgram ? `Next session in ${activeProgram.name}` : "Create your first training program", action: "Open RepMate" };
    void updateTodayWidget(payload).catch(() => undefined);
  }, [activeWorkout, loading, programs]);
  const value = useMemo<AppState>(() => ({ loading, profile, programs, workouts, activeWorkout, sync, refresh,
    retrySync: async () => { await syncOutbox({ force: true }); },
    saveProgram: async (program) => { await saveRecord("programs", program); setPrograms((items) => [...items.filter((item) => item.id !== program.id), program]); },
    removeProgram: async (id) => { await deleteRecord("programs", id); setPrograms((items) => items.filter((item) => item.id !== id)); },
    setActive: async (workout) => { setActiveWorkout(workout); await queueActiveWrite(workout, true); },
    updateActive: (update) => { setActiveWorkout((current) => { if (!current) return current; const next = update(current); void queueActiveWrite(next); return next; }); },
    saveWorkout: async (workout) => { await saveRecord("workouts", workout); setWorkouts((items) => [...items.filter((item) => item.id !== workout.id), workout]); },
    removeWorkout: async (id) => { await deleteRecord("workouts", id); setWorkouts((items) => items.filter((item) => item.id !== id)); },
    saveProfile: async (next) => { await saveRecord("profile", next); setProfile(next); },
  }), [activeWorkout, loading, profile, programs, queueActiveWrite, refresh, sync, workouts]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useRepMate() { const context = useContext(AppContext); if (!context) throw new Error("AppProvider missing"); return context; }
