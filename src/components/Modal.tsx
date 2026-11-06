import { useEffect, useRef, useState, type ReactNode } from 'react';

export function Modal({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => previous?.focus?.();
  }, []);

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        // 重なったモーダルでは一番手前だけを閉じる
        e.stopPropagation();
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panel}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger = false,
  requireText,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  /** 指定すると、この文字を入力するまで実行できない */
  requireText?: string;
  onConfirm(): void;
  onCancel(): void;
}) {
  const [typed, setTyped] = useState('');
  const blocked = requireText !== undefined && typed.trim() !== requireText;
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="modal-body">{body}</div>
      {requireText && (
        <label className="confirm-input">
          確認のため「{requireText}」と入力してください
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </label>
      )}
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel}>
          やめる
        </button>
        <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={blocked}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
