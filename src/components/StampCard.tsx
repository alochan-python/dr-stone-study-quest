import type { Character } from '../domain/characters';
import type { Grade } from '../domain/grade';
import { Portrait } from './Portrait';

function SealText({ grade }: { grade: Grade }) {
  if (grade.tier === 'platinum-plus') {
    return (
      <>
        <span className="seal-sub">プラチナ</span>
        <span className="seal-plus">＋{grade.plus}</span>
      </>
    );
  }
  return <span className={grade.tier === 'platinum' ? 'seal-long' : 'seal-main'}>{grade.label}</span>;
}

/** グレードの違いは枠・背景・装飾だけで表し、キャラ画像自体は変えない */
export function StampCard({
  character,
  grade,
  lap,
  homework = false,
}: {
  character: Character;
  grade: Grade;
  lap: number;
  homework?: boolean;
}) {
  const earned = grade.tier !== 'none';
  return (
    <div
      className={`stamp-card t-${grade.tier} sparkle-${grade.sparkle}${lap >= 2 ? ' lap-special' : ''}`}
      data-testid="stamp-card"
      data-grade={grade.label}
    >
      {grade.sparkle >= 2 && <div className="rays" aria-hidden="true" />}
      {lap >= 2 && <div className="lap-ribbon">{lap}周目 特別枠</div>}
      <div className="hex-stack">
        <div className="hex-frame">
          <Portrait character={character} locked={!earned} />
        </div>
        {grade.sparkle > 0 && (
          <div className="sparks" aria-hidden="true">
            {Array.from({ length: Math.min(12, grade.plus + 2) }, (_, i) => (
              <i key={i} style={{ '--i': i } as React.CSSProperties} />
            ))}
          </div>
        )}
        {earned ? (
          <div className="seal" key={grade.label} data-testid="seal">
            <SealText grade={grade} />
          </div>
        ) : (
          <div className="seal seal-empty" data-testid="seal">
            <span className="seal-sub">スタンプ</span>
            <span className="seal-sub">なし</span>
          </div>
        )}
        {homework && (
          <div className="homework-stamp" aria-label="宿題達成スタンプ" title="宿題達成">
            <span aria-hidden="true">✅</span> 宿題
          </div>
        )}
      </div>
      <div className="plate">
        <span className="plate-rank">{character.rank}位</span>
        <strong className="plate-name">{character.name}</strong>
      </div>
    </div>
  );
}
