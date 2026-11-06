import { MAX_PROBLEMS, normalizeProblems } from '../domain/grade';

export function Stepper({ value, onChange }: { value: number; onChange(next: number): void }) {
  const change = (next: number) => onChange(normalizeProblems(next));
  return (
    <div className="stepper">
      <button type="button" className="step-btn" onClick={() => change(value - 1)} disabled={value <= 0} aria-label="1問減らす">
        −1問
      </button>
      <label className="step-value">
        <span className="visually-hidden">自主勉強の問題数</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_PROBLEMS}
          value={value}
          onFocus={(e) => e.target.select()}
          onChange={(e) => change(e.target.valueAsNumber)}
        />
        <span aria-hidden="true">問</span>
      </label>
      <button type="button" className="step-btn step-add" onClick={() => change(value + 1)} aria-label="1問増やす">
        ＋1問
      </button>
      <button type="button" className="step-btn step-add" onClick={() => change(value + 5)} aria-label="5問増やす">
        ＋5問
      </button>
    </div>
  );
}
