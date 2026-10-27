import { mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { EnvHttpProxyAgent, fetch } from 'undici';
import { REFERENCE_MEMBERS_URL } from '../shared/pvp.mjs';
import { snapshotGuildIds, refreshWeeklySnapshots } from '../shared/pvp-weekly.mjs';

const directory = 'pvp-snapshot/pvp-cache';
const agent = new EnvHttpProxyAgent();
async function writeSnapshot(path, data) {
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(data));
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force:true });
  }
}
async function json(url, timeout = 15000) {
  const response = await fetch(url, { dispatcher: agent, signal: AbortSignal.timeout(timeout), headers: { accept:'application/json', 'user-agent':'line-rangers-guildwar/1.0 (weekly public rank cache)' } });
  if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}`); }
  const body = await response.text();
  if (body.length > 10_000_000) throw new Error('応答が大きすぎます');
  return JSON.parse(body);
}
try {
  const catalog = await json('https://line-rangers-fan.github.io/line-rangers-guildwar/data/rosters.json', 30000);
  const ids = snapshotGuildIds(catalog);
  if (!ids.length) throw new Error('ギルド一覧が空です');
  await mkdir(directory, { recursive: true });
  const summary = await refreshWeeklySnapshots({
    ids,
    pause: () => new Promise(resolve => setTimeout(resolve, 300)),
    beforeRetry: () => new Promise(resolve => setTimeout(resolve, 2000)),
    fetchMembers: (gid, attempt) => json(REFERENCE_MEMBERS_URL.replace('{gid}', encodeURIComponent(gid)), attempt === 1 ? 15000 : 30000),
    save: (gid, data) => writeSnapshot(`${directory}/${gid}.json`, data),
  });
  await writeSnapshot(`${directory}/status.json`, { attemptedAt: new Date().toISOString(), ...summary });
  console.log(`PvP weekly update: ${summary.successes} updated, ${summary.failures} failed, ${summary.skipped} skipped; previous files are kept on failure`);
} finally { await agent.close(); }
