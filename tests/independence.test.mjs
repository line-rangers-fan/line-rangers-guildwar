import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync, backup } from "node:sqlite";
import { openStore } from "../server/store.mjs";
import { createSources } from "../server/sources.mjs";
import { createApp } from "../server/app.mjs";
const member = {
  uid: "stable-user",
  userName: "保存済みプレイヤー",
  level: 500,
  pvpLeaguePhase: "LEGEND",
};
const guild = {
  gid: "guild1",
  name: "継続ギルド",
  nationalFlag: "JP",
  lastGuildWarRank: 1,
};
test("previously cached members migrate once and never request the closed service", async () => {
  const store = openStore(":memory:");
  try {
    const old = store.putCache(
      "members:guild1",
      [member],
      "https://closed.example/members",
    );
    store.putCache("guilds", [guild], "https://closed.example/guilds");
    store.migrateCachedRosters();
    const sources = createSources(store, {}, async () => {
      throw new Error("network forbidden");
    });
    let r = await sources.members("guild1");
    assert.equal(r.mode, "snapshot");
    assert.equal(r.fetchedAt, old.fetchedAt);
    assert.equal(r.source, "local:roster");
    assert.equal(r.data[0].userName, member.userName);
    store.putRoster("guild1", [{ ...member, userName: "改名後" }]);
    store.migrateCachedRosters();
    r = await sources.members("guild1");
    assert.equal(r.mode, "manual");
    assert.equal(r.data[0].userName, "改名後");
    assert.equal(store.listLocalGuilds()[0].name, guild.name);
  } finally {
    store.close();
  }
});
test("brand-new installation works fully offline; names can change without losing attack records", async () => {
  const dir = mkdtempSync(join(tmpdir(), "guildwar-offline-"));
  const path = join(dir, "db.sqlite");
  const store = openStore(path);
  const requests = [];
  const sources = createSources(store, {}, async (url) => {
    requests.push(url);
    throw new Error("all external hosts offline");
  });
  const app = createApp({ store, sources, writeToken: "private-key" });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = (path, method, body, auth = true) =>
    fetch(base + path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(auth ? { authorization: "Bearer private-key" } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  let gid;
  try {
    let r = await send(
      "/api/guilds",
      "POST",
      { name: "自前ギルド", nationalFlag: "JP" },
      false,
    );
    assert.equal(r.status, 401);
    r = await send("/api/guilds", "POST", {
      name: "自前ギルド",
      nationalFlag: "JP",
    });
    assert.equal(r.status, 201);
    gid = (await r.json()).guild.gid;
    r = await fetch(base + "/api/guilds");
    const list = await r.json();
    assert.equal(list.guilds[0].gid, gid);
    assert.equal(list.stale, true);
    r = await send(`/api/guilds/${gid}/roster`, "PUT", { members: [member] });
    assert.equal(r.status, 200);
    r = await send(`/api/guilds/${gid}/checks`, "PUT", {
      team: "ally",
      uid: member.uid,
      day: "2026-10-23",
      slot: 2,
      checked: true,
    });
    assert.equal(r.status, 200);
    r = await send(`/api/guilds/${gid}/roster`, "PUT", {
      members: [{ ...member, userName: "新しい名前" }],
    });
    assert.equal(r.status, 200);
    const before = store.getRoster(gid).data;
    r = await send(`/api/guilds/${gid}/roster`, "PUT", {
      members: [member, member],
    });
    assert.equal(r.status, 400);
    assert.deepEqual(store.getRoster(gid).data, before);
    r = await send(`/api/guilds/${gid}/roster`, "PUT", {
      members: [{ ...member, userName: "" }],
    });
    assert.equal(r.status, 400);
    r = await send(`/api/guilds/${gid}/roster`, "PUT", { members: [] }, false);
    assert.equal(r.status, 401);
    r = await fetch(base + `/api/guilds/${gid}/members`);
    assert.equal((await r.json()).members[0].userName, "新しい名前");
    r = await fetch(base + `/api/guilds/${gid}/checks?week=2026-10-23`);
    assert.equal((await r.json()).states[member.uid]["2026-10-23"][2], true);
    assert.ok(requests.every((url) => !url.includes("onrender.com")));
    // A consistent SQLite backup includes rosters, registry, and attack records.
    const db = new DatabaseSync(path, { readOnly: true });
    await backup(db, join(dir, "backup.sqlite"));
    db.close();
    const restored = openStore(join(dir, "backup.sqlite"));
    try {
      assert.equal(restored.getRoster(gid).data[0].userName, "新しい名前");
      assert.equal(
        restored.getChecks(gid, "ally", "2026-10-21", "2026-10-25")[member.uid][
          "2026-10-23"
        ][2],
        true,
      );
    } finally {
      restored.close();
    }
  } finally {
    await new Promise((r) => server.close(r));
    store.close();
  }
  const reopened = openStore(path);
  try {
    const independent = createSources(reopened, {}, async () => {
      throw new Error("offline");
    });
    assert.equal(
      (await independent.members(gid)).data[0].userName,
      "新しい名前",
    );
  } finally {
    reopened.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("unregistered guild stays explicitly empty if public ranking is unavailable", async () => {
  const store = openStore(":memory:");
  try {
    let calls = 0;
    const sources = createSources(store, {}, async () => {
      calls++;
      throw new Error();
    });
    const r = await sources.members("new-guild");
    assert.equal(calls, 1);
    assert.equal(r.needsSetup, true);
    assert.deepEqual(r.data, []);
  } finally {
    store.close();
  }
});
