export const DAYS = [3, 5, 0];
export const LEAGUES = [
  "LEGEND",
  "MASTER_1",
  "MASTER_2",
  "MASTER_3",
  "DIAMOND_1",
  "DIAMOND_2",
  "DIAMOND_3",
  "GOLD_1",
  "GOLD_2",
  "GOLD_3",
  "SILVER_1",
  "SILVER_2",
  "SILVER_3",
  "BRONZE",
];
export function japanDate(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}
export function gameDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
} // JST 09:00 = UTC 00:00
export function weekDates(date = gameDate()) {
  const d = new Date(`${date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(d.getTime()) ||
    d.toISOString().slice(0, 10) !== date
  )
    throw new Error("日付が正しくありません");
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return [2, 4, 6].map((offset) => {
    const day = new Date(monday);
    day.setUTCDate(day.getUTCDate() + offset);
    return day.toISOString().slice(0, 10);
  });
}
export function shiftWeek(date, delta) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta * 7);
  return d.toISOString().slice(0, 10);
}
export function leagueLabel(p) {
  return (
    {
      LEGEND: "L",
      MASTER_1: "M1",
      MASTER_2: "M2",
      MASTER_3: "M3",
      DIAMOND_1: "D1",
      DIAMOND_2: "D2",
      DIAMOND_3: "D3",
      GOLD_1: "G1",
      GOLD_2: "G2",
      GOLD_3: "G3",
      SILVER_1: "S1",
      SILVER_2: "S2",
      SILVER_3: "S3",
      BRONZE: "B",
    }[p] ||
    p ||
    "—"
  );
}
export function levelLabel(n) {
  if (n < 100) return `Lv${n}`;
  const i = Math.min(4, Math.floor((n - 100) / 99));
  return `${["M", "S", "U", "L", "SL"][i]}${n - 99 * (i + 1)}`;
}
export function checked(states, uid, day, slot) {
  return states?.[uid]?.[day]?.[slot] === true;
}
export function remaining(members, states, day) {
  return members.reduce(
    (sum, m) =>
      sum + [1, 2].filter((slot) => !checked(states, m.uid, day, slot)).length,
    0,
  );
}
export function csvCell(value) {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function validId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}
