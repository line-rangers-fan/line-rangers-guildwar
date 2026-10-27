import test from "node:test";
import assert from "node:assert/strict";
import { normalizeReferenceMembers, withReferencePvp } from "../shared/pvp.mjs";
import { memberComparator } from "../shared/personal.mjs";
import { leagueLabel } from "../shared/domain.mjs";
import { openStore } from "../server/store.mjs";
import { createSources } from "../server/sources.mjs";
const reference = normalizeReferenceMembers({
  members: [
    { uid: "r1", userName: "太郎", level: 300, pvpLeaguePhase: "DIAMOND_1" },
    { uid: "r2", userName: "花子", level: 200, pvpLeaguePhase: "GOLD_2" },
    { uid: "r3", userName: "同名", level: 100, pvpLeaguePhase: "MASTER_1" },
    { uid: "r4", userName: "同名", level: 90, pvpLeaguePhase: "BRONZE" },
    { uid: "r5", userName: "次郎", level: 150, pvpLeaguePhase: "NOT_A_LEAGUE" },
  ],
});
const roster = [
  { uid: "a", userName: "太郎", level: 300, pvpLeaguePhase: "" },
  { uid: "b", userName: "花子", level: 200, pvpLeaguePhase: "MASTER_2" },
  { uid: "c", userName: "同名", level: 100, pvpLeaguePhase: "" },
  { uid: "d", userName: "次郎", level: 150, pvpLeaguePhase: "" },
  { uid: "e", userName: "三郎", level: 120, pvpLeaguePhase: "" },
];
test("reference PvP fills only unique unset names and keeps manual values", () => {
  const result = withReferencePvp(roster, reference);
  assert.equal(result[0].pvpReference, "DIAMOND_1");
  assert.equal(result[1].pvpLeaguePhase, "MASTER_2");
  assert.equal(result[1].pvpReference, undefined);
  assert.equal(result[2].pvpReference, undefined, "same-name players are never guessed");
  assert.equal(result[3].pvpReference, undefined, "unknown league names are ignored");
  assert.equal(result[4].pvpReference, undefined, "names absent from the reference stay blank");
  assert.equal(roster[0].pvpReference, undefined, "input rows are not mutated");
});
test("reference ranks sort with the same PvP order as manual ranks", () => {
  const order = withReferencePvp(roster, reference).sort(memberComparator({ key: "pvp", dir: -1 })).map((m) => m.uid);
  assert.deepEqual(order, ["b", "a", "d", "e", "c"]);
});
test("reference format changes are rejected instead of partially trusted", () => {
  assert.throws(() => normalizeReferenceMembers({ members: "changed" }));
  assert.throws(() => normalizeReferenceMembers([{ level: 1 }]));
});
test("bronze subdivisions returned by the source retain their compact rank and sort order", () => {
  const source = normalizeReferenceMembers([{ userName: "A", pvpLeaguePhase: "BRONZE_2" }]);
  const combined = withReferencePvp([{ uid: "a", userName: "A", level: 100, pvpLeaguePhase: "" }], source);
  assert.equal(combined[0].pvpReference, "BRONZE_2");
  assert.equal(leagueLabel(combined[0].pvpReference), "B");
  assert.ok(memberComparator({ key: "pvp", dir: -1 })(combined[0], { uid: "b", userName: "B", level: 100, pvpLeaguePhase: "BRONZE_3" }) < 0);
});
test("compact rank labels keep league and division clear", () => {
  assert.deepEqual(
    ["LEGEND", "MASTER_1", "MASTER_3", "DIAMOND_3", "GOLD_2", "SILVER_3", "BRONZE", "BRONZE_1", "BRONZE_2", "BRONZE_3"].map(leagueLabel),
    ["L", "M1", "M3", "D3", "G2", "S3", "B", "B", "B", "B"],
  );
});
test("reference PvP is served on read and never written into the stored roster", async () => {
  const store = openStore(":memory:");
  try {
    store.putRoster("guild1", [{ uid: "stable-a", userName: "太郎", level: 300, pvpLeaguePhase: "" }], "manual");
    const requests = [];
    const source = createSources(store, {}, async (url, options) => {
      requests.push([url, options?.timeout]);
      return { members: [{ uid: "other", userName: "太郎", level: 300, pvpLeaguePhase: "DIAMOND_1" }] };
    });
    const result = await source.members("guild1");
    assert.equal(result.data[0].uid, "stable-a");
    assert.equal(result.data[0].pvpReference, "DIAMOND_1");
    assert.deepEqual(requests, [["https://rangers-api-3mfw.onrender.com/api/guild-member-info/guild1/members", 5000]]);
    assert.equal(store.getRoster("guild1").data[0].pvpReference, undefined);
    assert.equal(store.getRoster("guild1").data[0].pvpLeaguePhase, "");
  } finally {
    store.close();
  }
});
test("reference outage leaves the roster usable without PvP annotations", async () => {
  const store = openStore(":memory:");
  try {
    store.putRoster("guild2", [{ uid: "stable-b", userName: "花子", level: 200, pvpLeaguePhase: "" }], "manual");
    const source = createSources(store, {}, async () => {
      throw new Error("offline");
    });
    const result = await source.members("guild2");
    assert.equal(result.data[0].uid, "stable-b");
    assert.equal(result.data[0].pvpReference, undefined);
  } finally {
    store.close();
  }
});
