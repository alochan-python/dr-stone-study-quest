#!/usr/bin/env node
// 公開物に提供画像が混ざっていないことを確かめる。CI と push 前に実行する。
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RASTER = /\.(jpe?g|webp|gif|avif|bmp|tiff?)$/i;
// 公開してよい画像は自作の PWA アイコンだけ
const ALLOWED_PNG = /(^|\/)icons\/(icon-192|icon-512|icon-maskable-512|apple-touch-icon)\.png$/;

const isForbidden = (path) =>
  path.includes('private-assets/') ||
  /image-pack.*\.json$/i.test(path) ||
  RASTER.test(path) ||
  (/\.png$/i.test(path) && !ALLOWED_PNG.test(path));

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const staged = execSync('git ls-files --cached', { encoding: 'utf8' }).split('\n').filter(Boolean);
const built = existsSync('dist') ? walk('dist') : [];
const bad = [...staged, ...built].filter(isForbidden);

if (bad.length > 0) {
  console.error('公開してはいけないファイルが含まれています:\n' + bad.map((p) => `  ${p}`).join('\n'));
  process.exit(1);
}
console.log(`OK: git ${staged.length}件 / dist ${built.length}件に提供画像は含まれていません`);
