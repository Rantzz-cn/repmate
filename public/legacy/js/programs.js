export const activeProgram = (items) => items.find((x) => x.active) || items[0];
export function scheduledDay(program, date = new Date()) {
  return program?.days.find((d) => d.weekday === date.getDay()) || null;
}