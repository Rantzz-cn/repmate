"use client";

import { Download, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { exercises } from "@/lib/data";
import type { Profile, Workout } from "@/lib/types";
import { workoutStats } from "@/lib/workouts";

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

async function createRecap(workout: Workout, profile: Profile) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const stats = workoutStats(workout);
  canvas.width = 1080;
  canvas.height = 1920;
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, 1080, 1920);
  ctx.strokeStyle = "#191919";
  ctx.lineWidth = 1;
  for (let x = 0; x < 1080; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1920); ctx.stroke(); }
  for (let y = 0; y < 1920; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1080, y); ctx.stroke(); }

  try {
    const logo = await loadImage("/assets/images/whitelogo.png");
    ctx.drawImage(logo, 70, 65, 310, 90);
  } catch {}
  ctx.fillStyle = "#888";
  ctx.font = "700 26px Arial";
  ctx.fillText("WORKOUT RECAP", 770, 110);

  if (workout.photo) {
    try {
      const photo = await loadImage(workout.photo);
      const scale = Math.max(940 / photo.width, 900 / photo.height);
      const width = photo.width * scale;
      const height = photo.height * scale;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(70, 210, 940, 900, 34);
      ctx.clip();
      ctx.drawImage(photo, 70 + (940 - width) / 2, 210 + (900 - height) / 2, width, height);
      ctx.restore();
    } catch {}
  } else {
    ctx.fillStyle = "#fff";
    ctx.fillRect(70, 210, 940, 900);
    try {
      const logo = await loadImage("/assets/images/logo.png");
      const scale = Math.min(460 / logo.width, 300 / logo.height);
      ctx.drawImage(logo, 540 - logo.width * scale / 2, 660 - logo.height * scale / 2, logo.width * scale, logo.height * scale);
    } catch {}
  }

  ctx.fillStyle = "#999";
  ctx.font = "700 24px Arial";
  ctx.fillText("REPMATE · WORKOUT COMPLETE", 70, 1180);
  ctx.fillStyle = "#fff";
  ctx.font = "700 88px Arial";
  ctx.fillText(workout.name.toUpperCase(), 70, 1280);
  ctx.fillStyle = "#999";
  ctx.font = "600 26px Arial";
  ctx.fillText(new Date(workout.completedAt!).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }).toUpperCase(), 70, 1330);

  const metrics = [
    [`${Math.max(1, Math.round((workout.duration ?? 0) / 60))} MIN`, "DURATION"],
    [`${Math.round(stats.volume).toLocaleString()} ${profile.units.toUpperCase()}`, "VOLUME"],
    [String(stats.sets), "SETS"],
  ];
  metrics.forEach(([value, label], index) => {
    const x = 70 + index * 315;
    ctx.fillStyle = "#777";
    ctx.font = "700 20px Arial";
    ctx.fillText(label, x, 1410);
    ctx.fillStyle = "#fff";
    ctx.font = "700 38px Arial";
    ctx.fillText(value, x, 1460);
  });
  ctx.strokeStyle = "#292929";
  ctx.beginPath();
  ctx.moveTo(70, 1510);
  ctx.lineTo(1010, 1510);
  ctx.stroke();
  workout.exercises.slice(0, 5).forEach((item, index) => {
    const exercise = exercises.find((entry) => entry.id === item.exerciseId);
    const volume = item.sets.filter((set) => set.done).reduce((sum, set) => sum + set.weight * set.reps, 0);
    const y = 1580 + index * 58;
    ctx.fillStyle = "#fff";
    ctx.font = "600 25px Arial";
    ctx.fillText(exercise?.name ?? "Exercise", 70, y);
    ctx.fillStyle = "#888";
    ctx.textAlign = "right";
    ctx.fillText(`${Math.round(volume)} ${profile.units.toUpperCase()}`, 1010, y);
    ctx.textAlign = "left";
  });
  ctx.fillStyle = "#666";
  ctx.font = "600 19px Arial";
  ctx.fillText("BUILT WITH REPMATE", 70, 1860);
  return canvas.toDataURL("image/png");
}

export function ShareRecap({ workout, profile, onClose }: { workout: Workout | null; profile: Profile; onClose(): void }) {
  const [image, setImage] = useState("");
  useEffect(() => {
    if (!workout) return;
    let cancelled = false;
    void createRecap(workout, profile).then((result) => { if (!cancelled) setImage(result); });
    return () => { cancelled = true; };
  }, [profile, workout]);
  if (!workout) return null;
  const save = () => {
    const link = document.createElement("a");
    link.href = image;
    link.download = `repmate-${workout.name.toLowerCase().replace(/\W+/g, "-")}.png`;
    link.click();
  };
  const share = async () => {
    const blob = await (await fetch(image)).blob();
    const file = new File([blob], "repmate-workout.png", { type: "image/png" });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) await navigator.share({ title: `${workout.name} workout`, files: [file] });
    else save();
  };
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="overflow-y-auto p-5"><DialogTitle>Your workout recap</DialogTitle><DialogDescription className="mt-1">Ready for Instagram and Facebook stories.</DialogDescription>{image ? <img src={image} alt="RepMate workout recap" className="mx-auto mt-4 max-h-[62dvh] rounded-2xl border border-white/10" /> : <div className="numeric grid h-72 place-items-center text-zinc-600">Building recap</div>}<div className="mt-4 grid grid-cols-2 gap-2"><Button variant="secondary" onClick={save} disabled={!image}><Download className="size-4" />Save image</Button><Button onClick={share} disabled={!image}><Share2 className="size-4" />Share</Button><Button variant="ghost" className="col-span-2" onClick={onClose}>Done</Button></div></DialogContent></Dialog>;
}
