"use client";

/**
 * Offline upload queue for the QR mobile add pipeline.
 *
 * Spec: docs/qr-operational-gaps.md section B.
 * - IndexedDB-backed queue survives reloads / poor signal
 * - Compressed Blobs only (raw files would blow IDB quota)
 * - retryCount up to MAX_UPLOAD_RETRIES, then "failed" — manual retry only
 * - `online` event triggers processAll() so the next reconnect drains the queue
 * - subscribe(snapshot) feeds React UI; onUploaded(item) emits when an item lands so
 *   the form can promote the URL into its draft images array
 *
 * Storage is pluggable via UploadQueueStorage so unit tests can run without IDB.
 */

export type UploadQueueStatus =
  | "pending"
  | "uploading"
  | "uploaded"
  | "retry"
  | "failed";

export interface UploadQueueItem {
  id: string;
  batchId: string;
  main: Blob;
  thumb: Blob;
  baseName: string;
  fieldName: string;
  retryCount: number;
  status: UploadQueueStatus;
  createdAt: number;
  mainUrl?: string;
  error?: string;
}

export interface UploadQueueStorage {
  put(item: UploadQueueItem): Promise<void>;
  delete(id: string): Promise<void>;
  getAll(batchId?: string): Promise<UploadQueueItem[]>;
  clear(): Promise<void>;
}

export const MAX_UPLOAD_RETRIES = 3;
const DB_NAME = "janicka-upload-queue";
const STORE = "items";

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error("IndexedDB se nepodařilo otevřít"));
  });
}

export function idbStorage(): UploadQueueStorage {
  return {
    async put(item) {
      const db = await openIDB();
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE, "readwrite");
          tx.objectStore(STORE).put(item);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        });
      } finally {
        db.close();
      }
    },
    async delete(id) {
      const db = await openIDB();
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE, "readwrite");
          tx.objectStore(STORE).delete(id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        });
      } finally {
        db.close();
      }
    },
    async getAll(batchId) {
      const db = await openIDB();
      try {
        return await new Promise<UploadQueueItem[]>((resolve, reject) => {
          const tx = db.transaction(STORE, "readonly");
          const req = tx.objectStore(STORE).getAll();
          req.onsuccess = () => {
            const all = (req.result ?? []) as UploadQueueItem[];
            resolve(batchId ? all.filter((it) => it.batchId === batchId) : all);
          };
          req.onerror = () => reject(req.error);
        });
      } finally {
        db.close();
      }
    },
    async clear() {
      const db = await openIDB();
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE, "readwrite");
          tx.objectStore(STORE).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        });
      } finally {
        db.close();
      }
    },
  };
}

export function memoryStorage(): UploadQueueStorage {
  const map = new Map<string, UploadQueueItem>();
  return {
    async put(item) {
      map.set(item.id, item);
    },
    async delete(id) {
      map.delete(id);
    },
    async getAll(batchId) {
      const all = Array.from(map.values()).map((it) => ({ ...it }));
      return batchId ? all.filter((it) => it.batchId === batchId) : all;
    },
    async clear() {
      map.clear();
    },
  };
}

export type UploadResult = { mainUrl: string };
export type Uploader = (item: UploadQueueItem) => Promise<UploadResult>;
export type Listener = (items: UploadQueueItem[]) => void;
export type UploadedListener = (item: UploadQueueItem) => void;

export interface UploadQueueOptions {
  storage?: UploadQueueStorage;
  uploader?: Uploader;
  maxRetries?: number;
  maxConcurrent?: number;
}

