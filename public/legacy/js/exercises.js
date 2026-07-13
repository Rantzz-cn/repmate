export function filterExercises(items, { q = '', muscle = '', equipment = '' }) {
  q = q.toLowerCase();
  return items.filter(
    (x) =>
      (!q || x.name.toLowerCase().includes(q)) &&
      (!muscle || x.primaryMuscle === muscle) &&
      (!equipment || x.equipment === equipment),
  );
}
export function alternatives(current, items) {
  return items
    .filter((x) => x.id !== current.id)
    .map((x) => ({
      item: x,
      score:
        (x.primaryMuscle === current.primaryMuscle) * 4 +
        (x.movement === current.movement) * 3 +
        (x.equipment === current.equipment) * 2 +
        (x.type === current.type),
    }))
    .filter((x) => x.score >= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}