import { JSONParser } from "@streamparser/json";
import { validId } from "./domain.mjs";

export const RANGERBOOK_BASE = "https://pvp-data.warmycat.com";
export const RANKING_URL = `${RANGERBOOK_BASE}/guildwar_ranking.json`;
const MAX_AGE = Infinity;
export function assertRecent(metadata, maxAge = MAX_AGE) {
  const observed = Date.parse(metadata?.generatedAtUtc);
  const age = Date.now() - observed;
  if (!Number.isFinite(observed) || (Number.isFinite(maxAge) && (age > maxAge || age < -5 * 60000)))
    throw new Error("Rangerbookの名簿が古いため、保存済み名簿を維持します。");
  return metadata.generatedAtUtc;
}

// Retain only roster fields while streaming. Never buffer the full
// 20–60 MB response in a Worker isolate, or put it into a D1 cache row.
export async function readCompactSnapshot(response, maxAge = MAX_AGE) {
  const result = { metadata: null, guilds: [] };
  const parser = new JSONParser({ paths: ["$.metadata", "$.guilds.*.guildName", "$.guilds.*.curMemberCount", "$.guilds.*.members.*.name", "$.guilds.*.members.*.level"], keepStack: false });
  parser.onValue = ({ value, key, stack }) => {
    if (key === "metadata") result.metadata = value;
    else {
      const index = stack[2]?.key;
      if (!Number.isInteger(index) || index < 0 || index >= 1000) throw new Error("ギルド数が上限を超えました");
      const guild = result.guilds[index] ||= { members: [] };
      if (stack.length === 3) guild[key] = value;
      else {
        const memberIndex = stack[4]?.key;
        if (!Number.isInteger(memberIndex) || memberIndex < 0 || memberIndex >= 100) throw new Error("メンバー数が上限を超えました");
        const member = guild.members[memberIndex] ||= {};
        member[key] = value;
      }
    }
  };
  const reader = response.body.getReader();
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 100_000_000) throw new Error("配信データが上限を超えました");
      parser.write(value);
    }
    if (!parser.isEnded) parser.end();
  } catch (e) {
    await reader.cancel().catch(() => {});
    throw e;
  } finally {
    reader.releaseLock();
  }
  assertRecent(result.metadata, maxAge);
  if (!result.guilds.length) throw new Error("名簿データがありません");
  return result;
}

export function publicRankings(input, maxAge = MAX_AGE) {
  assertRecent(input?.metadata, maxAge);
  if (!Array.isArray(input.guilds) || !input.guilds.length)
    throw new Error("Rangerbookのランキング形式が変わりました");
  const seen = new Set();
  for (const g of input.guilds) {
    if (!validId(g.gid) || seen.has(g.gid) || typeof g.guildName !== "string")
      throw new Error("ランキングのギルド情報が不正です");
    seen.add(g.gid);
  }
  return input;
}

export function selectRoster(ranking, snapshot, gid, maxAge = MAX_AGE) {
  assertRecent(ranking.metadata, maxAge);
  const observedAt = assertRecent(snapshot.metadata, maxAge);
  const guild = ranking.guilds.find((g) => g.gid === gid);
  if (!guild || ranking.guilds.filter((g) => g.guildName === guild.guildName).length !== 1)
    throw new Error("Rangerbookに対応するギルドを一意に特定できません。");
  const matches = snapshot.guilds.filter((g) => g.guildName === guild.guildName);
  if (matches.length !== 1) throw new Error("このギルドの公開名簿は取得できません。");
  const row = matches[0];
  if (!Array.isArray(row.members) || row.members.length > 50)
    throw new Error("公開名簿の人数が一致しないため、保存済み名簿を維持します。");
  if (row.members.some((m) => typeof m.name !== "string" || !m.name.trim() || m.name.length > 100 || !Number.isInteger(m.level) || m.level < 1 || m.level > 10000))
    throw new Error("公開名簿に不正なメンバー情報があります。");
  return { members: row.members, observedAt, reportedMemberCount: row.curMemberCount, incomplete: row.members.length !== row.curMemberCount };
}

export function reconcileRoster(previous, incoming, newId = () => `rb-${crypto.randomUUID()}`) {
  const byName = new Map();
  for (const m of previous) byName.set(m.userName, [...(byName.get(m.userName) || []), m]);
  const groups = new Map();
  for (const m of incoming) groups.set(m.name, [...(groups.get(m.name) || []), m]);
  const data = [];
  let duplicates = false;
  for (const [name, rows] of groups) {
    const old = byName.get(name) || [];
    if (rows.length > 1 || old.length > 1) {
      // There is no game UID in the public feed. Keep an unchanged duplicate
      // group intact; never assign one account's checks to another by order.
      const levels = (list, field) => list.map((m) => m[field]).sort((a,b) => a-b).join(",");
      if (old.length === 0) {
        duplicates = true;
        data.push(...rows.map((row) => ({ uid: newId(), userName: name, level: row.level, pvpLeaguePhase: "" })));
      } else if (rows.length !== old.length || levels(rows, "level") !== levels(old, "level"))
        throw new Error("同名メンバーを区別できません。「名簿を管理」で確認してください。既存の名簿・攻撃記録は維持しています。");
      else {
        duplicates = true;
        data.push(...old);
      }
    } else {
      const existing = old[0];
      data.push({ uid: existing?.uid || newId(), userName: name, level: rows[0].level, pvpLeaguePhase: existing?.pvpLeaguePhase || "" });
    }
  }
  return { data, duplicates };
}
