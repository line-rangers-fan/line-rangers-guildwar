import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { EnvHttpProxyAgent, fetch } from 'undici';
import { publicRankings, readCompactSnapshot, selectRoster, RANKING_URL, RANGERBOOK_BASE } from '../shared/rangerbook.mjs';
const maxAge = 48 * 3600000;
const agent = new EnvHttpProxyAgent();
async function download(url) {
  const r = await fetch(url, { dispatcher: agent, signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
  return r;
}
const catalog = { generatedAt: new Date().toISOString(), guilds: {} };
try {
  const ranking = publicRankings(await (await download(RANKING_URL)).json(), maxAge);
  for (const tier of ['LEGEND','MASTER']) {
    try {
      const source = `${RANGERBOOK_BASE}/guildwar_data_${tier}.json`;
      const snapshot = await readCompactSnapshot(await download(source), maxAge);
      for (const g of ranking.guilds.filter(g => g.tier === tier && g.rank >= 1 && g.rank <= 200)) {
        try {
          const { members, observedAt } = selectRoster(ranking, snapshot, g.gid, maxAge);
          const seen = new Map();
          catalog.guilds[g.gid] = { name:g.guildName, rank:g.rank, observedAt, source, members:members.map(m => {
            const occurrence = seen.get(m.name) || 0;
            seen.set(m.name, occurrence + 1);
            return { uid:'rb-'+createHash('sha256').update(JSON.stringify([g.gid,m.name,occurrence])).digest('hex').slice(0,32), userName:m.name, level:m.level, pvpLeaguePhase:'' };
          }) };
        } catch (e) { console.warn(`Skipped guild ${g.rank}: ${e.message}`); }
      }
    } catch(e) { console.warn(`${tier} catalog unavailable: ${e.message}`); }
  }
} catch(e) { console.warn(`Roster catalog unavailable: ${e.message}`); }
await mkdir('pages-dist/data', { recursive:true });
await writeFile('pages-dist/data/rosters.json', JSON.stringify(catalog));
await mkdir('pages-dist/data/rosters', { recursive:true });
for (const [gid, row] of Object.entries(catalog.guilds)) await writeFile(`pages-dist/data/rosters/${gid}.json`, JSON.stringify({guilds:{[gid]:row}}));
console.log(`Published compact roster catalog: ${Object.keys(catalog.guilds).length} guilds`);
await agent.close();
