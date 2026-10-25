import test from "node:test";
import assert from "node:assert/strict";
import { readCompactSnapshot, reconcileRoster, selectRoster, RANKING_URL, RANGERBOOK_BASE } from "../shared/rangerbook.mjs";
import { createSources } from "../shared/sources.mjs";
import { openStore } from "../server/store.mjs";

const metadata = () => ({ generatedAtUtc: new Date().toISOString() });
const ranking = () => ({ metadata: metadata(), guilds: [{ gid: "guild1", guildName: "日本", rank: 10, tier: "LEGEND" }] });
const snapshot = () => ({ metadata: metadata(), guilds: [{ guildName: "日本", rank: 2, curMemberCount: 1, members: [{ name: "名前", level: 500, guildwar: [{ private: "not retained" }] }] }] });

test("streamed UTF-8 snapshot keeps only names and levels, accepting older metadata and rejecting truncated JSON", async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot()));
  const r = await readCompactSnapshot(new Response(new ReadableStream({ start(c) {
    for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7));
    c.close();
  } })));
  assert.deepEqual(r.guilds[0].members, [{ name: "名前", level: 500 }]);
  assert.equal(JSON.stringify(r).includes("private"), false);
  await assert.rejects(readCompactSnapshot(new Response('{"guilds":[')));
  assert.equal((await readCompactSnapshot(new Response(JSON.stringify({ ...snapshot(), metadata: { generatedAtUtc: "2020-01-01" } })))).guilds.length, 1);
});

test("guilds are joined by unique name rather than rank, while keeping available members on count mismatch", () => {
  assert.equal(selectRoster(ranking(), snapshot(), "guild1").members[0].name, "名前");
  const countMismatch = snapshot(); countMismatch.guilds[0].curMemberCount = 2;
  assert.equal(selectRoster(ranking(), countMismatch, "guild1").members.length, 1);
  assert.equal(selectRoster(ranking(), countMismatch, "guild1").incomplete, true);
  const ambiguous = ranking(); ambiguous.guilds.push({ gid: "guild2", guildName: "日本" });
  assert.throws(() => selectRoster(ambiguous, snapshot(), "guild1"));
});

test("existing IDs survive updates; renames get new IDs; ambiguous duplicates cannot take checks", () => {
  const previous = [{ uid: "old-id", userName: "名前", level: 499, pvpLeaguePhase: "LEGEND" }];
  const updated = reconcileRoster(previous, [{ name: "名前", level: 500 }]);
  assert.equal(updated.data[0].uid, "old-id");
  assert.equal(updated.data[0].pvpLeaguePhase, "LEGEND");
  assert.equal(reconcileRoster(previous, [{ name: "改名", level: 500 }], () => "new-id").data[0].uid, "new-id");
  const firstDuplicate = reconcileRoster([], [{ name: "名前", level: 499 }, { name: "名前", level: 500 }], (() => { let i = 0; return () => `new-${++i}`; })());
  assert.equal(firstDuplicate.data.length, 2);
  assert.notEqual(firstDuplicate.data[0].uid, firstDuplicate.data[1].uid);
  assert.throws(() => reconcileRoster(previous, [{ name: "名前", level: 500 }, { name: "名前", level: 499 }]));
  const duplicate = [...previous, { uid: "other-id", userName: "名前", level: 400, pvpLeaguePhase: "" }];
  assert.deepEqual(reconcileRoster(duplicate, [{ name: "名前", level: 400 }, { name: "名前", level: 499 }]).data, duplicate);
});

test("public sync preserves checks, caches tier data, and survives outage without the closing API", async () => {
  const store = openStore(":memory:"); const requests = [];
  try {
    store.putRoster("guild1", [{ uid: "stable", userName: "名前", level: 499, pvpLeaguePhase: "" }]);
    store.saveCheck({ gid: "guild1", team: "ally", uid: "stable", day: "2026-10-23", slot: 2, checked: true });
    const sources = createSources(store, {}, async (url, options) => {
      requests.push(url);
      if (url === RANKING_URL) return ranking();
      assert.equal(options.compactGuilds, true);
      assert.equal(url, `${RANGERBOOK_BASE}/guildwar_data_LEGEND.json`);
      return snapshot();
    });
    assert.equal((await sources.members("guild1")).mode, "manual");
    assert.equal(requests.length, 0);
    const synced = await sources.syncMembers("guild1");
    assert.equal(synced.mode, "rangerbook");
    assert.equal(synced.data[0].uid, "stable");
    assert.equal(synced.data[0].level, 500);
    await sources.members("guild1");
    assert.equal(requests.length, 2);
    assert.equal(store.getChecks("guild1", "ally", "2026-10-21", "2026-10-25").stable["2026-10-23"][2], true);
    const offline = createSources(store, {}, async () => { throw new Error("offline"); });
    store.putCache("rangerbook-ranking", ranking(), RANKING_URL);
    const brokenSnapshot = snapshot(); brokenSnapshot.metadata.generatedAtUtc = "invalid";
    store.putCache("rangerbook-snapshot:LEGEND", brokenSnapshot, "fixture");
    const result = await offline.members("guild1");
    assert.equal(result.stale, true);
    assert.equal(result.data[0].uid, "stable");
    assert.equal(result.fetchedAt, synced.fetchedAt);
    assert.ok(requests.every((url) => !url.includes("onrender.com")));
  } finally { store.close(); }
});

test("manual edits made during a public fetch are kept", async () => {
  const store = openStore(":memory:");
  try {
    const sources = createSources(store, {}, async (url) => {
      if (url === RANKING_URL) return ranking();
      store.putRoster("guild1", [{ uid: "manual", userName: "編集済み", level: 1, pvpLeaguePhase: "" }]);
      return snapshot();
    });
    const r = await sources.syncMembers("guild1");
    assert.equal(r.stale, true);
    assert.equal(r.data[0].userName, "編集済み");
    assert.equal(store.getRoster("guild1").mode, "manual");
  } finally { store.close(); }
});
