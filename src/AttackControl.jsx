import React from "react";

export function AttackControl({ name, day, slot, value, disabled, onChange }) {
  return (
    <label className="attack-control">
      <input
        type="checkbox"
        className="attack-check"
        checked={value}
        disabled={disabled}
        aria-label={`${name} ${day} ${slot}回目`}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
