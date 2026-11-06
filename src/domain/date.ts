const TOKYO_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** 端末のタイムゾーンに関わらず、日本時間の日付を YYYY-MM-DD で返す */
export function todayInTokyo(now: Date = new Date()): string {
  return TOKYO_FORMAT.format(now);
}

function toUtc(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return formatIso(d);
}

export function isValidDate(date: unknown): date is string {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && formatIso(toUtc(date)) === date;
}

export function weekday(date: string): string {
  return WEEKDAYS[toUtc(date).getUTCDay()];
}

/** 例: 11月6日(金) */
export function formatJa(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${m}月${d}日(${weekday(date)})`;
}

/** 例: 2026年11月6日(金) */
export function formatJaFull(date: string): string {
  return `${Number(date.slice(0, 4))}年${formatJa(date)}`;
}

export interface MonthCell {
  date: string;
  day: number;
}

/** 月カレンダー用。先頭の空きは null（日曜始まり） */
export function monthCells(year: number, month: number): (MonthCell | null)[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (MonthCell | null)[] = Array(first.getUTCDay()).fill(null);
  for (let day = 1; day <= count; day++) {
    cells.push({ date: formatIso(new Date(Date.UTC(year, month - 1, day))), day });
  }
  return cells;
}
