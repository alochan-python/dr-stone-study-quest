import { Portrait } from '../components/Portrait';
import { TOTAL_CHARACTERS } from '../domain/characters';
import { formatJa } from '../domain/date';
import { LEVELS, lapLabel } from '../domain/levels';
import { useApp } from '../state/store';

export function Complete({ onBack }: { onBack(): void }) {
  const { progress } = useApp();
  const firstLap = progress.awards.filter((a) => a.lap === 1);

  if (firstLap.length < TOTAL_CHARACTERS) {
    return (
      <div className="page">
        <h2>まだ達成していません</h2>
        <p className="page-note">あと{TOTAL_CHARACTERS - firstLap.length}人で達成です。</p>
        <button className="btn btn-primary" onClick={onBack}>ホームへ戻る</button>
      </div>
    );
  }

  return (
    <div className="page complete" data-testid="complete-screen">
      <header className="complete-hero">
        <p className="complete-kicker">ALL {TOTAL_CHARACTERS} CHARACTERS</p>
        <h2>50日達成！</h2>
        <p>{TOTAL_CHARACTERS}人のキャラクターが全員そろいました</p>
        <p>{LEVELS[0].name}クリア！ 次は{LEVELS[1].name}です</p>
      </header>
      <ul className="complete-crowd" aria-label="50人のキャラクター">
        {firstLap.map((a) => (
          <li key={a.character.rank} className={`crowd-hex t-${a.grade.tier}`}>
            <Portrait character={a.character} />
          </li>
        ))}
      </ul>
      <dl className="stat-grid stat-grid-2">
        <div className="stat"><dt>累計問題数</dt><dd data-testid="complete-total">{progress.stats.totalProblems}<small>問</small></dd></div>
        <div className="stat"><dt>最長連続記録</dt><dd data-testid="complete-longest">{progress.stats.longestStreak}<small>日</small></dd></div>
      </dl>
      <button className="btn btn-save" onClick={onBack}>
        {progress.stats.lap >= 2 ? `${lapLabel(progress.stats.lap)}を続ける` : 'レベル2へ進む'}
      </button>
      <section className="panel">
        <h3>50日間の達成履歴</h3>
        <div className="history-scroll">
          <table className="history">
            <thead>
              <tr><th>人目</th><th>日付</th><th>キャラクター</th><th>問題</th><th>スタンプ</th></tr>
            </thead>
            <tbody>
              {firstLap.map((a) => (
                <tr key={a.order}>
                  <td>{a.order}</td>
                  <td>{formatJa(a.date)}</td>
                  <td>{a.character.rank}位 {a.character.name}</td>
                  <td>{a.problems}問</td>
                  <td>{a.grade.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
