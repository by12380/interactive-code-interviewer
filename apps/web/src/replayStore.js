const DB_NAME = "ici_replays";
const DB_VERSION = 1;
const STORE_NAME = "replays";

/** @type {Promise<IDBDatabase> | null} */
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("Unable to open IndexedDB"));
    } catch (e) {
      reject(e);
    }
  });
  return dbPromise;
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction error"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
  });
}

/**
 * @param {string} id
 * @returns {Promise<any | null>}
 */
export async function getReplay(id) {
  const key = String(id || "");
  if (!key) return null;
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const req = store.get(key);
  const out = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error("Unable to read replay"));
  });
  await txDone(tx);
  return out;
}

/**
 * @param {any} replay
 * @returns {Promise<boolean>}
 */
export async function putReplay(replay) {
  if (!replay?.id) return false;
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  store.put(replay);
  await txDone(tx);
  return true;
}

/**
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteReplay(id) {
  const key = String(id || "");
  if (!key) return false;
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  store.delete(key);
  await txDone(tx);
  return true;
}

/**
 * Delete any replay payloads not in idsToKeep.
 * @param {string[]} idsToKeep
 * @returns {Promise<void>}
 */
export async function pruneOldReplays(idsToKeep) {
  const keep = new Set((Array.isArray(idsToKeep) ? idsToKeep : []).map(String));
  const db = await openDb();

  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const keyReq = store.getAllKeys();
  const keys = await new Promise((resolve, reject) => {
    keyReq.onsuccess = () => resolve(Array.isArray(keyReq.result) ? keyReq.result : []);
    keyReq.onerror = () => reject(keyReq.error || new Error("Unable to list replay keys"));
  });

  for (const k of keys) {
    const id = String(k || "");
    if (!id) continue;
    if (!keep.has(id)) {
      try {
        store.delete(id);
      } catch {
        // ignore individual delete errors
      }
    }
  }
  await txDone(tx);
}

