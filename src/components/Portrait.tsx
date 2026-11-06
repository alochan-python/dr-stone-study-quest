import type { Character } from '../domain/characters';
import { useApp } from '../state/store';

/**
 * 画像パックがあれば切り出し画像を、なければ順位と頭文字の仮画像を表示する。
 * 公開版には画像を含めず、仮画像はキャラクターの絵柄に似せない。
 */
export function Portrait({ character, locked = false }: { character: Character; locked?: boolean }) {
  const { images } = useApp();
  const src = images[character.rank];
  const className = `portrait${locked ? ' is-locked' : ''}`;

  if (src) return <img className={className} src={src} alt={character.name} draggable={false} />;

  const hue = (character.rank * 47) % 360;
  return (
    <svg className={className} viewBox="0 0 100 100" role="img" aria-label={`${character.name}（仮画像）`}>
      <defs>
        <linearGradient id={`ph-${character.rank}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 52% 42%)`} />
          <stop offset="1" stopColor={`hsl(${(hue + 50) % 360} 58% 20%)`} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#ph-${character.rank})`} />
      <path d="M0 72 L24 58 L44 70 L68 52 L100 68 V100 H0 Z" fill="#000" opacity="0.2" />
      <text x="50" y="46" textAnchor="middle" fontSize="36" fontWeight="900" fill="#fff">
        {character.name.charAt(0)}
      </text>
      <text x="50" y="72" textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff" opacity="0.85">
        No.{character.rank}
      </text>
    </svg>
  );
}
