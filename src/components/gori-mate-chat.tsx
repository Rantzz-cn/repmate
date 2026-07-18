"use client";

import Image from "next/image";
import { Dumbbell, Send, Sparkles, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRepMate } from "./providers/app-provider";

interface Message { id: string; role: "gori" | "user"; text: string }
const starter: Message = { id: "welcome", role: "gori", text: "Hey, I’m Gori Mate. Ask me about your program, workout, progress, or exercise setup." };
const prompts = ["What should I train?", "How is my progress?", "Motivate me"];

export function GoriMateChat() {
  const state = useRepMate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined") return [starter];
    try { const saved = localStorage.getItem("repmate-gori-chat"); return saved ? JSON.parse(saved) : [starter]; } catch { return [starter]; }
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { try { localStorage.setItem("repmate-gori-chat", JSON.stringify(messages.slice(-30))); } catch {} scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, open]);

  const reply = (question: string) => {
    const text = question.toLowerCase();
    const activeProgram = state.programs.find((program) => program.active) ?? state.programs[0];
    const completed = state.workouts.length;
    const volume = state.workouts.reduce((total, workout) => total + workout.exercises.flatMap((item) => item.sets).filter((set) => set.done).reduce((sum, set) => sum + set.weight * set.reps, 0), 0);
    if (/pain|hurt|injur|dizzy|chest pain/.test(text)) return "Stop if you feel sharp pain, dizziness, or unusual symptoms. I can offer general training guidance, but a healthcare professional should assess pain or injury.";
    if (/what.*train|today|next workout|routine/.test(text)) {
      if (state.activeWorkout) return `Your ${state.activeWorkout.name} workout is active. You’re on exercise ${state.activeWorkout.current + 1} of ${state.activeWorkout.exercises.length}.`;
      if (!activeProgram?.days.length) return "You don’t have a routine yet. Open Program to create one or use the starter plan.";
      const routine = activeProgram.days.find((day) => day.weekday === new Date().getDay());
      return routine ? `${routine.name} is scheduled today with ${routine.exercises.length} exercises. Start it from Dashboard or Program.` : `Today is a recovery day in ${activeProgram.name}. Your next listed session is ${activeProgram.days[0].name}.`;
    }
    if (/progress|volume|workout.*done|history/.test(text)) return completed ? `You’ve completed ${completed} workout${completed === 1 ? "" : "s"} and logged ${Math.round(volume).toLocaleString()} ${state.profile.units} of volume. Open Progress for the details.` : "Complete your first workout and I’ll help you interpret your training trend.";
    if (/form|technique|how.*do|exercise/.test(text)) return "Open the movement in the Exercise Library for its matching animation, body map, and form cues. Keep each rep controlled and stop if it causes pain.";
    if (/motivat|tired|lazy|skip/.test(text)) return completed ? `You’ve already logged ${completed} session${completed === 1 ? "" : "s"}. You don’t need a perfect workout today—start with the warm-up and earn the next set.` : "Start small: show up, warm up, and complete the first exercise. Momentum usually follows action.";
    if (/rest|timer/.test(text)) return "Use the programmed rest timer during workouts. It stays accurate when you return after switching apps or locking your phone.";
    return "I can help with your next workout, progress, exercise form, rest timer, or motivation. Try asking one of those directly.";
  };

  const send = (event?: FormEvent, preset?: string) => {
    event?.preventDefault();
    const question = (preset ?? input).trim();
    if (!question) return;
    setMessages((items) => [...items, { id: crypto.randomUUID(), role: "user", text: question }, { id: crypto.randomUUID(), role: "gori", text: reply(question) }]);
    setInput("");
  };

  return <>
    <button type="button" className="gori-chat-launcher" onClick={() => setOpen(true)} aria-label="Open Gori Mate coach"><Image src="/assets/images/gorillamate.webp" alt="" width={72} height={90} unoptimized /><span><b>Gori Mate</b><small>Ask your coach</small></span><Sparkles aria-hidden="true" /></button>
    {open && <div className="gori-chat-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section className="gori-chat" role="dialog" aria-modal="true" aria-labelledby="gori-chat-title"><header><div className="gori-chat__avatar"><Image src="/assets/images/gorillamate.webp" alt="" width={56} height={70} unoptimized /></div><div><h2 id="gori-chat-title">Gori Mate</h2><p><i /> RepMate training coach</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Close Gori Mate"><X /></button></header><div className="gori-chat__messages" ref={scrollRef}>{messages.map((message) => <div key={message.id} className={`gori-message is-${message.role}`}>{message.role === "gori" && <Dumbbell aria-hidden="true" />}<p>{message.text}</p></div>)}</div>{messages.length < 5 && <div className="gori-chat__prompts">{prompts.map((prompt) => <button type="button" key={prompt} onClick={() => send(undefined, prompt)}>{prompt}</button>)}</div>}<form onSubmit={send}><label className="sr-only" htmlFor="gori-message">Message Gori Mate</label><input id="gori-message" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about your training…" autoComplete="off" /><button type="submit" disabled={!input.trim()} aria-label="Send message"><Send /></button></form><small className="gori-chat__note">General fitness guidance, not medical advice.</small></section></div>}
  </>;
}
