export type GradeTier = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'platinum-plus';

export interface Grade {
  tier: GradeTier;
  /** プラチナ＋N の N。5問以上で 問題数−3 */
  plus: number;
  label: string;
  /** カレンダーなど狭い場所用の表記 */
  short: string;
  /** 演出の豪華さ 0〜3 */
  sparkle: 0 | 1 | 2 | 3;
}

export const MAX_PROBLEMS = 999;

export function normalizeProblems(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_PROBLEMS, Math.max(0, Math.floor(value)));
}

export function gradeFor(problems: number): Grade {
  const n = normalizeProblems(problems);
  if (n === 0) return { tier: 'none', plus: 0, label: 'スタンプなし', short: '', sparkle: 0 };
  if (n === 1) return { tier: 'bronze', plus: 0, label: '銅', short: '銅', sparkle: 0 };
  if (n === 2) return { tier: 'silver', plus: 0, label: '銀', short: '銀', sparkle: 0 };
  if (n === 3) return { tier: 'gold', plus: 0, label: '金', short: '金', sparkle: 0 };
  if (n === 4) return { tier: 'platinum', plus: 0, label: 'プラチナ', short: 'PT', sparkle: 0 };
  const plus = n - 3;
  return {
    tier: 'platinum-plus',
    plus,
    label: `プラチナ＋${plus}`,
    short: `PT+${plus}`,
    sparkle: plus >= 7 ? 3 : plus >= 4 ? 2 : 1,
  };
}
