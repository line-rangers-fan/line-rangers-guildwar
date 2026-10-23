import { validId } from "./domain.mjs";
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
  async function cached(key, ttl, urls, normalize) {
    const prev = await store.getCache(key);
    if (prev && Date.now() - Date.parse(prev.fetchedAt) < ttl)
      return { ...prev, stale: false };
    if (pending.has(key)) return pending.get(key);
    const task = (async () => {
      let error;
      for (const url of urls)
        try {
          return {
            ...(await store.putCache(
              key,
              normalize(await requestJSON(url)),
              url,
            )),
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
    guilds: async () => {
      let result;
      try {
        result = await cached(
          "guilds",
          15 * 60000,
          [
            config.guildURL || "https://rangers.lerico.net/api/v2/guilds",
            ...(config.fallbackURL ? [config.fallbackURL] : []),
          ],
          normalizeGuilds,
        );
      } catch {
        result = {
          data: [],
          source: "local:guilds",
          fetchedAt: null,
          stale: true,
          warning:
            "ギルド情報を取得できません。保存済み・手動登録のギルドで運用できます。",
        };
      }
      const combined = new Map(
        ((await store.listLocalGuilds?.()) || []).map((g) => [
          g.gid,
          { ...g, local: true },
        ]),
      );
      for (const g of result.data)
        combined.set(g.gid, { ...combined.get(g.gid), ...g });
      return { ...result, data: [...combined.values()] };
    },
    members: async (gid) => {
      const local = await store.getRoster(gid);
      // Closed-site caches are promoted locally; their remote URLs are never requested.
      if (local && (local.mode === "manual" || !config.memberURL)) return local;
      const legacy = await store.getCache(`members:${gid}`);
      if (!local && legacy) {
        const saved = await store.putRoster(
          gid,
          normalizeMembers(legacy.data),
          "snapshot",
          legacy.fetchedAt,
        );
        if (!config.memberURL) return saved;
      }
      if (config.memberURL) {
        try {
          const r = await cached(
            `independent-members:${gid}`,
            5 * 60000,
            [config.memberURL.replace("{gid}", encodeURIComponent(gid))],
            normalizeMembers,
          );
          const saved = await store.putRoster(
            gid,
            r.data,
            "provider",
            r.fetchedAt,
          );
          return {
            ...saved,
            source: r.source,
            stale: r.stale,
            warning: r.warning,
          };
        } catch {
          const prev = await store.getRoster(gid);
          if (prev)
            return {
              ...prev,
              stale: true,
              warning:
                "自動取得先に接続できないため、保存済み名簿を表示しています。",
            };
        }
      }
      return {
        data: [],
        mode: "unregistered",
        source: "local:roster",
        fetchedAt: null,
        updatedAt: null,
        stale: false,
        needsSetup: true,
      };
    },
  };
}
