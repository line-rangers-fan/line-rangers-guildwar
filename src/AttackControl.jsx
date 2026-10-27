import React from "react";

export function AttackControl({ name, day, slot, attacked, result, disabled, onOpen }) {
  const value = !attacked ? "empty" : result || "unknown";
  const label = value === "win" ? "勝ち" : value === "loss" ? "負け" : value === "unknown" ? "勝敗未判定" : "未攻撃";
  return (
    <button
      type="button"
      className={`attack-result result-${value}`}
      disabled={disabled}
      aria-haspopup="dialog"
      aria-label={`${name} ${day} ${slot}回目 ${label}。勝敗を選択`}
      onClick={onOpen}
    >
      {value === "win" ? "○" : value === "loss" ? "×" : ""}
    </button>
  );
}

