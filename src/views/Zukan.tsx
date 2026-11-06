import { useState } from 'react';
import { Modal } from '../components/Modal';
import { Portrait } from '../components/Portrait';
import { StampCard } from '../components/StampCard';
import { CHARACTERS, TOTAL_CHARACTERS } from '../domain/characters';
import { formatJaFull } from '../domain/date';
import { awardsInLap, type Award } from '../domain/progress';
import { useApp } from '../state/store';

export function Zukan({ onEditDay }: { onEditDay(date: string): void }) {
  const { progress } = useApp();
  const [lap, setLap] = useState(progress.stats.lap);
  const [selected, setSelected] = useState<Award | null>(null);
  const awards = awardsInLap(progress, lap);

  return (
    <div className="page">
      <header className="page-head">
        <h2>スタンプ帳</h2>
        <p className="page-sub">
          <b data-testid="zukan-count">{awards.size}</b> / {TOTAL_CHARACTERS}人
        </p>
      </header>
      {progress.stats.lap >= 2 && (
        <div className="lap-tabs" role="tablist" aria-label="周の切り替え">
          {Array.from({ length: progress.stats.lap }, (_, i) => i + 1).map((n) => (
            <button key={n} role="tab" aria-selected={n === lap} className={n === lap ? 'is-on' : ''} onClick={() => setLap(n)}>
              {n}周目
            </button>
          ))}
        </div>
      )}
      <ul className={`zukan-grid${lap >= 2 ? ' lap-special' : ''}`}>
        {CHARACTERS.map((c) => {
          const award = awards.get(c.rank);
          const content = (
            <>
              <span className="tile-rank">{c.rank}位</span>
              <span className={`tile-hex t-${award ? award.grade.tier : 'none'}`}>
                <Portrait character={c} locked={!award} />
              </span>
              <span className="tile-name">{c.name}</span>
              <span className="tile-grade">{award ? award.grade.label : '未達成'}</span>
            </>
          );
          return (
            <li key={c.rank} data-testid={`tile-${c.rank}`} data-earned={award ? 'true' : 'false'}>
              {award ? (
                <button className="tile" onClick={() => setSelected(award)}>{content}</button>
              ) : (
                <div className="tile is-locked">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
      {selected && (
        <Modal title={`${selected.character.rank}位 ${selected.character.name}`} onClose={() => setSelected(null)}>
          <div className="detail-card">
            <StampCard character={selected.character} grade={selected.grade} lap={selected.lap} />
          </div>
          <dl className="detail-list">
            <div><dt>キャラクター名</dt><dd>{selected.character.name}</dd></div>
            <div><dt>順位</dt><dd>{selected.character.rank}位</dd></div>
            <div><dt>達成した日</dt><dd>{formatJaFull(selected.date)}</dd></div>
            <div><dt>解いた問題数</dt><dd>{selected.problems}問</dd></div>
            <div><dt>グレード</dt><dd>{selected.grade.label}</dd></div>
            {selected.lap >= 2 && <div><dt>周</dt><dd>{selected.lap}周目</dd></div>}
          </dl>
          <div className="modal-actions">
            <button
              className="btn btn-primary"
              onClick={() => {
                const { date } = selected;
                setSelected(null);
                onEditDay(date);
              }}
            >
              この日の記録を修正
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
