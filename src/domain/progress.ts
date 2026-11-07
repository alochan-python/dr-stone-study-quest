import { TOTAL_CHARACTERS, characterAtOrder, lapAtOrder, positionInLap, type Character } from './characters';
import { addDays } from './date';
import { gradeFor, type Grade } from './grade';

export interface DayRecord {
  date: string;
  homework: boolean;
  problems: number;
  updatedAt: string;
  /** お助けアイテムを使った日。問題数が0の間だけ有効で、1問以上に直すとアイテムは戻る */
  rescue?: boolean;
}

/** 連続でこの日数を達成するたびにお助けアイテムが1個増える（管理欄で変更できる） */
export const DEFAULT_RESCUE_INTERVAL = 20;
export const MAX_RESCUE_INTERVAL = 100;

export function isValidRescueInterval(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_RESCUE_INTERVAL;
}

export interface Award {
  /** 通算何回目の達成か（1始まり） */
  order: number;
  date: string;
  problems: number;
  grade: Grade;
  lap: number;
  character: Character;
}

export interface Stats {
  currentStreak: number;
  longestStreak: number;
  achievedDays: number;
  totalProblems: number;
  homeworkDays: number;
  /** 現在の周 */
  lap: number;
  /** 現在の周で獲得した人数 */
  collected: number;
  remaining: number;
  /** 使えるお助けアイテムの数 */
  rescueItems: number;
  /** 次のアイテムまでの連続達成日数 */
  nextRescueIn: number;
}

export interface Progress {
  awards: Award[];
  awardByDate: Map<string, Award>;
  recordByDate: Map<string, DayRecord>;
  /** アイテムで連続を守った日 */
  rescuedDates: Set<string>;
  /** 今アイテムを使えば連続がつながる日（古い順）。使えないときは空 */
  pendingRescue: string[];
  stats: Stats;
}

/**
 * すべての表示の元になる計算。
 * キャラの割り当ては保存せず、達成日（1問以上）を古い順に並べて毎回導出するため、
 * 同日の再入力や過去日の修正があっても順位が飛んだり重複したりしない。
 */
export function deriveProgress(records: DayRecord[], today: string, rescueInterval = DEFAULT_RESCUE_INTERVAL): Progress {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const awards: Award[] = [];
  let totalProblems = 0;
  let homeworkDays = 0;

  for (const r of sorted) {
    if (r.homework) homeworkDays++;
    if (r.problems <= 0) continue;
    totalProblems += r.problems;
    const order = awards.length + 1;
    awards.push({
      order,
      date: r.date,
      problems: r.problems,
      grade: gradeFor(r.problems),
      lap: lapAtOrder(order),
      character: characterAtOrder(order),
    });
  }

  const awardByDate = new Map(awards.map((a) => [a.date, a]));
  const n = awards.length;
  const walk = walkStreak(sorted, today, rescueInterval);
  return {
    awards,
    awardByDate,
    recordByDate: new Map(sorted.map((r) => [r.date, r])),
    rescuedDates: walk.rescued,
    pendingRescue: findPendingRescue(awardByDate, walk.rescued, walk.items, today),
    stats: {
      currentStreak: walk.current,
      longestStreak: walk.longest,
      achievedDays: n,
      totalProblems,
      homeworkDays,
      lap: n === 0 ? 1 : lapAtOrder(n),
      collected: n === 0 ? 0 : positionInLap(n),
      remaining: n === 0 ? TOTAL_CHARACTERS : TOTAL_CHARACTERS - positionInLap(n),
      rescueItems: walk.items,
      nextRescueIn: rescueInterval - (walk.current % rescueInterval),
    },
  };
}

/**
 * 連続日数とアイテムを古い順にたどって求める。アイテムの数は保存しないので、過去日を直しても矛盾しない。
 * アイテムを使った日は連続をつなぐだけで、日数には足さない（同じ節目で二重にもらえないようにするため）。
 * 使った時点でアイテムがない・前日とつながっていない印は無効として、休みの日と同じに扱う。
 */
function walkStreak(sorted: DayRecord[], today: string, rescueInterval: number) {
  const rescued = new Set<string>();
  let streak = 0;
  let longest = 0;
  let items = 0;
  let lastAlive: string | null = null;

  for (const r of sorted) {
    if (r.date > today) break;
    const adjacent = lastAlive !== null && addDays(lastAlive, 1) === r.date;
    if (!adjacent) streak = 0;
    if (r.problems > 0) {
      streak++;
      longest = Math.max(longest, streak);
      if (streak % rescueInterval === 0) items++;
      lastAlive = r.date;
    } else if (r.rescue && r.date < today && adjacent && items > 0) {
      items--;
      rescued.add(r.date);
      lastAlive = r.date;
    }
  }

  // 今日まだ記録していなくても、昨日まで続いていれば連続は生きているものとして扱う
  const alive = lastAlive !== null && lastAlive >= addDays(today, -1);
  return { current: alive ? streak : 0, longest, items, rescued };
}

/** 昨日で終わる空白を、手持ちのアイテムで埋めきれるときだけその日付を返す。翌日以降は使えない */
function findPendingRescue(awardByDate: Map<string, Award>, rescued: Set<string>, items: number, today: string): string[] {
  const missed: string[] = [];
  let cursor = addDays(today, -1);
  const first = [...awardByDate.keys()][0];
  if (first === undefined) return [];
  while (!awardByDate.has(cursor) && !rescued.has(cursor)) {
    if (cursor < first || missed.length >= items) return [];
    missed.unshift(cursor);
    cursor = addDays(cursor, -1);
  }
  return missed;
}

export interface TodaySlot {
  order: number;
  lap: number;
  position: number;
  character: Character;
  award: Award | undefined;
  tomorrow: { character: Character; lap: number };
}

export function todaySlot(progress: Progress, today: string): TodaySlot {
  const award = progress.awardByDate.get(today);
  const order = award?.order ?? progress.awards.length + 1;
  return {
    order,
    lap: lapAtOrder(order),
    position: positionInLap(order),
    character: characterAtOrder(order),
    award,
    tomorrow: { character: characterAtOrder(order + 1), lap: lapAtOrder(order + 1) },
  };
}

/** まだ獲得していない次のキャラクター */
export function nextCharacter(progress: Progress): { character: Character; lap: number } {
  const order = progress.awards.length + 1;
  return { character: characterAtOrder(order), lap: lapAtOrder(order) };
}

/** 達成⇔未達成が変わる編集で、割り当てがずれる「以降の達成日」の数 */
export function shiftImpact(progress: Progress, date: string, nextProblems: number): number {
  const was = progress.awardByDate.has(date);
  if (was === nextProblems > 0) return 0;
  return progress.awards.filter((a) => a.date > date).length;
}

export function completedLaps(progress: Progress): number {
  return Math.floor(progress.awards.length / TOTAL_CHARACTERS);
}

export function awardsInLap(progress: Progress, lap: number): Map<number, Award> {
  return new Map(progress.awards.filter((a) => a.lap === lap).map((a) => [a.character.rank, a]));
}
