// 画像パックは AES-256-GCM で暗号化して配信し、合言葉を入れた端末の中でだけ復号する
const ITERATIONS = 600_000;

export interface EncryptedPack {
  v: 1;
  iterations: number;
  salt: string;
  iv: string;
  data: string;
}

export class WrongPassphraseError extends Error {}

function toBase64(bytes: Uint8Array): string {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

/** スマホの自動大文字化や前後の空白で失敗しないようにそろえる */
export function normalizePassphrase(passphrase: string): string {
  return passphrase.trim().toLowerCase();
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(normalizePassphrase(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptPack(text: string, passphrase: string, iterations = ITERATIONS): Promise<EncryptedPack> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  return { v: 1, iterations, salt: toBase64(salt), iv: toBase64(iv), data: toBase64(new Uint8Array(data)) };
}

export async function decryptPack(pack: EncryptedPack, passphrase: string): Promise<string> {
  const key = await deriveKey(passphrase, fromBase64(pack.salt), pack.iterations);
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(pack.iv) }, key, fromBase64(pack.data));
    return new TextDecoder().decode(plain);
  } catch {
    throw new WrongPassphraseError();
  }
}
