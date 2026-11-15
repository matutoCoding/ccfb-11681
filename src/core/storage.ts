// ---------- IndexedDB 持久化 + 材质包导入导出 ----------
import type { Material } from './types';

const DB_NAME = 'leather-studio';
const STORE = 'materials';
const SETTINGS_STORE = 'settings';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) db.createObjectStore(SETTINGS_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  }));
}

export async function listMaterials(): Promise<Material[]> {
  const all = await tx(STORE, 'readonly', (s) => s.getAll() as IDBRequest<Material[]>);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveMaterial(m: Material): Promise<void> {
  m.updatedAt = Date.now();
  await tx(STORE, 'readwrite', (s) => s.put(m));
}

export async function deleteMaterial(id: string): Promise<void> {
  await tx(STORE, 'readwrite', (s) => s.delete(id));
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const v = await tx(SETTINGS_STORE, 'readonly', (s) => s.get(key));
    return v === undefined ? fallback : (v as T);
  } catch { return fallback; }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await tx(SETTINGS_STORE, 'readwrite', (s) => s.put(value, key));
}

export async function clearAll(): Promise<void> {
  await tx(STORE, 'readwrite', (s) => s.clear());
  await tx(SETTINGS_STORE, 'readwrite', (s) => s.clear());
}

// ---------- 材质包导出/导入 ----------

export interface MaterialPack {
  format: 'leather-pack';
  version: 1;
  exportedAt: string;
  materials: Material[];
}

export function exportPack(materials: Material[]): void {
  const pack: MaterialPack = {
    format: 'leather-pack', version: 1,
    exportedAt: new Date().toISOString(),
    materials,
  };
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `leather-pack-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export async function importPack(file: File): Promise<{ added: number; skipped: number }> {
  const text = await file.text();
  const pack = JSON.parse(text) as MaterialPack;
  if (pack.format !== 'leather-pack' || !Array.isArray(pack.materials)) {
    throw new Error('不是有效的材质包文件');
  }
  const existing = new Set((await listMaterials()).map((m) => m.id));
  let added = 0, skipped = 0;
  for (const m of pack.materials) {
    if (!m.id || !m.emboss || !m.aging) { skipped++; continue; }
    if (existing.has(m.id)) {
      // 冲突: 重新分配编号再导入
      m.id = `${m.id}-IMP${added}`;
    }
    await saveMaterial(m);
    added++;
  }
  return { added, skipped };
}
