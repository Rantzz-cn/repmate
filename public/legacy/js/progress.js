import { workoutStats } from './workout.js';
export function aggregate(workouts) {
  const complete = workouts.filter((w) => w.completedAt),
    all = complete.map(workoutStats);
  return {
    workouts: complete.length,
    sets: all.reduce((n, x) => n + x.sets, 0),
    reps: all.reduce((n, x) => n + x.reps, 0),
    volume: all.reduce((n, x) => n + x.volume, 0),
    duration: complete.length
      ? Math.round(complete.reduce((n, w) => n + (w.duration || 0), 0) / complete.length / 60)
      : 0,
  };
}
export function drawChart(canvas, values) {
  const dpr = devicePixelRatio || 1,
    w = canvas.clientWidth,
    h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const c = canvas.getContext('2d');
  c.scale(dpr, dpr);
  c.clearRect(0, 0, w, h);
  if (values.length < 2) return;
  const max = Math.max(...values, 1),
    min = Math.min(...values, 0);
  c.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--text');
  c.lineWidth = 3;
  c.beginPath();
  values.forEach((v, i) => {
    const x = 10 + (i * (w - 20)) / (values.length - 1),
      y = h - 15 - ((v - min) / (max - min || 1)) * (h - 30);
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  });
  c.stroke();
}