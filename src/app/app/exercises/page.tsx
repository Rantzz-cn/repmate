"use client";

import Image from "next/image";
import Link from "next/link";
import { Search, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { FocusBackButton } from "@/components/focus-back-button";
import { PageHeader } from "@/components/page-header";
import { exercises } from "@/lib/data";
import { titleCase } from "@/lib/utils";

export default function ExercisesPage() {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState("all");
  const [equipment, setEquipment] = useState("all");
  const filtered = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return exercises.filter((exercise) => words.every((word) => `${exercise.name} ${exercise.primaryMuscle} ${exercise.secondaryMuscles.join(" ")} ${exercise.equipment}`.toLowerCase().includes(word)) && (muscle === "all" || exercise.primaryMuscle === muscle || exercise.secondaryMuscles.includes(muscle as never)) && (equipment === "all" || exercise.equipment === equipment));
  }, [equipment, muscle, query]);

  return <div className="app-page focus-page">
    <FocusBackButton />
    <PageHeader eyebrow={`${exercises.length} movements`} title="Exercises" />
    <label className="relative"><Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-zinc-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="h-14 w-full rounded-2xl border border-white/10 bg-[#181818] pl-12 pr-4 outline-none focus:border-white/30" placeholder="Search exercises" /></label>
    <div className="grid grid-cols-2 gap-2"><select value={muscle} onChange={(event) => setMuscle(event.target.value)} className="h-12 rounded-2xl border border-white/10 bg-[#181818] px-3"><option value="all">All muscles</option>{[...new Set(exercises.map((exercise) => exercise.primaryMuscle))].map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select><select value={equipment} onChange={(event) => setEquipment(event.target.value)} className="h-12 rounded-2xl border border-white/10 bg-[#181818] px-3"><option value="all">All equipment</option>{[...new Set(exercises.map((exercise) => exercise.equipment))].map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></div>
    <div className="grid gap-3 lg:grid-cols-2">{filtered.map((exercise) => <Link href={`/app/exercises/${exercise.id}`} key={exercise.id} className="group overflow-hidden rounded-3xl border border-white/10 bg-[#111] transition hover:border-white/25"><div className="relative grid h-52 place-items-center overflow-hidden bg-white"><Image src={exercise.animation} alt={`${exercise.name} animated form`} width={420} height={260} unoptimized className="h-full w-full object-contain" onError={(event) => { event.currentTarget.src = "/assets/images/fallback.webp"; }} /><span className="absolute right-3 top-3 grid size-10 place-items-center rounded-xl bg-black/75"><Star className="size-4" /></span></div><div className="p-4"><p className="eyebrow">{titleCase(exercise.equipment)} · {exercise.repRange}</p><h2 className="mt-1 text-lg font-semibold">{exercise.name}</h2><div className="mt-3 flex gap-2 text-[10px] capitalize text-zinc-400"><span className="rounded-full border border-white/10 px-2 py-1">{exercise.primaryMuscle}</span>{exercise.secondaryMuscles.slice(0, 2).map((target) => <span key={target} className="rounded-full border border-white/10 px-2 py-1">{target}</span>)}</div></div></Link>)}{!filtered.length && <div className="col-span-full rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-500">No exercises match those filters.</div>}</div>
    <aside className="fixed bottom-6 right-4 z-30 flex items-end"><div className="mr-[-10px] max-w-44 rounded-2xl bg-white p-3 text-black shadow-xl"><p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Gori Mate</p><p className="text-[11px]">Small improvements become serious progress.</p></div><Image src="/assets/images/gorillamate.png" width={82} height={100} alt="Gori Mate" className="h-24 w-20 object-contain object-bottom" /></aside>
  </div>;
}