async function defaultUploader(item: UploadQueueItem): Promise<UploadResult> {
  const fd = new FormData();
  const ext = item.main.type === "image/webp" ? "webp" : "jpg";
  fd.append(
    item.fieldName,
    new File([item.main], `${item.baseName}.${ext}`, { type: item.main.type })
  );
  fd.append(
    item.fieldName,
    new File([item.thumb], `${item.baseName}-thumb.${ext}`, {
      type: item.thumb.type,
    })
  );
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Nahrávání selhalo (HTTP ${res.status})`);
  }
  const data = (await res.json()) as { urls?: string[] };
  if (!data.urls || data.urls.length === 0) {
    throw new Error("Server nevrátil URL nahraného souboru");
  }
  return { mainUrl: data.urls[0] };
}

export class UploadQueue {
  private storage: UploadQueueStorage;
  private uploader: Uploader;
  private maxRetries: number;
  private maxConcurrent: number;
  private items = new Map<string, UploadQueueItem>();
  private listeners = new Set<Listener>();
  private uploadedListeners = new Set<UploadedListener>();
  private inFlight = new Set<string>();
  private hydrated = false;

  constructor(opts: UploadQueueOptions = {}) {
    this.storage =
      opts.storage ??
      (typeof indexedDB !== "undefined" ? idbStorage() : memoryStorage());
    this.uploader = opts.uploader ?? defaultUploader;
    this.maxRetries = opts.maxRetries ?? MAX_UPLOAD_RETRIES;
    this.maxConcurrent = Math.max(1, opts.maxConcurrent ?? 3);
  }

  async hydrate(): Promise<void> {
    if (this.hydrated) return;
    this.hydrated = true;
    const persisted = await this.storage.getAll();
    for (const it of persisted) {
      // 'uploading' across reload = orphaned mid-flight; treat as retry candidate.
      const recovered: UploadQueueItem =
        it.status === "uploading" ? { ...it, status: "retry" } : it;
      this.items.set(recovered.id, recovered);
      if (recovered !== it) await this.storage.put(recovered);
    }
    this.emit();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  onUploaded(listener: UploadedListener): () => void {
    this.uploadedListeners.add(listener);
    return () => {
      this.uploadedListeners.delete(listener);
    };
  }

  snapshot(): UploadQueueItem[] {
    return Array.from(this.items.values()).sort(
      (a, b) => a.createdAt - b.createdAt
    );
  }

  hasInFlight(batchId?: string): boolean {
    return this.snapshot()
      .filter((it) => !batchId || it.batchId === batchId)
      .some(
        (it) =>
          it.status === "pending" ||
          it.status === "uploading" ||
          it.status === "retry"
      );
  }

  async enqueue(input: {
    batchId: string;
    main: Blob;
    thumb: Blob;
    baseName: string;
    fieldName?: string;
  }): Promise<UploadQueueItem> {
    const item: UploadQueueItem = {
      id: makeId(),
      batchId: input.batchId,
      main: input.main,
      thumb: input.thumb,
      baseName: input.baseName,
      fieldName: input.fieldName ?? "files",
      retryCount: 0,
      status: "pending",
      createdAt: Date.now(),
    };
    this.items.set(item.id, item);
    await this.storage.put(item);
    this.emit();
    return item;
  }

  async retryItem(id: string): Promise<void> {
    const it = this.items.get(id);
    if (!it) return;
    if (it.status === "uploading" || it.status === "uploaded") return;
    const reset: UploadQueueItem = {
      ...it,
      status: "pending",
      retryCount: 0,
      error: undefined,
    };
    this.items.set(id, reset);
    await this.storage.put(reset);
    this.emit();
    void this.processOne(reset.id);
  }

  async retryAll(batchId?: string): Promise<void> {
    const candidates = this.snapshot().filter(
      (it) =>
        (!batchId || it.batchId === batchId) &&
        (it.status === "retry" || it.status === "failed")
    );
    for (const it of candidates) {
      const reset: UploadQueueItem = {
        ...it,
        status: "pending",
        retryCount: it.status === "failed" ? 0 : it.retryCount,
        error: undefined,
      };
      this.items.set(it.id, reset);
      await this.storage.put(reset);
    }
    this.emit();
    await this.processAll();
  }

  async remove(id: string): Promise<void> {
    if (!this.items.has(id)) return;
    if (this.inFlight.has(id)) return;
    this.items.delete(id);
    await this.storage.delete(id);
    this.emit();
  }

  async processAll(): Promise<void> {
    const candidates = this.snapshot().filter(
      (it) =>
        (it.status === "pending" || it.status === "retry") &&
        !this.inFlight.has(it.id)
    );

    let cursor = 0;
    const concurrency = Math.min(this.maxConcurrent, candidates.length);
    if (concurrency === 0) return;

    const pump = async () => {
      while (true) {
        const idx = cursor++;
        if (idx >= candidates.length) return;
        await this.processOne(candidates[idx].id);
      }
    };
    await Promise.all(Array.from({ length: concurrency }, () => pump()));
  }

  private async processOne(id: string): Promise<void> {
    if (this.inFlight.has(id)) return;
    const item = this.items.get(id);
    if (!item) return;
    if (
      item.status === "uploaded" ||
      item.status === "uploading" ||
      item.status === "failed"
    ) {
      return;
    }
    if (item.retryCount >= this.maxRetries) {
      const failed: UploadQueueItem = { ...item, status: "failed" };
      this.items.set(id, failed);
      await this.storage.put(failed);
      this.emit();
      return;
    }

    this.inFlight.add(id);
    const uploading: UploadQueueItem = {
      ...item,
      status: "uploading",
      error: undefined,
    };
    this.items.set(id, uploading);
    await this.storage.put(uploading);
    this.emit();

    try {
      const { mainUrl } = await this.uploader(uploading);
      const uploaded: UploadQueueItem = {
        ...uploading,
        status: "uploaded",
        mainUrl,
      };
      // Notify subscribers BEFORE clearing — they need the URL.
      for (const l of this.uploadedListeners) {
        try {
          l(uploaded);
        } catch {
          // listener crashes must not corrupt the queue
        }
      }
      this.items.delete(id);
      await this.storage.delete(id);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Nahrávání selhalo";
      const nextRetry = uploading.retryCount + 1;
      const reachedLimit = nextRetry >= this.maxRetries;
      const next: UploadQueueItem = {
        ...uploading,
        status: reachedLimit ? "failed" : "retry",
        retryCount: nextRetry,
        error: message,
      };
      this.items.set(id, next);
      await this.storage.put(next);
    } finally {
      this.inFlight.delete(id);
      this.emit();
    }
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const l of this.listeners) {
      try {
        l(snap);
      } catch {
        // listener crashes must not corrupt the queue
      }
    }
  }
}

let _singleton: UploadQueue | null = null;
let _onlineHandlerAttached = false;

export function getUploadQueue(): UploadQueue {
  if (!_singleton) {
    _singleton = new UploadQueue();
    if (typeof window !== "undefined") {
      void _singleton.hydrate().then(() => {
        if (!navigator.onLine) return;
        void _singleton!.processAll();
      });
      if (!_onlineHandlerAttached) {
        _onlineHandlerAttached = true;
        window.addEventListener("online", () => {
          void _singleton!.processAll();
        });
      }
    }
  }
  return _singleton;
}

export const __test = { defaultUploader };
