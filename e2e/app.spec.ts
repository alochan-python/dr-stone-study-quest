import { chromium, expect, test, type Page } from '@playwright/test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tab = (page: Page, name: string) => page.getByRole('navigation').getByRole('button', { name });
const plusOne = (page: Page) => page.getByRole('button', { name: '1問増やす' });
const save = (page: Page) => page.getByRole('button', { name: /今日の記録を保存|保存済み/ });
const card = (page: Page) => page.getByTestId('stamp-card');

async function setDate(page: Page, date: string) {
  await page.clock.setFixedTime(new Date(`${date}T12:00:00+09:00`));
}

async function expectNoSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test('全画面が横スクロールなしで表示できる', async ({ page }, info) => {
  await page.goto('./');
  await expect(card(page)).toBeVisible();
  await expectNoSideScroll(page);
  await page.screenshot({ path: `test-results/shots/${info.project.name}-home.png` });
  for (const name of ['スタンプ帳', 'カレンダー', 'きろく']) {
    await tab(page, name).click();
    await expectNoSideScroll(page);
    await page.screenshot({ path: `test-results/shots/${info.project.name}-${name}.png` });
  }
});

test('主要ボタンが画面内でタップできる大きさ', async ({ page }) => {
  await page.goto('./');
  await save(page).scrollIntoViewIfNeeded();
  for (const button of [plusOne(page), save(page)]) {
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});

const PASS_FILE = 'private-assets/passphrase.txt';

test('合言葉でキャラクター画像を表示でき、再読み込み後も残る', async ({ page }) => {
  test.skip(!existsSync(PASS_FILE), '合言葉はこのPCにしかない');
  await page.goto('./');
  await page.getByLabel('合言葉').fill('wrong-passphrase');
  await page.getByRole('button', { name: 'キャラを表示' }).click();
  await expect(page.getByRole('alert')).toContainText('合言葉が違います');
  await expect(card(page).locator('img.portrait')).toHaveCount(0);

  // スマホの自動大文字化を想定し、先頭を大文字にして入力する
  const pass = readFileSync(PASS_FILE, 'utf8').trim();
  await page.getByLabel('合言葉').fill(pass.charAt(0).toUpperCase() + pass.slice(1));
  await page.getByRole('button', { name: 'キャラを表示' }).click();
  await expect(page.getByText('50人のキャラクターを表示しました')).toBeVisible();
  await expect(card(page).locator('img.portrait')).toHaveAttribute('alt', 'ブロディ');
  await expect(page.getByTestId('image-hint')).toHaveCount(0);

  await page.reload();
  await expect(card(page).locator('img.portrait')).toHaveAttribute('alt', 'ブロディ');
  await tab(page, 'スタンプ帳').click();
  await expect(page.locator('.zukan-grid img.portrait')).toHaveCount(50);
});

test('合言葉つきリンクを開くだけで画像が表示され、URLから合言葉が消える', async ({ page }) => {
  test.skip(!existsSync(PASS_FILE), '合言葉はこのPCにしかない');
  await page.goto(`./#key=${readFileSync(PASS_FILE, 'utf8').trim()}`);
  await expect(page.getByText('50人のキャラクターを表示しました')).toBeVisible();
  await expect(card(page).locator('img.portrait')).toHaveAttribute('alt', 'ブロディ');
  expect(page.url()).not.toContain('key=');
  await page.reload();
  await expect(card(page).locator('img.portrait')).toHaveAttribute('alt', 'ブロディ');
});

test('きろくタブから画像パックのファイルも読み込める', async ({ page }) => {
  const pack = JSON.stringify({
    app: 'dr-stone-study-quest',
    type: 'image-pack',
    version: 1,
    images: { 50: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==' },
  });
  await page.goto('./');
  await expect(page.getByTestId('image-hint')).toBeVisible();
  await tab(page, 'きろく').click();
  await page.getByTestId('image-file').setInputFiles({ name: 'p.json', mimeType: 'application/json', buffer: Buffer.from(pack) });
  await expect(page.getByText('1人分の画像を読み込みました')).toBeVisible();
  await tab(page, 'ホーム').click();
  await expect(page.getByTestId('image-hint')).toHaveCount(0);
  await expect(card(page).locator('img.portrait')).toHaveAttribute('alt', 'ブロディ');
  await page.reload();
  await expect(card(page).locator('img.portrait')).toHaveAttribute('alt', 'ブロディ');
});

test('画像が入るまで合言葉の欄は再読み込みしても表示され続ける', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByLabel('合言葉')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('合言葉')).toBeVisible();
  await tab(page, 'きろく').click();
  await expect(page.getByLabel('合言葉')).toBeVisible();
  await expect(page.getByTestId('build-id')).toContainText('版:');
});

