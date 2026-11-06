import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { AppProvider } from './state/store';
import './styles.css';

// 新しい版を見つけたら自動で読み込み直す。入力中の内容は下書きとして保存されているので失われない
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    // ホーム画面アプリは開きっぱなしになりやすいので、前面に戻るたびに更新を確認する
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void registration.update().catch(() => undefined);
    });
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
