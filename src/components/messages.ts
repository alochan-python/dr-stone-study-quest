import { gradeFor } from '../domain/grade';

export function awardMessage(homework: boolean, problems: number, name?: string): string {
  if (problems > 0 && name) return `${name}の${gradeFor(problems).label}スタンプ！保存しました`;
  if (homework) return '宿題を記録しました。キャラクターは自主勉強1問以上で進みます';
  return '0問で記録しました';
}
