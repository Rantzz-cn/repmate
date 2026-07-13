import { STORES, getAll, put, clear } from './db.js';
export async function exportData() {
  const data = { version: 1, exportedAt: new Date().toISOString(), stores: {} };
  for (const s of STORES) data.stores[s] = await getAll(s);
  return data;
}
export async function importData(data) {
  if (!data?.stores) throw new Error('This is not a RepMate backup.');
  for (const s of STORES) {
    await clear(s);
    for (const row of data.stores[s] || []) await put(s, row);
  }
}
export async function resetData() {
  for (const s of STORES) await clear(s);
  localStorage.clear();
}