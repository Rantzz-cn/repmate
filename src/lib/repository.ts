"use client";

import { supabase } from "./supabase";
import type { StoreName } from "./types";

interface CacheRecord<T = unknown> { key: string; userId: string; store: StoreName; recordId: string; data: T; updatedAt: string }
interface OutboxRecord<T = unknown> extends CacheRecord<T> { operation: "put" | "delete"; attempts?: number; lastError?: string }
export type SyncPhase = "offline" | "pending" | "syncing" | "synced" | "error";
export interface SyncSnapshot { phase: SyncPhase; pending: number; lastSyncedAt: string | null; error: string | null }

const DB = "repmate-next-offline";
const VERSION = 1;
const listeners = new Set<(snapshot: SyncSnapshot) => void>();
let snapshot: SyncSnapshot = { phase: "synced", pending: 0, lastSyncedAt: null, error: null };
let activeSync: Promise<SyncSnapshot> | null = null;

function publish(patch: Partial<SyncSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener(snapshot));
}

export function getSyncSnapshot() { return snapshot; }
export function subscribeSync(listener: (snapshot: SyncSnapshot) => void) { listeners.add(listener); listener(snapshot); return () => listeners.delete(listener); }

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("records")) request.result.createObjectStore("records", { keyPath: "key" });
      if (!request.result.objectStoreNames.contains("outbox")) request.result.createObjectStore("outbox", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idb<T>(storeName: "records" | "outbox", mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

const all = <T>(store: "records" | "outbox") => idb<T[]>(store, "readonly", (objectStore) => objectStore.getAll());
const write = <T extends { key: string }>(store: "records" | "outbox", value: T) => idb<IDBValidKey>(store, "readwrite", (objectStore) => objectStore.put(value));
const drop = (store: "records" | "outbox", key: string) => idb<undefined>(store, "readwrite", (objectStore) => objectStore.delete(key));
const cacheKey = (userId: string, store: StoreName, id: string) => `${userId}|${store}|${id}`;

async function userId() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sign in required");
  return data.session.user.id;
}

async function pendingFor(userId: string) {
  return (await all<OutboxRecord>("outbox")).filter((item) => item.userId === userId);
}

async function updatePendingState(userId: string, preferred?: SyncPhase) {
  const pending = (await pendingFor(userId)).length;
  const phase = !navigator.onLine ? "offline" : preferred ?? (pending ? "pending" : "synced");
  publish({ phase, pending, error: phase === "error" ? snapshot.error : null });
}

export async function syncOutbox({ force = false }: { force?: boolean } = {}): Promise<SyncSnapshot> {
  if (activeSync && !force) return activeSync;
  activeSync = (async () => {
    const uid = await userId();
    const pending = await pendingFor(uid);
    if (!navigator.onLine) {
      publish({ phase: "offline", pending: pending.length, error: null });
      return snapshot;
    }
    if (!pending.length) {
      publish({ phase: "synced", pending: 0, error: null });
      return snapshot;
    }
    publish({ phase: "syncing", pending: pending.length, error: null });
    let failed = 0;
    let lastError = "";
    for (const item of pending) {
      try {
        const query = item.operation === "put"
          ? supabase.from("app_data").upsert({ user_id: uid, store: item.store, record_id: item.recordId, data: item.data, updated_at: item.updatedAt }, { onConflict: "user_id,store,record_id" })
          : supabase.from("app_data").delete().eq("user_id", uid).eq("store", item.store).eq("record_id", item.recordId);
        const { error } = await query;
        if (error) throw error;
        await drop("outbox", item.key);
      } catch (error) {
        failed += 1;
        lastError = error instanceof Error ? error.message : "Sync failed";
        await write("outbox", { ...item, attempts: (item.attempts ?? 0) + 1, lastError });
      }
    }
    const remaining = await pendingFor(uid);
    publish({ phase: failed ? "error" : "synced", pending: remaining.length, lastSyncedAt: failed ? snapshot.lastSyncedAt : new Date().toISOString(), error: failed ? lastError : null });
    return snapshot;
  })();
  try { return await activeSync; } finally { activeSync = null; }
}

async function reconcileStore<T>(uid: string, store: StoreName, rows: Array<{ record_id: string; data: T; updated_at: string }>) {
  const remoteKeys = new Set(rows.map((row) => cacheKey(uid, store, row.record_id)));
  const pendingKeys = new Set((await pendingFor(uid)).map((item) => item.key));
  for (const row of rows) {
    const key = cacheKey(uid, store, row.record_id);
    if (!pendingKeys.has(key)) await write("records", { key, userId: uid, store, recordId: row.record_id, data: row.data, updatedAt: row.updated_at });
  }
  const cached = (await all<CacheRecord<T>>("records")).filter((item) => item.userId === uid && item.store === store);
  for (const item of cached) if (!remoteKeys.has(item.key) && !pendingKeys.has(item.key)) await drop("records", item.key);
}

export async function listRecords<T>(store: StoreName): Promise<T[]> {
  const uid = await userId();
  if (navigator.onLine) {
    await syncOutbox();
    const { data, error } = await supabase.from("app_data").select("record_id,data,updated_at").eq("user_id", uid).eq("store", store);
    if (!error) await reconcileStore(uid, store, (data ?? []) as Array<{ record_id: string; data: T; updated_at: string }>);
    else publish({ phase: "error", error: error.message });
  } else await updatePendingState(uid, "offline");
  return (await all<CacheRecord<T>>("records")).filter((item) => item.userId === uid && item.store === store).map((item) => item.data);
}

export async function saveRecord<T extends { id: string }>(store: StoreName, value: T) {
  const uid = await userId();
  const key = cacheKey(uid, store, value.id);
  const updatedAt = new Date().toISOString();
  const record = { key, userId: uid, store, recordId: value.id, data: value, updatedAt };
  await write("records", record);
  await write("outbox", { ...record, operation: "put", attempts: 0 } satisfies OutboxRecord<T>);
  await updatePendingState(uid);
  if (navigator.onLine) void syncOutbox().catch(() => undefined);
  return value;
}

export async function deleteRecord(store: StoreName, id: string) {
  const uid = await userId();
  const key = cacheKey(uid, store, id);
  const updatedAt = new Date().toISOString();
  await drop("records", key);
  await write("outbox", { key, userId: uid, store, recordId: id, data: null, updatedAt, operation: "delete", attempts: 0 });
  await updatePendingState(uid);
  if (navigator.onLine) void syncOutbox().catch(() => undefined);
}
