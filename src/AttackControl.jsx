import React from "react";

// Each click sends an explicit slot value through the existing shared-save API.
// Clearing slot 1 also clears slot 2 on the server, preserving its invariants.
export function AttackControl({ name, day, first, second, disabled, onChange }) {
  const count = second ? 2 : first ? 1 : 0;
  const next = (count + 1) % 3;
  return (
    <button
      type="button"
      className="attack-mark"
      data-count={count}
      disabled={disabled}
      aria-label={`${name} ${day} ${count}回攻撃済み。${next === 0 ? "解除" : `${next}回目を記録`}`}
      title={`${count}回攻撃済み → ${next === 0 ? "解除" : `${next}回目を記録`}`}
      onClick={() => onChange(next === 2 ? 2 : 1, next !== 0)}
    >
      <span aria-hidden="true" className="attack-strokes" />
      <span className="sr-only">{count} / 2</span>
    </button>
  );
}
