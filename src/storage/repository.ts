import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { DEFAULT_RESCUE_INTERVAL, type DayRecord } from '../domain/progress';

export interface Settings {
  animations: boolean;
  sound: boolean;
  lastBackupAt: string | null;
  completionSeen: boolean;
  rescueInterval: number;
}

export const DEFAULT_SETTINGS: Settings = {
  animations: true,
  sound: true,
  lastBackupAt: null,
  completionSeen: false,
  rescueInterval: DEFAULT_RESCUE_INTERVAL,
};

export interface Draft {
  date: string;
  homework: boolean;
  problems: number;
}

/** 置き換え・初期化の直前に自動で取る1世代分の控え */
export interface Snapshot {
  takenAt: string;
  reason: string;
  records: DayRecord[];
}

interface Schema extends DBSchema {
  records: { key: string; value: DayRecord };
  meta: { key: string; value: unknown };
  images: { key: number; value: string };
}

const DB_NAME = 'dr-stone-study-quest';

export class Repository {
  constructor(private db: IDBPDatabase<Schema>) {}

  getRecords(): Promise<DayRecord[]> {
    return this.db.getAll('records');
  }

  async putRecord(record: DayRecord): Promise<void> {
    await this.db.put('records', record);
  }

  async putRecords(records: DayRecord[]): Promise<void> {
    const tx = this.db.transaction('records', 'readwrite');
    for (const r of records) tx.store.put(r);
    await tx.done;
  }

  async deleteRecord(date: string): Promise<void> {
    await this.db.delete('records', date);
  }

  /** 控えの保存と全件置き換えを1トランザクションで行い、途中失敗でデータを失わないようにする */
  async replaceRecords(records: DayRecord[], snapshot: Snapshot | null): Promise<void> {
    const tx = this.db.transaction(['records', 'meta'], 'readwrite');
    if (snapshot) tx.objectStore('meta').put(snapshot, 'snapshot');
    const store = tx.objectStore('records');
    store.clear();
    for (const r of records) store.put(r);
    await tx.done;
  }

  async addRecords(records: DayRecord[]): Promise<void> {
    const tx = this.db.transaction('records', 'readwrite');
    for (const r of records) tx.store.add(r);
    await tx.done;
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    return (await this.db.get('meta', key)) as T | undefined;
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await this.db.put('meta', value, key);
  }

  async deleteMeta(key: string): Promise<void> {
    await this.db.delete('meta', key);
  }

  async getImages(): Promise<Record<number, string>> {
    const tx = this.db.transaction('images');
    const [keys, values] = await Promise.all([tx.store.getAllKeys(), tx.store.getAll()]);
    return Object.fromEntries(keys.map((k, i) => [k, values[i]]));
  }

  async putImages(images: Record<number, string>): Promise<void> {
    const tx = this.db.transaction('images', 'readwrite');
    for (const [rank, url] of Object.entries(images)) tx.store.put(url, Number(rank));
    await tx.done;
  }

  async clearImages(): Promise<void> {
    await this.db.clear('images');
  }

  close(): void {
    this.db.close();
  }
}

export async function openRepository(): Promise<Repository> {
  const db = await openDB<Schema>(DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore('records', { keyPath: 'date' });
      database.createObjectStore('meta');
      database.createObjectStore('images');
    },
  });
  return new Repository(db);
}
