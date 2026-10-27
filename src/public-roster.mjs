import { validId } from '../shared/domain.mjs';
export function catalogRoster(catalog, gid) {
  const row = catalog?.guilds?.[gid];
  if (!row || !(row.rank >= 1 && row.rank <= 200)) return null;
  const members = row.members;
  if (!Array.isArray(members) || members.length > 50 || new Set(members.map(m=>m.uid)).size !== members.length || members.some(m=>!validId(m.uid) || typeof m.userName !== 'string' || !m.userName.trim() || !Number.isInteger(m.level) || m.level < 1 || m.level > 10000)) return null;
  return row;
}

export async function loadRosterWithFallback({ api, gid, signal, token = '', catalogURL, fetchCatalog = fetch }) {
  let current;
  try { current = await api(`/api/guilds/${gid}/members`, { signal }); }
  catch(e) {
    if (e.name === 'AbortError') throw e;
    current = {members:[],needsSetup:true,stale:true,warning:e.message};
  }
  // An intentionally empty manual roster is still a saved roster.
  if (current.members?.length || current.mode === 'manual') return current;
  try {
    const response = await fetchCatalog(catalogURL, { signal });
    if (!response.ok) return current;
    const candidate = catalogRoster(await response.json(), gid);
    if (!candidate || signal?.aborted) return current;
    if (!candidate.members.length) return { ...current, needsSetup:true, stale:true, warning:"配信元の公開名簿にメンバーがまだ収録されていません。", publicObservedAt:candidate.observedAt };
    // A participant may have registered a roster while the catalog downloaded.
    const latest = await api(`/api/guilds/${gid}/members`, { signal });
    if (latest.members?.length || latest.mode === 'manual' || signal?.aborted) return latest;
    current = latest;
    let saved;
    try {
      saved = await api(`/api/guilds/${gid}/roster`, {
        method:'PUT', signal,
        headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) },
        body:JSON.stringify({members:candidate.members}),
      });
    } catch(e) {
      if (e.name === 'AbortError') throw e;
      return {...current, needsSetup:true, stale:true, warning:`公開名簿は取得できましたが保存できませんでした。${e.message}`};
    }
    return {...saved, publicObservedAt:candidate.observedAt, reportedMemberCount:candidate.reportedMemberCount, publicIncomplete:candidate.incomplete};
  } catch(e) {
    if (e.name === 'AbortError') throw e;
    return current;
  }
}

const personalRosterKey = (gid) => `guildwar-personal-roster:${gid}`;
export async function loadPersonalRoster({gid, signal, catalogURL, storage = localStorage}) {
  const raw = storage.getItem(personalRosterKey(gid));
  if (raw) {
    const members = JSON.parse(raw);
    if (!catalogRoster({guilds:{[gid]:{rank:1,members}}}, gid)) throw new Error('保存した名簿を読み込めません');
    return {members, mode:'manual', source:'browser', stale:false};
  }
  try {
    const response = await fetch(catalogURL, {signal});
    if (!response.ok) throw new Error('公開名簿を取得できません');
    const row = catalogRoster(await response.json(), gid);
    if (!row) throw new Error('公開名簿を取得できません');
    return {members:row.members, mode:'public', source:row.source, needsSetup:!row.members.length, publicObservedAt:row.observedAt, publicIncomplete:row.incomplete, reportedMemberCount:row.reportedMemberCount};
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    return {members:[], needsSetup:true, stale:true, warning:'公開名簿を取得できません。メンバーを手動で登録できます。'};
  }

}
export function savePersonalRoster(gid, members, storage = localStorage) {
  if (!catalogRoster({guilds:{[gid]:{rank:1,members}}}, gid)) throw new Error('名簿の形式が正しくありません');
  storage.setItem(personalRosterKey(gid), JSON.stringify(members));
  return {members, mode:'manual', source:'browser', stale:false};
}
