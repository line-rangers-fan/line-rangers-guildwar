import test from "node:test";
import assert from "node:assert/strict";
import { openStore } from "../server/store.mjs";
import { createSources } from "../server/sources.mjs";
import { createApp } from "../server/app.mjs";

test("PvP refresh bypasses cache without modifying saved roster or checks", async () => {
  const store = openStore(":memory:");
  let calls = 0;
  const sources = createSources(store, {}, async () => ({ members: [{ userName: "A", pvpLeaguePhase: ++calls === 1 ? "GOLD_1" : "MASTER_2" }] }));
  store.putRoster("guild1", [{ uid: "stable", userName: "A", level: 100, pvpLeaguePhase: "LEGEND" }], "manual");
  const before = store.getRoster("guild1");
  const server = createApp({ store, sources }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/guilds/guild1/pvp`;
  try {
    assert.equal((await (await fetch(url)).json()).members[0].pvpLeaguePhase, "GOLD_1");
    assert.equal((await (await fetch(url)).json()).members[0].pvpLeaguePhase, "GOLD_1");
    assert.equal(calls, 1);
    assert.equal((await (await fetch(url + "?refresh=1")).json()).members[0].pvpLeaguePhase, "MASTER_2");
    assert.equal(calls, 2);
    assert.deepEqual(store.getRoster("guild1"), before);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  }
});

test("failed forced refresh is marked stale and uncached failures are explicit", async () => {
  const store = openStore(":memory:");
  const source = createSources(store, {}, async () => { throw new Error("offline"); });
  try {
    store.putCache("reference-members:cached", [{ userName: "A", pvpLeaguePhase: "GOLD_1" }], "fixture");
    assert.equal((await source.pvpMembers("cached", true)).stale, true);
    await assert.rejects(source.pvpMembers("uncached", true), /offline/);
  } finally { store.close(); }
});

test("PvP endpoint returns the previous ranks when a refresh fails", async () => {
  const store = openStore(":memory:");
  let online = true;
  const sources = createSources(store, {}, async () => {
    if (!online) throw new Error("offline");
    return { members: [{ userName: "A", pvpLeaguePhase: "GOLD_1" }] };
  });
  const server = createApp({ store, sources }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/guilds/guild1/pvp?refresh=1`;
  try {
    await fetch(url);
    online = false;
    const response = await fetch(url);
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.stale, true);
    assert.equal(result.members[0].pvpLeaguePhase, "GOLD_1");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  }
});

test("roster requests avoid PvP by default and allow explicit opt-in", async () => {
  const store = openStore(":memory:");
  let pvpCalls = 0;
  const sources = createSources(store, {}, async () => {
    pvpCalls++;
    return { members:[{userName:"A",pvpLeaguePhase:"GOLD_1"}] };
  });
  store.putRoster("guild1", [{uid:"stable",userName:"A",level:100,pvpLeaguePhase:""}], "manual");
  const server = createApp({store,sources}).listen(0,"127.0.0.1");
  await new Promise(resolve => server.once("listening",resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/guilds/guild1/members`;
  try {
    const roster = await (await fetch(`${base}?include_pvp=0`)).json();
    assert.equal(roster.members[0].uid,"stable");
    assert.equal(pvpCalls,0);
    const compatible = await (await fetch(base)).json();
    assert.equal(pvpCalls,0);
    assert.equal(compatible.members[0].pvpReference,undefined);
    const optedIn = await (await fetch(`${base}?include_pvp=1`)).json();
    assert.equal(pvpCalls,1);
    assert.equal(optedIn.members[0].pvpReference,"GOLD_1");
  } finally {
    await new Promise(resolve => server.close(resolve));
    store.close();
  }
});

