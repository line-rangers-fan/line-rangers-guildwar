import { validId } from '../shared/domain.mjs';
import { rosterCandidates } from '../shared/roster-additions.mjs';
export function catalogRoster(catalog, gid) {
  const row = catalog?.guilds?.[gid];
  if (!row || !(row.rank >= 1 && row.rank <= 200)) return null;
  const members = row.members;
  if (!Array.isArray(members) || members.length > 50 || new Set(members.map(m=>m.uid)).size !== members.length || members.some(m=>!validId(m.uid) || typeof m.userName !== 'string' || !m.userName.trim() || !Number.isInteger(m.level) || m.level < 1 || m.level > 10000)) return null;
  return row;
}

export async function loadRosterWithFallback({ api, gid, signal, token = '', catalogURL, fetchCatalog = fetch }) {
  let current;
  try { current = await api(`/api/guilds/${gid}/members?include_pvp=0`, { signal }); }
  catch(e) {
    if (e.name === 'AbortError') throw e;
    current = {members:[],needsSetup:true,stale:true,warning:e.message};
  }
  // Update existing rosters only by an atomic append; never replace manual edits.
  if (current.members?.length) {
    try {
      const response = await fetchCatalog(catalogURL, { signal, cache: 'no-cache' });
      if (!response.ok) throw new Error('公開名簿を取得できません。');
      const candidate = catalogRoster(await response.json(), gid);
      if (!candidate) throw new Error('公開名簿を確認できません。');
      const observed = Date.parse(candidate.observedAt);
      if (!Number.isFinite(observed) || Date.now() - observed > 48 * 3600000 || observed > Date.now() + 300000)
        throw new Error('公開名簿の日時が古いか不明です。');
      const diff = rosterCandidates(current.members, candidate.members);
      const info = { publicObservedAt:candidate.observedAt, reportedMemberCount:candidate.reportedMemberCount, publicIncomplete:candidate.incomplete };
      if (!diff.additions.length) return {...current, ...info};
      if (candidate.incomplete || diff.missing.length || diff.ambiguous.length || current.members.length + diff.additions.length > 50 || !current.updatedAt)
        return {...current, ...info, stale:true, warning:'公開名簿に未登録の候補があります。改名・脱退・同名や人数を「名簿を管理」で確認してください。'};
      const saved = await api(`/api/guilds/${gid}/roster-additions`, {
        method:'POST', signal,
        headers:{'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {})},
        body:JSON.stringify({updatedAt:current.updatedAt, members:diff.additions.map(({userName,level}) => ({userName,level}))}),
      });
      return {...saved, ...info};
    } catch(e) {
      if (e.name === 'AbortError') throw e;
      return {...current, stale:true, warning:`公開名簿の自動確認を完了できませんでした。${e.message}`};
    }
  }
  // An intentionally empty manual roster is still a saved roster.
  if (current.mode === 'manual') return current;
  try {
    const response = await fetchCatalog(catalogURL, { signal });
    if (!response.ok) return current;
    const candidate = catalogRoster(await response.json(), gid);
    if (!candidate || signal?.aborted) return current;
    if (!candidate.members.length) return { ...current, needsSetup:true, stale:true, warning:"配信元の公開名簿にメンバーがまだ収録されていません。", publicObservedAt:candidate.observedAt };
    // A participant may have registered a roster while the catalog downloaded.
    const latest = await api(`/api/guilds/${gid}/members?include_pvp=0`, { signal });
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

