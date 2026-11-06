import { useState } from 'react';
import { characterAtOrder, lapAtOrder } from '../domain/characters';
import { formatJaFull } from '../domain/date';
import { gradeFor } from '../domain/grade';
import { deriveProgress, shiftImpact } from '../domain/progress';
import { useApp } from '../state/store';
import { ConfirmDialog, Modal } from './Modal';
import { Stepper } from './Stepper';
import { awardMessage } from './messages';

/** カレンダー・図鑑共通の1日編集。編集後の統計と順位はすべて再計算される */
export function DayEditor({ date, onClose }: { date: string; onClose(): void }) {
  const { progress, records, today, draft, saveDay, deleteDay, notify } = useApp();
  const record = progress.recordByDate.get(date);
  const source = draft?.date === date ? draft : record;
  const [homework, setHomework] = useState(source?.homework ?? false);
  const [problems, setProblems] = useState(source?.problems ?? 0);
  const [confirm, setConfirm] = useState<'save' | 'delete' | null>(null);

  const others = records.filter((r) => r.date !== date);
  const preview = deriveProgress(
    [...others, { date, homework, problems, updatedAt: '' }],
    today,
  ).awardByDate.get(date);
  const impact = shiftImpact(progress, date, problems);
  const deleteImpact = shiftImpact(progress, date, 0);

  const save = async () => {
    setConfirm(null);
    if (await saveDay(date, homework, problems)) {
      notify({ kind: 'success', text: awardMessage(homework, problems, preview?.character.name) });
      onClose();
    }
  };

  const remove = async () => {
    setConfirm(null);
    if (await deleteDay(date)) {
      notify({ kind: 'success', text: `${formatJaFull(date)}を未入力に戻しました` });
      onClose();
    }
  };

  const impactNote = (count: number) =>
    `この日より後の${count}日分のキャラクターが1人ずつずれます。獲得の順番に抜けや重複が出ないよう、アプリが自動で並べ直します。`;

  return (
    <Modal title={`${formatJaFull(date)}の記録`} onClose={onClose}>
      <p className="editor-state">
        {record ? (record.problems > 0 ? '自主勉強：達成' : '自主勉強：0問で記録') : 'まだ入力していません'}
      </p>
      <label className="homework-check">
        <input type="checkbox" checked={homework} onChange={(e) => setHomework(e.target.checked)} />
        <span>宿題を終えた</span>
      </label>
      <Stepper value={problems} onChange={setProblems} />
      <div className="editor-preview" data-testid="editor-preview">
        {preview ? (
          <>
            <b>{preview.character.rank}位 {preview.character.name}</b>
            <span>
              {gradeFor(problems).label}スタンプ
              {lapAtOrder(preview.order) >= 2 ? `（${lapAtOrder(preview.order)}周目）` : ''}
            </span>
          </>
        ) : (
          <span>
            0問：キャラクタースタンプなし
            {progress.awards.length === 0 ? `（1問で${characterAtOrder(1).name}）` : ''}
          </span>
        )}
      </div>
      {impact > 0 && <p className="warn">{impactNote(impact)}</p>}
      <div className="modal-actions">
        {record && (
          <button type="button" className="btn btn-ghost-danger" onClick={() => setConfirm('delete')}>
            未入力に戻す
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={() => (impact > 0 ? setConfirm('save') : void save())}>
          この内容で保存
        </button>
      </div>
      {confirm === 'save' && (
        <ConfirmDialog
          title="過去の記録を変更しますか？"
          body={<p>{impactNote(impact)}</p>}
          confirmLabel="変更する"
          onConfirm={() => void save()}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'delete' && (
        <ConfirmDialog
          title="この日の記録を消しますか？"
          body={
            <>
              <p>{formatJaFull(date)}の宿題と問題数を消して、未入力に戻します。</p>
              {deleteImpact > 0 && <p>{impactNote(deleteImpact)}</p>}
            </>
          }
          confirmLabel="消す"
          danger
          onConfirm={() => void remove()}
          onCancel={() => setConfirm(null)}
        />
      )}
    </Modal>
  );
}
