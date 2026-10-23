import test from "node:test";
import assert from "node:assert/strict";
import {
  weekDates,
  gameDate,
  japanDate,
  shiftWeek,
  remaining,
  csvCell,
} from "../shared/domain.mjs";
import { normalizeGuilds, normalizeMembers } from "../server/sources.mjs";
test("JST 09:00 boundary, including Sunday to Monday", () => {
  assert.equal(japanDate(new Date("2026-10-25T23:59:59Z")), "2026-10-26");
  assert.equal(gameDate(new Date("2026-10-25T23:59:59Z")), "2026-10-25");
  assert.deepEqual(weekDates(gameDate(new Date("2026-10-25T23:59:59Z"))), [
    "2026-10-21",
    "2026-10-23",
    "2026-10-25",
  ]);
  assert.deepEqual(weekDates(gameDate(new Date("2026-10-26T00:00:00Z"))), [
    "2026-10-28",
    "2026-10-30",
    "2026-11-01",
  ]);
});
test("week crosses year and rejects impossible dates", () => {
  assert.deepEqual(weekDates("2026-01-01"), [
    "2025-12-31",
    "2026-01-02",
    "2026-01-04",
  ]);
  assert.equal(shiftWeek("2026-12-30", 1), "2027-01-06");
  assert.throws(() => weekDates("2026-02-30"));
  assert.throws(() => weekDates("invalid"));
});
test("remaining includes only current members and requested day", () => {
  assert.equal(
    remaining(
      [{ uid: "a" }, { uid: "b" }],
      {
        a: { "2026-10-23": { 1: true, 2: true } },
        retired: { "2026-10-23": { 1: true } },
      },
      "2026-10-23",
    ),
    2,
  );
});
test("CSV escaping protects member names from spreadsheet formulas", () => {
  assert.equal(csvCell("=SUM(A1)"), '"\'=SUM(A1)"');
  assert.equal(csvCell('a"b'), '"a""b"');
});
test("upstream validation rejects duplicates and malformed data", () => {
  assert.throws(() => normalizeGuilds({}));
  assert.throws(() =>
    normalizeMembers({
      members: [
        { uid: "a", userName: "A", level: 1 },
        { uid: "a", userName: "A", level: 1 },
      ],
    }),
  );
  assert.deepEqual(normalizeMembers({ members: [] }), []);
  assert.throws(() =>
    normalizeMembers({ members: [{ uid: "../x", userName: "A", level: 1 }] }),
  );
});
