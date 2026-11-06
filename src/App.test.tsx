import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { buildBackup } from './domain/backup';
import { addDays } from './domain/date';
import * as sound from './domain/sound';
import type { DayRecord } from './domain/progress';
import { AppProvider } from './state/store';
import { openRepository, type Repository } from './storage/repository';

const TODAY = '2026-11-06';

function setClock(date: string) {
  vi.setSystemTime(new Date(`${date}T12:00:00+09:00`));
}

async function seed(records: DayRecord[]) {
  const repo = await openRepository();
  await repo.addRecords(records);
  repo.close();
}

const rec = (date: string, problems: number, homework = false): DayRecord => ({
  date,
  problems,
  homework,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

async function start(openRepo?: () => Promise<Repository>) {
  const user = userEvent.setup();
  const view = render(
    <AppProvider openRepo={openRepo}>
      <App />
    </AppProvider>,
  );
  await screen.findByRole('button', { name: /今日の記録を保存|保存済み/ });
  return { user, ...view };
}

const plusOne = () => screen.getByRole('button', { name: '1問増やす' });
const saveButton = () => screen.getByRole('button', { name: /今日の記録を保存|保存済み/ });
const openTab = (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(within(screen.getByRole('navigation')).getByRole('button', { name: new RegExp(name) }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  setClock(TODAY);
});

afterEach(() => vi.useRealTimers());

describe('今日の記録', () => {
  it('初期状態は50位ブロディでスタンプなし、図鑑は全員未達成', async () => {
    const { user } = await start();
    const card = screen.getByTestId('stamp-card');
    expect(within(card).getByText('ブロディ')).toBeInTheDocument();
    expect(card).toHaveAttribute('data-grade', 'スタンプなし');
    await openTab(user, 'スタンプ帳');
    expect(screen.getByTestId('zukan-count')).toHaveTextContent('0');
    expect(document.querySelectorAll('[data-earned="true"]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-earned="false"]')).toHaveLength(50);
  });

  it('＋1問と保存で 銅→銀→金→プラチナ と上がり、キャラは進まない', async () => {
    const { user } = await start();
    for (const label of ['銅', '銀', '金', 'プラチナ', 'プラチナ＋2']) {
      await user.click(plusOne());
      expect(screen.getByTestId('stamp-card')).toHaveAttribute('data-grade', label);
      await user.click(saveButton());
      await screen.findByText(new RegExp(`${label}スタンプ！`));
      expect(within(screen.getByTestId('stamp-card')).getByText('ブロディ')).toBeInTheDocument();
      expect(screen.getByTestId('achieved-days')).toHaveTextContent('1');
    }
  });

  it('＋5問で プラチナ＋2、−1問で プラチナ に下がる', async () => {
    const { user } = await start();
    await user.click(screen.getByRole('button', { name: '5問増やす' }));
    expect(screen.getByTestId('stamp-card')).toHaveAttribute('data-grade', 'プラチナ＋2');
    await user.click(screen.getByRole('button', { name: '1問減らす' }));
    expect(screen.getByTestId('stamp-card')).toHaveAttribute('data-grade', 'プラチナ');
  });

  it('宿題だけではキャラが進まない', async () => {
    const { user } = await start();
    await user.click(screen.getByRole('checkbox', { name: '宿題を終えた' }));
    expect(screen.getByLabelText('宿題達成スタンプ')).toBeInTheDocument();
    await user.click(saveButton());
    await screen.findByText(/宿題を記録しました/);
    expect(screen.getByTestId('achieved-days')).toHaveTextContent('0');
    expect(screen.getByTestId('next-character')).toHaveTextContent('ブロディ');
    await openTab(user, 'きろく');
    expect(screen.getByTestId('stat-homework')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-current')).toHaveTextContent('0');
  });

  it('翌日の達成で49位に進み、前日のキャラは残る', async () => {
    await seed([rec(addDays(TODAY, -1), 3)]);
    const { user } = await start();
    expect(within(screen.getByTestId('stamp-card')).getByText('コニー・リー')).toBeInTheDocument();
    await user.click(plusOne());
    await user.click(saveButton());
    await screen.findByText(/コニー・リーの銅スタンプ/);
    expect(screen.getByTestId('current-streak')).toHaveTextContent('2');
    expect(screen.getByTestId('tomorrow-character')).toHaveTextContent('コクヨウ');
  });

  it('1日休むと連続が途切れるが、獲得済みは残り次のキャラから再開する', async () => {
    await seed([rec(addDays(TODAY, -3), 1), rec(addDays(TODAY, -2), 1)]);
    const { user } = await start();
    expect(screen.getByTestId('current-streak')).toHaveTextContent('0');
    expect(screen.getByTestId('achieved-days')).toHaveTextContent('2');
    expect(within(screen.getByTestId('stamp-card')).getByText('コクヨウ')).toBeInTheDocument();
    await openTab(user, 'きろく');
    expect(screen.getByTestId('stat-longest')).toHaveTextContent('2');
  });
});

describe('確定音', () => {
  it('保存を確定した時にグレードに応じて鳴る', async () => {
    const play = vi.spyOn(sound, 'playConfirmSound').mockImplementation(() => undefined);
    const { user } = await start();
    await user.click(plusOne());
    await user.click(plusOne());
    expect(play).not.toHaveBeenCalled();
    await user.click(saveButton());
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    expect(play.mock.calls[0][0].label).toBe('銀');
  });

  it('設定でOFFにすると鳴らない', async () => {
    const play = vi.spyOn(sound, 'playConfirmSound').mockImplementation(() => undefined);
    const { user } = await start();
    await openTab(user, 'きろく');
    await user.click(screen.getByRole('checkbox', { name: '保存したときの音' }));
    await openTab(user, 'ホーム');
    await user.click(plusOne());
    await user.click(saveButton());
    await screen.findByText(/銅スタンプ！/);
    expect(play).not.toHaveBeenCalled();
  });

  it('保存に失敗した時は鳴らない', async () => {
    const play = vi.spyOn(sound, 'playConfirmSound').mockImplementation(() => undefined);
    const { user } = await start(async () => {
      const repo = await openRepository();
      vi.spyOn(repo, 'putRecord').mockRejectedValue(new Error('disk'));
      return repo;
    });
    await user.click(plusOne());
    await user.click(saveButton());
    await screen.findByRole('alert');
    expect(play).not.toHaveBeenCalled();
  });
});

describe('保存', () => {
  it('再読み込みしても保存したデータが残る', async () => {
    const first = await start();
    await first.user.click(plusOne());
    await first.user.click(plusOne());
    await first.user.click(saveButton());
    await screen.findByText(/銀スタンプ！/);
    first.unmount();

    await start();
    expect(screen.getByTestId('stamp-card')).toHaveAttribute('data-grade', '銀');
    expect(screen.getByTestId('achieved-days')).toHaveTextContent('1');
  });

  it('未保存の入力も再読み込みで失われない', async () => {
    const first = await start();
    await first.user.click(plusOne());
    await waitFor(async () => {
      const repo = await openRepository();
      const draft = await repo.getMeta('draft');
      repo.close();
      expect(draft).toBeTruthy();
    });
    first.unmount();
    await start();
    expect(screen.getByTestId('stamp-card')).toHaveAttribute('data-grade', '銅');
    expect(screen.getByTestId('stage-status')).toHaveTextContent('保存で確定');
  });

  it('日付をまたいだ下書きは今日に混ぜず、元の日に保存できる', async () => {
    const first = await start();
    await first.user.click(plusOne());
    await waitFor(async () => {
      const repo = await openRepository();
      const draft = await repo.getMeta('draft');
      repo.close();
      expect(draft).toBeTruthy();
    });
    first.unmount();

    setClock(addDays(TODAY, 1));
    const { user } = await start();
    expect(screen.getByTestId('stamp-card')).toHaveAttribute('data-grade', 'スタンプなし');
    await user.click(screen.getByRole('button', { name: /11月6日.*に保存/ }));
    await screen.findByText(/の分として保存しました/);
    expect(screen.getByTestId('achieved-days')).toHaveTextContent('1');
    expect(within(screen.getByTestId('stamp-card')).getByText('コニー・リー')).toBeInTheDocument();
  });

  it('保存に失敗したらエラーを表示し、入力を残して再試行できる', async () => {
    let fail = true;
    const { user } = await start(async () => {
      const repo = await openRepository();
      const original = repo.putRecord.bind(repo);
      vi.spyOn(repo, 'putRecord').mockImplementation((r) => (fail ? Promise.reject(new Error('disk')) : original(r)));
      return repo;
    });
    await user.click(plusOne());
    await user.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('保存できませんでした');
    expect(screen.getByTestId('stamp-card')).toHaveAttribute('data-grade', '銅');
    expect(screen.getByTestId('achieved-days')).toHaveTextContent('0');
    fail = false;
    await user.click(screen.getByRole('button', { name: '再試行' }));
    await waitFor(() => expect(screen.getByTestId('achieved-days')).toHaveTextContent('1'));
  });

  it('データベースを開けない時はエラー画面を出す', async () => {
    render(
      <AppProvider openRepo={() => Promise.reject(new Error('blocked'))}>
        <App />
      </AppProvider>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('データを読み込めませんでした');
  });
});

describe('過去日の編集', () => {
  it('カレンダーで未入力と0問を区別し、修正すると統計と順位が再計算される', async () => {
    await seed([rec('2026-11-03', 1), rec('2026-11-04', 0), rec('2026-11-05', 2)]);
    const { user } = await start();
    await openTab(user, 'カレンダー');
    expect(screen.getByTestId('day-2026-11-02')).toHaveAttribute('data-state', 'empty');
    expect(screen.getByTestId('day-2026-11-04')).toHaveAttribute('data-state', 'zero');
    expect(screen.getByTestId('day-2026-11-05')).toHaveAttribute('data-state', 'achieved');
    expect(screen.getByTestId('day-2026-11-07')).toBeDisabled();

    // 0問だった日を達成に直すと、後ろの日がずれる警告を出す
    await user.click(screen.getByTestId('day-2026-11-04'));
    await user.click(screen.getByRole('button', { name: '1問増やす' }));
    await user.click(screen.getByRole('button', { name: 'この内容で保存' }));
    await user.click(await screen.findByRole('button', { name: '変更する' }));
    await screen.findByText(/コニー・リーの銅スタンプ/);

    await openTab(user, 'きろく');
    expect(screen.getByTestId('stat-days')).toHaveTextContent('3');
    expect(screen.getByTestId('stat-longest')).toHaveTextContent('3');
    expect(screen.getByTestId('stat-problems')).toHaveTextContent('4');

    await openTab(user, 'スタンプ帳');
    expect(screen.getByTestId('tile-48')).toHaveTextContent('銀'); // 11/5 は 49位→48位 へ
    expect(screen.getByTestId('tile-49')).toHaveTextContent('銅');
    expect(screen.getByTestId('tile-47')).toHaveAttribute('data-earned', 'false');
  });

  it('図鑑の達成済みキャラから詳細を見て修正できる', async () => {
    await seed([rec('2026-11-05', 3)]);
    const { user } = await start();
    await openTab(user, 'スタンプ帳');
    await user.click(within(screen.getByTestId('tile-50')).getByRole('button'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('ブロディ');
    expect(dialog).toHaveTextContent('50位');
    expect(dialog).toHaveTextContent('2026年11月5日(木)');
    expect(dialog).toHaveTextContent('3問');
    expect(dialog).toHaveTextContent('金');
    await user.click(within(dialog).getByRole('button', { name: 'この日の記録を修正' }));
    await user.click(screen.getByRole('button', { name: '1問増やす' }));
    await user.click(screen.getByRole('button', { name: 'この内容で保存' }));
    await screen.findByText(/プラチナスタンプ！/);
    expect(screen.getByTestId('tile-50')).toHaveTextContent('プラチナ');
  });

  it('未達成のキャラはタップで詳細を開けない', async () => {
    const { user } = await start();
    await openTab(user, 'スタンプ帳');
    expect(within(screen.getByTestId('tile-50')).queryByRole('button')).toBeNull();
  });

  it('過去日を未入力に戻すと繰り上がる', async () => {
    await seed([rec('2026-11-04', 1), rec('2026-11-05', 1)]);
    const { user } = await start();
    await openTab(user, 'カレンダー');
    await user.click(screen.getByTestId('day-2026-11-04'));
    await user.click(screen.getByRole('button', { name: '未入力に戻す' }));
    await user.click(await screen.findByRole('button', { name: '消す' }));
    await waitFor(() => expect(screen.getByTestId('day-2026-11-04')).toHaveAttribute('data-state', 'empty'));
    await openTab(user, 'スタンプ帳');
    expect(screen.getByTestId('tile-50')).toHaveAttribute('data-earned', 'true');
    expect(screen.getByTestId('tile-49')).toHaveAttribute('data-earned', 'false');
  });
});

describe('50人達成後', () => {
  const fifty = Array.from({ length: 50 }, (_, i) => rec(addDays(TODAY, i - 50), 2));

  it('達成画面を自動で開き、統計と履歴を表示する。以後は2周目を記録できる', async () => {
    await seed(fifty);
    const user = userEvent.setup();
    render(
      <AppProvider>
        <App />
      </AppProvider>,
    );
    const screenEl = await screen.findByTestId('complete-screen');
    expect(screenEl).toHaveTextContent('50日達成！');
    expect(screen.getByTestId('complete-total')).toHaveTextContent('100');
    expect(screen.getByTestId('complete-longest')).toHaveTextContent('50');
    expect(screenEl.querySelectorAll('tbody tr')).toHaveLength(50);
    expect(screenEl.querySelectorAll('.crowd-hex')).toHaveLength(50);

    await user.click(screen.getByRole('button', { name: /2周目へ進む/ }));
    const card = screen.getByTestId('stamp-card');
    expect(card).toHaveClass('lap-special');
    expect(within(card).getByText('2周目 特別枠')).toBeInTheDocument();
    expect(within(card).getByText('ブロディ')).toBeInTheDocument();

    await user.click(plusOne());
    await user.click(saveButton());
    await screen.findByText(/ブロディの銅スタンプ/);
    await openTab(user, 'スタンプ帳');
    expect(screen.getByRole('tab', { name: '1周目' })).toBeInTheDocument();
    expect(screen.getByTestId('zukan-count')).toHaveTextContent('1');
    await user.click(screen.getByRole('tab', { name: '1周目' }));
    expect(screen.getByTestId('zukan-count')).toHaveTextContent('50');
  });
});

describe('バックアップと初期化', () => {
  function upload(testId: string, text: string) {
    const input = screen.getByTestId(testId) as HTMLInputElement;
    const file = new File([text], 'x.json', { type: 'application/json' });
    // jsdom の File に text() がない環境でも動くようにする
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(text) });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  it('統合では既存の記録を上書きしない', async () => {
    await seed([rec('2026-11-01', 5)]);
    const { user } = await start();
    await openTab(user, 'きろく');
    act(() => upload('backup-file', buildBackup([rec('2026-11-01', 9), rec('2026-11-02', 2)])));
    const summary = await screen.findByTestId('import-summary');
    expect(summary).toHaveTextContent('新しく追加できる日：1日');
    expect(summary).toHaveTextContent('内容が違う日：1日');
    await user.click(screen.getByRole('button', { name: '足りない日だけ追加' }));
    await screen.findByText('1日分を追加しました');
    expect(screen.getByTestId('stat-problems')).toHaveTextContent('7');
  });

  it('置き換えは確認後に実行し、控えから元に戻せる', async () => {
    await seed([rec('2026-11-01', 5)]);
    const { user } = await start();
    await openTab(user, 'きろく');
    act(() => upload('backup-file', buildBackup([rec('2026-11-02', 2), rec('2026-11-03', 1)])));
    await user.click(await screen.findByRole('button', { name: '全部置き換える' }));
    await user.click(await screen.findByRole('button', { name: '置き換える' }));
    await waitFor(() => expect(screen.getByTestId('stat-problems')).toHaveTextContent('3'));
    await user.click(screen.getByRole('button', { name: 'この状態に戻す' }));
    await user.click(await screen.findByRole('button', { name: '戻す' }));
    await waitFor(() => expect(screen.getByTestId('stat-problems')).toHaveTextContent('5'));
  });

  it('壊れたファイルはエラーにして記録を変えない', async () => {
    await seed([rec('2026-11-01', 5)]);
    const { user } = await start();
    await openTab(user, 'きろく');
    act(() => upload('backup-file', 'not json'));
    expect(await screen.findByRole('alert')).toHaveTextContent('読み込めませんでした');
    expect(screen.getByTestId('stat-problems')).toHaveTextContent('5');
  });

  it('初期化は「リセット」と入力するまで実行できず、取り消せば何も消えない', async () => {
    await seed([rec('2026-11-01', 5)]);
    const { user } = await start();
    await openTab(user, 'きろく');
    await user.click(screen.getByRole('button', { name: '記録をすべて消す' }));
    const confirm = screen.getByRole('button', { name: '消す' });
    expect(confirm).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'やめる' }));
    expect(screen.getByTestId('stat-problems')).toHaveTextContent('5');

    await user.click(screen.getByRole('button', { name: '記録をすべて消す' }));
    await user.type(screen.getByRole('textbox'), 'リセット');
    await user.click(screen.getByRole('button', { name: '消す' }));
    await waitFor(() => expect(screen.getByTestId('stat-problems')).toHaveTextContent('0'));
    expect(screen.getByRole('button', { name: 'この状態に戻す' })).toBeInTheDocument();
  });

  it('画像パックを読み込むと画像に切り替わり、記録には影響しない', async () => {
    await seed([rec('2026-11-01', 5)]);
    const { user } = await start();
    await openTab(user, 'きろく');
    const pack = JSON.stringify({
      app: 'dr-stone-study-quest',
      type: 'image-pack',
      version: 1,
      images: { 49: 'data:image/webp;base64,AAAA' },
    });
    act(() => upload('image-file', pack));
    await screen.findByText('1人分の画像を読み込みました');
    expect(screen.getByTestId('image-status')).toHaveTextContent('1人分');
    await openTab(user, 'ホーム');
    expect(within(screen.getByTestId('stamp-card')).getByRole('img', { name: 'コニー・リー' }).tagName).toBe('IMG');
  });
});
