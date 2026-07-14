"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Pencil, Play, Plus, Trash2, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useRepMate } from "@/components/providers/app-provider";
import { RoutineEditor } from "@/components/routine-editor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { weekdays } from "@/lib/data";
import type { Program, Routine } from "@/lib/types";
import { createWorkout } from "@/lib/workouts";

export default function ProgramsPage() {
  const state = useRepMate();
  const router = useRouter();
  const [editing, setEditing] = useState<{ program: Program; routine: Routine } | null>(null);
  const [toast, setToast] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Program | null>(null);
  const [pendingRoutineDelete, setPendingRoutineDelete] = useState<{ program: Program; routine: Routine } | null>(null);
  const toastTimer = useRef<number | null>(null);

  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2800);
  };

  const create = async () => {
    const id = crypto.randomUUID();
    await state.saveProgram({ id, name: "My Program", split: "Custom", active: !state.programs.length, days: [] });
    notify("New program created.");
  };

  const addRoutine = async (program: Program) => {
    const routine: Routine = { id: crypto.randomUUID(), name: `Workout ${program.days.length + 1}`, weekday: 1, muscles: [], exercises: [] };
    const updated = { ...program, days: [...program.days, routine] };
    await state.saveProgram(updated);
    setEditing({ program: updated, routine });
    notify("Routine added. Choose its exercises.");
  };

  const saveRoutine = async (program: Program) => {
    await state.saveProgram(program);
    notify("Routine changes saved.");
  };

  const copyProgram = async (program: Program) => {
    await state.saveProgram({ ...program, id: crypto.randomUUID(), name: `${program.name} Copy`, active: false });
    notify(`${program.name} copied.`);
  };

  const activateProgram = async (program: Program) => {
    await Promise.all(state.programs.map((item) => state.saveProgram({ ...item, active: item.id === program.id })));
    notify(`${program.name} is now active.`);
  };

  const deleteProgram = async () => {
    if (!pendingDelete) return;
    const name = pendingDelete.name;
    await state.removeProgram(pendingDelete.id);
    setPendingDelete(null);
    notify(`${name} deleted.`);
  };

  const deleteRoutine = async () => {
    if (!pendingRoutineDelete) return;
    const { program, routine } = pendingRoutineDelete;
    await state.saveProgram({ ...program, days: program.days.filter((item) => item.id !== routine.id) });
    setPendingRoutineDelete(null);
    notify(`${routine.name} removed from ${program.name}.`);
  };

  const start = async (program: Program, routine: Routine) => {
    await state.setActive(createWorkout(program, routine));
    router.push("/app/workout");
  };

  return <div className="app-page">
    <PageHeader eyebrow="Plan your training" title="Program" action={<Button onClick={create} variant="secondary"><Plus className="size-4" />New</Button>} />
    <div className="program-list">
      {state.programs.map((program) => <section key={program.id} className="program-card-native">
        <header className="program-card-native__head"><div><p className="eyebrow">{program.split}</p><h2>{program.name}</h2></div><span className="program-status">{program.active ? "Active" : "Inactive"}</span></header>
        <div className="program-days">
          {program.days.map((routine, index) => <article key={routine.id} className="program-day-native">
            <span className="program-day-native__number numeric">{String(index + 1).padStart(2, "0")}</span>
            <div className="program-day-native__copy"><h3>{routine.name}</h3><p>{routine.exercises.length} exercises · {weekdays[routine.weekday]} · {routine.muscles.join(", ")}</p></div>
            <div className="program-day-native__actions"><button onClick={() => setEditing({ program, routine })} className="program-icon-action" aria-label={`Edit ${routine.name}`} title="Edit routine"><Pencil /></button><button onClick={() => setPendingRoutineDelete({ program, routine })} className="program-icon-action program-icon-action--danger" aria-label={`Delete ${routine.name}`} title="Delete routine"><Trash2 /></button><button disabled={!routine.exercises.length} onClick={() => start(program, routine)} className="program-icon-action program-icon-action--start" aria-label={`Start ${routine.name}`} title="Start workout"><Play /></button></div>
          </article>)}
          <button onClick={() => addRoutine(program)} className="program-add-routine"><Plus />Add routine</button>
        </div>
        <footer className="program-card-native__footer"><Button variant="secondary" onClick={() => copyProgram(program)}><Copy className="size-4" />Copy plan</Button>{!program.active && <Button variant="secondary" onClick={() => activateProgram(program)}>Activate</Button>}<Button variant="danger" onClick={() => setPendingDelete(program)}><Trash2 className="size-4" />Delete</Button></footer>
      </section>)}
    </div>
    {editing && <RoutineEditor key={editing.routine.id} program={editing.program} routine={editing.routine} open onOpenChange={(open) => !open && setEditing(null)} onSave={saveRoutine} />}
    <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
      <DialogContent className="confirm-dialog max-w-[340px] p-0">
        <div className="confirm-dialog__body"><span className="confirm-dialog__icon"><TriangleAlert /></span><div className="pr-10"><p className="confirm-dialog__eyebrow">Remove program</p><DialogTitle className="text-lg">Delete {pendingDelete?.name}?</DialogTitle><DialogDescription className="mt-2 leading-relaxed">The program and its routines will be removed. Completed workouts will stay in Progress.</DialogDescription></div></div>
        <div className="confirm-dialog__actions"><Button variant="secondary" onClick={() => setPendingDelete(null)}>Cancel</Button><Button variant="danger" onClick={deleteProgram}><Trash2 className="size-4" />Delete</Button></div>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(pendingRoutineDelete)} onOpenChange={(open) => !open && setPendingRoutineDelete(null)}>
      <DialogContent className="confirm-dialog max-w-[340px] p-0">
        <div className="confirm-dialog__body"><span className="confirm-dialog__icon"><TriangleAlert /></span><div className="pr-10"><p className="confirm-dialog__eyebrow">Remove routine</p><DialogTitle className="text-lg">Delete {pendingRoutineDelete?.routine.name}?</DialogTitle><DialogDescription className="mt-2 leading-relaxed">Its exercise setup will be removed from {pendingRoutineDelete?.program.name}. Completed workouts will stay in Progress.</DialogDescription></div></div>
        <div className="confirm-dialog__actions"><Button variant="secondary" onClick={() => setPendingRoutineDelete(null)}>Cancel</Button><Button variant="danger" onClick={deleteRoutine}><Trash2 className="size-4" />Delete</Button></div>
      </DialogContent>
    </Dialog>
    {toast && <div className="program-toast" role="status" aria-live="polite"><CheckCircle2 aria-hidden="true" /><span>{toast}</span></div>}
  </div>;
}
