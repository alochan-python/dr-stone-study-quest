import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { buildBackup, parseImagePack, planMerge, type MergePlan } from '../domain/backup';
import { todayInTokyo } from '../domain/date';
import { gradeFor, normalizeProblems } from '../domain/grade';
import { deriveProgress, type DayRecord, type Progress } from '../domain/progress';
import { playConfirmSound, unlockAudio } from '../domain/sound';
import { DEFAULT_SETTINGS, openRepository, type Draft, type Repository, type Settings, type Snapshot } from '../storage/repository';

export interface Notice {
  kind: 'success' | 'error';
  text: string;
  retry?: () => void;
}

interface AppState {
  today: string;
  records: DayRecord[];
  progress: Progress;
  settings: Settings;
  images: Record<number, string>;
  draft: Draft | null;
  snapshot: Snapshot | null;
  notice: Notice | null;
  dismissNotice(): void;
  notify(notice: Notice): void;
  setDraft(draft: Draft | null): void;
  saveDay(date: string, homework: boolean, problems: number): Promise<boolean>;
  deleteDay(date: string): Promise<boolean>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  exportBackup(): string;
  markBackedUp(): Promise<void>;
  applyMerge(plan: MergePlan): Promise<boolean>;
  replaceAll(records: DayRecord[]): Promise<boolean>;
  resetAll(): Promise<boolean>;
  restoreSnapshot(): Promise<boolean>;
  importImages(images: Record<number, string>): Promise<boolean>;
  clearImages(): Promise<boolean>;
}

const Context = createContext<AppState | null>(null);

export function useApp(): AppState {
  const value = useContext(Context);
  if (!value) throw new Error('AppProvider の外では使えません');
  return value;
}

function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return '端末の保存容量が足りません。空き容量を増やしてからもう一度保存してください。';
  }
  return '保存できませんでした。入力内容は画面に残っています。もう一度お試しください。';
}

