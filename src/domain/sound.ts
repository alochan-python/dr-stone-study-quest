import type { Grade } from './grade';

// 音声ファイルを持たず合成するので、オフラインでも鳴り追加ダウンロードも不要
type AudioCtor = typeof AudioContext;

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (context) return context;
  const Ctor: AudioCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  return context;
}

/** iOS はタップ処理の中で起こさないと鳴らないため、await より前に呼ぶ */
export function unlockAudio(): void {
  try {
    const ctx = getContext();
    if (ctx?.state === 'suspended') void ctx.resume();
  } catch {
    // 音が出なくても記録には影響させない
  }
}

function tone(ctx: AudioContext, frequency: number, start: number, length: number, volume: number, type: OscillatorType) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

const CHIME = [659.25, 783.99, 987.77, 1318.51, 1567.98, 1975.53];

/** グレードが上がるほど音の数が増える音階を返す（0問・宿題のみは空） */
export function chimeNotes(grade: Grade): number[] {
  const count = { none: 0, bronze: 1, silver: 2, gold: 3, platinum: 4, 'platinum-plus': 4 + grade.sparkle }[grade.tier];
  return CHIME.slice(0, Math.min(CHIME.length, count));
}

/** 保存を確定した時の音。スタンプを押す「ポン」に、グレード分のチャイムを重ねる */
export function playConfirmSound(grade: Grade): void {
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime + 0.01;
    tone(ctx, 170, now, 0.13, 0.5, 'triangle');
    tone(ctx, 1200, now, 0.03, 0.12, 'square');
    chimeNotes(grade).forEach((frequency, i) => {
      tone(ctx, frequency, now + 0.07 + i * 0.075, 0.32, 0.2, 'sine');
    });
  } catch {
    // 音が出なくても記録には影響させない
  }
}
