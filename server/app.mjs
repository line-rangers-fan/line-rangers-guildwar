import express from "express";
import { randomUUID } from "node:crypto";
import { normalizeMembers } from "./sources.mjs";
import { resolve } from "node:path";
import { gameDate, validId, weekDates } from "../shared/domain.mjs";
export function createApp({
  store,
  sources,
  writeToken = "",
  staticDir = resolve("dist"),
}) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
    });
    next();
  });
  app.use(express.json({ limit: "64kb" }));
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.get("/api/health", (req, res) =>
    res.json({
      ok: true,
      storage: "sqlite",
      gameDate: gameDate(),
      writeProtected: Boolean(writeToken),
    }),
  );
  const params = (req, res, next) => {
    if (!validId(req.params.gid)) {
      res.status(400).json({ error: "ギルドIDが正しくありません" });
      return;
    }
    next();
  };
  const authorizeWrite = (req, res, next) => {
    const origin = req.get("origin");
    if (origin) {
      try {
        if (new URL(origin).host !== req.get("host"))
          return res
            .status(403)
            .json({ error: "別サイトからの保存はできません" });
      } catch {
        return res.status(403).json({ error: "送信元が正しくありません" });
      }
    }
    if (writeToken && req.get("authorization") !== `Bearer ${writeToken}`)
      return res
        .status(401)
        .json({ error: "設定から保存用キーを入力してください" });
    next();
  };
  app.post("/api/guilds", authorizeWrite, (req, res) => {
    const { name, nationalFlag = "" } = req.body || {};
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 100 ||
      typeof nationalFlag !== "string" ||
      !/^([A-Z]{2})?$/.test(nationalFlag)
    )
      return res
        .status(400)
        .json({ error: "ギルド名と国コードを確認してください" });
    const guild = {
      gid: `local-${randomUUID()}`,
      name: name.trim(),
      nationalFlag,
      level: 0,
      currentMemberCount: 0,
      lastGuildWarRank: 0,
      lastGuildWarScore: 0,
      local: true,
    };
    store.putLocalGuild(guild);
    store.putRoster(guild.gid, []);
    res.status(201).json({ guild });
  });
  app.put(
    "/api/guilds/:gid/roster",
    params,
    authorizeWrite,
    async (req, res) => {
      let data;
      try {
        data = normalizeMembers(req.body);
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
        return res.status(400).json({
          error:
            "名簿は50人以内で、空欄のない名前・IDと正しいレベルを指定してください",
        });
      }
      const gid = req.params.gid;
      const guild =
        store.listLocalGuilds().find((g) => g.gid === gid) ||
        store.getCache("guilds")?.data?.find((g) => g.gid === gid) ||
        (await sources.guilds()).data.find((g) => g.gid === gid);
      if (!guild)
        return res.status(404).json({ error: "先にギルドを登録してください" });
      store.putLocalGuild({ ...guild, currentMemberCount: data.length });
      const r = store.putRoster(gid, data, "manual");
      res.json({
        members: r.data,
        mode: r.mode,
        source: r.source,
        fetchedAt: r.fetchedAt,
        updatedAt: r.updatedAt,
        stale: false,
      });
    },
  );
  app.get("/api/guilds", async (req, res) => {
    const r = await sources.guilds();
    res.json({
      guilds: r.data,
      source: r.source,
      fetchedAt: r.fetchedAt,
      stale: r.stale,
      warning: r.warning,
    });
  });
  app.get("/api/guilds/:gid/members", params, async (req, res) => {
    const r = await sources.members(req.params.gid);
    res.json({
      members: r.data,
      mode: r.mode,
      needsSetup: r.needsSetup,
      updatedAt: r.updatedAt,
      source: r.source,
      fetchedAt: r.fetchedAt,
      stale: r.stale,
      warning: r.warning,
    });
  });
  app.post("/api/guilds/:gid/sync", params, authorizeWrite, async (req, res) => {
    const r = await sources.syncMembers(req.params.gid);
    res.json({ members: r.data, mode: r.mode, source: r.source, fetchedAt: r.fetchedAt, updatedAt: r.updatedAt, stale: r.stale, warning: r.warning, needsSetup: r.needsSetup });
  });
  app.get("/api/guilds/:gid/checks", params, (req, res) => {
    const team = req.query.team || "ally";
    if (!["ally", "enemy"].includes(team))
      return res.status(400).json({ error: "チームが正しくありません" });
    let dates;
    try {
      dates = weekDates(req.query.week || gameDate());
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    res.json({
      states: store.getChecks(req.params.gid, team, dates[0], dates[2]),
      dates,
    });
  });
  app.put(
    "/api/guilds/:gid/checks",
    params,
    authorizeWrite,
    async (req, res) => {
      const { team, uid, day, slot, checked } = req.body || {};
      if (
        !["ally", "enemy"].includes(team) ||
        !validId(uid) ||
        ![1, 2].includes(slot) ||
        typeof checked !== "boolean"
      )
        return res
          .status(400)
          .json({ error: "チェック内容が正しくありません" });
      let dates;
      try {
        dates = weekDates(day);
        if (!dates.includes(day)) throw new Error();
      } catch {
        return res
          .status(400)
          .json({ error: "水・金・日の正しい日付を指定してください" });
      }
      const r = await sources.members(req.params.gid);
      if (!r.data.some((m) => m.uid === uid))
        return res
          .status(400)
          .json({ error: "このギルドに登録されていないメンバーです" });
      store.saveCheck({ gid: req.params.gid, team, uid, day, slot, checked });
      res.json({
        states: store.getChecks(req.params.gid, team, dates[0], dates[2]),
      });
    },
  );
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "APIが見つかりません" }),
  );
  app.use(express.static(staticDir, { index: false }));
  app.get(["/", "/guildWarCount", "/guild-tracker"], (req, res) =>
    res.sendFile(resolve(staticDir, "index.html")),
  );
  app.use((err, req, res, next) => {
    const code = err.status === 400 ? 400 : 502;
    res.status(code).json({
      error:
        code === 400
          ? "リクエストの形式が正しくありません"
          : "情報を取得できませんでした。しばらくしてから再試行してください。",
    });
  });
  return app;
}
