import test from "node:test";
import assert from "node:assert/strict";
import { compactPvp, guildPvp, matchPvp, pvpLabel } from "../shared/pvp.mjs";
import { createSources } from "../server/sources.mjs";
import { openStore } from "../server/store.mjs";
const now = Date.now();
const sample = (name = "メンバー", gid = "guild1") => ({ top100: [{ mid: "player1", displayName: name, rank: 3 }], playerInfo: [{ mid: "player1", player: { userName: name }, guild: { gid }, lastFetched: new Date(now).toISOString() }] });
test("PvP uses exact guild and name and rejects stale or changed names", () => {
 const rows = compactPvp(sample(), "DIAMOND_2", now);
 assert.equal(guildPvp(rows, "guild1", now)[0].league, "DIAMOND_2");
 assert.deepEqual(guildPvp(rows, "other", now), []);
 assert.deepEqual(compactPvp(sample(), "DIAMOND_2", now + 7 * 3600000), []);
 const renamed = sample(); renamed.playerInfo[0].player.userName = "変更後";
 assert.deepEqual(compactPvp(renamed, "DIAMOND_2", now), []);
 assert.equal(pvpLabel("DIAMOND_2"), "ダイヤII");
 assert.equal(pvpLabel(""), "未確認");
});
test("duplicate members or multiple league observations never assign a guessed PvP rank", () => {
 const rows = compactPvp(sample(), "LEGEND", now);
 assert.deepEqual(guildPvp([...rows, ...rows], "guild1", now), []);
 const players = guildPvp(rows, "guild1", now);
 assert.equal(matchPvp([{userName:"メンバー"}, {userName:"メンバー"}], players).size, 0);
 assert.equal(matchPvp([{userName:"メンバー"}], players).size, 1);
});
test("league caches serve multiple guilds without repeated downloads and tolerate unavailable leagues", async () => {
 const store = openStore(":memory:"); let calls = 0;
 try {
  const sources = createSources(store, {}, async (url) => { calls++; if (url.endsWith("BRONZE")) throw new Error("offline"); return url.endsWith("LEGEND") ? sample() : {top100:[],playerInfo:[]}; });
  const a = await sources.pvp("guild1"); assert.equal(a.players.length, 1); assert.equal(a.partial, true);
  assert.equal(calls, 14);
  const b = await sources.pvp("other"); assert.equal(b.players.length, 0); assert.equal(calls, 15);
 } finally { store.close(); }
});
