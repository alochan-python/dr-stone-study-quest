import { useRef, useState, type ChangeEvent } from 'react';
import { ConfirmDialog, Modal } from '../components/Modal';
import { TOTAL_CHARACTERS } from '../domain/characters';
import { ImagePackButton } from '../components/ImagePackButton';
import { ImageUnlock } from '../components/ImageUnlock';
import { ImportError, backupFileName, parseBackup, planMerge, type MergePlan } from '../domain/backup';
import { formatJa } from '../domain/date';
import { gradeFor } from '../domain/grade';
import { playConfirmSound } from '../domain/sound';
import type { DayRecord } from '../domain/progress';
import { useApp } from '../state/store';

async function deliverFile(name: string, text: string) {
  const file = new File([text], name, { type: 'application/json' });
  // ホーム画面から起動した iOS ではダウンロードが動かないことがあるため共有シートを使う
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches;
  if (standalone && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: name });
    return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'medium', timeStyle: 'short' });
}

export function Records({ onOpenComplete }: { onOpenComplete(): void }) {
  const app = useApp();
  const { progress, today, records, settings, images, snapshot, notify } = app;
  const { stats } = progress;
  const backupInput = useRef<HTMLInputElement>(null);
  const [incoming, setIncoming] = useState<{ records: DayRecord[]; plan: MergePlan } | null>(null);
  const [confirm, setConfirm] = useState<'replace' | 'reset' | 'restore' | 'clear-images' | null>(null);
  const imageCount = Object.keys(images).length;

  const exportBackup = async () => {
    try {
      await deliverFile(backupFileName(today), app.exportBackup());
      await app.markBackedUp();
      notify({ kind: 'success', text: 'バックアップを書き出しました' });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      notify({ kind: 'error', text: 'バックアップを書き出せませんでした。もう一度お試しください。' });
    }
  };

  const readFile = async (event: ChangeEvent<HTMLInputElement>, handler: (text: string) => Promise<void> | void) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      await handler(await file.text());
    } catch (error) {
      notify({ kind: 'error', text: error instanceof ImportError ? error.message : 'ファイルを読み込めませんでした。' });
    }
  };

  const onBackupFile = (text: string) => {
    const parsed = parseBackup(text, today);
    setIncoming({ records: parsed, plan: planMerge(records, parsed) });
  };

  const merge = async () => {
    if (!incoming) return;
    if (await app.applyMerge(incoming.plan)) {
      notify({ kind: 'success', text: `${incoming.plan.added.length}日分を追加しました` });
      setIncoming(null);
    }
  };

  const replace = async () => {
    setConfirm(null);
    if (incoming && (await app.replaceAll(incoming.records))) {
      notify({ kind: 'success', text: 'バックアップの内容に置き換えました' });
      setIncoming(null);
    }
  };

  return (
    <div className="page">
      <header className="page-head"><h2>きろく</h2></header>
      <dl className="stat-grid">
        <Stat label="現在の連続達成" value={stats.currentStreak} unit="日" id="stat-current" hero />
        <Stat label="最長連続達成" value={stats.longestStreak} unit="日" id="stat-longest" hero />
        <Stat label="累計自主勉強達成" value={stats.achievedDays} unit="日" id="stat-days" />
        <Stat label="自主勉強の累計" value={stats.totalProblems} unit="問" id="stat-problems" />
        <Stat label={`${stats.lap >= 2 ? `${stats.lap}周目 ` : ''}${TOTAL_CHARACTERS}人中`} value={stats.collected} unit="人まで" id="stat-collected" />
        <Stat label="残りキャラクター" value={stats.remaining} unit="人" id="stat-remaining" />
        <Stat label="宿題達成" value={stats.homeworkDays} unit="日" id="stat-homework" />
      </dl>
      {stats.achievedDays >= TOTAL_CHARACTERS && (
        <button className="banner banner-gold" onClick={onOpenComplete}>50日達成の記念画面を見る ›</button>
      )}

      <section className="panel">
        <h3>データのバックアップ</h3>
        <p className="panel-note">
          記録はこの端末のブラウザだけに保存され、他の端末とは同期されません。機種変更や消去に備えて、ときどき書き出してください。
          {settings.lastBackupAt ? ` 前回：${formatDateTime(settings.lastBackupAt)}` : ' まだ書き出していません。'}
        </p>
        <div className="panel-actions">
          <button className="btn btn-primary" onClick={() => void exportBackup()}>JSONに書き出す</button>
          <button className="btn" onClick={() => backupInput.current?.click()}>JSONから復元</button>
          <input
            ref={backupInput}
            data-testid="backup-file"
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => void readFile(e, onBackupFile)}
          />
        </div>
        {snapshot && (
          <p className="panel-note">
            控えあり（{snapshot.reason}・{formatDateTime(snapshot.takenAt)}・{snapshot.records.length}日分）
            <button className="link-btn" onClick={() => setConfirm('restore')}>この状態に戻す</button>
          </p>
        )}
      </section>

      <section className="panel">
        <h3>キャラクター画像</h3>
        <p className="panel-note" data-testid="image-status">
          {imageCount > 0 ? `この端末に${imageCount}人分の画像が入っています。` : '現在は仮画像を表示しています。'}
          合言葉を入れると、この端末にキャラクター画像を保存して表示します。
        </p>
        {imageCount === 0 && <ImageUnlock />}
        <div className="panel-actions">
          <ImagePackButton />
          {imageCount > 0 && <button className="btn" onClick={() => setConfirm('clear-images')}>仮画像に戻す</button>}
        </div>
      </section>

      <section className="panel">
        <h3>設定</h3>
        <label className="switch-row">
          <span>スタンプのアニメーション</span>
          <input
            type="checkbox"
            checked={settings.animations}
            onChange={(e) => void app.updateSettings({ animations: e.target.checked })}
          />
        </label>
        <label className="switch-row">
          <span>保存したときの音</span>
          <input
            type="checkbox"
            checked={settings.sound}
            onChange={(e) => {
              void app.updateSettings({ sound: e.target.checked });
              if (e.target.checked) playConfirmSound(gradeFor(3));
            }}
          />
        </label>
      </section>

      <section className="panel panel-danger">
        <h3>初期化</h3>
        <p className="panel-note">すべての記録を消します。先にバックアップを書き出すことをおすすめします。</p>
        <button className="btn btn-ghost-danger" onClick={() => setConfirm('reset')}>記録をすべて消す</button>
      </section>

      <p className="fine-print">
        非公式の個人用アプリです。原作の権利は各権利者に帰属します。記録はサーバーへ送信されず、利用料金もかかりません。
        <br />
        <span data-testid="build-id">版: {__BUILD_ID__}</span>
      </p>

      {incoming && (
        <Modal title="バックアップの読み込み" onClose={() => setIncoming(null)}>
          <ul className="import-summary" data-testid="import-summary">
            <li>ファイル内の記録：<b>{incoming.records.length}</b>日分</li>
            <li>新しく追加できる日：<b>{incoming.plan.added.length}</b>日</li>
            <li>同じ内容の日：<b>{incoming.plan.identical}</b>日</li>
            <li>内容が違う日：<b>{incoming.plan.conflicts.length}</b>日</li>
          </ul>
          {incoming.plan.conflicts.length > 0 && (
            <ul className="conflict-list">
              {incoming.plan.conflicts.slice(0, 5).map(({ existing, incoming: other }) => (
                <li key={existing.date}>
                  {formatJa(existing.date)}：今 {existing.problems}問 / ファイル {other.problems}問
                </li>
              ))}
              {incoming.plan.conflicts.length > 5 && <li>ほか{incoming.plan.conflicts.length - 5}日</li>}
            </ul>
          )}
          <p className="panel-note">「足りない日だけ追加」なら、今の記録は変わりません。</p>
          <div className="modal-actions">
            <button className="btn btn-ghost-danger" onClick={() => setConfirm('replace')}>全部置き換える</button>
            <button className="btn btn-primary" onClick={() => void merge()} disabled={incoming.plan.added.length === 0}>
              足りない日だけ追加
            </button>
          </div>
        </Modal>
      )}
      {confirm === 'replace' && incoming && (
        <ConfirmDialog
          title="今の記録を置き換えますか？"
          body={<p>今の{records.length}日分を、ファイルの{incoming.records.length}日分に置き換えます。直前の状態は控えとして1回分残ります。</p>}
          confirmLabel="置き換える"
          danger
          onConfirm={() => void replace()}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'reset' && (
        <ConfirmDialog
          title="すべての記録を消しますか？"
          body={<p>{records.length}日分の記録を消して最初からやり直します。直前の状態は控えとして1回分残ります。</p>}
          confirmLabel="消す"
          danger
          requireText="リセット"
          onConfirm={() => {
            setConfirm(null);
            void app.resetAll().then((ok) => ok && notify({ kind: 'success', text: '記録を初期化しました' }));
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'restore' && snapshot && (
        <ConfirmDialog
          title="控えの状態に戻しますか？"
          body={<p>今の{records.length}日分を、控えの{snapshot.records.length}日分に置き換えます。今の状態が新しい控えになります。</p>}
          confirmLabel="戻す"
          onConfirm={() => {
            setConfirm(null);
            void app.restoreSnapshot().then((ok) => ok && notify({ kind: 'success', text: '控えの状態に戻しました' }));
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'clear-images' && (
        <ConfirmDialog
          title="仮画像に戻しますか？"
          body={<p>この端末の画像パックを削除します。勉強の記録は消えません。</p>}
          confirmLabel="削除する"
          onConfirm={() => {
            setConfirm(null);
            void app.clearImages();
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, unit, id, hero = false }: { label: string; value: number; unit: string; id: string; hero?: boolean }) {
  return (
    <div className={`stat${hero ? ' stat-hero' : ''}`}>
      <dt>{label}</dt>
      <dd data-testid={id}>{value}<small>{unit}</small></dd>
    </div>
  );
}
