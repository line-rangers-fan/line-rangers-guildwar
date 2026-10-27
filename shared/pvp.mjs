import { LEAGUES } from "./domain.mjs";
// The reference site's member list supplies the displayed PvP ranks for
// display and sorting. It is never saved into the roster.
export const REFERENCE_MEMBERS_URL = "https://rangers-api-3mfw.onrender.com/api/guild-member-info/{gid}/members";
export const REFERENCE_MAX_AGE = 6 * 60 * 60 * 1000;
export const displayedPvpRank = (member) => member.pvpReferenceChecked ? (member.pvpReference || "") : (member.pvpLeaguePhase || member.pvpReference || "");
export function normalizeReferenceMembers(input) {
  const members = Array.isArray(input) ? input : input?.members;
  if (!Array.isArray(members) || members.length > 100) throw new Error("PvP参照名簿の形式が変わっています");
  // Keep rows with unknown leagues: they still count toward name uniqueness.
  return members.map((m) => {
    if (typeof m?.userName !== "string") throw new Error("PvP参照名簿に不正な行があります");
    return { userName: m.userName, pvpLeaguePhase: LEAGUES.includes(m.pvpLeaguePhase) ? m.pvpLeaguePhase : "" };
  });
}
// Match only names that occur exactly once on both sides. Same-name players are never guessed.
export function withReferencePvp(members, reference) {
  const counts = (list) => list.reduce((map, m) => map.set(m.userName, (map.get(m.userName) || 0) + 1), new Map());
  const ours = counts(members), theirs = counts(reference);
  const leagues = new Map(reference.filter((r) => r.pvpLeaguePhase && theirs.get(r.userName) === 1).map((r) => [r.userName, r.pvpLeaguePhase]));
  return members.map((m) => {
    const pvpReference = ours.get(m.userName) === 1 ? leagues.get(m.userName) : "";
    return { ...m, pvpReference: pvpReference || "", pvpReferenceChecked: true };
  });
}
