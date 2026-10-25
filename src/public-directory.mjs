import { directoryGuilds } from '../shared/personal.mjs';
import { catalogRoster } from './public-roster.mjs';

// The live directory and the public roster feed have different coverage.
// Fill only missing ranks; never replace a live guild with an older catalog row.
export async function loadGuildDirectory({ api, signal, catalogURL, fetchCatalog = fetch }) {
  let response, apiError;
  try {
    response = await api('/api/guilds?limit=500&maxRank=200', { signal });
    response = { ...response, guilds: directoryGuilds(response.guilds, 200) };
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    apiError = error;
    response = { guilds: [], stale: true, fetchedAt: null };
  }
  if (response.guilds.length === 200) return response;
  try {
    const downloaded = await fetchCatalog(catalogURL, { signal });
    if (!downloaded.ok) throw new Error('公開ギルド一覧を取得できません');
    const catalog = await downloaded.json();
    const guilds = [...response.guilds];
    const ids = new Set(guilds.map(g => g.gid));
    const ranks = new Set(guilds.map(g => g.lastGuildWarRank));
    let supplemented = 0;
    for (const gid of Object.keys(catalog.guilds || {})) {
      const row = catalogRoster(catalog, gid);
      if (!row || typeof row.name !== 'string' || !row.name.trim() ||
          !Number.isInteger(row.rank) || ids.has(gid) || ranks.has(row.rank)) continue;
      guilds.push({ gid, name: row.name, lastGuildWarRank: row.rank,
        currentMemberCount: Number.isInteger(row.reportedMemberCount) ? row.reportedMemberCount : row.members.length,
        nationalFlag: '', level: 0, lastGuildWarScore: 0 });
      ids.add(gid);
      ranks.add(row.rank);
      supplemented++;
    }
    if (apiError && !guilds.length) throw apiError;
    return { ...response, guilds: directoryGuilds(guilds, 200), catalogSupplemented: supplemented,
      catalogGeneratedAt: catalog.generatedAt,
      ...(apiError ? { warning: '一覧の取得先に接続できないため、公開カタログのギルド一覧を表示しています。' } : {}) };
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    if (apiError) throw apiError;
    return response;
  }
}