export function AppProvider({
  children,
  openRepo = openRepository,
}: {
  children: ReactNode;
  openRepo?: () => Promise<Repository>;
}) {
  const repoRef = useRef<Repository | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [today, setToday] = useState(() => todayInTokyo());
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [images, setImages] = useState<Record<number, string>>({});
  const [draft, setDraftState] = useState<Draft | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (async () => {
      const repo = await openRepo();
      const [loadedRecords, loadedSettings, loadedImages, loadedDraft, loadedSnapshot] = await Promise.all([
        repo.getRecords(),
        repo.getMeta<Settings>('settings'),
        repo.getImages(),
        repo.getMeta<Draft>('draft'),
        repo.getMeta<Snapshot>('snapshot'),
      ]);
      if (cancelled) return repo.close();
      repoRef.current = repo;
      setRecords(loadedRecords);
      setSettings({ ...DEFAULT_SETTINGS, ...loadedSettings });
      setImages(loadedImages);
      if (import.meta.env.MODE === 'development' && Object.keys(loadedImages).length === 0) {
        // ローカル起動時だけ、手元の画像パックを自動で使う（公開版のビルドには含まれない）
        fetch(`${import.meta.env.BASE_URL}__private/image-pack.json`)
          .then((response) => (response.ok ? response.text() : Promise.reject(new Error('no pack'))))
          .then((text) => setImages(parseImagePack(text)))
          .catch(() => undefined);
      }
      setDraftState(loadedDraft ?? null);
      setSnapshot(loadedSnapshot ?? null);
      setStatus('ready');
      navigator.storage?.persist?.().catch(() => undefined);
    })().catch(() => {
      if (!cancelled) setStatus('failed');
    });
    return () => {
      cancelled = true;
      repoRef.current?.close();
      repoRef.current = null;
    };
  }, [openRepo, attempt]);

  // 日付の変わり目と、別タブ・バックグラウンドからの復帰に追従する
  useEffect(() => {
    const sync = () => {
      setToday(todayInTokyo());
      if (document.visibilityState === 'visible') {
        repoRef.current?.getRecords().then(setRecords).catch(() => undefined);
      }
    };
    const timer = window.setInterval(() => setToday(todayInTokyo()), 30_000);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  const progress = useMemo(() => deriveProgress(records, today), [records, today]);

  const setDraft = useCallback((next: Draft | null) => {
    setDraftState(next);
    const repo = repoRef.current;
    if (!repo) return;
    (next ? repo.setMeta('draft', next) : repo.deleteMeta('draft')).catch(() => undefined);
  }, []);

  const guarded = useCallback(async (action: (repo: Repository) => Promise<void>, retry?: () => void) => {
    const repo = repoRef.current;
    try {
      if (!repo) throw new Error('database is not ready');
      await action(repo);
      setRecords(await repo.getRecords());
      return true;
    } catch (error) {
      setNotice({ kind: 'error', text: errorMessage(error), retry });
      return false;
    }
  }, []);

  const saveDay = useCallback<AppState['saveDay']>(
    async (date, homework, problems) => {
      if (settingsRef.current.sound) unlockAudio();
      const record: DayRecord = {
        date,
        homework,
        problems: normalizeProblems(problems),
        updatedAt: new Date().toISOString(),
      };
      if (date > todayInTokyo()) {
        setNotice({ kind: 'error', text: '未来の日付には記録できません。' });
        return false;
      }
      const ok = await guarded(
        (repo) => repo.putRecord(record),
        () => void saveDay(date, homework, problems),
      );
      if (!ok) return false;
      if (settingsRef.current.sound) playConfirmSound(gradeFor(record.problems));
      setDraftState((current) => {
        if (current?.date !== date) return current;
        repoRef.current?.deleteMeta('draft').catch(() => undefined);
        return null;
      });
      return true;
    },
    [guarded],
  );

  const deleteDay = useCallback<AppState['deleteDay']>(
    (date) => guarded((repo) => repo.deleteRecord(date)),
    [guarded],
  );

  const updateSettings = useCallback<AppState['updateSettings']>(async (patch) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    await repoRef.current?.setMeta('settings', next).catch(() => {
      setNotice({ kind: 'error', text: '設定を保存できませんでした。' });
    });
  }, []);

  const takeSnapshot = useCallback(
    (reason: string): Snapshot => ({ takenAt: new Date().toISOString(), reason, records }),
    [records],
  );

  const replaceWith = useCallback(
    async (next: DayRecord[], reason: string) => {
      const snap = takeSnapshot(reason);
      const ok = await guarded((repo) => repo.replaceRecords(next, snap));
      if (ok) setSnapshot(snap);
      return ok;
    },
    [guarded, takeSnapshot],
  );

  const value: AppState = {
    today,
    records,
    progress,
    settings,
    images,
    draft,
    snapshot,
    notice,
    dismissNotice: useCallback(() => setNotice(null), []),
    notify: setNotice,
    setDraft,
    saveDay,
    deleteDay,
    updateSettings,
    exportBackup: () => buildBackup(records),
    markBackedUp: () => updateSettings({ lastBackupAt: new Date().toISOString() }),
    applyMerge: (plan) => guarded(async (repo) => repo.addRecords(planMerge(records, plan.added).added)),
    replaceAll: (next) => replaceWith(next, 'バックアップで置き換える前'),
    resetAll: async () => {
      const ok = await replaceWith([], '初期化する前');
      if (ok) {
        setDraft(null);
        await updateSettings({ completionSeen: false });
      }
      return ok;
    },
    restoreSnapshot: async () => {
      if (!snapshot) return false;
      return replaceWith(snapshot.records, '元に戻す前');
    },
    importImages: async (next) => {
      const ok = await guarded((repo) => repo.putImages(next));
      if (ok) setImages((current) => ({ ...current, ...next }));
      return ok;
    },
    clearImages: async () => {
      const ok = await guarded((repo) => repo.clearImages());
      if (ok) setImages({});
      return ok;
    },
  };

  if (status === 'failed') {
    return (
      <main className="fatal" role="alert">
        <h1>データを読み込めませんでした</h1>
        <p>
          このブラウザでは保存機能（IndexedDB）が使えない可能性があります。プライベートブラウズを使っている場合は通常モードで開いてください。
        </p>
        <button className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>
          もう一度読み込む
        </button>
      </main>
    );
  }
  if (status === 'loading') return <main className="fatal" aria-busy="true">読み込み中…</main>;
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
