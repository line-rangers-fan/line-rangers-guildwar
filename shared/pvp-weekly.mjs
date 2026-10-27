import { validId } from './domain.mjs';
import { normalizeReferenceMembers } from './pvp.mjs';

export function snapshotGuildIds(catalog) {
  if (!catalog || typeof catalog.guilds !== 'object' || Array.isArray(catalog.guilds)) throw new Error('ギルド一覧が不正です');
  return Object.entries(catalog.guilds)
    .filter(([gid, row]) => validId(gid) && row?.rank >= 1 && row.rank <= 200)
    .sort((a, b) => a[1].rank - b[1].rank)
    .slice(0, 200).map(([gid]) => gid);
}
export function validatePvpSnapshot(data, gid) {
  if (data?.version !== 1 || data.gid !== gid || typeof data.fetchedAt !== 'string' || !Number.isFinite(Date.parse(data.fetchedAt))) throw new Error('保存済みPvPデータが不正です');
  const members = normalizeReferenceMembers(data.members);
  if (!members.length) throw new Error('PvPデータが空です');
  return { gid, members, fetchedAt: data.fetchedAt };
}
export async function updateSnapshots({ ids, fetchMembers, save, now = () => new Date(), concurrency = 2, maxFailures = 10, pause = async () => {}, onFailure = () => {}, allowAllFailed = false }) {
  let cursor = 0, consecutiveFailures = 0, successes = 0, failures = 0, skipped = 0;
  async function worker() {
    while (cursor < ids.length && consecutiveFailures < maxFailures) {
      const gid = ids[cursor++];
      try {
        const raw = await fetchMembers(gid);
        const snapshot = { version: 1, gid, fetchedAt: now().toISOString(), members: normalizeReferenceMembers(raw) };
        validatePvpSnapshot(snapshot, gid);
        await save(gid, snapshot);
        successes++; consecutiveFailures = 0;
      } catch (error) {
        failures++; consecutiveFailures++;
        onFailure(gid, error);
        console.warn(`PvP snapshot ${gid}: ${error.message}`);
      }
      await pause();
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(4, concurrency)) }, worker));
  skipped = ids.length - cursor;
  if (!successes && !allowAllFailed) throw new Error('PvPランクを1件も取得できませんでした。以前の保存データを維持します。');
  return { successes, failures, skipped };
}

// Retry only failed or not-yet-attempted guilds once. Never refetch a success.
export async function refreshWeeklySnapshots({ ids, fetchMembers, beforeRetry = async () => {}, ...options }) {
  const failed = [];
  const first = await updateSnapshots({ ...options, ids, fetchMembers: gid => fetchMembers(gid, 1), onFailure: gid => failed.push(gid), allowAllFailed: true });
  const remaining = [...failed, ...ids.slice(ids.length - first.skipped)];
  let summary = first;
  if (remaining.length) {
    await beforeRetry();
    const retry = await updateSnapshots({ ...options, ids: remaining, fetchMembers: gid => fetchMembers(gid, 2), allowAllFailed: true });
    summary = { successes:first.successes + retry.successes, failures:retry.failures, skipped:retry.skipped };
  }
  if (!summary.successes) throw new Error('PvPランクを1件も取得できませんでした。以前の保存データを維持します。');
  return summary;
}