test('スクロールせずに入力と保存へ届く（縦長スマホ以上）', async ({ page }) => {
  await page.goto('./');
  // 案内は画像が入ると消えるので、ふだんの状態にしてから測る
  const pack = JSON.stringify({ app: 'dr-stone-study-quest', type: 'image-pack', version: 1, images: { 50: 'data:image/png;base64,AAAA' } });
  await tab(page, 'きろく').click();
  await page.getByTestId('image-file').setInputFiles({ name: 'p.json', mimeType: 'application/json', buffer: Buffer.from(pack) });
  await tab(page, 'ホーム').click();
  await expect(page.getByTestId('image-hint')).toHaveCount(0);
  const box = await save(page).boundingBox();
  const navTop = (await page.getByRole('navigation').boundingBox())!.y;
  const viewport = page.viewportSize()!;
  // タブバーがスマホ下部にある幅では、その上に収まること
  const limit = viewport.width < 760 ? navTop : viewport.height;
  expect(box!.y + box!.height).toBeLessThanOrEqual(limit);
});

test('スタンプの更新・翌日の進行・再読み込み後の保持', async ({ page }) => {
  await setDate(page, '2026-11-06');
  await page.goto('./');
  await expect(card(page)).toHaveAttribute('data-grade', 'スタンプなし');
  await expect(card(page).getByText('ブロディ')).toBeVisible();

  await plusOne(page).click();
  await save(page).click();
  await expect(page.getByText('ブロディの銅スタンプ！')).toBeVisible();
  await plusOne(page).click();
  await save(page).click();
  await expect(page.getByText('ブロディの銀スタンプ！')).toBeVisible();

  await page.reload();
  await expect(card(page)).toHaveAttribute('data-grade', '銀');
  await expect(page.getByTestId('achieved-days')).toHaveText(/^1/);

  await setDate(page, '2026-11-07');
  await page.reload();
  await expect(card(page).getByText('コニー・リー')).toBeVisible();
  await plusOne(page).click();
  await save(page).click();
  await expect(page.getByText('コニー・リーの銅スタンプ！')).toBeVisible();
  await expect(page.getByTestId('current-streak')).toHaveText(/^2/);

  // 1日休むと連続は途切れるが獲得済みは残る
  await setDate(page, '2026-11-09');
  await page.reload();
  await expect(page.getByTestId('current-streak')).toHaveText(/^0/);
  await tab(page, 'スタンプ帳').click();
  await expect(page.getByTestId('zukan-count')).toHaveText('2');
});

test('確定の時だけ音が鳴る', async ({ page }) => {
  await page.addInitScript(() => {
    const started: number[] = [];
    (window as unknown as { __tones: number[] }).__tones = started;
    const original = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args: [number?]) {
      started.push(this.frequency.value);
      return original.apply(this, args);
    };
  });
  await page.goto('./');
  const tones = () => page.evaluate(() => (window as unknown as { __tones: number[] }).__tones.length);
  await plusOne(page).click();
  await plusOne(page).click();
  await plusOne(page).click();
  expect(await tones()).toBe(0);
  await save(page).click();
  await expect(page.getByText('金スタンプ！')).toBeVisible();
  // 押す音2つ＋金のチャイム3音
  expect(await tones()).toBe(5);
});

