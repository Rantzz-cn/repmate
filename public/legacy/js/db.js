import { supabase } from './supabase.js';

export const STORES = ['exercises', 'programs', 'workouts', 'activeWorkout', 'profile', 'recovery'];

const DB_NAME = 'repmate-offline';
// Version 2 repairs databases created by an interrupted first install.
const DB_VERSION = 2;
const RECORDS = 'records';
const OUTBOX = 'outbox';
let syncPromise = null;

const openDatabase = () => new Promise((resolve, reject) => {
  if (!('indexedDB' in window)) {
    reject(new Error('Offline storage is not supported by this browser.'));
    return;
  }

  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(RECORDS)) database.createObjectStore(RECORDS, { keyPath: 'key' });
    if (!database.objectStoreNames.contains(OUTBOX)) database.createObjectStore(OUTBOX, { keyPath: 'key' });
  };
  request.onsuccess = () => {
    const database = request.result;
    database.onversionchange = () => database.close();
    resolve(database);
  };
  request.onerror = () => reject(request.error);
  request.onblocked = () => reject(new Error('Offline storage is busy. Close other RepMate tabs and retry.'));
});

const transaction = async (storeName, mode, operation) => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    let tx;
    let request;
    let result;

    try {
      tx = database.transaction(storeName, mode);
      request = operation(tx.objectStore(storeName));
      if (request && typeof request === 'object' && 'onsuccess' in request) {
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => reject(request.error);
      } else {
        result = request;
      }
    } catch (error) {
      database.close();
      reject(error);
      return;
    }

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error('Offline storage transaction failed.'));
    tx.onabort = () => reject(tx.error || new Error('Offline storage transaction was cancelled.'));
  }).finally(() => database.close());
};

const allLocal = (storeName) => transaction(storeName, 'readonly', (store) => store.getAll());
const localGet = (storeName, key) => transaction(storeName, 'readonly', (store) => store.get(key));
const pendingFor = async (userId) => (await allLocal(OUTBOX)).filter((entry) => entry.userId === userId);
const localPut = (storeName, value) => transaction(storeName, 'readwrite', (store) => store.put(value));
const localDelete = (storeName, key) => transaction(storeName, 'readwrite', (store) => store.delete(key));
const recordKey = (userId, store, id) => `${userId}|${store}|${id}`;
const emitStatus = (status, pending = 0) => window.dispatchEvent(new CustomEvent('repmate:sync', { detail: { status, pending } }));
const reportError = (error, context) => window.__REPMATE_CAPTURE_ERROR__?.(error, context);

async function currentUser() {
  const { data, error } = await supabase.auth.getSession();
  const user = data?.session?.user;
  if (error || !user) throw new Error('Please sign in to continue.');
  return user;
}

async function cachedRecords(userId, store) {
  return (await allLocal(RECORDS))
    .filter((entry) => entry.userId === userId && entry.store === store)
    .map((entry) => entry.data);
}

async function cacheRemoteStore(userId, store, rows) {
  const pendingKeys = new Set((await allLocal(OUTBOX)).map((entry) => entry.key));
  // Remote results are merged into the offline cache. Never prune a local record
  // merely because it is absent remotely: a just-completed offline workout may
  // still be waiting for the server to accept it. Explicit deletes already remove
  // their local record and are represented by an outbox tombstone.
  for (const row of rows) {
    const key = recordKey(userId, store, row.record_id);
    if (!pendingKeys.has(key)) await localPut(RECORDS, { key, userId, store, recordId: row.record_id, data: row.data, updatedAt: row.updated_at });
  }
}

async function queueChange(userId, store, recordId, operation, data = null) {
  const key = recordKey(userId, store, recordId);
  await localPut(OUTBOX, { key, userId, store, recordId, operation, data, queuedAt: new Date().toISOString() });
  emitStatus(navigator.onLine ? 'syncing' : 'offline', (await pendingFor(userId)).length);
}

export async function syncPending() {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    const user = await currentUser();
    if (!navigator.onLine) {
      emitStatus('offline', (await pendingFor(user.id)).length);
      return false;
    }

    // Continue in batches because UI saves can be queued while a previous batch
    // is uploading. This prevents a later change from being stranded until reload.
    while (true) {
      const pending = (await pendingFor(user.id)).sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
      if (!pending.length) {
        emitStatus('synced', 0);
        return true;
      }
      emitStatus('syncing', pending.length);
      for (const change of pending) {
        try {
        let error;
        if (change.operation === 'put') {
          ({ error } = await supabase.from('app_data').upsert({ user_id: change.userId, store: change.store, record_id: change.recordId, data: change.data, updated_at: change.queuedAt }, { onConflict: 'user_id,store,record_id' }));
        } else if (change.recordId === '*') {
          ({ error } = await supabase.from('app_data').delete().eq('user_id', change.userId).eq('store', change.store));
        } else {
          ({ error } = await supabase.from('app_data').delete().eq('user_id', change.userId).eq('store', change.store).eq('record_id', change.recordId));
        }
          if (error) throw error;
          await localDelete(OUTBOX, change.key);
        } catch (error) {
          const pendingCount = (await pendingFor(user.id)).length;
          reportError(error, { feature: 'offline-sync', store: change.store, operation: change.operation, pending: pendingCount });
          emitStatus('offline', pendingCount);
          return false;
        }
      }
    }
  })().finally(() => { syncPromise = null; });
  return syncPromise;
}

export async function getAll(store) {
  const user = await currentUser();
  if (navigator.onLine) {
    await syncPending();
    try {
      const { data, error } = await supabase.from('app_data').select('record_id,data,updated_at').eq('user_id', user.id).eq('store', store).order('updated_at');
      if (error) throw error;
      await cacheRemoteStore(user.id, store, data || []);
      emitStatus('synced', (await pendingFor(user.id)).length);
    } catch (error) {
      reportError(error, { feature: 'remote-data-load', store });
      emitStatus('offline', (await pendingFor(user.id)).length);
    }
  }
  return cachedRecords(user.id, store);
}

export async function get(store, id) {
  const user = await currentUser();
  if (navigator.onLine) await getAll(store);
  return (await localGet(RECORDS, recordKey(user.id, store, id)))?.data;
}

export async function put(store, value) {
  const user = await currentUser();
  if (!value?.id) throw new Error(`Cannot save ${store} record without an id.`);
  const key = recordKey(user.id, store, value.id);
  await localPut(RECORDS, { key, userId: user.id, store, recordId: value.id, data: value, updatedAt: new Date().toISOString() });
  await queueChange(user.id, store, value.id, 'put', value);
  if (navigator.onLine) syncPending();
  return value;
}

export async function remove(store, id) {
  const user = await currentUser();
  await localDelete(RECORDS, recordKey(user.id, store, id));
  await queueChange(user.id, store, id, 'delete');
  if (navigator.onLine) syncPending();
}

export async function clear(store) {
  const user = await currentUser();
  const records = (await allLocal(RECORDS)).filter((entry) => entry.userId === user.id && entry.store === store);
  for (const record of records) await localDelete(RECORDS, record.key);
  await queueChange(user.id, store, '*', 'delete');
  if (navigator.onLine) syncPending();
}

window.addEventListener('online', () => { syncPending().catch((error) => {
  reportError(error, { feature: 'reconnect-sync' });
  emitStatus('offline', 0);
}); });
window.addEventListener('offline', async () => {
  try { emitStatus('offline', (await pendingFor((await currentUser()).id)).length); }
  catch (_) { emitStatus('offline', 0); }
});
