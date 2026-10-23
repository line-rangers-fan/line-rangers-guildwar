import { EnvHttpProxyAgent, fetch } from "undici";
import { validId } from "../shared/domain.mjs";
const agent = new EnvHttpProxyAgent();
export function normalizeGuilds(input) {
  if (!Array.isArray(input) || !input.length || input.length > 20000)
    throw new Error("ギルド一覧の形式が変わっています");
  const seen = new Set();
  return input.map((g) => {
    if (!validId(g.gid) || typeof g.name !== "string" || seen.has(g.gid))
      throw new Error("ギルド情報が不正です");
    seen.add(g.gid);
    const number = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    return {
      gid: g.gid,
      name: g.name,
      nationalFlag: String(g.nationalFlag || ""),
      level: number(g.level),
      currentMemberCount: number(g.currentMemberCount),
      lastGuildWarRank: number(g.lastGuildWarRank),
      lastGuildWarScore: number(g.lastGuildWarScore),
      expRank: number(g.expRank),
      exp: number(g.exp),
      eventStageRank: number(g.eventStageRank),
      combinedRank: number(g.combinedRank),
      lastFetchedV: typeof g.lastFetchedV === "string" ? g.lastFetchedV : null,
    };
  });
}
export function normalizeMembers(input) {
  const members = Array.isArray(input) ? input : input?.members;
  if (!Array.isArray(members) || members.length > 100)
    throw new Error("メンバー一覧の形式が変わっています");
  const seen = new Set();
  return members.map((m) => {
    if (
      !validId(m.uid) ||
      typeof m.userName !== "string" ||
      !Number.isFinite(Number(m.level)) ||
      seen.has(m.uid)
    )
      throw new Error("メンバー情報が不正です");
    seen.add(m.uid);
    return {
      uid: m.uid,
      userName: m.userName,
      level: Number(m.level),
      pvpLeaguePhase: String(m.pvpLeaguePhase || ""),
    };
  });
}
export function createSources(store, config = {}, requestJSON) {
  const pending = new Map();
  async function getJSON(url) {
    const response = await fetch(url, {
      dispatcher: agent,
      signal: AbortSignal.timeout(25000),
      headers: {
        accept: "application/json",
        "user-agent": "line-rangers-guildwar/1.0 (read-only fan tool)",
      },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`情報源がHTTP ${response.status}を返しました`);
    }
    const text = await response.text();
    if (text.length > 10_000_000) throw new Error("情報源の応答が大きすぎます");
    return JSON.parse(text);
  }
  async function cached(key, ttl, urls, normalize) {
    const prev = store.getCache(key);
    if (prev && Date.now() - Date.parse(prev.fetchedAt) < ttl)
      return { ...prev, stale: false };
    if (pending.has(key)) return pending.get(key);
    const task = (async () => {
      let error;
      for (const url of urls)
        try {
          return {
            ...store.putCache(
              key,
              normalize(await (requestJSON || getJSON)(url)),
              url,
            ),
            stale: false,
          };
        } catch (e) {
          error = e;
        }
      if (prev)
        return {
          ...prev,
          stale: true,
          warning:
            "情報源に接続できないため、前回取得できたデータを表示しています。",
        };
      throw error;
    })();
    pending.set(key, task);
    try {
      return await task;
    } finally {
      pending.delete(key);
    }
  }
  return {
    guilds: () =>
      cached(
        "guilds",
        15 * 60000,
        [
          config.guildURL || "https://rangers.lerico.net/api/v2/guilds",
          config.fallbackURL ||
            "https://rangers-api-3mfw.onrender.com/api/guilds/get-guild-names",
        ],
        normalizeGuilds,
      ),
    members: (gid) =>
      cached(
        `members:${gid}`,
        5 * 60000,
        [
          `${config.memberBase || "https://rangers-api-3mfw.onrender.com"}/api/guild-member-info/${encodeURIComponent(gid)}/members`,
        ],
        normalizeMembers,
      ),
  };
}
