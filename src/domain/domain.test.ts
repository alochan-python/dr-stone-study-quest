import { describe, expect, it } from 'vitest';
import { ImportError, buildBackup, parseBackup, parseImagePack, planMerge } from './backup';
import { CHARACTERS, characterAtOrder } from './characters';
import { addDays, isValidDate, monthCells, todayInTokyo } from './date';
import { gradeFor, normalizeProblems } from './grade';
import { awardsInLap, deriveProgress, nextCharacter, shiftImpact, todaySlot, type DayRecord } from './progress';
import { chimeNotes } from './sound';

const rec = (date: string, problems: number, homework = false): DayRecord => ({
  date,
  problems,
  homework,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

/** start から連続して count 日、毎日 problems 問解いた記録 */
const run = (start: string, count: number, problems = 1) =>
  Array.from({ length: count }, (_, i) => rec(addDays(start, i), problems));

const D1 = '2026-04-01';

describe('キャラクターデータ', () => {
  it('50人全員が50位→1位の順に並ぶ', () => {
    expect(CHARACTERS).toHaveLength(50);
    expect(CHARACTERS.map((c) => c.rank)).toEqual(Array.from({ length: 50 }, (_, i) => 50 - i));
    expect(new Set(CHARACTERS.map((c) => c.name)).size).toBe(50);
  });

  it('指定どおりの登場順になる', () => {
    expect([1, 2, 3, 4, 5].map((n) => characterAtOrder(n).name)).toEqual(['ブロディ', 'コニー・リー', 'コクヨウ', 'ナマリ', 'シャーロット']);
    expect(characterAtOrder(48)).toEqual({ rank: 3, name: '七海龍水' });
    expect(characterAtOrder(49)).toEqual({ rank: 2, name: '石神千空' });
    expect(characterAtOrder(50)).toEqual({ rank: 1, name: 'あさぎりゲン' });
    expect(characterAtOrder(51).rank).toBe(50);
  });
});

describe('スタンプのグレード', () => {
  it.each([
    [0, 'スタンプなし', 'none'],
    [1, '銅', 'bronze'],
    [2, '銀', 'silver'],
    [3, '金', 'gold'],
    [4, 'プラチナ', 'platinum'],
    [5, 'プラチナ＋2', 'platinum-plus'],
    [6, 'プラチナ＋3', 'platinum-plus'],
    [7, 'プラチナ＋4', 'platinum-plus'],
    [8, 'プラチナ＋5', 'platinum-plus'],
    [9, 'プラチナ＋6', 'platinum-plus'],
    [10, 'プラチナ＋7', 'platinum-plus'],
    [11, 'プラチナ＋8', 'platinum-plus'],
    [100, 'プラチナ＋97', 'platinum-plus'],
  ])('%i問 → %s', (problems, label, tier) => {
    expect(gradeFor(problems).label).toBe(label);
    expect(gradeFor(problems).tier).toBe(tier);
  });

  it('問題数が多いほど演出が豪華になる', () => {
    expect([4, 5, 7, 10].map((n) => gradeFor(n).sparkle)).toEqual([0, 1, 2, 3]);
  });

  it('不正な入力は0以上の整数に丸める', () => {
    expect([NaN, -3, 2.7, 5000].map(normalizeProblems)).toEqual([0, 0, 2, 999]);
  });

  it('確定音はグレードが上がるほど音が増える', () => {
    const counts = [0, 1, 2, 3, 4, 5, 7, 10].map((n) => chimeNotes(gradeFor(n)).length);
    expect(counts).toEqual([0, 1, 2, 3, 4, 5, 6, 6]);
  });
});

describe('キャラクターの進行', () => {
  it('0問ではキャラが進まない', () => {
    const p = deriveProgress([rec(D1, 0)], D1);
    expect(p.awards).toHaveLength(0);
    expect(p.stats.achievedDays).toBe(0);
    expect(nextCharacter(p).character.name).toBe('ブロディ');
  });

  it('宿題だけではキャラが進まず、連続にも入らないが宿題日数は数える', () => {
    const p = deriveProgress([rec(D1, 0, true), rec(addDays(D1, 1), 0, true)], addDays(D1, 1));
    expect(p.awards).toHaveLength(0);
    expect(p.stats.currentStreak).toBe(0);
    expect(p.stats.homeworkDays).toBe(2);
  });

  it('宿題をしていない日でも1問以上で進む', () => {
    const p = deriveProgress([rec(D1, 1, false)], D1);
    expect(p.awards[0].character.name).toBe('ブロディ');
  });

  it.each([
    [1, '銅'],
    [2, '銀'],
    [3, '金'],
    [4, 'プラチナ'],
    [5, 'プラチナ＋2'],
    [10, 'プラチナ＋7'],
  ])('初日に%i問で50位の%sスタンプ', (problems, label) => {
    const [award] = deriveProgress([rec(D1, problems)], D1).awards;
    expect(award.character.rank).toBe(50);
    expect(award.grade.label).toBe(label);
  });

  it('同じ日の追加登録では順位が進まない', () => {
    for (const problems of [1, 2, 3, 8]) {
      const p = deriveProgress([rec(D1, problems)], D1);
      expect(p.awards).toHaveLength(1);
      expect(p.awards[0].character.rank).toBe(50);
    }
  });

  it('翌日の達成で49位に進む', () => {
    const p = deriveProgress([rec(D1, 3), rec(addDays(D1, 1), 1)], addDays(D1, 1));
    expect(p.awards[1].character).toEqual({ rank: 49, name: 'コニー・リー' });
    expect(p.awards[1].grade.label).toBe('銅');
  });

  it('休んでも獲得済みキャラは消えず、次は未獲得のキャラから', () => {
    const p = deriveProgress([rec(D1, 1), rec(addDays(D1, 5), 1)], addDays(D1, 5));
    expect(p.awards.map((a) => a.character.rank)).toEqual([50, 49]);
    expect(nextCharacter(p).character.rank).toBe(48);
  });

  it('今日と明日のキャラクターを正しく案内する', () => {
    const before = deriveProgress([rec(D1, 1)], addDays(D1, 1));
    expect(todaySlot(before, addDays(D1, 1)).character.rank).toBe(49);
    expect(todaySlot(before, addDays(D1, 1)).tomorrow.character.rank).toBe(48);
    const after = deriveProgress([rec(D1, 1), rec(addDays(D1, 1), 2)], addDays(D1, 1));
    expect(todaySlot(after, addDays(D1, 1)).character.rank).toBe(49);
    expect(todaySlot(after, addDays(D1, 1)).award?.grade.label).toBe('銀');
  });
});

describe('連続日数と統計', () => {
  it('連続日数を数える', () => {
    const p = deriveProgress(run(D1, 3), addDays(D1, 2));
    expect(p.stats.currentStreak).toBe(3);
    expect(p.stats.longestStreak).toBe(3);
  });

  it('今日が未入力でも昨日まで続いていれば連続は残る', () => {
    expect(deriveProgress(run(D1, 3), addDays(D1, 3)).stats.currentStreak).toBe(3);
  });

  it('1日休むと連続記録が途切れ、最長は残る', () => {
    const p = deriveProgress(run(D1, 3), addDays(D1, 4));
    expect(p.stats.currentStreak).toBe(0);
    expect(p.stats.longestStreak).toBe(3);
    expect(p.stats.achievedDays).toBe(3);
  });

  it('0問の日を挟むと連続が途切れる', () => {
    const p = deriveProgress([rec(D1, 1), rec(addDays(D1, 1), 0), rec(addDays(D1, 2), 1)], addDays(D1, 2));
    expect(p.stats.currentStreak).toBe(1);
    expect(p.stats.longestStreak).toBe(1);
  });

  it('全統計を集計する', () => {
    const p = deriveProgress([rec(D1, 3, true), rec(addDays(D1, 1), 2), rec(addDays(D1, 2), 0, true)], addDays(D1, 2));
    expect(p.stats).toMatchObject({ achievedDays: 2, totalProblems: 5, homeworkDays: 2, collected: 2, remaining: 48, lap: 1 });
  });

  it('月末・年末をまたいでも連続が続く', () => {
    expect(deriveProgress(run('2026-12-30', 4), '2027-01-02').stats.currentStreak).toBe(4);
    expect(deriveProgress(run('2028-02-28', 3), '2028-03-01').stats.currentStreak).toBe(3);
  });
});

describe('過去日の編集', () => {
  const days = [rec(D1, 1), rec(addDays(D1, 1), 1), rec(addDays(D1, 2), 1)];
  const today = addDays(D1, 2);

  it('過去日を0問に直すと以降が繰り上がり、統計も更新される', () => {
    const edited = days.map((r, i) => (i === 0 ? { ...r, problems: 0 } : r));
    const p = deriveProgress(edited, today);
    expect(p.awards.map((a) => [a.date, a.character.rank])).toEqual([[addDays(D1, 1), 50], [addDays(D1, 2), 49]]);
    expect(p.stats.totalProblems).toBe(2);
    expect(p.stats.currentStreak).toBe(2);
  });

  it('休んだ過去日を埋めると順番を保ったまま挿入され、連続がつながる', () => {
    const gap = [rec(D1, 1), rec(addDays(D1, 2), 2)];
    expect(deriveProgress(gap, today).stats.longestStreak).toBe(1);
    const p = deriveProgress([...gap, rec(addDays(D1, 1), 4)], today);
    expect(p.awards.map((a) => a.character.rank)).toEqual([50, 49, 48]);
    expect(p.awards[1].grade.label).toBe('プラチナ');
    expect(p.stats.longestStreak).toBe(3);
  });

  it('問題数だけの修正ではほかの日の割り当てが変わらない', () => {
    const p = deriveProgress(days.map((r, i) => (i === 1 ? { ...r, problems: 7 } : r)), today);
    expect(p.awards.map((a) => a.character.rank)).toEqual([50, 49, 48]);
    expect(p.awards[1].grade.label).toBe('プラチナ＋4');
  });

  it('編集でずれる日数を事前に計算する', () => {
    const p = deriveProgress(days, today);
    expect(shiftImpact(p, D1, 0)).toBe(2);
    expect(shiftImpact(p, D1, 5)).toBe(0);
    expect(shiftImpact(p, today, 0)).toBe(0);
  });
});

describe('50人達成後', () => {
  it('50日目は1位で、残りは0人', () => {
    const p = deriveProgress(run(D1, 50), addDays(D1, 49));
    expect(p.awards[49].character.name).toBe('あさぎりゲン');
    expect(p.stats).toMatchObject({ collected: 50, remaining: 0, lap: 1, longestStreak: 50 });
    expect(nextCharacter(p)).toEqual({ character: { rank: 50, name: 'ブロディ' }, lap: 2 });
  });

  it('51日目から2周目になり、1周目の記録は消えない', () => {
    const p = deriveProgress(run(D1, 53), addDays(D1, 52));
    expect(p.stats).toMatchObject({ lap: 2, collected: 3, remaining: 47, achievedDays: 53 });
    expect(awardsInLap(p, 1).size).toBe(50);
    expect(awardsInLap(p, 2).size).toBe(3);
    expect(awardsInLap(p, 2).get(50)?.date).toBe(addDays(D1, 50));
    expect(awardsInLap(p, 1).get(50)?.date).toBe(D1);
  });
});

describe('日本時間の日付', () => {
  it('14:59:59Zまでは当日、15:00:00Zから翌日', () => {
    expect(todayInTokyo(new Date('2026-11-06T14:59:59Z'))).toBe('2026-11-06');
    expect(todayInTokyo(new Date('2026-11-06T15:00:00Z'))).toBe('2026-11-07');
  });

  it('日付を検証する', () => {
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('2026-1-1')).toBe(false);
    expect(isValidDate(20260101)).toBe(false);
  });

  it('月カレンダーの先頭の空きと日数が正しい', () => {
    const cells = monthCells(2026, 11); // 2026-11-01 は日曜
    expect(cells[0]?.date).toBe('2026-11-01');
    expect(cells.filter(Boolean)).toHaveLength(30);
    expect(monthCells(2026, 4).slice(0, 3)).toEqual([null, null, null]); // 2026-04-01 は水曜
  });
});

describe('バックアップ', () => {
  const today = '2026-11-06';
  const records = [rec('2026-11-01', 3, true), rec('2026-11-02', 0)];

  it('書き出して読み戻すと同じ内容になる', () => {
    expect(parseBackup(buildBackup(records), today)).toEqual(records);
  });

  const wrap = (rs: unknown) => JSON.stringify({ app: 'dr-stone-study-quest', type: 'backup', schemaVersion: 1, records: rs });

  it.each([
    ['JSONでない', 'hello'],
    ['別アプリ', JSON.stringify({ app: 'other', records: [] })],
    ['新しい形式', JSON.stringify({ app: 'dr-stone-study-quest', type: 'backup', schemaVersion: 99, records: [] })],
    ['不正な日付', wrap([rec('2026-13-01', 1)])],
    ['未来の日付', wrap([rec('2026-11-07', 1)])],
    ['日付の重複', wrap([rec('2026-11-01', 1), rec('2026-11-01', 2)])],
    ['負の問題数', wrap([rec('2026-11-01', -1)])],
    ['小数の問題数', wrap([rec('2026-11-01', 1.5)])],
    ['宿題が真偽値でない', wrap([{ date: '2026-11-01', problems: 1, homework: 'yes' }])],
  ])('%sのファイルは拒否する', (_, text) => {
    expect(() => parseBackup(text, today)).toThrow(ImportError);
  });

  it('統合は既存の記録を変えず、足りない日だけ足す', () => {
    const plan = planMerge(
      [rec('2026-11-01', 5), rec('2026-11-02', 1)],
      [rec('2026-11-01', 9), rec('2026-11-02', 1), rec('2026-11-03', 2)],
    );
    expect(plan.added.map((r) => r.date)).toEqual(['2026-11-03']);
    expect(plan.identical).toBe(1);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.merged.find((r) => r.date === '2026-11-01')?.problems).toBe(5);
  });
});

describe('画像パック', () => {
  const pack = (images: unknown) => JSON.stringify({ app: 'dr-stone-study-quest', type: 'image-pack', version: 1, images });

  it('正しいパックを読み込む', () => {
    expect(parseImagePack(pack({ 50: 'data:image/webp;base64,AAAA' }))).toEqual({ 50: 'data:image/webp;base64,AAAA' });
  });

  it.each([
    ['SVG', { 50: 'data:image/svg+xml;base64,AAAA' }],
    ['外部URL', { 50: 'https://example.com/a.png' }],
    ['範囲外の順位', { 51: 'data:image/png;base64,AAAA' }],
    ['空', {}],
  ])('%sは拒否する', (_, images) => {
    expect(() => parseImagePack(pack(images))).toThrow(ImportError);
  });
});
