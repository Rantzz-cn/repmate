export function newWorkout(program, day, exerciseMap) {
  return {
    id: `active`,
    sessionId: crypto.randomUUID(),
    programId: program.id,
    dayId: day.id,
    name: day.name,
    startedAt: new Date().toISOString(),
    current: 0,
    notes: '',
    exercises: day.exercises.map((x) => ({
      exerciseId: x.exerciseId,
      notes: '',
      sets: Array.from({ length: x.sets }, () => ({ weight: 0, reps: 0, rir: 2, done: false })),
      rest: exerciseMap.get(x.exerciseId)?.rest || 90,
      minReps: x.minReps,
      maxReps: x.maxReps,
    })),
  };
}
export function workoutStats(w) {
  const sets = w.exercises.flatMap((e) => e.sets).filter((s) => s.done);
  return {
    sets: sets.length,
    reps: sets.reduce((n, s) => n + Number(s.reps), 0),
    volume: sets.reduce((n, s) => n + Number(s.reps) * Number(s.weight), 0),
  };
}
export function overload(ex) {
  const done = ex.sets.filter((s) => s.done);
  if (!done.length) return 'Log working sets to receive a recommendation.';
  if (done.every((s) => s.reps >= ex.maxReps && s.rir >= 1))
    return 'All sets reached the top of the range. Consider the smallest weight increase next time.';
  if (done.filter((s) => s.reps < ex.minReps).length >= 2)
    return 'Reps fell below target. Consider a small load reduction next time.';
  return 'Performance is in range. Keep the same weight next session.';
}