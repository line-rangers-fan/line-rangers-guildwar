import { validId, weekDates } from "./domain.mjs";
export const privateKey = (gid) => `guildwar-private-checks:${gid}`;
export function loadPrivateBoard(storage, gid, week) {
  const raw = storage.getItem(privateKey(gid));
  if (!raw) return { states: {}, results: [{}, {}], exists: false };
  const data = JSON.parse(raw);
  const sameWeek = data.week === week;
  const results = sameWeek && Array.isArray(data.results) && data.results.length === 2 ? data.results : [{}, {}];
  return { states: sameWeek && data.states && typeof data.states === "object" && !Array.isArray(data.states) ? data.states : {}, results, exists: true };
}
export function savePrivateBoard(storage, gid, week, states, results) {
  const savedResults = results ?? loadPrivateBoard(storage, gid, week).results;
  storage.setItem(privateKey(gid), JSON.stringify({ week, states, results:savedResults }));
}
export function checkedEntries(states, members, dates) {
  const entries = [];
  for (const member of members) for (const day of dates) for (const slot of [1, 2])
    if (states?.[member.uid]?.[day]?.[slot] === true) entries.push({ uid: member.uid, day, slot });
  return entries;
}
export function validateShare(input, members) {
  const dates = weekDates(input?.week);
  if (!Array.isArray(input?.entries) || input.entries.length > 300) throw new Error("共有データの形式が正しくありません");
  const ids = new Set(members.map((m) => m.uid)), entries = new Map();
  for (const entry of input.entries) {
    if (!validId(entry?.uid) || !ids.has(entry.uid) || !dates.includes(entry.day) || ![1, 2].includes(entry.slot)) throw new Error("共有データに未登録メンバーまたは不正な日付があります");
    for (const slot of entry.slot === 2 ? [1, 2] : [1]) entries.set(`${entry.uid}:${entry.day}:${slot}`, { uid: entry.uid, day: entry.day, slot });
  }
  return { dates, entries: [...entries.values()] };
}
