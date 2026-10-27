export function createD1Store(db) {
  return {
    async createIsolatedBoard(id, gid, members, entries) {
      const now = new Date().toISOString();
      const statements = [db.prepare("INSERT INTO isolated_boards VALUES(?,?,?,?)").bind(id,gid,JSON.stringify(members),now), ...entries.map(e=>db.prepare("INSERT INTO checks VALUES(?,?,?,?,?,?,?)").bind(id,"ally",e.uid,e.day,e.slot,1,now))];
      try { await db.batch(statements); return true; } catch (e) { if (await this.getIsolatedBoard(id)) return false; throw e; }
    },
    async getIsolatedBoard(id) { const r=await db.prepare("SELECT gid,payload FROM isolated_boards WHERE id=?").bind(id).first(); return r ? {gid:r.gid,members:JSON.parse(r.payload)} : null; },
    async putIsolatedRoster(id, members) { await db.prepare("UPDATE isolated_boards SET payload=? WHERE id=?").bind(JSON.stringify(members),id).run(); },
    async listLocalGuilds() {
      return (
        await db.prepare("SELECT payload FROM local_guilds ORDER BY gid").all()
      ).results.map((r) => JSON.parse(r.payload));
    },
    async putLocalGuild(g) {
      await db
        .prepare(
          "INSERT INTO local_guilds VALUES(?,?) ON CONFLICT(gid) DO UPDATE SET payload=excluded.payload",
        )
        .bind(g.gid, JSON.stringify(g))
        .run();
    },
    async getRoster(gid) {
      const r = await db
        .prepare("SELECT * FROM rosters WHERE gid=?")
        .bind(gid)
        .first();
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
    async putRoster(gid, data, mode = "manual", observedAt = null) {
      const now = new Date().toISOString();
      await db
        .prepare(
          "INSERT INTO rosters VALUES(?,?,?,?,?) ON CONFLICT(gid) DO UPDATE SET payload=excluded.payload,mode=excluded.mode,observed_at=excluded.observed_at,updated_at=excluded.updated_at",
        )
        .bind(gid, JSON.stringify(data), mode, observedAt, now)
        .run();
      return this.getRoster(gid);
    },
    async getCache(key) {
      const r = await db
        .prepare("SELECT * FROM cache WHERE key=?")
        .bind(key)
        .first();
      return r
        ? {
            data: JSON.parse(r.payload),
            source: r.source,
            fetchedAt: r.fetched_at,
          }
        : null;
    },
    async putCache(key, data, source) {
      const fetchedAt = new Date().toISOString();
      await db
        .prepare(
          "INSERT INTO cache VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,source=excluded.source,fetched_at=excluded.fetched_at",
        )
        .bind(key, JSON.stringify(data), source, fetchedAt)
        .run();
      return { data, source, fetchedAt };
    },
    async getChecks(gid, team, from, to) {
      const rows = (
        await db
          .prepare(
            "SELECT uid,day,slot,checked FROM checks WHERE gid=? AND team=? AND day>=? AND day<=?",
          )
          .bind(gid, team, from, to)
          .all()
      ).results;
      const result = Object.create(null);
      for (const r of rows) {
        result[r.uid] ??= Object.create(null);
        result[r.uid][r.day] ??= Object.create(null);
        result[r.uid][r.day][r.slot] = Boolean(r.checked);
      }
      return result;
    },
    async mergeChecks(gid, entries) {
      const now = new Date().toISOString();
      for (let i = 0; i < entries.length; i += 80) {
        await db.batch(entries.slice(i, i + 80).map((e) => db.prepare("INSERT INTO checks VALUES(?,?,?,?,?,?,?) ON CONFLICT(gid,team,uid,day,slot) DO UPDATE SET checked=1,updated_at=excluded.updated_at").bind(gid, "ally", e.uid, e.day, e.slot, 1, now)));
      }
    },
    async saveCheck({ gid, team, uid, day, slot, checked }) {
      const now = new Date().toISOString();
      const q = (s, v) =>
        db
          .prepare(
            "INSERT INTO checks VALUES(?,?,?,?,?,?,?) ON CONFLICT(gid,team,uid,day,slot) DO UPDATE SET checked=excluded.checked,updated_at=excluded.updated_at",
          )
          .bind(gid, team, uid, day, s, Number(v), now);
      const list = [q(slot, checked)];
      if (slot === 2 && checked) list.push(q(1, true));
      if (slot === 1 && !checked) list.push(q(2, false));
      await db.batch(list);
    },
  };
}
