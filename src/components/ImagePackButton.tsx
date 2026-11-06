import { useRef, type ChangeEvent } from 'react';
import { ImportError, parseImagePack } from '../domain/backup';
import { useApp } from '../state/store';

/** 画像パックは端末の IndexedDB にだけ保存され、通信では送られない */
export function ImagePackButton({ className = 'btn' }: { className?: string }) {
  const { importImages, notify } = useApp();
  const input = useRef<HTMLInputElement>(null);

  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const pack = parseImagePack(await file.text());
      if (await importImages(pack)) {
        notify({ kind: 'success', text: `${Object.keys(pack).length}人分の画像を読み込みました` });
      }
    } catch (error) {
      notify({ kind: 'error', text: error instanceof ImportError ? error.message : 'ファイルを読み込めませんでした。' });
    }
  };

  return (
    <>
      <button type="button" className={className} onClick={() => input.current?.click()}>
        画像パックを読み込む
      </button>
      <input
        ref={input}
        data-testid="image-file"
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => void onChange(e)}
      />
    </>
  );
}
