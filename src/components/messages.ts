import { gradeFor } from '../domain/grade';
import { LEVELS, levelForLap } from '../domain/levels';

/** 新しく達成した日の節目。レベルの区切りと、連続日数の節目ごとのアイテム獲得を知らせる */
export function milestoneMessage(lap: number, position: number, streak: number, rescueInterval: number): string {
  const parts: string[] = [];
  if (position === 1 && lap >= 2 && lap <= LEVELS.length) parts.push(`文明レベルアップ！${levelForLap(lap).name}へ`);
  if (position === 50 && lap <= LEVELS.length) parts.push(`${levelForLap(lap).name}クリア！`);
  if (streak % rescueInterval === 0) parts.push('お助けアイテムをゲット！');
  return parts.join(' ');
}

export function awardMessage(homework: boolean, problems: number, name?: string): string {
  if (problems > 0 && name) return `${name}の${gradeFor(problems).label}スタンプ！保存しました`;
  if (homework) return '宿題を記録しました。キャラクターは自主勉強1問以上で進みます';
  return '0問で記録しました';
}
