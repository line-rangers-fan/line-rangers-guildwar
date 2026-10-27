import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import worker from "../worker/index.mjs";
import { createD1Store } from "../worker/store.mjs";
const db = new DatabaseSync(":memory:");
db.exec(await readFile("migrations/0001_initial.sql", "utf8"));
function prepare(sql) {
  let args = [];
  return {
    bind(...v) {
      args = v;
      return this;
    },
    async first() {
      return db.prepare(sql).get(...args) || null;
    },
    async all() {
      return { results: db.prepare(sql).all(...args) };
    },
    async run() {
      db.prepare(sql).run(...args);
      return { success: true };
    },
    _run() {
      db.prepare(sql).run(...args);
    },
  };
}
const DB = {
  prepare,
  async batch(list) {
    db.exec("BEGIN");
    try {
      for (const q of list) q._run();
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    return list.map(() => ({ success: true }));
  },
};
const store = createD1Store(DB);
await store.putCache(
  "guilds",
  [
    {
      gid: "guild1",
      name: "検証ギルド",
      nationalFlag: "JP",
      lastGuildWarRank: 1,
    },
  ],
  "fixture",
);
const env = { DB, WRITE_TOKEN: "qa-only" };
const req = (path, method = "GET", data, token = "qa-only") =>
  worker.fetch(
    new Request("https://test.local" + path, {
      method,
      headers: {
        "content-type": "application/json",
        origin: "https://test.local",
        authorization: `Bearer ${token}`,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    }),
    env,
  );
try {
  assert.equal((await req("/guildWarCount")).status, 200);
  assert.equal((await (await req("/api/health")).json()).storage, "d1");
  const member = {
    uid: "member1",
    userName: "太郎",
    level: 500,
    pvpLeaguePhase: "LEGEND",
  };
  assert.equal(
    (
      await req(
        "/api/guilds/guild1/roster",
        "PUT",
        { members: [member] },
        "wrong",
      )
    ).status,
    401,
  );
  assert.equal(
    (await req("/api/guilds/guild1/roster", "PUT", { members: [member] }))
      .status,
    200,
  );
  assert.equal(
    (
      await req("/api/guilds/guild1/checks", "PUT", {
        team: "ally",
        uid: "member1",
        day: "2026-10-23",
        slot: 2,
        checked: true,
      })
    ).status,
    200,
  );
  const a = await (
    await req("/api/guilds/guild1/checks?week=2026-10-23")
  ).json();
  assert.equal(a.states.member1["2026-10-23"][1], true);
  assert.equal(a.states.member1["2026-10-23"][2], true);
  const enemy = await (
    await req("/api/guilds/guild1/checks?team=enemy&week=2026-10-23")
  ).json();
  assert.deepEqual(enemy.states, {});
  assert.equal(
    (
      await req("/api/guilds/guild1/roster", "PUT", {
        members: [{ ...member, userName: "改名後" }],
      })
    ).status,
    200,
  );
  assert.equal(
    (await (await req("/api/guilds/guild1/members")).json()).members[0]
      .userName,
    "改名後",
  );
  assert.equal(
    (
      await req("/api/guilds/guild1/checks", "PUT", {
        team: "ally",
        uid: "member1",
        day: "2026-10-23",
        slot: 1,
        checked: false,
      })
    ).status,
    200,
  );
  const b = await (
    await req("/api/guilds/guild1/checks?week=2026-10-23")
  ).json();
  assert.equal(b.states.member1["2026-10-23"][2], false);
  const imported = await req("/api/guilds/guild1/share", "POST", { week: "2026-10-23", entries: [{ uid: "member1", day: "2026-10-25", slot: 2 }] });
  assert.equal(imported.status, 200);
  const shared = await imported.json();
  assert.equal(shared.states.member1["2026-10-25"][1], true);
  assert.equal(shared.states.member1["2026-10-25"][2], true);
  assert.equal((await req("/api/guilds/guild1/share", "POST", { week: "2026-10-23", entries: [{ uid: "outsider", day: "2026-10-25", slot: 1 }] })).status, 400);
  const preflight = await worker.fetch(new Request("https://test.local/api/guilds/guild1/share", { method: "OPTIONS", headers: { origin: "https://line-rangers-fan.github.io", "access-control-request-method": "POST" } }), env);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "https://line-rangers-fan.github.io");
  const pagesRead = await worker.fetch(new Request("https://test.local/api/health", { headers: { origin: "https://line-rangers-fan.github.io" } }), env);
  assert.equal(pagesRead.headers.get("access-control-allow-origin"), "https://line-rangers-fan.github.io");
  const originalFetch = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async () => new Response(JSON.stringify({ members: [{ userName: "太郎", pvpLeaguePhase: ++calls === 1 ? "GOLD_1" : "MASTER_2" }] }), { headers: { "content-type": "application/json" } });
    assert.equal((await (await req("/api/guilds/guild1/pvp?refresh=1")).json()).members[0].pvpLeaguePhase, "GOLD_1");
    assert.equal((await (await req("/api/guilds/guild1/pvp?refresh=1")).json()).members[0].pvpLeaguePhase, "MASTER_2");
    assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; }
  console.log(
    "Worker/D1 smoke checks passed: routing, authentication, roster, atomic check invariants, team separation, rename.",
  );
} finally {
  db.close();
}
