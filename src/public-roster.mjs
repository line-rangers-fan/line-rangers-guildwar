import { validId } from '../shared/domain.mjs';
export function catalogRoster(catalog, gid, now = Date.now()) {
  const row = catalog?.guilds?.[gid];
  const age = now - Date.parse(row?.observedAt);
  if (!row || !Number.isFinite(age) || age < -300000 || age > 48 * 3600000 || !(row.rank >= 1 && row.rank <= 200)) return null;
  const members = row.members;
  if (!Array.isArray(members) || !members.length || members.length > 50 || new Set(members.map(m=>m.uid)).size !== members.length || members.some(m=>!validId(m.uid) || typeof m.userName !== 'string' || !m.userName.trim() || !Number.isInteger(m.level) || m.level < 1 || m.level > 10000)) return null;
  return row;
}

export async function loadRosterWithFallback({ api, gid, signal, token = '', catalogURL, fetchCatalog = fetch }) {
  const current = await api(`/api/guilds/${gid}/members`, { signal });
  if (current.members?.length || !current.needsSetup) return current;
  try {
    const response = await fetchCatalog(catalogURL, { signal });
    if (!response.ok) return current;
    const candidate = catalogRoster(await response.json(), gid);
    if (!candidate || signal?.aborted) return current;
    // A participant may have registered a roster while the catalog downloaded.
    const latest = await api(`/api/guilds/${gid}/members`, { signal });
    if (latest.members?.length || !latest.needsSetup || signal?.aborted) return latest;
    const saved = await api(`/api/guilds/${gid}/roster`, {
      method:'PUT', signal,
      headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) },
      body:JSON.stringify({members:candidate.members}),
    });
    return {...saved, publicObservedAt:candidate.observedAt};
  } catch(e) {
    if (e.name === 'AbortError') throw e;
    return current;
  }
}
