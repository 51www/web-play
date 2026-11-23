import type { PersistedState } from '../types';

const DB_NAME = 'web-play';
const DB_VERSION = 1;
const VIDEO_STORE = 'videos';
const STATE_STORE = 'state';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(VIDEO_STORE)) db.createObjectStore(VIDEO_STORE, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(STATE_STORE)) db.createObjectStore(STATE_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('无法打开本地数据库'));
  });
  return dbPromise;
}

async function run<T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = action(tx.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('本地数据库操作失败'));
  });
}

export async function putVideo(key: string, blob: Blob): Promise<void> {
  await run(VIDEO_STORE, 'readwrite', (store) => store.put({ key, blob }) as IDBRequest<IDBValidKey>);
}

export async function getVideo(key: string): Promise<Blob | null> {
  const row = await run<{ key: string; blob: Blob } | undefined>(VIDEO_STORE, 'readonly', (store) => store.get(key));
  return row?.blob ?? null;
}

export async function deleteVideo(key: string): Promise<void> {
  await run(VIDEO_STORE, 'readwrite', (store) => store.delete(key) as IDBRequest<undefined>);
}

export async function saveState(state: PersistedState): Promise<void> {
  await run(STATE_STORE, 'readwrite', (store) => store.put({ key: 'app', value: state }) as IDBRequest<IDBValidKey>);
}

export async function loadState(): Promise<PersistedState | null> {
  const row = await run<{ key: string; value: PersistedState } | undefined>(STATE_STORE, 'readonly', (store) => store.get('app'));
  return row?.value ?? null;
}
