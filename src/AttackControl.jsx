import React from "react";

export function AttackControl({ name, day, slot, attacked, result, disabled, onChange }) {
  const value = !attacked ? "empty" : result || "unknown";
  return (
    <label className="attack-control">
      <select
        className={`attack-result result-${value}`}
        value={value}
        disabled={disabled}
        aria-label={`${name} ${day} ${slot}回目の勝敗`}
        onChange={(e) => onChange(e.target.value === "empty" ? null : e.target.value)}
      >
        <option value="empty">—</option>
        <option value="win">○</option>
        <option value="loss">×</option>
        <option value="unknown" disabled>済</option>
      </select>
    </label>
  );
}
