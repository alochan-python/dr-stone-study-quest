// 画像パックを暗号化して public/packs に出力する。合言葉は private-assets/passphrase.txt（git管理外）に置く。
// 実行: npm run pack:encrypt
import { randomInt } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { encryptPack } from '../src/domain/encryptedPack.ts';

const PACK = 'private-assets/dr-stone-image-pack.json';
const PASS = 'private-assets/passphrase.txt';
const OUT = 'public/packs/characters.enc.json';
// 打ち間違えやすい文字を除いた小文字と数字
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function generate(): string {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `${group()}-${group()}-${group()}-${group()}`;
}

if (!existsSync(PASS)) writeFileSync(PASS, `${generate()}\n`, { mode: 0o600 });
const encrypted = await encryptPack(readFileSync(PACK, 'utf8'), readFileSync(PASS, 'utf8'));
writeFileSync(OUT, JSON.stringify(encrypted));
console.log(`${OUT} を出力しました（合言葉: ${PASS}）`);
