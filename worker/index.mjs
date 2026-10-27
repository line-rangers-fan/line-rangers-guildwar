import { createD1Store } from "./store.mjs";
import { directoryGuilds } from "../shared/personal.mjs";
import { validateShare } from "../shared/boards.mjs";
import { trustedOrigin, corsHeaders } from "../shared/cors.mjs";
import { createSources, normalizeMembers } from "../shared/sources.mjs";
import { readCompactSnapshot } from "../shared/rangerbook.mjs";
import { gameDate, validId, weekDates } from "../shared/domain.mjs";
import { assets } from "./assets.generated.mjs";
const security = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
};
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      ...security,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
const sessions = new WeakMap();
async function remoteJSON(url, options = {}) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(options.timeout || (options.compactGuilds ? 90000 : 15000)),
    headers: { accept: "application/json" },
  });
  if (!r.ok) throw new Error("upstream unavailable");
  return options.compactGuilds ? readCompactSnapshot(r) : r.json();
}
export function createWorkerHandler(makeStore = createD1Store) {
  const handler = {
    async fetch(request, env) {
      try {
        const url = new URL(request.url),
          path = url.pathname;
        if (!path.startsWith("/api/")) {
          const key = ["/", "/guildWarCount", "/guild-tracker"].includes(path)
            ? "/index.html"
            : path;
          const a = assets[key];
          if (!a)
            return new Response("Not found", {
              status: 404,
              headers: security,
            });
          return new Response(a.body, {
            headers: {
              ...security,
              "Content-Type": a.type,
              "Cache-Control":
                key === "/index.html" ? "no-cache" : "public,max-age=3600",
            },
          });
        }
        if (!env.DB)
          return json({ error: "保存先の接続が完了していません" }, 503);
        let state = sessions.get(env.DB);
        if (!state) {
          const store = makeStore(env.DB);
          state = {
            store,
            sources: createSources(
              store,
              {
                guildURL: env.GUILD_SOURCE_URL,
                fallbackURL: env.GUILD_FALLBACK_URL,
                memberURL: env.MEMBER_SOURCE_URL,
              },
              remoteJSON,
            ),
          };
          sessions.set(env.DB, state);
        }
        const { store, sources } = state;
        if (path === "/api/health" && request.method === "GET")
          return json({
            ok: true,
            storage: "d1",
            gameDate: gameDate(),
            writeProtected: Boolean(env.WRITE_TOKEN),
          });
        if (request.method !== "GET" && request.method !== "HEAD") {
          const origin = request.headers.get("origin");
          if (origin && !trustedOrigin(origin, url.origin))
            return json({ error: "別サイトからの保存はできません" }, 403);
          if (
            env.WRITE_TOKEN &&
            request.headers.get("authorization") !== `Bearer ${env.WRITE_TOKEN}`
          )
            return json({ error: "設定から保存用キーを入力してください" }, 401);
        }
        async function body() {
          const text = await request.text();
          if (new TextEncoder().encode(text).length > 65536)
            throw new Error("invalid input");
          return JSON.parse(text);
        }
        if (path === "/api/guild-tiers" && request.method === "GET") {
          const r = await sources.guildTiers();
          return json({ tiers: r.data, fetchedAt: r.observedAt || r.fetchedAt, stale: r.stale, warning: r.warning });
        }
        if (path === "/api/guilds" && request.method === "GET") {
          const r = await sources.guilds();
          return json({
            guilds: url.searchParams.get("limit") ? directoryGuilds(r.data, 200) : r.data,
            source: r.source,
            fetchedAt: r.fetchedAt,
            stale: r.stale,
            warning: r.warning,
          });
        }
        if (path === "/api/guilds" && request.method === "POST") {
          const { name, nationalFlag = "" } = await body();
          if (
            typeof name !== "string" ||
            !name.trim() ||
            name.trim().length > 100 ||
            typeof nationalFlag !== "string" ||
            !/^([A-Z]{2})?$/.test(nationalFlag)
          )
            return json({ error: "ギルド名と国コードを確認してください" }, 400);
          const g = {
            gid: `local-${crypto.randomUUID()}`,
            name: name.trim(),
            nationalFlag,
            level: 0,
            currentMemberCount: 0,
            lastGuildWarRank: 0,
            lastGuildWarScore: 0,
            local: true,
          };
          await store.putLocalGuild(g);
          await store.putRoster(g.gid, []);
          return json({ guild: g }, 201);
        }
        const match = path.match(
          /^\/api\/guilds\/([^/]+)\/(members|pvp|roster|checks|sync|share)$/,
        );
        if (!match) return json({ error: "APIが見つかりません" }, 404);
        const [, gid, action] = match;
        if (!validId(gid))
          return json({ error: "ギルドIDが正しくありません" }, 400);
        if (action === "pvp" && request.method === "GET") {
          try {
            const r = await sources.pvpMembers(gid, url.searchParams.get("refresh") === "1");
            return json({ members: r.data, fetchedAt: r.fetchedAt, stale: r.stale, warning: r.warning });
          } catch {
            return json({ error: "PvPデータを取得できませんでした。時間をおいて再試行してください。" }, 503);
          }
        }
        if (action === "share" && request.method === "POST") {
          const roster = await store.getRoster(gid) || await sources.members(gid);
          let checked;
          try { checked = validateShare(await body(), roster.data); }
          catch (e) { return json({ error: e.message }, 400); }
          await store.mergeChecks(gid, checked.entries);
          return json({ states: await store.getChecks(gid, "ally", checked.dates[0], checked.dates[2]) });
        }
        if ((action === "members" && request.method === "GET") || (action === "sync" && request.method === "POST")) {
          const sourceOptions = { includePvp:url.searchParams.get("include_pvp") !== "0" };
          const r = action === "sync" ? await sources.syncMembers(gid, sourceOptions) : await sources.members(gid, sourceOptions);
          return json({
            members: r.data,
            source: r.source,
            mode: r.mode,
            needsSetup: r.needsSetup,
            updatedAt: r.updatedAt,
            fetchedAt: r.fetchedAt,
            stale: r.stale,
            warning: r.warning,
          });
        }
        if (action === "roster" && request.method === "PUT") {
          let data;
          try {
            data = normalizeMembers(await body());
            if (
              data.length > 50 ||
              data.some(
                (m) =>
                  !m.userName.trim() ||
                  m.userName.length > 100 ||
                  !Number.isInteger(m.level) ||
                  m.level < 1 ||
                  m.level > 10000 ||
                  m.pvpLeaguePhase.length > 40,
              )
            )
              throw new Error();
            data = data.map((m) => ({ ...m, userName: m.userName.trim() }));
          } catch {
            return json(
              {
                error:
                  "名簿は50人以内で、空欄のない名前・IDと正しいレベルを指定してください",
              },
              400,
            );
          }
          const g =
            (await store.listLocalGuilds()).find((g) => g.gid === gid) ||
            (await store.getCache("guilds"))?.data?.find(
              (g) => g.gid === gid,
            ) ||
            (await sources.guilds()).data.find((g) => g.gid === gid);
          if (!g) return json({ error: "先にギルドを登録してください" }, 404);
          await store.putLocalGuild({ ...g, currentMemberCount: data.length });
          const r = await store.putRoster(gid, data);
          return json({
            members: r.data,
            mode: r.mode,
            source: r.source,
            fetchedAt: r.fetchedAt,
            updatedAt: r.updatedAt,
            stale: false,
          });
        }
        if (action === "checks" && request.method === "GET") {
          const team = url.searchParams.get("team") || "ally";
          if (!["ally", "enemy"].includes(team))
            return json({ error: "チームが正しくありません" }, 400);
          let dates;
          try {
            dates = weekDates(url.searchParams.get("week") || gameDate());
          } catch {
            return json({ error: "日付が正しくありません" }, 400);
          }
          return json({
            states: await store.getChecks(gid, team, dates[0], dates[2]),
            dates,
          });
        }
        if (action === "checks" && request.method === "PUT") {
          const { team, uid, day, slot, checked } = await body();
          if (
            !["ally", "enemy"].includes(team) ||
            !validId(uid) ||
            ![1, 2].includes(slot) ||
            typeof checked !== "boolean"
          )
            return json({ error: "チェック内容が正しくありません" }, 400);
          let dates;
          try {
            dates = weekDates(day);
            if (!dates.includes(day)) throw new Error();
          } catch {
            return json(
              { error: "水・金・日の正しい日付を指定してください" },
              400,
            );
          }
          const r = await store.getRoster(gid) || await sources.members(gid);
          if (!r.data.some((m) => m.uid === uid))
            return json(
              { error: "このギルドに登録されていないメンバーです" },
              400,
            );
          await store.saveCheck({ gid, team, uid, day, slot, checked });
          return json({
            states: await store.getChecks(gid, team, dates[0], dates[2]),
          });
        }
        return json({ error: "操作が見つかりません" }, 404);
      } catch (e) {
        return json(
          {
            error:
              e instanceof SyntaxError
                ? "入力の形式が正しくありません"
                : "情報を取得できませんでした。しばらくしてから再試行してください。",
          },
          e instanceof SyntaxError ? 400 : 502,
        );
      }
    },
  };
  return { async fetch(request, env) {
    const origin = request.headers.get("origin");
    if (request.method === "OPTIONS" && new URL(request.url).pathname.startsWith("/api/")) {
      return new Response(null, { status: trustedOrigin(origin, new URL(request.url).origin) ? 204 : 403, headers: corsHeaders(origin) });
    }
    const response = await handler.fetch(request, env);
    if (new URL(request.url).pathname.startsWith("/api/")) for (const [key, value] of Object.entries(corsHeaders(origin))) response.headers.set(key, value);
    return response;
  } };
}
export default createWorkerHandler();

