import { mkdir, writeFile } from 'node:fs/promises';
import { EnvHttpProxyAgent, fetch } from 'undici';
import { REFERENCE_MEMBERS_URL } from '../shared/pvp.mjs';
import { snapshotGuildIds, updateSnapshots } from '../shared/pvp-weekly.mjs';

const directory = 'pvp-snapshot/pvp-cache';
const agent = new EnvHttpProxyAgent();
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
  const summary = await updateSnapshots({
    ids,
    pause: () => new Promise(resolve => setTimeout(resolve, 300)),
    fetchMembers: gid => json(REFERENCE_MEMBERS_URL.replace('{gid}', encodeURIComponent(gid))),
    save: (gid, data) => writeFile(`${directory}/${gid}.json`, JSON.stringify(data)),
  });
  await writeFile(`${directory}/status.json`, JSON.stringify({ attemptedAt: new Date().toISOString(), ...summary }));
  console.log(`PvP weekly update: ${summary.successes} updated, ${summary.failures} failed, ${summary.skipped} skipped; previous files are kept on failure`);
} finally { await agent.close(); }
