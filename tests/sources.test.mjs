import test from "node:test";
import assert from "node:assert/strict";
import { openStore } from "../server/store.mjs";
import { createSources } from "../server/sources.mjs";
const guild = {
  gid: "guild1",
  name: "テストギルド",
  nationalFlag: "JP",
  lastGuildWarRank: 1,
};
test("valid cache avoids unnecessary upstream calls", async () => {
  const store = openStore(":memory:");
  try {
    store.putCache("guilds", [guild], "original");
    let calls = 0;
    const source = createSources(store, {}, async () => {
      calls++;
      throw new Error("offline");
    });
    const r = await source.guilds();
    assert.equal(calls, 0);
    assert.equal(r.stale, false);
    assert.equal(r.data[0].gid, "guild1");
  } finally {
    store.close();
  }
});
test("failed or malformed refresh keeps previous data and timestamp with stale warning", async () => {
  const previous = {
    data: [guild],
    source: "previous-source",
    fetchedAt: "2025-01-01T00:00:00Z",
  };
  let writes = 0;
  const store = {
    getCache: () => previous,
    putCache: () => {
      writes++;
    },
  };
  const source = createSources(store, {}, async () => ({ unexpected: true }));
  const result = await source.guilds();
  assert.equal(writes, 0);
  assert.equal(result.stale, true);
  assert.equal(result.fetchedAt, previous.fetchedAt);
  assert.equal(result.source, previous.source);
  assert.equal(result.data[0].name, guild.name);
  assert.ok(result.warning);
});
test("guild listing falls back and coalesces concurrent requests", async () => {
  const store = openStore(":memory:");
  let calls = 0;
  try {
    const source = createSources(
      store,
      { guildURL: "primary", fallbackURL: "secondary" },
      async (url) => {
        calls++;
        await new Promise((r) => setTimeout(r, 10));
        if (url === "primary") throw new Error("offline");
        return [guild];
      },
    );
    const [a, b] = await Promise.all([source.guilds(), source.guilds()]);
    assert.equal(calls, 2);
    assert.equal(a.source, "secondary");
    assert.equal(b.fetchedAt, a.fetchedAt);
    assert.equal(a.stale, false);
  } finally {
    store.close();
  }
});