test('JSONバックアップを書き出し、初期化後に復元できる', async ({ page }) => {
  await setDate(page, '2026-11-06');
  await page.goto('./');
  await plusOne(page).click();
  await plusOne(page).click();
  await plusOne(page).click();
  await page.getByRole('checkbox', { name: '宿題を終えた' }).check();
  await save(page).click();
  await expect(page.getByText('金スタンプ！')).toBeVisible();

  await tab(page, 'きろく').click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSONに書き出す' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('dr-stone-study-backup-2026-11-06.json');
  const path = await download.path();
  const backup = JSON.parse(readFileSync(path, 'utf8'));
  expect(backup.records).toMatchObject([{ date: '2026-11-06', problems: 3, homework: true }]);

  await page.getByRole('button', { name: '記録をすべて消す' }).click();
  await page.getByRole('textbox', { name: /リセット/ }).fill('リセット');
  await page.getByRole('button', { name: '消す', exact: true }).click();
  await expect(page.getByTestId('stat-problems')).toHaveText(/^0/);

  await page.getByTestId('backup-file').setInputFiles(path);
  await page.getByRole('button', { name: '足りない日だけ追加' }).click();
  await expect(page.getByTestId('stat-problems')).toHaveText(/^3/);
  await expect(page.getByTestId('stat-homework')).toHaveText(/^1/);

  await page.reload();
  await expect(card(page)).toHaveAttribute('data-grade', '金');
});

test('PWAのマニフェストとアイコンがサブパスで取得できる', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toContain('/dr-stone-study-quest/');
  const manifestUrl = new URL(href!, page.url()).toString();
  const manifest = await (await request.get(manifestUrl)).json();
  expect(manifest.start_url).toBe('/dr-stone-study-quest/');
  expect(manifest.display).toBe('standalone');
  for (const icon of manifest.icons) {
    const response = await request.get(new URL(icon.src, manifestUrl).toString());
    expect(response.ok()).toBe(true);
  }
  expect((await request.get(new URL('icons/apple-touch-icon.png', page.url()).toString())).ok()).toBe(true);
});

test('公開版にキャラクター画像が配信されていない', async ({ page }) => {
  const images: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'image' && !r.url().includes('/icons/') && !r.url().includes('favicon')) images.push(r.url());
  });
  await page.goto('./');
  await tab(page, 'スタンプ帳').click();
  await expect(page.getByTestId('tile-1')).toBeVisible();
  await expect(page.getByRole('img', { name: 'あさぎりゲン（仮画像）' })).toBeVisible();
  expect(images).toEqual([]);
});

test('初回アクセス後はオフラインでも起動・記録できる', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Playwright の WebKit は Service Worker のオフライン制御に対応していない');
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(card(page)).toBeVisible();
  await plusOne(page).click();
  await save(page).click();
  await expect(page.getByText(/銅スタンプ！/)).toBeVisible();
  await page.reload();
  await expect(card(page)).toHaveAttribute('data-grade', '銅');
  await context.setOffline(false);
});

test('お助けアイテムを使う画面が崩れず、連続がつながる', async ({ page }, info) => {
  await setDate(page, '2026-11-06');
  const records = Array.from({ length: 20 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 9, 16 + i)).toISOString().slice(0, 10);
    return { date: d, homework: false, problems: 1, updatedAt: '2026-01-01T00:00:00.000Z' };
  });
  await page.goto('./');
  await tab(page, 'きろく').click();
  await page.getByTestId('backup-file').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ app: 'dr-stone-study-quest', type: 'backup', schemaVersion: 1, records })),
  });
  await page.getByRole('button', { name: '足りない日だけ追加' }).click();
  await tab(page, 'ホーム').click();
  await expect(page.getByTestId('rescue-offer')).toBeVisible();
  await expectNoSideScroll(page);
  await page.screenshot({ path: `test-results/shots/${info.project.name}-rescue.png` });
  await page.getByRole('button', { name: /アイテムを使う/ }).click();
  await expect(page.getByTestId('current-streak')).toHaveText(/^20/);
  await page.getByTestId('level-card').click();
  await expect(page.getByTestId('level-list')).toContainText('石斧');
  await expectNoSideScroll(page);
  await page.screenshot({ path: `test-results/shots/${info.project.name}-levels.png` });
});

