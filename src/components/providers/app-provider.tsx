"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { defaultProfile, starterProgram } from "@/lib/data";
import { deleteRecord, listRecords, saveRecord, syncOutbox } from "@/lib/repository";
import type { Profile, Program, Workout } from "@/lib/types";
import { useAuth } from "./auth-provider";

interface AppState {
  loading: boolean; profile: Profile; programs: Program[]; workouts: Workout[]; activeWorkout: Workout | null;
  saveProgram(program: Program): Promise<void>; removeProgram(id: string): Promise<void>; setActive(workout: Workout | null): Promise<void>; saveWorkout(workout: Workout): Promise<void>; removeWorkout(id: string): Promise<void>; saveProfile(profile: Profile): Promise<void>; refresh(): Promise<void>;
}
const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true), [profile, setProfile] = useState(defaultProfile), [programs, setPrograms] = useState<Program[]>([]), [workouts, setWorkouts] = useState<Workout[]>([]), [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const [profiles, storedPrograms, storedWorkouts, active] = await Promise.all([listRecords<Profile>("profile"), listRecords<Program>("programs"), listRecords<Workout>("workouts"), listRecords<Workout>("activeWorkout")]);
    const nextProfile = profiles[0] ?? { ...defaultProfile, name: session.user.user_metadata.full_name?.split(" ")[0] || "Athlete", avatarUrl: session.user.user_metadata.avatar_url };
    let nextPrograms = storedPrograms;
    if (!nextPrograms.length) { nextPrograms = [starterProgram]; await saveRecord("programs", starterProgram); }
    if (!profiles.length) await saveRecord("profile", nextProfile);
    setProfile(nextProfile); setPrograms(nextPrograms); setWorkouts(storedWorkouts); setActiveWorkout(active[0] ?? null); setLoading(false);
  }, [session]);
  useEffect(() => {
    const initialLoad = window.setTimeout(() => void refresh(), 0);
    const online = () => void syncOutbox();
    window.addEventListener("online", online);
    return () => { window.clearTimeout(initialLoad); window.removeEventListener("online", online); };
  }, [refresh]);
  const value = useMemo<AppState>(() => ({ loading, profile, programs, workouts, activeWorkout, refresh,
    saveProgram: async (program) => { await saveRecord("programs", program); setPrograms((items) => [...items.filter((item) => item.id !== program.id), program]); },
    removeProgram: async (id) => { await deleteRecord("programs", id); setPrograms((items) => items.filter((item) => item.id !== id)); },
    setActive: async (workout) => { if (workout) await saveRecord("activeWorkout", { ...workout, id: "active" }); else await deleteRecord("activeWorkout", "active"); setActiveWorkout(workout); },
    saveWorkout: async (workout) => { await saveRecord("workouts", workout); setWorkouts((items) => [...items.filter((item) => item.id !== workout.id), workout]); },
    removeWorkout: async (id) => { await deleteRecord("workouts", id); setWorkouts((items) => items.filter((item) => item.id !== id)); },
    saveProfile: async (next) => { await saveRecord("profile", next); setProfile(next); },
  }), [activeWorkout, loading, profile, programs, refresh, workouts]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useRepMate() { const context = useContext(AppContext); if (!context) throw new Error("AppProvider missing"); return context; }
