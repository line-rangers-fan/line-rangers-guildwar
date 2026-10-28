import { normalizeReferenceMembers } from '../shared/pvp.mjs';

// The provider only offers a guild-wide endpoint. Use it solely to fill names
// absent from the weekly snapshot, never to replace its existing ranks.
export function missingPvpNames(roster, weekly, supplemental = []) {
  const count = new Map();
  for (const m of roster) count.set(m.userName, (count.get(m.userName) || 0) + 1);
  const known = new Set([...weekly, ...supplemental].map(m => m.userName));
  return roster.filter(m => count.get(m.userName) === 1 && !known.has(m.userName)).map(m => m.userName);
}
export function selectPvpAdditions(roster, weekly, supplemental, raw) {
  const requested = new Set(missingPvpNames(roster, weekly, supplemental));
  const rows = normalizeReferenceMembers(raw);
  const count = new Map();
  for (const row of rows) count.set(row.userName, (count.get(row.userName) || 0) + 1);
  return rows.filter(row => requested.has(row.userName) && count.get(row.userName) === 1 && row.pvpLeaguePhase);
}
export function readPvpAdditions(storage, gid, weeklyAt) {
  try {
    const v = JSON.parse(storage.getItem(`guildwar-pvp-additions:${gid}`) || 'null');
    if (!v || v.weeklyAt !== weeklyAt || !Number.isFinite(Date.parse(v.fetchedAt))) return [];
    return normalizeReferenceMembers(v.members).filter(m => m.pvpLeaguePhase);
  } catch { return []; }
}
export function savePvpAdditions(storage, gid, weeklyAt, fetchedAt, members) {
  try { storage.setItem(`guildwar-pvp-additions:${gid}`, JSON.stringify({weeklyAt,fetchedAt,members})); } catch {}
}