test('ブラウザを完全に終了しても、記録と保存前の入力と設定が残る', async ({ browserName }, info) => {
  test.skip(browserName !== 'chromium', '同じ保存先で再起動できるのは Chromium のみ');
  const baseURL = info.project.use.baseURL!;
  const profile = mkdtempSync(join(tmpdir(), 'dr-stone-profile-'));
  try {
    let context = await chromium.launchPersistentContext(profile, { baseURL });
    let page = context.pages()[0] ?? (await context.newPage());
    await page.goto('./');
    await plusOne(page).click();
    await save(page).click();
    await expect(page.getByTestId('achieved-days')).toHaveText(/^1/);
    await page.getByRole('button', { name: '1問増やす' }).click();
    await page.getByRole('checkbox', { name: '宿題を終えた' }).check();
    await expect(page.getByTestId('autosave-note')).toBeVisible();
    await tab(page, 'きろく').click();
    await page.getByTestId('rescue-interval').fill('7');
    await page.waitForTimeout(300);
    await context.close();

    context = await chromium.launchPersistentContext(profile, { baseURL });
    page = context.pages()[0] ?? (await context.newPage());
    await page.goto('./');
    await expect(page.getByTestId('achieved-days')).toHaveText(/^1/);
    await expect(card(page)).toHaveAttribute('data-grade', '銀');
    await expect(page.getByRole('checkbox', { name: '宿題を終えた' })).toBeChecked();
    await tab(page, 'きろく').click();
    await expect(page.getByTestId('rescue-interval')).toHaveValue('7');
    await context.close();
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
});

test('連続日数とレベルが大きく、3桁の日数と長いレベル名でも崩れない', async ({ page }, info) => {
  await setDate(page, '2026-11-06');
  const records = Array.from({ length: 299 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 10, 5 - i)).toISOString().slice(0, 10),
    homework: false,
    problems: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
  }));
  await page.goto('./');
  const pack = JSON.stringify({ app: 'dr-stone-study-quest', type: 'image-pack', version: 1, images: { 50: 'data:image/png;base64,AAAA' } });
  await tab(page, 'きろく').click();
  await page.getByTestId('image-file').setInputFiles({ name: 'p.json', mimeType: 'application/json', buffer: Buffer.from(pack) });
  await page.getByTestId('backup-file').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ app: 'dr-stone-study-quest', type: 'backup', schemaVersion: 1, records })),
  });
  await page.getByRole('button', { name: '足りない日だけ追加' }).click();
  await tab(page, 'ホーム').click();
  await page.getByRole('button', { name: /レベル6を続ける|ホーム/ }).first().click();

  const streak = page.getByTestId('current-streak');
  const level = page.getByTestId('level-num');
  await expect(streak).toHaveText(/^299/);
  await expect(level).toHaveText('レベル6');
  await expect(page.getByTestId('level-card')).toContainText('コンピュータ・情報革命レベル');
  const px = (el: Element) => parseFloat(getComputedStyle(el).fontSize);
  expect(await streak.evaluate(px)).toBeGreaterThanOrEqual(50);
  expect(await level.evaluate(px)).toBeGreaterThanOrEqual(38);
  await expectNoSideScroll(page);

  await page.screenshot({ path: `test-results/shots/${info.project.name}-hero.png` });
  const box = await save(page).boundingBox();
  const navTop = (await page.getByRole('navigation').boundingBox())!.y;
  const viewport = page.viewportSize()!;
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.width < 760 ? navTop : viewport.height);
});
