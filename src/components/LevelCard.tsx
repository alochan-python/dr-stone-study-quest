import { useState } from 'react';
import { TOTAL_CHARACTERS } from '../domain/characters';
import { LEVELS, levelForLap } from '../domain/levels';
import { useApp } from '../state/store';
import { Modal } from './Modal';

/** 今の文明レベルとお助けアイテムをまとめて見せる。タップで7段階の一覧を開く */
export function LevelCard({ lap, collected }: { lap: number; collected: number }) {
  const { progress, settings } = useApp();
  const { stats } = progress;
  const [open, setOpen] = useState(false);
  const current = levelForLap(lap);

  return (
    <>
      <button className="level-card" onClick={() => setOpen(true)} data-testid="level-card">
        <span className="level-head">
          <span className="level-badge">レベル{current.level}</span>
          <span className="level-name">{current.name}</span>
          <span className="level-more" aria-hidden="true">›</span>
        </span>
        <span className="level-bar" aria-hidden="true">
          <i style={{ width: `${(collected / TOTAL_CHARACTERS) * 100}%` }} />
        </span>
        <span className="level-foot">
          <span data-testid="level-count">{collected}/{TOTAL_CHARACTERS}人</span>
          <span data-testid="rescue-items">
            🧪 お助けアイテム <b>{stats.rescueItems}</b>個<span className="level-tail">・次まで連続あと{stats.nextRescueIn}日</span>
          </span>
        </span>
      </button>
      {open && (
        <Modal title="文明レベル" onClose={() => setOpen(false)}>
          <p className="panel-note">
            {TOTAL_CHARACTERS}人そろえると次のレベルへ進みます。連続{settings.rescueInterval}日達成ごとにお助けアイテムを1個もらえます。お休みの翌日に使うと連続記録がつながります。
          </p>
          <p className="panel-note" data-testid="rescue-summary">
            🧪 今のお助けアイテム：{stats.rescueItems}個（次まで連続あと{stats.nextRescueIn}日）
          </p>
          <ol className="level-list" data-testid="level-list">
            {LEVELS.map((level) => {
              const reached = level.level <= current.level;
              return (
                <li key={level.level} className={`${reached ? 'is-reached' : 'is-future'}${level === current ? ' is-current' : ''}`}>
                  <h4>
                    レベル{level.level} {level.name}
                    <small>{level.theme}</small>
                  </h4>
                  {reached ? (
                    <>
                      <p className="level-items">{level.items.join('・')}</p>
                      <p className="level-point">{level.point}</p>
                    </>
                  ) : (
                    <p className="level-locked">このレベルに進むと内容が見られます</p>
                  )}
                </li>
              );
            })}
          </ol>
        </Modal>
      )}
    </>
  );
}
