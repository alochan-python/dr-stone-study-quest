import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { parseImagePack } from '../domain/backup';
import { WrongPassphraseError, decryptPack, type EncryptedPack } from '../domain/encryptedPack';
import { useApp } from '../state/store';

/** 合言葉で暗号化された画像を取得・復号し、この端末に保存する */
function useImageUnlock() {
  const { importImages, notify } = useApp();
  return useCallback(
    async (passphrase: string) => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}packs/characters.enc.json`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const encrypted = (await response.json()) as EncryptedPack;
        const pack = parseImagePack(await decryptPack(encrypted, passphrase));
        if (await importImages(pack)) {
          notify({ kind: 'success', text: `${Object.keys(pack).length}人のキャラクターを表示しました` });
        }
      } catch (error) {
        notify({
          kind: 'error',
          text:
            error instanceof WrongPassphraseError
              ? '合言葉が違います。もう一度確認してください。'
              : '画像を取得できませんでした。インターネット接続を確認してください。',
        });
      }
    },
    [importImages, notify],
  );
}

/**
 * URL末尾の #key=合言葉 を開くだけで画像を表示する。
 * # 以降はサーバーへ送られず、読み取ったらアドレス欄と履歴からも消す。
 */
export function ImageLinkUnlock() {
  const { images } = useApp();
  const unlock = useImageUnlock();
  const hasImages = useRef(Object.keys(images).length > 0);

  useEffect(() => {
    const match = /^#key=(.+)$/.exec(window.location.hash);
    if (!match) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (!hasImages.current) void unlock(decodeURIComponent(match[1]));
  }, [unlock]);

  return null;
}

export function ImageUnlock() {
  const unlock = useImageUnlock();
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    await unlock(passphrase);
    setBusy(false);
  };

  return (
    <form className="image-unlock" onSubmit={(e) => void submit(e)}>
      <label className="visually-hidden" htmlFor="image-passphrase">合言葉</label>
      <input
        id="image-passphrase"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        placeholder="合言葉"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
      />
      <button className="btn btn-sm btn-primary" disabled={busy || passphrase.trim() === ''}>
        {busy ? '読み込み中…' : 'キャラを表示'}
      </button>
    </form>
  );
}
