"use client";

import { CheckCircle2, Dumbbell, Share2, Trash2, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { FocusBackButton } from "@/components/focus-back-button";
import { useRepMate } from "@/components/providers/app-provider";
import { ShareRecap } from "@/components/share-recap";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Workout } from "@/lib/types";
import { workoutStats } from "@/lib/workouts";

export default function ProgressPage() {
  const state = useRepMate();
  const [sharing, setSharing] = useState<Workout | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Workout | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);
  const [now] = useState(() => Date.now());
  const completed = state.workouts.filter((workout) => workout.completedAt).sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!));
  const totals = completed.reduce((result, workout) => {
    const stats = workoutStats(workout);
    return { sets: result.sets + stats.sets, volume: result.volume + stats.volume };
  }, { sets: 0, volume: 0 });

  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  };

  const deleteWorkout = async () => {
    if (!pendingDelete) return;
    const name = pendingDelete.name;
    await state.removeWorkout(pendingDelete.id);
    setPendingDelete(null);
    notify(`${name} removed from workout history.`);
  };

  return <div className="app-page focus-page">
    <FocusBackButton />
    <PageHeader eyebrow="Strength over time" title="Progress" />
    <section className="grid grid-cols-2 gap-3">
      {[[completed.length, "Workouts"], [completed.filter((workout) => now - Date.parse(workout.completedAt!) < 604800000).length, "This week"], [totals.sets, "Total sets"], [`${Math.round(totals.volume).toLocaleString()} ${state.profile.units}`, "Total volume"]].map(([value, label]) => <div key={label} className="flex min-h-28 flex-col justify-between rounded-2xl border border-white/10 bg-[#111] p-4"><strong className="numeric text-xl">{value}</strong><span className="text-sm text-zinc-500">{label}</span></div>)}
    </section>
    <section className="rounded-3xl border border-white/10 bg-[#111] p-5">
      <h2 className="display text-2xl">Training volume</h2><p className="text-sm text-zinc-500">Completed session volume</p>
      {completed.length < 2 ? <div className="grid min-h-52 place-items-center text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-2xl border border-white/10"><Dumbbell className="size-5" /></span><p className="mt-4 max-w-56 text-sm text-zinc-500">Complete two workouts to see your training trend.</p></div></div> : <div className="mt-8 flex h-48 items-end gap-3">{completed.slice(0, 8).reverse().map((workout) => { const value = workoutStats(workout).volume; const max = Math.max(...completed.map((item) => workoutStats(item).volume)); return <div key={workout.id} className="flex h-full flex-1 items-end"><div className="w-full rounded-t-lg bg-white/80" style={{ height: `${Math.max(8, value / max * 100)}%` }} title={`${value} ${state.profile.units}`} /></div>; })}</div>}
    </section>
    <h2 className="text-lg font-semibold">Workout history</h2>
    {completed.map((workout) => { const stats = workoutStats(workout); return <article key={workout.id} className="rounded-2xl border border-white/10 bg-[#111] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold">{workout.name}</h3><p className="mt-1 text-xs text-zinc-500">{new Date(workout.completedAt!).toLocaleString()} · {stats.sets} sets · {Math.round(stats.volume)} {state.profile.units}</p></div><div className="flex shrink-0 gap-2"><button onClick={() => setSharing(workout)} className="grid size-10 place-items-center rounded-xl border border-white/10" aria-label={`Share ${workout.name} recap`}><Share2 className="size-4" /></button><button onClick={() => setPendingDelete(workout)} className="grid size-10 place-items-center rounded-xl border border-red-500/20 bg-red-500/5 text-red-400" aria-label={`Delete ${workout.name}`}><Trash2 className="size-4" /></button></div></div></article>; })}
    <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
      <DialogContent className="confirm-dialog max-w-[340px] p-0">
        <div className="confirm-dialog__body"><span className="confirm-dialog__icon"><TriangleAlert /></span><div className="pr-10"><p className="confirm-dialog__eyebrow">Remove workout</p><DialogTitle className="text-lg">Delete {pendingDelete?.name}?</DialogTitle><DialogDescription className="mt-2 leading-relaxed">This session and its recorded sets will be permanently removed from Progress.</DialogDescription></div></div>
        <div className="confirm-dialog__actions"><Button variant="secondary" onClick={() => setPendingDelete(null)}>Cancel</Button><Button variant="danger" onClick={deleteWorkout}><Trash2 className="size-4" />Delete</Button></div>
      </DialogContent>
    </Dialog>
    {sharing && <ShareRecap workout={sharing} profile={state.profile} onClose={() => setSharing(null)} />}
    {toast && <div className="program-toast" role="status" aria-live="polite"><CheckCircle2 /><span>{toast}</span></div>}
  </div>;
}
