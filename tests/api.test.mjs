import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../server/store.mjs";
import { createApp } from "../server/app.mjs";
const members = [
  {
    uid: "player1",
    userName: "プレイヤー",
    level: 500,
    pvpLeaguePhase: "LEGEND",
  },
];
const sources = {
  members: async () => ({
    data: members,
    source: "test",
    fetchedAt: "2026-10-23T00:00:00Z",
    stale: false,
  }),
  guilds: async () => ({ data: [], source: "test", stale: false }),
};
test("API persists across reopen, separates guild/team/week, and writes idempotently", async () => {
  const dir = mkdtempSync(join(tmpdir(), "guildwar-"));
  const dbPath = join(dir, "db.sqlite");
  let store = openStore(dbPath);
  const server = createApp({ store, sources, writeToken: "test-token" }).listen(
    0,
    "127.0.0.1",
  );
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const write = (body, headers = { authorization: "Bearer test-token" }) =>
    fetch(base + "/api/guilds/guild1/checks", {
      method: "PUT",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  const body = {
    team: "ally",
    uid: "player1",
    day: "2026-10-23",
    slot: 2,
    checked: true,
  };
  try {
    assert.equal((await write(body, {})).status, 401);
    assert.equal(
      (
        await write(body, {
          authorization: "Bearer test-token",
          origin: "https://evil.example",
        })
      ).status,
      403,
    );
    assert.equal((await write({ ...body, uid: "not-member" })).status, 400);
    assert.equal((await write({ ...body, day: "2026-10-22" })).status, 400);
    for (let i = 0; i < 2; i++) {
      const r = await write(body);
      assert.equal(r.status, 200);
      const d = await r.json();
      assert.equal(d.states.player1["2026-10-23"][1], true);
      assert.equal(d.states.player1["2026-10-23"][2], true);
    }
    for (const path of [
      "/api/guilds/guild1/checks?team=enemy&week=2026-10-23",
      "/api/guilds/guild2/checks?team=ally&week=2026-10-23",
      "/api/guilds/guild1/checks?week=2026-10-30",
    ])
      assert.deepEqual((await (await fetch(base + path)).json()).states, {});
    assert.equal(
      (await fetch(base + "/api/guilds/guild1/checks?week=2026-02-30")).status,
      400,
    );
    const r = await write({ ...body, slot: 1, checked: false });
    const d = await r.json();
    assert.equal(d.states.player1["2026-10-23"][1], false);
    assert.equal(d.states.player1["2026-10-23"][2], false);
    await write(body);
  } finally {
    await new Promise((r) => server.close(r));
    store.close();
  }
  store = openStore(dbPath);
  try {
    assert.equal(
      store.getChecks("guild1", "ally", "2026-10-21", "2026-10-25").player1[
        "2026-10-23"
      ][2],
      true,
    );
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
