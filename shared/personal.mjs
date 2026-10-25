import { validId, LEAGUES } from "./domain.mjs";
export const PREFERENCES_KEY = "guildwar-personal-v1";
export const DEFAULT_SORT = { key: "level", dir: -1 };
export function directoryGuilds(input, limit = 200) {
  const seen = new Set();
  return [...input].filter((g) => {
    if (!validId(g.gid) || g.gid.startsWith("local-") || seen.has(g.gid) || !(g.lastGuildWarRank > 0 && g.lastGuildWarRank <= 200)) return false;
    seen.add(g.gid); return true;
  }).sort((a, b) => a.lastGuildWarRank - b.lastGuildWarRank || a.gid.localeCompare(b.gid)).slice(0, Math.min(200, Math.max(0, limit)));
}
export function validSort(sort) {
  return ["name", "level", "pvp"].includes(sort?.key) && [1, -1].includes(sort?.dir) ? { key: sort.key, dir: sort.dir } : { ...DEFAULT_SORT };
}
export function loadPersonal(storage) {
  const empty = { guilds: [], selection: { ally: "", enemy: "" }, team: "ally", sort: { ...DEFAULT_SORT }, filterDay: "", filter: "all" };
  try {
    const data = JSON.parse(storage.getItem(PREFERENCES_KEY) || "null");
    const selection = data?.selection || JSON.parse(storage.getItem("guildwar-selection") || "{}");
    const seen = new Set();
    const guilds = (Array.isArray(data?.guilds) ? data.guilds : []).filter((g) => {
      if (!validId(g?.gid) || g.gid.startsWith("local-") || typeof g.name !== "string" || !g.name.trim() || seen.has(g.gid)) return false;
      seen.add(g.gid); return true;
    }).slice(0, 500);
    const filter = ["all", "attacked", "none"].includes(data?.filter)
      ? data.filter
      : ["once", "twice"].includes(data?.filter)
        ? "attacked"
        : "all";
    return { guilds, selection: Object.fromEntries(["ally", "enemy"].map((team) => [team, validId(selection?.[team]) && !selection[team].startsWith("local-") ? selection[team] : ""])), team: "ally", sort: validSort(data?.sort), filterDay: typeof data?.filterDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.filterDay) ? data.filterDay : "", filter: data?.filter === "remaining" ? "none" : filter };
  } catch { return empty; }
}
export function memberComparator(sort) {
  return (a, b) => {
    const name = a.userName.localeCompare(b.userName, "ja");
    const byLevel = Number(b.level || 0) - Number(a.level || 0);
    if (sort.key === "pvp") {
      const rank = (member) => {
        const index = LEAGUES.indexOf(member.pvpLeaguePhase);
        return index < 0 ? LEAGUES.length : index;
      };
      return rank(a) - rank(b) || byLevel || name || a.uid.localeCompare(b.uid);
    }
    return (sort.key === "level" ? -sort.dir * byLevel : sort.dir * name) || name || a.uid.localeCompare(b.uid);
  };
}

// Only explicit shared links may preselect a guild from the address.
export function initialChoice(params) {
  const gid = params.get("gid");
  return { ally: params.get("share") === "1" && validId(gid) ? gid : "", enemy: "" };
}
export function resetPersonal(storage) {
  const keys = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key === PREFERENCES_KEY || key === "guildwar-selection" || key?.startsWith("guildwar-private-checks:")) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}
