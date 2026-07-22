"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BadgeInfo } from "lucide-react";
import { BodyMap } from "@/components/body-map";
import { exercises } from "@/lib/data";

export function ExerciseDetails({ id }: { id: string }) {
  const exercise = exercises.find((entry) => entry.id === id);
  if (!exercise) return <div className="app-page"><p>Exercise not found.</p><Link href="/app/exercises">Back to exercises</Link></div>;
  return <div className="app-page">
    <header className="grid grid-cols-[48px_1fr_48px] items-center"><Link href="/app/exercises" className="grid size-12 place-items-center rounded-full border border-white/10 bg-[#181818]" aria-label="Back to exercises"><ArrowLeft className="size-5" /></Link><span className="text-center text-xs font-bold uppercase tracking-widest text-zinc-500">Exercise</span></header>
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#111] p-4"><p className="eyebrow capitalize">{exercise.primaryMuscle}</p><h1 className="numeric mt-2 text-3xl leading-tight">{exercise.name}</h1><p className="mt-1 text-sm capitalize text-zinc-400">{exercise.equipment} · {exercise.repRange} reps</p><div className="mt-5 grid h-72 place-items-center overflow-hidden rounded-2xl bg-white"><Image src={exercise.animation} width={500} height={400} unoptimized alt={`${exercise.name} demonstration`} className="h-full w-full object-contain" onError={(event) => { event.currentTarget.src = "/assets/images/fallback.webp"; }} /></div></section>
    <BodyMap exercise={exercise} />
    <section className="rounded-3xl border border-white/10 bg-[#111] p-5"><div className="flex items-center gap-2"><BadgeInfo className="size-4 text-zinc-400" /><h2 className="font-semibold">Form cues</h2></div><ul className="mt-4 grid gap-3 text-sm text-zinc-400"><li>Brace your core before every repetition.</li><li>Use a controlled range of motion.</li><li>Keep your joints stacked and avoid momentum.</li></ul><p className="mt-5 text-xs text-zinc-600">Animation demonstrates the movement pattern. Adjust setup to your body and available equipment.</p></section>
    <Link href="/app/exercises" className="flex min-h-13 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-black">Back to exercises</Link>
  </div>;
}
