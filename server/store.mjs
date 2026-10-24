import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export function openStore(path) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS checks(gid TEXT NOT NULL,team TEXT NOT NULL,uid TEXT NOT NULL,day TEXT NOT NULL,slot INTEGER NOT NULL CHECK(slot IN(1,2)), checked INTEGER NOT NULL CHECK(checked IN(0,1)),updated_at TEXT NOT NULL, PRIMARY KEY(gid,team,uid,day,slot));
    CREATE TABLE IF NOT EXISTS cache(key TEXT PRIMARY KEY,payload TEXT NOT NULL,source TEXT NOT NULL,fetched_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS local_guilds(gid TEXT PRIMARY KEY,payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rosters(gid TEXT PRIMARY KEY,payload TEXT NOT NULL,mode TEXT NOT NULL,observed_at TEXT,updated_at TEXT NOT NULL);`);
  return {
    listLocalGuilds() {
      return db
        .prepare("SELECT payload FROM local_guilds ORDER BY gid")
        .all()
        .map((r) => JSON.parse(r.payload));
    },
    putLocalGuild(guild) {
      db.prepare(
        "INSERT INTO local_guilds VALUES(?,?) ON CONFLICT(gid) DO UPDATE SET payload=excluded.payload",
      ).run(guild.gid, JSON.stringify(guild));
    },
    getRoster(gid) {
      const r = db.prepare("SELECT * FROM rosters WHERE gid=?").get(gid);
      return r
        ? {
            data: JSON.parse(r.payload),
            mode: r.mode,
            fetchedAt: r.observed_at,
            updatedAt: r.updated_at,
            source: "local:roster",
            stale: false,
          }
        : null;
    },
    putRoster(gid, data, mode = "manual", observedAt = null) {
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO rosters VALUES(?,?,?,?,?) ON CONFLICT(gid) DO UPDATE SET payload=excluded.payload,mode=excluded.mode,observed_at=excluded.observed_at,updated_at=excluded.updated_at",
      ).run(gid, JSON.stringify(data), mode, observedAt, now);
      return this.getRoster(gid);
    },
    migrateCachedRosters() {
      const guilds = this.getCache("guilds")?.data || [];
      for (const row of db
        .prepare("SELECT * FROM cache WHERE key LIKE 'members:%'")
        .all()) {
        const gid = row.key.slice(8);
        if (this.getRoster(gid)) continue;
        this.putRoster(
          gid,
          JSON.parse(row.payload),
          "snapshot",
          row.fetched_at,
        );
        const guild = guilds.find((g) => g.gid === gid);
        if (guild) this.putLocalGuild(guild);
      }
    },
    getChecks(gid, team, from, to) {
      const rows = db
        .prepare(
          "SELECT uid,day,slot,checked FROM checks WHERE gid=? AND team=? AND day>=? AND day<=?",
        )
        .all(gid, team, from, to);
      const result = Object.create(null);
      for (const r of rows) {
        result[r.uid] ??= Object.create(null);
        result[r.uid][r.day] ??= Object.create(null);
        result[r.uid][r.day][r.slot] = Boolean(r.checked);
      }
      return result;
    },
    saveCheck({ gid, team, uid, day, slot, checked }) {
      const q = db.prepare(
        "INSERT INTO checks VALUES(?,?,?,?,?,?,?) ON CONFLICT(gid,team,uid,day,slot) DO UPDATE SET checked=excluded.checked,updated_at=excluded.updated_at",
      );
      const now = new Date().toISOString();
      db.exec("BEGIN IMMEDIATE");
      try {
        q.run(gid, team, uid, day, slot, Number(checked), now);
        if (slot === 2 && checked) q.run(gid, team, uid, day, 1, 1, now);
        if (slot === 1 && !checked) q.run(gid, team, uid, day, 2, 0, now);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    mergeChecks(gid, entries) {
      const now = new Date().toISOString();
      const q = db.prepare("INSERT INTO checks VALUES(?,?,?,?,?,?,?) ON CONFLICT(gid,team,uid,day,slot) DO UPDATE SET checked=1,updated_at=excluded.updated_at");
      db.exec("BEGIN IMMEDIATE");
      try {
        for (const e of entries) q.run(gid, "ally", e.uid, e.day, e.slot, 1, now);
        db.exec("COMMIT");
      } catch (e) { db.exec("ROLLBACK"); throw e; }
    },
    getCache(key) {
      const r = db.prepare("SELECT * FROM cache WHERE key=?").get(key);
      return r
        ? {
            data: JSON.parse(r.payload),
            source: r.source,
            fetchedAt: r.fetched_at,
          }
        : null;
    },
    putCache(key, data, source) {
      const fetchedAt = new Date().toISOString();
      db.prepare(
        "INSERT INTO cache VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,source=excluded.source,fetched_at=excluded.fetched_at",
      ).run(key, JSON.stringify(data), source, fetchedAt);
      return { data, source, fetchedAt };
    },
    close() {
      db.close();
    },
  };
}
