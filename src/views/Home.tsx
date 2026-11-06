import { useEffect, useRef, useState } from 'react';
import { ImageUnlock } from '../components/ImageUnlock';
import { awardMessage } from '../components/messages';
import { Portrait } from '../components/Portrait';
import { StampCard } from '../components/StampCard';
import { Stepper } from '../components/Stepper';
import { TOTAL_CHARACTERS } from '../domain/characters';
import { formatJa, formatJaFull } from '../domain/date';
import { gradeFor } from '../domain/grade';
import { nextCharacter, todaySlot } from '../domain/progress';
import { useApp } from '../state/store';

const BACKUP_REMINDER_DAYS = 14;

export function Home({ onOpen }: { onOpen(view: 'records' | 'complete'): void }) {
  const { today, progress, draft, setDraft, saveDay, notify, settings, images } = useApp();
  const { stats } = progress;
  const slot = todaySlot(progress, today);
  const next = nextCharacter(progress);
  const record = progress.recordByDate.get(today);

  // 未保存の入力は日付に紐づける。日付をまたいだ下書きを今日の分に混ぜない
  const staleDraft = draft && draft.date !== today ? draft : null;
  const activeDraft = draft?.date === today ? draft : null;
  const homework = activeDraft?.homework ?? record?.homework ?? false;
  const problems = activeDraft?.problems ?? record?.problems ?? 0;
  const dirty = activeDraft !== null;
  const grade = gradeFor(problems);

  const update = (patch: { homework?: boolean; problems?: number }) => {
    const edited = { date: today, homework, problems, ...patch };
    const unchanged = edited.homework === (record?.homework ?? false) && edited.problems === (record?.problems ?? 0);
    setDraft(unchanged ? null : edited);
  };

  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const ok = await saveDay(today, homework, problems);
    setSaving(false);
    if (ok) notify({ kind: 'success', text: awardMessage(homework, problems, slot.character.name) });
  };

  const resolveStale = async (keep: boolean) => {
    if (!staleDraft) return;
    if (keep) {
      if (await saveDay(staleDraft.date, staleDraft.homework, staleDraft.problems)) {
        notify({ kind: 'success', text: `${formatJaFull(staleDraft.date)}の分として保存しました` });
      }
    } else {
      setDraft(null);
    }
  };

  // グレードが変わった瞬間だけ光らせる
  const previousLabel = useRef(grade.label);
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    if (previousLabel.current !== grade.label) {
      previousLabel.current = grade.label;
      setFlash((n) => n + 1);
    }
  }, [grade.label]);

  const backupAge = settings.lastBackupAt
    ? (Date.now() - new Date(settings.lastBackupAt).getTime()) / 86_400_000
    : Infinity;
  const needsBackup = stats.achievedDays >= 7 && backupAge > BACKUP_REMINDER_DAYS;

  return (
    <div className="home">
      <header className="topbar">
        <h1>
          <span className="brand">Dr.STONE</span> 勉強50日チャレンジ
        </h1>
        <dl className="chips">
          <div className="chip chip-fire">
            <dt>連続</dt>
            <dd data-testid="current-streak">{stats.currentStreak}<small>日</small></dd>
          </div>
          <div className="chip">
            <dt>累計</dt>
            <dd data-testid="achieved-days">{stats.achievedDays}<small>日</small></dd>
          </div>
          <div className="chip chip-next">
            <dt>次に登場</dt>
            <dd data-testid="next-character">
              <span className="chip-thumb"><Portrait character={next.character} /></span>
              <span className="chip-name">{next.character.rank}位 {next.character.name}</span>
            </dd>
          </div>
        </dl>
      </header>

      {Object.keys(images).length === 0 && (
        <div className="image-hint" data-testid="image-hint">
          <p>合言葉を入れるとキャラクターが表示されます（端末ごとに1回）</p>
          <ImageUnlock />
        </div>
      )}

      {staleDraft && (
        <div className="banner" role="alert">
          <p>
            {formatJa(staleDraft.date)}の未保存の入力があります（{staleDraft.problems}問
            {staleDraft.homework ? '・宿題済み' : ''}）
          </p>
          <div className="banner-actions">
            <button className="btn btn-primary btn-sm" onClick={() => void resolveStale(true)}>{formatJa(staleDraft.date)}に保存</button>
            <button className="btn btn-sm" onClick={() => void resolveStale(false)}>捨てる</button>
          </div>
        </div>
      )}
      {stats.achievedDays >= TOTAL_CHARACTERS && (
        <button className="banner banner-gold" onClick={() => onOpen('complete')}>
          50日達成！ 記念画面を見る ›
        </button>
      )}

      <div className="home-grid">
        <section className="stage" aria-label="今日のキャラクター">
          <p className="stage-date">
            {formatJa(today)}
            <span className="stage-count">
              {slot.lap >= 2 ? `${slot.lap}周目 ` : ''}{slot.position}/{TOTAL_CHARACTERS}人目
            </span>
          </p>
          <div className="stage-card" key={flash}>
            {flash > 0 && <div className="flash" aria-hidden="true" />}
            <StampCard character={slot.character} grade={grade} lap={slot.lap} homework={homework} />
          </div>
          <p className="stage-status" data-testid="stage-status" aria-live="polite">
            {problems === 0
              ? '1問解くとスタンプ獲得！'
              : `${grade.label}スタンプ${dirty ? '（保存で確定）' : '獲得済み'}`}
          </p>
        </section>

        <section className="controls" aria-label="今日の記録">
          <label className={`homework-check${homework ? ' is-on' : ''}`}>
            <input type="checkbox" checked={homework} onChange={(e) => update({ homework: e.target.checked })} />
            <span>宿題を終えた</span>
          </label>
          <div className="problems-field">
            <p className="field-label">宿題以外に自分で解いた問題数</p>
            <Stepper value={problems} onChange={(value) => update({ problems: value })} />
          </div>
          <button className={`btn btn-save${dirty ? ' is-dirty' : ''}`} onClick={() => void save()} disabled={saving}>
            {dirty ? '今日の記録を保存' : record ? '保存済み（もう一度保存）' : '今日の記録を保存'}
          </button>
          <div className="tomorrow">
            <span className="tomorrow-thumb"><Portrait character={slot.tomorrow.character} locked /></span>
            <p>
              <small>明日の予告{slot.tomorrow.lap >= 2 ? `（${slot.tomorrow.lap}周目）` : ''}</small>
              <b data-testid="tomorrow-character">{slot.tomorrow.character.rank}位 {slot.tomorrow.character.name}</b>
            </p>
          </div>
          {needsBackup && (
            <button className="backup-hint" onClick={() => onOpen('records')}>
              しばらくバックアップしていません。記録を守るために保存しましょう ›
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
