"use client";

import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { exercises, weekdays } from "@/lib/data";
import type { Program, Routine } from "@/lib/types";
import { titleCase } from "@/lib/utils";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";

interface RoutineEditorProps {
  program: Program;
  routine: Routine;
  open: boolean;
  onOpenChange(value: boolean): void;
  onSave(program: Program): Promise<void>;
}

export function RoutineEditor({ program, routine, open, onOpenChange, onSave }: RoutineEditorProps) {
  const [name, setName] = useState(routine.name);
  const [weekday, setWeekday] = useState(routine.weekday);
  const [order, setOrder] = useState(routine.exercises.map((item) => item.exerciseId));
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return exercises.filter((exercise) => terms.every((term) => `${exercise.name} ${exercise.primaryMuscle} ${exercise.equipment}`.toLowerCase().includes(term)));
  }, [query]);

  const toggle = (id: string) => setOrder((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const move = (index: number, offset: number) => setOrder((items) => {
    const next = [...items];
    const target = index + offset;
    if (target < 0 || target >= next.length) return items;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  const save = async () => {
    const cleanName = name.trim().replace(/\s+/g, " ");
    if (cleanName.length < 2) return setError("Enter a workout name with at least 2 characters.");
    if (program.days.some((item) => item.id !== routine.id && item.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) return setError("This program already has a workout with that name.");

    setBusy(true);
    setError("");
    const previous = new Map(routine.exercises.map((item) => [item.exerciseId, item]));
    const nextRoutine = {
      ...routine,
      name: cleanName,
      weekday,
      exercises: order.map((exerciseId) => previous.get(exerciseId) ?? { exerciseId, sets: 3, minReps: 8, maxReps: 12 }),
      muscles: [...new Set(order.map((id) => exercises.find((exercise) => exercise.id === id)?.primaryMuscle).filter(Boolean))].map((item) => titleCase(String(item))),
    };
    try {
      await onSave({ ...program, days: program.days.map((item) => item.id === routine.id ? nextRoutine : item) });
      onOpenChange(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the workout. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <div className="grid max-h-[92dvh] grid-rows-[auto_auto_auto_minmax(90px,140px)_auto_minmax(110px,1fr)_auto] gap-3 p-5 pt-6">
        <div className="pr-12"><DialogTitle>Edit {name.trim() || "workout"}</DialogTitle><DialogDescription className="mt-1">Name your workout, choose its day, and set the exercise order.</DialogDescription></div>
        <label><span className="mb-1.5 block text-xs font-semibold text-zinc-400">Workout name</span><Input value={name} onChange={(event) => { setName(event.target.value); if (error) setError(""); }} placeholder="e.g. Push Day" maxLength={50} aria-invalid={Boolean(error)} />{error && <small role="alert" className="mt-1.5 block text-[11px] text-red-400">{error}</small>}</label>
        <label><span className="mb-1.5 block text-xs font-semibold text-zinc-400">Training day</span><select value={weekday} onChange={(event) => setWeekday(Number(event.target.value))} className="h-11 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm">{weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
        <section className="overflow-y-auto rounded-2xl border border-white/10 bg-black/25 p-3"><header className="mb-2 flex justify-between"><div><strong className="text-sm">Workout order</strong><p className="text-[10px] text-zinc-500">Use the controls to reorder</p></div><span className="rounded-full bg-zinc-900 px-2 py-1 text-[10px] text-zinc-400">{order.length} selected</span></header><div className="grid gap-1.5">{order.map((id, index) => { const exercise = exercises.find((item) => item.id === id)!; return <div key={id} className="grid grid-cols-[26px_1fr_auto] items-center gap-2 rounded-xl border border-white/10 bg-zinc-900 p-2"><span className="numeric text-[10px] text-zinc-500">{String(index + 1).padStart(2, "0")}</span><span className="truncate text-xs font-semibold">{exercise.name}</span><span className="flex gap-1"><button type="button" onClick={() => move(index, -1)} disabled={!index} className="grid size-8 place-items-center rounded-lg border border-white/10 disabled:opacity-20"><ArrowUp className="size-3.5" /></button><button type="button" onClick={() => move(index, 1)} disabled={index === order.length - 1} className="grid size-8 place-items-center rounded-lg border border-white/10 disabled:opacity-20"><ArrowDown className="size-3.5" /></button></span></div>; })}</div></section>
        <label className="relative"><Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-zinc-500" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exercises" className="pl-11" /></label>
        <section className="grid gap-1.5 overflow-y-auto">{filtered.map((exercise) => <label key={exercise.id} className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-zinc-900 px-3"><input type="checkbox" checked={order.includes(exercise.id)} onChange={() => toggle(exercise.id)} className="size-4 accent-white" /><span className="min-w-0"><strong className="block truncate text-xs">{exercise.name}</strong><small className="text-[10px] capitalize text-zinc-500">{exercise.primaryMuscle} · {exercise.equipment}</small></span></label>)}</section>
        <footer className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3"><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save} disabled={busy || !order.length || !name.trim()}>{busy ? "Saving…" : "Save changes"}</Button></footer>
      </div>
    </DialogContent>
  </Dialog>;
}
