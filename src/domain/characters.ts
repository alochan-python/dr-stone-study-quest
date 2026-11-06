export interface Character {
  rank: number;
  name: string;
}

export const TOTAL_CHARACTERS = 50;

// 提供されたランキング画像に記載の順位・表記をそのまま転記（1位→50位）
const NAMES_BY_RANK = [
  'あさぎりゲン',
  '石神千空',
  '七海龍水',
  '西園寺羽京',
  'ゼノ・ヒューストン・ウィングフィールド',
  '獅子王 司',
  'スタンリー・スナイダー',
  '氷月',
  'コハク',
  '七海SAI',
  'スイカ',
  'クロム',
  'フランソワ',
  '金狼',
  '銀狼',
  '大木大樹',
  '小川 杠',
  '花田仁姫',
  'モズ',
  '石神百夜',
  'メカ千空',
  '上井 陽',
  'キリサメ',
  'ジョエル',
  'ルリ',
  'カセキ',
  'ルーナ・ライト',
  'チェルシー',
  '松風',
  'チタン',
  'ソユーズ',
  'ホワイマン',
  'リリアン・ワインバーグ',
  '紅葉ほむら',
  '北東西 南',
  '獅子王未来',
  'マグマ',
  'アマリリス',
  'チョーク',
  'イバラ',
  'ジャスパー',
  'マントル',
  'サガラ',
  'リューさん',
  'シャミール・ヴァルコフ',
  'シャーロット',
  'ナマリ',
  'コクヨウ',
  'コニー・リー',
  'ブロディ',
];

/** 登場順（50位→1位） */
export const CHARACTERS: Character[] = NAMES_BY_RANK.map((name, i) => ({ rank: i + 1, name })).reverse();

/** order は通算の達成回数（1始まり）。51回目は2周目の50位に戻る */
export function characterAtOrder(order: number): Character {
  return CHARACTERS[(order - 1) % TOTAL_CHARACTERS];
}

export function lapAtOrder(order: number): number {
  return Math.floor((order - 1) / TOTAL_CHARACTERS) + 1;
}

export function positionInLap(order: number): number {
  return ((order - 1) % TOTAL_CHARACTERS) + 1;
}
