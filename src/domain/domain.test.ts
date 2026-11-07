import { describe, expect, it } from 'vitest';
import { ImportError, buildBackup, parseBackup, parseImagePack, planMerge, readRescueInterval } from './backup';
import { CHARACTERS, characterAtOrder } from './characters';
import { WrongPassphraseError, decryptPack, encryptPack } from './encryptedPack';
import { addDays, isValidDate, monthCells, todayInTokyo } from './date';
import { gradeFor, normalizeProblems } from './grade';
import { LEVELS, lapLabel, levelForLap } from './levels';
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

describe('文明レベル', () => {
  it('7段階あり、50人ごとに進み、8周目以降はレベル7のまま', () => {
    expect(LEVELS.map((l) => l.level)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(levelForLap(1).name).toBe('石器時代レベル');
    expect(levelForLap(7).name).toBe('宇宙開発・現代・未来レベル');
    expect(levelForLap(9).level).toBe(7);
    expect(lapLabel(2)).toBe('レベル2');
    expect(lapLabel(8)).toBe('レベル7・8周目');
  });

  it('50人目まではレベル1、51人目からレベル2', () => {
    const fifty = deriveProgress(run(D1, 50), addDays(D1, 49));
    expect(todaySlot(fifty, addDays(D1, 49)).lap).toBe(1);
    const next = deriveProgress(run(D1, 50), addDays(D1, 50));
    expect(todaySlot(next, addDays(D1, 50))).toMatchObject({ lap: 2, position: 1 });
  });
});

describe('お助けアイテム', () => {
  const rescue = (date: string, homework = false): DayRecord => ({ ...rec(date, 0, homework), rescue: true });
  const day = (i: number) => addDays(D1, i);

  it('19日では0個、連続20日で1個、40日で2個', () => {
    expect(deriveProgress(run(D1, 19), day(18)).stats).toMatchObject({ rescueItems: 0, nextRescueIn: 1 });
    expect(deriveProgress(run(D1, 20), day(19)).stats).toMatchObject({ rescueItems: 1, nextRescueIn: 20 });
    expect(deriveProgress(run(D1, 40), day(39)).stats.rescueItems).toBe(2);
  });

  it('日数の設定を変えると、もらえる数が計算し直される', () => {
    expect(deriveProgress(run(D1, 20), day(19), 10).stats).toMatchObject({ rescueItems: 2, nextRescueIn: 10 });
    expect(deriveProgress(run(D1, 20), day(19), 30).stats).toMatchObject({ rescueItems: 0, nextRescueIn: 10 });
  });

  it('連続が途切れた日数はアイテムに数えない', () => {
    const p = deriveProgress([...run(D1, 10), ...run(day(11), 10)], day(20));
    expect(p.stats.rescueItems).toBe(0);
    expect(p.stats.currentStreak).toBe(10);
  });

  it('休んだ翌日に使える。達成済みでも今日のうちは使える', () => {
    const records = run(D1, 20);
    expect(deriveProgress(records, day(21)).pendingRescue).toEqual([day(20)]);
    expect(deriveProgress([...records, rec(day(21), 1)], day(21)).pendingRescue).toEqual([day(20)]);
  });

  it('使うと連続がつながり、アイテムが減る。その日は日数に足さない', () => {
    const records = [...run(D1, 20), rescue(day(20))];
    const p = deriveProgress(records, day(21));
    expect(p.stats).toMatchObject({ currentStreak: 20, rescueItems: 0, achievedDays: 20 });
    expect(p.rescuedDates.has(day(20))).toBe(true);
    expect(p.pendingRescue).toEqual([]);
    expect(p.awardByDate.has(day(20))).toBe(false);
    const after = deriveProgress([...records, rec(day(21), 1)], day(21));
    expect(after.stats).toMatchObject({ currentStreak: 21, longestStreak: 21, rescueItems: 0 });
  });

  it('使った日を挟んでも同じ節目で二重にもらえない', () => {
    const records = [...run(D1, 20), rescue(day(20)), ...run(day(21), 19)];
    expect(deriveProgress(records, day(39)).stats).toMatchObject({ currentStreak: 39, rescueItems: 0 });
    expect(deriveProgress([...records, rec(day(40), 1)], day(40)).stats).toMatchObject({ currentStreak: 40, rescueItems: 1 });
  });

  it('宿題だけの日にも使える', () => {
    const records = [...run(D1, 20), rec(day(20), 0, true)];
    expect(deriveProgress(records, day(21)).pendingRescue).toEqual([day(20)]);
  });

  it('翌日を過ぎると使えない', () => {
    const records = [...run(D1, 20), rec(day(21), 1)];
    expect(deriveProgress(records, day(22)).pendingRescue).toEqual([]);
  });

  it('アイテムが足りない空白には使えない。足りれば2日分でも使える', () => {
    expect(deriveProgress(run(D1, 20), day(22)).pendingRescue).toEqual([]);
    expect(deriveProgress(run(D1, 40), day(41)).pendingRescue).toEqual([day(40)]);
    expect(deriveProgress(run(D1, 40), day(42)).pendingRescue).toEqual([day(40), day(41)]);
  });

  it('記録がない・アイテムがないときは案内しない', () => {
    expect(deriveProgress([], D1).pendingRescue).toEqual([]);
    expect(deriveProgress(run(D1, 3), day(4)).pendingRescue).toEqual([]);
  });

  it('使った日を1問以上に直すとアイテムが戻る', () => {
    const p = deriveProgress([...run(D1, 20), { ...rec(day(20), 2), rescue: true }], day(20));
    expect(p.stats).toMatchObject({ rescueItems: 1, currentStreak: 21 });
    expect(p.rescuedDates.size).toBe(0);
  });

  it('過去日を直してアイテムが足りなくなると、その印は無効になる', () => {
    const records = [...run(D1, 20), rescue(day(20)), rec(day(21), 1)];
    const edited = records.map((r) => (r.date === day(5) ? { ...r, problems: 0 } : r));
    const p = deriveProgress(edited, day(21));
    expect(p.rescuedDates.size).toBe(0);
    expect(p.stats.rescueItems).toBe(0);
    expect(p.stats.currentStreak).toBe(1);
  });

  it('バックアップで使った日と日数の設定が保たれる', () => {
    const records = [...run(D1, 20), rescue(day(20), true)];
    const text = buildBackup(records, new Date('2026-05-01T00:00:00Z'), 15);
    expect(parseBackup(text, day(21))[20]).toMatchObject({ date: day(20), rescue: true, homework: true });
    expect(readRescueInterval(text)).toBe(15);
    expect(readRescueInterval(buildBackup(records))).toBeNull();
  });

  it('統合では使ったかどうかの違いも差分として数える', () => {
    const plan = planMerge([rec(D1, 0)], [rescue(D1)]);
    expect(plan.identical).toBe(0);
    expect(plan.conflicts).toHaveLength(1);
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

describe('合言葉つき画像パック', () => {
  const ITER = 1000; // テストを速くするため回数を減らす

  it('正しい合言葉で元に戻る。大文字化や前後の空白は吸収する', async () => {
    const pack = await encryptPack('秘密のデータ', 'abcd-efgh', ITER);
    expect(pack.data).not.toContain('秘密');
    expect(await decryptPack(pack, 'abcd-efgh')).toBe('秘密のデータ');
    expect(await decryptPack(pack, ' Abcd-efgh ')).toBe('秘密のデータ');
  });

  it('違う合言葉では復号できない', async () => {
    const pack = await encryptPack('秘密のデータ', 'abcd-efgh', ITER);
    await expect(decryptPack(pack, 'zzzz-zzzz')).rejects.toBeInstanceOf(WrongPassphraseError);
  });
});
