import { TOTAL_CHARACTERS, characterAtOrder, lapAtOrder, positionInLap, type Character } from './characters';
import { addDays } from './date';
import { gradeFor, type Grade } from './grade';

export interface DayRecord {
  date: string;
  homework: boolean;
  problems: number;
  updatedAt: string;
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
}

export interface Progress {
  awards: Award[];
  awardByDate: Map<string, Award>;
  recordByDate: Map<string, DayRecord>;
  stats: Stats;
}

/**
 * すべての表示の元になる計算。
 * キャラの割り当ては保存せず、達成日（1問以上）を古い順に並べて毎回導出するため、
 * 同日の再入力や過去日の修正があっても順位が飛んだり重複したりしない。
 */
export function deriveProgress(records: DayRecord[], today: string): Progress {
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
  return {
    awards,
    awardByDate,
    recordByDate: new Map(sorted.map((r) => [r.date, r])),
    stats: {
      currentStreak: currentStreak(awardByDate, today),
      longestStreak: longestStreak(awards),
      achievedDays: n,
      totalProblems,
      homeworkDays,
      lap: n === 0 ? 1 : lapAtOrder(n),
      collected: n === 0 ? 0 : positionInLap(n),
      remaining: n === 0 ? TOTAL_CHARACTERS : TOTAL_CHARACTERS - positionInLap(n),
    },
  };
}

/** 今日まだ記録していなくても、昨日まで続いていれば連続は生きているものとして扱う */
function currentStreak(awardByDate: Map<string, Award>, today: string): number {
  let cursor = awardByDate.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (awardByDate.has(cursor)) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

function longestStreak(awards: Award[]): number {
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const a of awards) {
    run = prev !== null && addDays(prev, 1) === a.date ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = a.date;
  }
  return longest;
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
