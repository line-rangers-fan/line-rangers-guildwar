import { checked } from './domain.mjs';

// Each attack has a separate small board: slot 1 means a verdict is known,
// slot 2 means it was a win. This preserves pre-existing checks as unknown.
export const emptyResults = () => [{}, {}];
export function resultAt(results, uid, day, slot) {
  const bits = results?.[slot - 1]?.[uid]?.[day];
  return bits?.[1] === true ? (bits?.[2] === true ? 'win' : 'loss') : null;
}
export function setResult(results, uid, day, slot, value) {
  const next = [ ...(results || emptyResults()) ];
  const board = next[slot - 1] || {};
  next[slot - 1] = {
    ...board, [uid]: { ...board[uid], [day]: { 1: value != null, 2: value === 'win' } },
  };
  return next;
}
export function resultSummary(states, results, members, day) {
  let attacks = 0, wins = 0, unknown = 0;
  for (const m of members) for (const slot of [1, 2]) {
    if (!checked(states, m.uid, day, slot)) continue;
    attacks++;
    const outcome = resultAt(results, m.uid, day, slot);
    if (outcome === 'win') wins++;
    if (!outcome) unknown++;
  }
  return { attacks, wins, unknown, rate: attacks ? wins / attacks * 100 : null };
}
export function resultEntries(states, results, members, dates, attackSlot) {
  const entries = [];
  for (const member of members) for (const day of dates) {
    if (!checked(states, member.uid, day, attackSlot)) continue;
    const value = resultAt(results, member.uid, day, attackSlot);
    if (value) entries.push({uid:member.uid, day, slot:1});
    if (value === 'win') entries.push({uid:member.uid, day, slot:2});
  }
  return entries;
}
