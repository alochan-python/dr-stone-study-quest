import { useEffect, useState } from 'react';
import { DayEditor } from './components/DayEditor';
import { TOTAL_CHARACTERS } from './domain/characters';
import { useApp } from './state/store';
import { CalendarView } from './views/CalendarView';
import { Complete } from './views/Complete';
import { Home } from './views/Home';
import { Records } from './views/Records';
import { Zukan } from './views/Zukan';

type View = 'home' | 'zukan' | 'calendar' | 'records' | 'complete';

const TABS: { id: View; label: string; icon: string }[] = [
  { id: 'home', label: 'ホーム', icon: '⬡' },
  { id: 'zukan', label: 'スタンプ帳', icon: '▦' },
  { id: 'calendar', label: 'カレンダー', icon: '▤' },
  { id: 'records', label: 'きろく', icon: '≡' },
];

export function App() {
  const { progress, settings, updateSettings, notice, dismissNotice } = useApp();
  const [view, setView] = useState<View>('home');
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.motion = settings.animations ? 'on' : 'off';
  }, [settings.animations]);

  // 初めて50人そろった時だけ記念画面を自動で開く
  useEffect(() => {
    if (progress.awards.length >= TOTAL_CHARACTERS && !settings.completionSeen) {
      setView('complete');
      void updateSettings({ completionSeen: true });
    }
  }, [progress.awards.length, settings.completionSeen, updateSettings]);

  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [view]);

  useEffect(() => {
    if (notice?.kind !== 'success') return;
    const timer = window.setTimeout(dismissNotice, 3500);
    return () => window.clearTimeout(timer);
  }, [notice, dismissNotice]);

  return (
    <div className="app">
      <nav className="tabbar" aria-label="メニュー">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={view === tab.id ? 'is-on' : ''}
            aria-current={view === tab.id ? 'page' : undefined}
            onClick={() => setView(tab.id)}
          >
            <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
      <main className="content">
        {view === 'home' && <Home onOpen={setView} />}
        {view === 'zukan' && <Zukan onEditDay={setEditing} />}
        {view === 'calendar' && <CalendarView onEditDay={setEditing} />}
        {view === 'records' && <Records onOpenComplete={() => setView('complete')} />}
        {view === 'complete' && <Complete onBack={() => setView('home')} />}
      </main>
      {editing && <DayEditor key={editing} date={editing} onClose={() => setEditing(null)} />}
      {notice && (
        <div className={`toast toast-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
          <span>{notice.text}</span>
          {notice.retry && (
            <button
              className="btn btn-sm"
              onClick={() => {
                const { retry } = notice;
                dismissNotice();
                retry?.();
              }}
            >
              再試行
            </button>
          )}
          {notice.kind === 'error' && (
            <button className="icon-btn" onClick={dismissNotice} aria-label="閉じる">×</button>
          )}
        </div>
      )}
    </div>
  );
}
