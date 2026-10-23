const base = process.env.APP_URL || "http://127.0.0.1:3000";
async function read(path) {
  const r = await fetch(base + path, { signal: AbortSignal.timeout(65000) });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}
const h = await read("/api/health");
if (!h.ok) throw new Error("health check failed");
const gs = await read("/api/guilds");
if (!gs.guilds.length) throw new Error("no guilds");
const guild =
  gs.guilds.find((g) => g.name === "ドリチー") ||
  gs.guilds.find((g) => g.nationalFlag === "JP" && g.lastGuildWarRank > 0);
const m = await read(`/api/guilds/${guild.gid}/members`);
const c = await read(`/api/guilds/${guild.gid}/checks`);
console.log(
  JSON.stringify(
    {
      ok: true,
      guildCount: gs.guilds.length,
      guildSource: gs.source,
      guildFetchedAt: gs.fetchedAt,
      memberSource: m.source,
      memberCount: m.members.length,
      week: c.dates,
      stale: gs.stale || m.stale,
    },
    null,
    2,
  ),
);
