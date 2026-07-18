"use client";
import Image from "next/image";
import Link from "next/link";
import { BarChart3, BatteryCharging, CalendarPlus, Dumbbell, Gauge, Moon, Zap } from "lucide-react";
import { useRepMate } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { exercises } from "@/lib/data";
import { createWorkout, workoutStats } from "@/lib/workouts";
import { saveRecord } from "@/lib/repository";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Readiness = "great" | "okay" | "sore";
const readinessOptions = [
  { level: "great" as const, icon: Zap, label: "Great", copy: "High energy", feedback: "You are ready to train with intent." },
  { level: "okay" as const, icon: Gauge, label: "Okay", copy: "Usual pace", feedback: "Follow the plan and adjust when needed." },
  { level: "sore" as const, icon: Moon, label: "Sore", copy: "Take it easy", feedback: "Reduce intensity and prioritize recovery." },
];

export default function TodayPage() {
  const state = useRepMate();
  const [now] = useState(() => Date.now());
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const router = useRouter();
  const readinessDate = new Date(now).toISOString().slice(0, 10);
  const activeProgram = state.programs.find((p) => p.active);
  const today = activeProgram?.days.find((day) => day.weekday === new Date().getDay());
  const recent = [...state.workouts].filter((w) => w.completedAt).sort((a,b) => Date.parse(b.completedAt!)-Date.parse(a.completedAt!))[0];
  const weekly = state.workouts.filter((w) => w.completedAt && now-Date.parse(w.completedAt)<604800000);
  const volume = weekly.reduce((sum,w) => sum+workoutStats(w).volume,0);
  const start = async () => { if (!activeProgram || !today) return; await state.setActive(createWorkout(activeProgram,today)); router.push("/app/workout"); };
  useEffect(() => {
    const saved = localStorage.getItem(`readiness:${readinessDate}`) as Readiness | null;
    if (saved && readinessOptions.some((option) => option.level === saved)) queueMicrotask(() => setReadiness(saved));
  }, [readinessDate]);
  const chooseReadiness = async (level: Readiness) => {
    setReadiness(level);
    localStorage.setItem(`readiness:${readinessDate}`, level);
    await saveRecord("recovery", { id: readinessDate, level, recordedAt: new Date().toISOString() });
  };
  if (state.loading) return null;
  return <div className="app-page">
    <header><p className="eyebrow">{new Intl.DateTimeFormat(undefined,{weekday:"long",month:"long",day:"numeric"}).format(new Date())}</p><h1 className="display page-title mt-2">Hi, {state.profile.name}</h1></header>
    <section className="flex min-h-36 items-end overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#181818] to-[#0d0d0d] px-5">
      <Image src="/assets/images/repmate.webp" width={140} height={150} alt="RepMate coach" className="h-32 w-28 object-contain object-bottom"/>
      <div className="relative mb-7 ml-2 flex-1 rounded-2xl bg-white p-4 text-black before:absolute before:-left-2 before:bottom-5 before:size-4 before:rotate-45 before:bg-white"><p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">RepMate</p><p className="mt-1 text-sm font-medium">{state.activeWorkout?`Your ${state.activeWorkout.name} session is waiting.`:today?`${today.name} is ready when you are.`:"Recovery is part of the work."}</p></div>
    </section>
    {state.activeWorkout ? <section className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#121212] p-4"><div><p className="eyebrow">Active workout</p><h2 className="mt-1 text-xl font-semibold">{state.activeWorkout.name}</h2><p className="text-xs text-zinc-500">{state.activeWorkout.current+1} of {state.activeWorkout.exercises.length} exercises</p></div><Link href="/app/workout" className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-semibold text-black">Resume</Link></section> : today ? <section className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#121212] p-4"><div className="grid size-12 place-items-center rounded-xl bg-white text-black"><Dumbbell className="size-5"/></div><div className="min-w-0 flex-1"><p className="eyebrow">Today&apos;s plan</p><h2 className="text-lg font-semibold">{today.name}</h2><p className="truncate text-xs text-zinc-500">{today.exercises.length} exercises · {today.muscles.join(", ")}</p></div><Button onClick={start}>Start</Button></section> : <section className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#121212] p-4"><div className="grid size-12 place-items-center rounded-xl bg-zinc-900"><CalendarPlus className="size-5"/></div><div className="flex-1"><p className="text-sm font-semibold">No workout scheduled</p><p className="text-xs text-zinc-500">Choose a program and training day.</p></div><Link href="/app/programs" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 bg-zinc-900 px-4 text-sm font-semibold">Plan</Link></section>}
    <section className="dashboard-shortcuts" aria-label="Training overview">
      <Link href="/app/progress" className="dashboard-shortcut dashboard-shortcut--progress">
        <span className="dashboard-shortcut__icon"><BarChart3 /></span>
        <div className="dashboard-shortcut__copy"><small>This week</small><h2>Progress</h2><p>Review your completed training.</p></div>
        <div className="dashboard-shortcut__metrics"><span><b className="numeric">{volume.toLocaleString()}</b> {state.profile.units}</span><span><b className="numeric">{weekly.length}</b> sessions</span></div>
        <span className="dashboard-shortcut__action">View progress</span>
      </Link>
      <Link href="/app/exercises" className="dashboard-shortcut dashboard-shortcut--exercises">
        <span className="dashboard-shortcut__icon"><Dumbbell /></span>
        <div className="dashboard-shortcut__copy"><small>Exercise library</small><h2>{exercises.length} movements</h2><p>Explore form guides and muscle targets.</p></div>
        <span className="dashboard-shortcut__action">Browse</span>
      </Link>
    </section>
    <div className="flex items-end justify-between"><h2 className="text-lg font-semibold">How are you feeling?</h2><span className="text-xs text-zinc-500">Today</span></div>
    <section className="readiness-card rounded-2xl border border-white/10 bg-[#101010] p-2"><div className="grid grid-cols-3 gap-2">{readinessOptions.map(({level,icon:Icon,label,copy})=><button type="button" key={level} aria-pressed={readiness===level} onClick={()=>chooseReadiness(level)} className={`readiness-choice rounded-xl border p-3 text-left transition ${readiness===level?"is-selected":"border-transparent"}`}><Icon className="mb-3 size-4 text-zinc-400"/><strong className="block text-xs">{label}</strong><small className="text-[10px] text-zinc-500">{copy}</small></button>)}</div>{readiness&&<p className="readiness-feedback" role="status">{readinessOptions.find((option)=>option.level===readiness)?.feedback}</p>}</section>
    <h2 className="text-lg font-semibold">Recent workout</h2>{recent?<Link href="/app/progress" className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#101010] p-4"><div><strong>{recent.name}</strong><p className="text-xs text-zinc-500">{new Date(recent.completedAt!).toLocaleDateString()} · {Math.round((recent.duration||0)/60)} min</p></div><BatteryCharging className="size-5 text-zinc-500"/></Link>:<div className="rounded-2xl border border-dashed border-white/10 p-7 text-center text-sm text-zinc-500">Your completed workouts will appear here.</div>}
  </div>;
}
