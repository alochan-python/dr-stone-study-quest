import { isValidDate } from './date';
import { MAX_PROBLEMS } from './grade';
import type { DayRecord } from './progress';

export const APP_ID = 'dr-stone-study-quest';
const SCHEMA_VERSION = 1;
const MAX_IMAGE_BYTES = 40 * 1024 * 1024;

export class ImportError extends Error {}

export function buildBackup(records: DayRecord[], now: Date = new Date()): string {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  return JSON.stringify(
    { app: APP_ID, type: 'backup', schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), records: sorted },
    null,
    2,
  );
}

export function backupFileName(today: string): string {
  return `dr-stone-study-backup-${today}.json`;
}

function parseJson(text: string): Record<string, unknown> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError('JSONファイルとして読み込めませんでした。ファイルが壊れていないか確認してください。');
  }
  if (typeof data !== 'object' || data === null) throw new ImportError('ファイルの形式が正しくありません。');
  return data as Record<string, unknown>;
}

export function parseBackup(text: string, today: string): DayRecord[] {
  const data = parseJson(text);
  if (data.app !== APP_ID || data.type !== 'backup') {
    throw new ImportError('このアプリのバックアップファイルではありません。');
  }
  if (data.schemaVersion !== SCHEMA_VERSION) {
    throw new ImportError('対応していないバックアップ形式です。アプリを最新にしてからお試しください。');
  }
  if (!Array.isArray(data.records)) throw new ImportError('バックアップに記録が見つかりません。');

  const seen = new Set<string>();
  return data.records.map((raw: unknown, i: number): DayRecord => {
    const r = (raw ?? {}) as Partial<DayRecord>;
    const where = `${i + 1}件目の記録`;
    if (!isValidDate(r.date)) throw new ImportError(`${where}の日付が正しくありません。`);
    if (r.date > today) throw new ImportError(`${where}が未来の日付（${r.date}）です。`);
    if (seen.has(r.date)) throw new ImportError(`${r.date} の記録が重複しています。`);
    seen.add(r.date);
    if (typeof r.homework !== 'boolean') throw new ImportError(`${r.date} の宿題の値が正しくありません。`);
    if (!Number.isInteger(r.problems) || r.problems! < 0 || r.problems! > MAX_PROBLEMS) {
      throw new ImportError(`${r.date} の問題数が正しくありません。`);
    }
    return {
      date: r.date,
      homework: r.homework,
      problems: r.problems!,
      updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : new Date(0).toISOString(),
    };
  });
}

export interface MergePlan {
  /** 既存を一切変えず、足りない日だけ足した結果 */
  merged: DayRecord[];
  added: DayRecord[];
  identical: number;
  /** 内容が異なる日（統合では既存を残す） */
  conflicts: { existing: DayRecord; incoming: DayRecord }[];
}

export function planMerge(existing: DayRecord[], incoming: DayRecord[]): MergePlan {
  const byDate = new Map(existing.map((r) => [r.date, r]));
  const added: DayRecord[] = [];
  const conflicts: MergePlan['conflicts'] = [];
  let identical = 0;
  for (const r of incoming) {
    const current = byDate.get(r.date);
    if (!current) added.push(r);
    else if (current.homework === r.homework && current.problems === r.problems) identical++;
    else conflicts.push({ existing: current, incoming: r });
  }
  return { merged: [...existing, ...added], added, identical, conflicts };
}

/** 画像パックは {rank: dataURL}。ラスター画像のみ受け付ける */
export function parseImagePack(text: string): Record<number, string> {
  if (text.length > MAX_IMAGE_BYTES) throw new ImportError('画像パックが大きすぎます。');
  const data = parseJson(text);
  if (data.app !== APP_ID || data.type !== 'image-pack' || typeof data.images !== 'object' || data.images === null) {
    throw new ImportError('このアプリの画像パックではありません。');
  }
  const images: Record<number, string> = {};
  for (const [key, value] of Object.entries(data.images)) {
    const rank = Number(key);
    if (!Number.isInteger(rank) || rank < 1 || rank > 50) throw new ImportError(`順位 ${key} は対象外です。`);
    if (typeof value !== 'string' || !/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value)) {
      throw new ImportError(`${rank}位の画像形式が正しくありません（WebP / PNG / JPEG のみ）。`);
    }
    images[rank] = value;
  }
  if (Object.keys(images).length === 0) throw new ImportError('画像が1枚も入っていません。');
  return images;
}
