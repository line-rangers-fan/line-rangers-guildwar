import { validatePvpSnapshot } from '../shared/pvp-weekly.mjs';

const storageKey = gid => `guildwar-pvp-snapshot:${gid}`;
export function cachedPvp(storage, gid) {
  try { return validatePvpSnapshot(JSON.parse(storage.getItem(storageKey(gid)) || 'null'), gid); }
  catch { return null; }
}
export async function loadPvpSnapshot({ gid, url, storage, fetcher = fetch, signal }) {
  const saved = cachedPvp(storage, gid);
  try {
    const response = await fetcher(url, { signal, cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const snapshot = validatePvpSnapshot(await response.json(), gid);
    // An older CDN response must never replace a newer saved snapshot.
    const newest = saved && Date.parse(saved.fetchedAt) > Date.parse(snapshot.fetchedAt) ? saved : snapshot;
    if (newest === snapshot) {
      try { storage.setItem(storageKey(gid), JSON.stringify({ version:1, ...snapshot })); } catch {}
    }
    return { snapshot:newest, offline:false };
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    return { snapshot:saved, offline:true };
  }
}
export function pvpSnapshotIsStale(fetchedAt, now = new Date()) {
  const shifted = new Date(now.getTime() + 9 * 3600000);
  const saturday = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), 5));
  saturday.setUTCDate(saturday.getUTCDate() - ((shifted.getUTCDay() + 1) % 7));
  let boundary = saturday.getTime() - 9 * 3600000;
  if (now.getTime() < boundary + 3 * 3600000) boundary -= 7 * 86400000;
  return Date.parse(fetchedAt) < boundary;
}
