import { validId } from "./domain.mjs";
export const PREFERENCES_KEY = "guildwar-personal-v1";
export const DEFAULT_SORT = { key: "name", dir: 1 };
export function directoryGuilds(input, limit = 500) {
  const seen = new Set();
  return [...input].filter((g) => {
    if (!validId(g.gid) || g.gid.startsWith("local-") || seen.has(g.gid) || !(g.lastGuildWarRank > 0 && g.lastGuildWarRank <= 500)) return false;
    seen.add(g.gid); return true;
  }).sort((a, b) => a.lastGuildWarRank - b.lastGuildWarRank || a.gid.localeCompare(b.gid)).slice(0, Math.min(500, limit));
}
export function validSort(sort) {
  return ["name", "level"].includes(sort?.key) && [1, -1].includes(sort?.dir) ? { key: sort.key, dir: sort.dir } : { ...DEFAULT_SORT };
}
export function loadPersonal(storage) {
  const empty = { guilds: [], selection: { ally: "", enemy: "" }, team: "ally", sort: { ...DEFAULT_SORT } };
  try {
    const data = JSON.parse(storage.getItem(PREFERENCES_KEY) || "null");
    const selection = data?.selection || JSON.parse(storage.getItem("guildwar-selection") || "{}");
    const seen = new Set();
    const guilds = (Array.isArray(data?.guilds) ? data.guilds : []).filter((g) => {
      if (!validId(g?.gid) || g.gid.startsWith("local-") || typeof g.name !== "string" || !g.name.trim() || seen.has(g.gid)) return false;
      seen.add(g.gid); return true;
    }).slice(0, 500);
    return { guilds, selection: Object.fromEntries(["ally", "enemy"].map((team) => [team, validId(selection?.[team]) && !selection[team].startsWith("local-") ? selection[team] : ""])), team: data?.team === "enemy" ? "enemy" : "ally", sort: validSort(data?.sort) };
  } catch { return empty; }
}
export function memberComparator(sort) {
  return (a, b) => {
    const name = a.userName.localeCompare(b.userName, "ja");
    const byLevel = Number(b.level || 0) - Number(a.level || 0);
    return (sort.key === "level" ? -sort.dir * byLevel : sort.dir * name) || name || a.uid.localeCompare(b.uid);
  };
}
