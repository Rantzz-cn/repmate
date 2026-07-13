"use client";
import { supabase } from "./supabase";
import type { StoreName } from "./types";

interface CacheRecord<T = unknown> { key: string; userId: string; store: StoreName; recordId: string; data: T; updatedAt: string }
interface OutboxRecord<T = unknown> extends CacheRecord<T> { operation: "put" | "delete" }
const DB = "repmate-next-offline", VERSION = 1;

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
    const tx = db.transaction(storeName, mode), request = action(tx.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
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

export async function syncOutbox() {
  if (!navigator.onLine) return;
  const uid = await userId(), pending = (await all<OutboxRecord>("outbox")).filter((item) => item.userId === uid);
  for (const item of pending) {
    const query = item.operation === "put"
      ? supabase.from("app_data").upsert({ user_id: uid, store: item.store, record_id: item.recordId, data: item.data, updated_at: item.updatedAt }, { onConflict: "user_id,store,record_id" })
      : supabase.from("app_data").delete().eq("user_id", uid).eq("store", item.store).eq("record_id", item.recordId);
    const { error } = await query;
    if (!error) await drop("outbox", item.key);
  }
}

export async function listRecords<T>(store: StoreName): Promise<T[]> {
  const uid = await userId();
  if (navigator.onLine) {
    await syncOutbox();
    const { data, error } = await supabase.from("app_data").select("record_id,data,updated_at").eq("user_id", uid).eq("store", store);
    if (!error) for (const row of data ?? []) await write("records", { key: cacheKey(uid, store, row.record_id), userId: uid, store, recordId: row.record_id, data: row.data, updatedAt: row.updated_at });
  }
  return (await all<CacheRecord<T>>("records")).filter((item) => item.userId === uid && item.store === store).map((item) => item.data);
}

export async function saveRecord<T extends { id: string }>(store: StoreName, value: T) {
  const uid = await userId(), key = cacheKey(uid, store, value.id), updatedAt = new Date().toISOString();
  const record = { key, userId: uid, store, recordId: value.id, data: value, updatedAt };
  await write("records", record);
  await write("outbox", { ...record, operation: "put" } satisfies OutboxRecord<T>);
  if (navigator.onLine) await syncOutbox();
  return value;
}

export async function deleteRecord(store: StoreName, id: string) {
  const uid = await userId(), key = cacheKey(uid, store, id), updatedAt = new Date().toISOString();
  await drop("records", key);
  await write("outbox", { key, userId: uid, store, recordId: id, data: null, updatedAt, operation: "delete" });
  if (navigator.onLine) await syncOutbox();
}
