import { useState } from 'react';
import { Portrait } from '../components/Portrait';
import { formatJa, monthCells } from '../domain/date';
import { useApp } from '../state/store';

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

export function CalendarView({ onEditDay }: { onEditDay(date: string): void }) {
  const { progress, today } = useApp();
  const [todayYear, todayMonth] = today.split('-').map(Number);
  const [{ year, month }, setCursor] = useState({ year: todayYear, month: todayMonth });
  const cells = monthCells(year, month);
  const isCurrentMonth = year === todayYear && month === todayMonth;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  const inMonth = progress.awards.filter((a) => a.date.startsWith(monthKey));
  const homeworkInMonth = [...progress.recordByDate.values()].filter((r) => r.date.startsWith(monthKey) && r.homework).length;

  const move = (delta: number) => {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    setCursor({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
  };

  return (
    <div className="page">
      <header className="page-head cal-head">
        <button className="icon-btn" onClick={() => move(-1)} aria-label="前の月">‹</button>
        <h2 data-testid="calendar-month">{year}年{month}月</h2>
        <button className="icon-btn" onClick={() => move(1)} disabled={isCurrentMonth} aria-label="次の月">›</button>
      </header>
      <p className="cal-summary">
        自主勉強 <b>{inMonth.length}</b>日 ・ <b>{inMonth.reduce((sum, a) => sum + a.problems, 0)}</b>問 ・ 宿題 <b>{homeworkInMonth}</b>日
      </p>
      <div className="cal-week" aria-hidden="true">
        {WEEK.map((w) => <span key={w}>{w}</span>)}
      </div>
      <div className="cal-grid">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`blank-${i}`} className="cal-blank" />;
          const record = progress.recordByDate.get(cell.date);
          const award = progress.awardByDate.get(cell.date);
          const future = cell.date > today;
          const description = !record
            ? '未入力'
            : `${record.homework ? '宿題済み、' : ''}${record.problems}問${award ? `、${award.grade.label}、${award.character.name}` : ''}`;
          return (
            <button
              key={cell.date}
              className={`cal-cell${cell.date === today ? ' is-today' : ''}${award ? ` t-${award.grade.tier}` : ''}${record ? '' : ' is-empty'}`}
              disabled={future}
              onClick={() => onEditDay(cell.date)}
              aria-label={`${formatJa(cell.date)} ${future ? '' : description}`}
              data-testid={`day-${cell.date}`}
              data-state={!record ? 'empty' : record.problems === 0 ? 'zero' : 'achieved'}
            >
              <span className="cal-top">
                <span className="cal-day">{cell.day}</span>
                {record?.homework && <span className="cal-hw" title="宿題完了">✅</span>}
              </span>
              {award && (
                <span className="cal-thumb"><Portrait character={award.character} /></span>
              )}
              {record && record.problems === 0 && <span className="cal-zero">0問</span>}
              {award && (
                <span className="cal-meta">{award.problems}問 <b>{award.grade.short}</b></span>
              )}
            </button>
          );
        })}
      </div>
      <ul className="cal-legend">
        <li>✅ 宿題完了</li>
        <li><span className="legend-empty" /> 空欄＝未入力</li>
        <li>0問＝入力したが0問</li>
        <li>銅・銀・金・PT＝スタンプ（PT＝プラチナ）</li>
      </ul>
      <p className="page-note">日付をタップすると、その日の記録を確認・修正できます。</p>
    </div>
  );
}
