"use client";

import { Building2, Check, ChevronLeft, Dumbbell, Flame, HeartPulse, Home, ShieldCheck, Target, TrendingUp, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { buildStarterProgram, weekdays, type OnboardingPreferences } from "@/lib/data";
import { useRepMate } from "./providers/app-provider";

const goals = [
  { value: "Build muscle", label: "Build muscle", copy: "Train for size and balanced development.", icon: Dumbbell },
  { value: "Get stronger", label: "Get stronger", copy: "Prioritize strength on compound lifts.", icon: TrendingUp },
  { value: "Improve fitness", label: "Improve fitness", copy: "Build a consistent, capable routine.", icon: HeartPulse },
  { value: "Lose body fat", label: "Lose body fat", copy: "Support an active, sustainable cut.", icon: Flame },
];
const experiences = [
  { value: "beginner", label: "Beginner", copy: "New or returning to structured training." },
  { value: "intermediate", label: "Intermediate", copy: "Training consistently for 6+ months." },
  { value: "advanced", label: "Advanced", copy: "Experienced with structured progression." },
] as const;
const setups = [
  { value: "gym", label: "Full gym", copy: "Machines, cables, barbells, and dumbbells.", icon: Building2 },
  { value: "home", label: "Home equipment", copy: "Dumbbells, a bench, or basic equipment.", icon: Home },
  { value: "bodyweight", label: "Bodyweight", copy: "Train with minimal or no equipment.", icon: UserRound },
] as const;

function readDraft() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("repmate:onboarding-draft") ?? "null"); } catch { return null; }
}

export function Onboarding() {
  const state = useRepMate();
  const [draft] = useState(readDraft);
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState(draft?.goal ?? "Build muscle");
  const [experience, setExperience] = useState<OnboardingPreferences["experience"]>(draft?.experience ?? "beginner");
  const [days, setDays] = useState<number[]>(Array.isArray(draft?.days) && draft.days.length >= 2 ? draft.days : [1, 3, 5]);
  const [setup, setSetup] = useState<OnboardingPreferences["setup"]>(draft?.setup ?? "gym");
  const [units, setUnits] = useState<"kg" | "lb">(draft?.units ?? state.profile.units);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const total = 4;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);
  useEffect(() => { localStorage.setItem("repmate:onboarding-draft", JSON.stringify({ goal, experience, days, setup, units })); }, [days, experience, goal, setup, units]);

  const toggleDay = (day: number) => setDays((current) => current.includes(day) ? current.length <= 2 ? current : current.filter((item) => item !== day) : current.length >= 6 ? current : [...current, day]);
  const finish = async () => {
    setBusy(true);
    setError("");
    try {
      await state.saveProgram(buildStarterProgram({ goal, experience, days, setup }));
      await state.saveProfile({ ...state.profile, goal, experience, trainingDays: days, trainingSetup: setup, units, onboardingComplete: true, starterProgramInitialized: true });
      localStorage.removeItem("repmate:onboarding-draft");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your setup could not be saved. Please try again.");
      setBusy(false);
    }
  };

  return <div className="onboarding-shell" role="dialog" aria-modal="true" aria-labelledby="onboarding-title"><main className="onboarding-card">
    <header className="onboarding-head"><div><p className="eyebrow">Set up RepMate</p><span>{step + 1} of {total}</span></div><div className="onboarding-progress" aria-label={`Step ${step + 1} of ${total}`}>{Array.from({ length: total }, (_, index) => <i key={index} className={index <= step ? "is-complete" : ""} />)}</div></header>
    <section className="onboarding-content">
      {step === 0 && <><OnboardingTitle icon={Target} title="What are you training for?" copy="Your goal shapes your starter program and recommendations."/><div className="onboarding-options">{goals.map(({ value, label, copy, icon: Icon }) => <Option key={value} selected={goal === value} icon={Icon} label={label} copy={copy} onClick={() => setGoal(value)}/>)}</div></>}
      {step === 1 && <><OnboardingTitle icon={ShieldCheck} title="What is your experience?" copy="We will use this to choose a manageable starting volume."/><div className="onboarding-options onboarding-options--simple">{experiences.map(({ value, label, copy }) => <Option key={value} selected={experience === value} label={label} copy={copy} onClick={() => setExperience(value)}/>)}</div></>}
      {step === 2 && <><OnboardingTitle icon={Dumbbell} title="When can you train?" copy="Select between two and six regular training days."/><div className="onboarding-days">{weekdays.map((name, index) => <button key={name} className={days.includes(index) ? "is-selected" : ""} onClick={() => toggleDay(index)} aria-pressed={days.includes(index)}><span>{name.slice(0, 3)}</span><small>{name}</small>{days.includes(index) && <Check/>}</button>)}</div><p className="onboarding-hint">{days.length} training days selected</p></>}
      {step === 3 && <><OnboardingTitle icon={Building2} title="Where do you train?" copy="RepMate will choose exercises that fit your setup."/><div className="onboarding-options">{setups.map(({ value, label, copy, icon: Icon }) => <Option key={value} selected={setup === value} icon={Icon} label={label} copy={copy} onClick={() => setSetup(value)}/>)}</div><div className="onboarding-units"><span>Preferred unit</span><div><button className={units === "kg" ? "is-selected" : ""} onClick={() => setUnits("kg")}>Kilograms</button><button className={units === "lb" ? "is-selected" : ""} onClick={() => setUnits("lb")}>Pounds</button></div></div></>}
    </section>
    {error && <p className="onboarding-error" role="alert">{error}</p>}
    <footer className="onboarding-actions"><button className="onboarding-back" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || busy}><ChevronLeft/><span>Back</span></button>{step < total - 1 ? <button className="onboarding-next" onClick={() => setStep((current) => current + 1)}>Continue</button> : <button className="onboarding-next" onClick={finish} disabled={busy}>{busy ? "Creating your plan…" : "Create my plan"}</button>}</footer>
  </main></div>;
}

function OnboardingTitle({ icon: Icon, title, copy }: { icon: typeof Target; title: string; copy: string }) { return <div className="onboarding-title"><span><Icon/></span><div><h1 id="onboarding-title">{title}</h1><p>{copy}</p></div></div>; }
function Option({ selected, icon: Icon, label, copy, onClick }: { selected: boolean; icon?: typeof Target; label: string; copy: string; onClick(): void }) { return <button className={selected ? "is-selected" : ""} onClick={onClick}>{Icon && <span><Icon/></span>}<div><strong>{label}</strong><small>{copy}</small></div>{selected && <Check/>}</button>; }
