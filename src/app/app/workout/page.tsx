"use client";

import Image from "next/image";
import Link from "next/link";
import { Capacitor } from "@capacitor/core";
import { AlertCircle, Check, Minus, Pause, Play, Plus, SkipForward } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useRepMate } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ShareRecap } from "@/components/share-recap";
import { exercises } from "@/lib/data";
import { cancelRestNotification, configureNotificationChannels, scheduleRestNotification } from "@/lib/native-notifications";
import type { Workout, WorkoutSet } from "@/lib/types";

export default function WorkoutPage() {
  const state = useRepMate();
  const router = useRouter();
  const workout = state.activeWorkout;
  const [rest, setRest] = useState(0);
  const [paused, setPaused] = useState(false);
  const [invalidSet, setInvalidSet] = useState<number | null>(null);
  const [validationMessage, setValidationMessage] = useState("");
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [recap, setRecap] = useState<Workout | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const timerEndsAt = useRef<number | null>(null);
  const timerFinished = useRef(false);

  const notifyTimerFinished = useCallback(() => {
    if (timerFinished.current) return;
    timerFinished.current = true;
    if (state.profile.vibration && navigator.vibrate) navigator.vibrate([180, 80, 180]);
    if (!Capacitor.isNativePlatform() && state.profile.notifications && "Notification" in window && Notification.permission === "granted") {
      new Notification("Rest complete", { body: "Your next set is ready.", icon: "/assets/images/logo.webp" });
    }
  }, [state.profile.notifications, state.profile.vibration]);

  useEffect(() => {
    void configureNotificationChannels().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!rest || paused || !timerEndsAt.current) return;
    const updateClock = () => {
      const remaining = Math.max(0, Math.ceil((timerEndsAt.current! - Date.now()) / 1000));
      setRest(remaining);
      if (!remaining) {
        timerEndsAt.current = null;
        notifyTimerFinished();
      }
    };
    updateClock();
    const timer = window.setInterval(updateClock, 250);
    document.addEventListener("visibilitychange", updateClock);
    window.addEventListener("focus", updateClock);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", updateClock);
      window.removeEventListener("focus", updateClock);
    };
  }, [notifyTimerFinished, paused, rest]);

  if (state.loading) return null;
  if (!workout) {
    return recap ? <ShareRecap workout={recap} profile={state.profile} onClose={() => { setRecap(null); router.replace("/app/progress"); }} /> : (
      <div className="grid min-h-[55dvh] place-items-center text-center"><div><h1 className="text-2xl font-semibold">No active workout</h1><p className="mt-2 text-sm text-zinc-500">Start a routine from your program.</p><Link href="/app/programs" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-white px-5 text-sm font-semibold text-black">Choose a workout</Link></div></div>
    );
  }

  const current = workout.exercises[workout.current];
  const exercise = exercises.find((item) => item.id === current.exerciseId)!;
  const update = (fn: (value: Workout) => Workout) => state.updateActive(fn);
  const updateSet = (index: number, patch: Partial<WorkoutSet>) => {
    setInvalidSet(null);
    setValidationMessage("");
    update((value) => ({ ...value, exercises: value.exercises.map((item, itemIndex) => itemIndex === value.current ? { ...item, sets: item.sets.map((set, setIndex) => setIndex === index ? { ...set, ...patch } : set) } : item) }));
  };
  const firstIncompleteSet = () => current.sets.findIndex((set) => !set.done || set.weight <= 0 || set.reps <= 0);
  const showIncompleteSet = () => {
    const index = firstIncompleteSet();
    if (index < 0) return false;
    setInvalidSet(index);
    setValidationMessage(`Complete set ${index + 1}: enter weight and reps, then tap the check button.`);
    window.setTimeout(() => document.querySelector(`[data-set-index="${index}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
    return true;
  };
  const startRest = (seconds: number) => {
    timerFinished.current = false;
    timerEndsAt.current = Date.now() + seconds * 1000;
    setRest(seconds);
    setPaused(false);
    if (state.profile.notifications) void scheduleRestNotification(seconds, exercise.name).catch(() => undefined);
  };
  const adjustRest = (seconds: number) => {
    const next = Math.max(0, rest + seconds);
    setRest(next);
    timerEndsAt.current = next ? Date.now() + next * 1000 : null;
    if (state.profile.notifications) {
      if (next) void scheduleRestNotification(next, exercise.name).catch(() => undefined);
      else void cancelRestNotification().catch(() => undefined);
    }
    if (!next) notifyTimerFinished();
  };
  const togglePause = () => {
    if (paused) {
      timerEndsAt.current = Date.now() + rest * 1000;
      if (state.profile.notifications) void scheduleRestNotification(rest, exercise.name).catch(() => undefined);
    } else {
      timerEndsAt.current = null;
      void cancelRestNotification().catch(() => undefined);
    }
    setPaused((value) => !value);
  };
  const toggleDone = (index: number) => {
    const set = current.sets[index];
    if (rest > 0 && !set.done) {
      setInvalidSet(index);
      setValidationMessage("Finish or skip the rest timer before starting the next set.");
      return;
    }
    if (!set.done && (set.weight <= 0 || set.reps <= 0)) {
      setInvalidSet(index);
      setValidationMessage(`Set ${index + 1} needs both weight and reps before it can be completed.`);
      return;
    }
    updateSet(index, { done: !set.done });
    if (!set.done) startRest(current.rest);
  };
  const move = (offset: number) => {
    if (offset > 0 && showIncompleteSet()) return;
    setInvalidSet(null);
    setValidationMessage("");
    update((value) => ({ ...value, current: Math.max(0, Math.min(value.exercises.length - 1, value.current + offset)) }));
  };
  const requestFinish = () => { if (!showIncompleteSet()) { setFinishError(""); setFinishOpen(true); } };
  const choosePhoto = (file?: File) => {
    if (!file) return;
    setFinishError("");
    if (file.size > 8 * 1024 * 1024) { setFinishError("Choose a photo smaller than 8 MB."); return; }
    if (!(["image/jpeg", "image/png", "image/webp"].includes(file.type))) { setFinishError("Choose a JPG, PNG, or WebP photo."); return; }
    const reader = new FileReader();
    reader.onerror = () => setFinishError("That photo could not be opened. Try another one.");
    reader.onload = () => setPhoto(String(reader.result));
    reader.readAsDataURL(file);
  };
  const finish = async (sessionPhoto: string | null) => {
    const complete = { ...workout, id: workout.sessionId, completedAt: new Date().toISOString(), duration: Math.round((Date.now() - Date.parse(workout.startedAt)) / 1000), photo: sessionPhoto };
    setFinishError("");
    setFinishing(true);
    try {
      await state.saveWorkout(complete);
      await state.setActive(null);
      setFinishOpen(false);
      setRecap(complete);
    } catch {
      setFinishError("Your workout could not be saved yet. Keep this screen open and try again.");
    } finally {
      setFinishing(false);
    }
  };

  return <div className="app-page workout-page">
    <header><p className="eyebrow">Active workout · {workout.current + 1} of {workout.exercises.length}</p><h1 className="display page-title mt-2">{workout.name}</h1></header>
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#111]"><div className="grid h-64 place-items-center bg-white"><Image src={exercise.animation} width={520} height={360} unoptimized alt={`${exercise.name} form`} className="h-full w-full object-contain" onError={(event) => { event.currentTarget.src = "/assets/images/fallback.webp"; }} /></div><div className="p-5"><p className="eyebrow capitalize">{exercise.primaryMuscle} · {exercise.equipment}</p><h2 className="mt-1 text-2xl font-semibold">{exercise.name}</h2><p className="mt-2 text-sm text-zinc-500">Target {current.minReps} to {current.maxReps} reps · {Math.round(current.rest / 60)} min rest</p></div></section>
    <section className="rounded-3xl border border-white/10 bg-[#111] p-4">
      <div className="mb-3 grid grid-cols-[24px_1fr_1fr_48px_40px] gap-2 px-2 text-[9px] font-bold uppercase text-zinc-500"><span>Set</span><span>Weight ({state.profile.units})</span><span>Reps</span><span>Done</span><span /></div>
      <div className="grid gap-2">{current.sets.map((set, index) => { const locked = rest > 0 && !set.done; return <div data-set-index={index} key={index} aria-disabled={locked} className={`grid grid-cols-[24px_1fr_1fr_48px_40px] items-center gap-2 rounded-2xl border p-2 transition ${locked ? "opacity-45" : ""} ${invalidSet === index ? "border-red-500 bg-red-500/5 ring-1 ring-red-500/30" : set.done ? "border-emerald-500/60 bg-emerald-500/5" : "border-transparent bg-[#191919]"}`}><span className="numeric text-center text-xs">{index + 1}</span><input disabled={locked} aria-label={`Set ${index + 1} weight in ${state.profile.units}`} aria-invalid={invalidSet === index && set.weight <= 0} inputMode="decimal" value={set.weight || ""} placeholder={locked ? "Rest" : "Weight"} onChange={(event) => updateSet(index, { weight: Number(event.target.value) })} className="h-12 min-w-0 rounded-xl bg-black px-3 numeric text-xs outline-none focus:ring-2 focus:ring-white/30 disabled:cursor-not-allowed" /><input disabled={locked} aria-label={`Set ${index + 1} repetitions`} aria-invalid={invalidSet === index && set.reps <= 0} inputMode="numeric" value={set.reps || ""} placeholder={locked ? "Rest" : "Reps"} onChange={(event) => updateSet(index, { reps: Number(event.target.value) })} className="h-12 min-w-0 rounded-xl bg-black px-3 numeric text-xs outline-none focus:ring-2 focus:ring-white/30 disabled:cursor-not-allowed" /><button disabled={locked} onClick={() => toggleDone(index)} aria-label={set.done ? `Mark set ${index + 1} incomplete` : locked ? `Set ${index + 1} locked during rest` : `Complete set ${index + 1}`} className={`grid size-12 place-items-center rounded-xl border disabled:cursor-not-allowed ${set.done ? "border-emerald-400 bg-emerald-500/50" : "border-white/10 bg-black text-zinc-700"}`}><Check className="size-6" /></button><button disabled={current.sets.length <= 1 || locked} onClick={() => update((value) => ({ ...value, exercises: value.exercises.map((item, itemIndex) => itemIndex === value.current ? { ...item, sets: item.sets.filter((_, setIndex) => setIndex !== index) } : item) }))} aria-label={`Remove set ${index + 1}`} className="grid size-10 place-items-center rounded-xl border border-white/10 text-zinc-500 disabled:opacity-20"><Minus className="size-4" /></button></div>; })}</div>
      <button disabled={rest > 0} onClick={() => update((value) => ({ ...value, exercises: value.exercises.map((item, itemIndex) => itemIndex === value.current ? { ...item, sets: [...item.sets, { weight: 0, reps: 0, rir: 2, done: false }] } : item) }))} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 text-sm text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"><Plus className="size-4" />{rest > 0 ? "Rest before adding a set" : "Add set"}</button>
      {validationMessage ? <p role="alert" aria-live="assertive" className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs leading-5 text-red-300"><AlertCircle className="mt-0.5 size-4 shrink-0" />{validationMessage}</p> : <p className="mt-3 text-xs text-zinc-500">Enter weight and reps, then complete each set.</p>}
    </section>
    {rest > 0 && <section className="sticky bottom-24 z-40 rounded-3xl border border-white/10 bg-[#181818]/95 p-4 shadow-2xl backdrop-blur-xl"><div className="flex items-center justify-between"><div><p className="eyebrow">Rest timer</p><p className="text-xs text-zinc-500">{paused ? "Paused" : exercise.name}</p></div><strong className="numeric text-3xl">{String(Math.floor(rest / 60)).padStart(2, "0")}:{String(rest % 60).padStart(2, "0")}</strong></div><div className="mt-3 grid grid-cols-4 gap-2"><button onClick={() => adjustRest(-30)} className="h-10 rounded-xl bg-zinc-900 text-xs">−30</button><button onClick={togglePause} aria-label={paused ? "Resume rest timer" : "Pause rest timer"} className="grid h-10 place-items-center rounded-xl bg-zinc-900">{paused ? <Play className="size-4" /> : <Pause className="size-4" />}</button><button onClick={() => adjustRest(30)} className="h-10 rounded-xl bg-zinc-900 text-xs">+30</button><button onClick={() => { setRest(0); timerEndsAt.current = null; void cancelRestNotification().catch(() => undefined); }} aria-label="Skip rest timer" className="grid h-10 place-items-center rounded-xl bg-zinc-900"><SkipForward className="size-4" /></button></div></section>}
    <div className="grid grid-cols-[1fr_2fr] gap-2"><Button variant="secondary" disabled={!workout.current} onClick={() => move(-1)}>Previous</Button>{workout.current === workout.exercises.length - 1 ? <Button onClick={requestFinish}>Finish workout</Button> : <Button onClick={() => move(1)}>Next exercise</Button>}</div>
    <Dialog open={finishOpen} onOpenChange={(open) => { if (!finishing) setFinishOpen(open); }}><DialogContent className="max-w-sm p-5 sm:p-6"><div className="pr-12"><p className="eyebrow">Workout complete</p><DialogTitle className="mt-2">Save your workout</DialogTitle><DialogDescription className="mt-2 leading-5">Your session is ready. Add a photo if you want, or finish without one.</DialogDescription></div><input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => choosePhoto(event.target.files?.[0])} /><button type="button" disabled={finishing} onClick={() => fileRef.current?.click()} className="mt-5 grid min-h-36 w-full place-items-center overflow-hidden rounded-2xl border border-dashed border-white/20 bg-[#181818] transition hover:border-white/35 disabled:opacity-50">{photo ? <span className="relative block h-44 w-full"><img src={photo} alt="Session preview" className="h-full w-full object-cover" /><span className="absolute inset-x-3 bottom-3 rounded-xl bg-black/75 px-3 py-2 text-xs text-white backdrop-blur">Tap to choose a different photo</span></span> : <span className="text-center"><span className="mx-auto mb-3 grid size-11 place-items-center rounded-xl border border-white/10 bg-zinc-900"><Plus className="size-5" /></span><strong className="block text-sm font-semibold">Add an optional photo</strong><small className="mt-1 block text-zinc-500">JPG, PNG or WebP · up to 8 MB</small></span>}</button>{finishError && <p role="alert" className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs leading-5 text-red-300">{finishError}</p>}<div className="mt-5 grid gap-2"><Button type="button" disabled={finishing} onClick={() => finish(photo)}>{finishing ? "Saving workout…" : "Save workout"}</Button><Button type="button" disabled={finishing} variant="ghost" onClick={() => finish(null)}>Finish without photo</Button></div></DialogContent></Dialog>
    {recap && <ShareRecap workout={recap} profile={state.profile} onClose={() => { setRecap(null); router.replace("/app/progress"); }} />}
  </div>;
}
