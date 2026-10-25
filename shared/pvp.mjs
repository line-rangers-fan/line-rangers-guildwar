// Only observations published by Lerico are used; absence is not a league.
export const PVP_LEAGUES = ["LEGEND", ...["MASTER", "DIAMOND", "GOLD", "SILVER"].flatMap((tier) => [1, 2, 3].map((n) => `${tier}_${n}`)), "BRONZE"];
export const PVP_BASE = "https://rangers.lerico.net/api/v2/pvp/league/rank/";
export const PVP_MAX_AGE = 6 * 60 * 60 * 1000;
export function pvpLabel(league) {
  const [tier, phase] = String(league || "").split("_");
  const name = { LEGEND: "レジェンド", MASTER: "マスター", DIAMOND: "ダイヤ", GOLD: "ゴールド", SILVER: "シルバー", BRONZE: "ブロンズ" }[tier];
  return PVP_LEAGUES.includes(league) ? name + ({ 1: "I", 2: "II", 3: "III" }[phase] || "") : "未確認";
}
export function compactPvp(input, league, now = Date.now()) {
  if (!PVP_LEAGUES.includes(league) || !Array.isArray(input?.top100) || !Array.isArray(input?.playerInfo) || input.top100.length > 1000 || input.playerInfo.length > 1000) throw new Error("PvP情報の形式が変わっています");
  const info = new Map(input.playerInfo.map((p) => [p.mid, p]));
  return input.top100.flatMap((row) => {
    const p = info.get(row.mid), time = Date.parse(p?.lastFetched);
    if (!p?.guild?.gid || !p?.player?.userName || row.displayName !== p.player.userName || !Number.isInteger(row.rank) || row.rank < 1 || !Number.isFinite(time) || now - time > PVP_MAX_AGE || time > now + 60000) return [];
    return [{ mid: row.mid, gid: p.guild.gid, userName: p.player.userName, league, rank: row.rank, observedAt: p.lastFetched }];
  });
}
export function guildPvp(rows, gid, now = Date.now()) {
  const groups = new Map();
  for (const row of rows) {
    if (row.gid !== gid || now - Date.parse(row.observedAt) > PVP_MAX_AGE) continue;
    const matches = groups.get(row.userName) || [];
    matches.push(row); groups.set(row.userName, matches);
  }
  // Even equal names within a guild may be different people. Don't guess.
  return [...groups.values()].filter((matches) => matches.length === 1).map(([{ userName, league, rank, observedAt }]) => ({ userName, league, rank, observedAt }));
}
export function matchPvp(members, observations) {
  const counts = new Map();
  for (const m of members) counts.set(m.userName, (counts.get(m.userName) || 0) + 1);
  return new Map(observations.filter((p) => counts.get(p.userName) === 1).map((p) => [p.userName, p]));
}
