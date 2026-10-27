import { resultEntries } from '../shared/results.mjs';
async function resultKey(gid, boardKey, slot) {
  const input = new TextEncoder().encode('guildwar-results-v1\u0000' + gid + '\u0000' + (boardKey || 'legacy') + '\u0000' + slot);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
function options(key, method, payload, signal) {
  return { method, signal, headers: { 'Content-Type':'application/json', 'x-board-key':key }, ...(payload === undefined ? {} : { body:JSON.stringify(payload) }) };
}
export async function readSharedResults({ api, gid, boardKey, week, signal }) {
  return Promise.all([1, 2].map(async slot => {
    const key = await resultKey(gid, boardKey, slot);
    try {
      const r = await api('/api/boards?week=' + encodeURIComponent(week), options(key, 'GET', undefined, signal));
      if (r.gid !== gid) throw new Error('勝敗データのギルドが一致しません。');
      return r.states || {};
    } catch (error) {
      if (error.status === 404) return {};
      throw error;
    }
  }));
}
async function createResultBoard({ api, gid, boardKey, week, members, slot, entries = [] }) {
  const key = await resultKey(gid, boardKey, slot);
  try {
    await api('/api/boards', options(key, 'POST', { gid, members, week, entries }));
  } catch (error) {
    if (error.status !== 409) throw error;
    const existing = await api('/api/boards?week=' + encodeURIComponent(week), options(key, 'GET'));
    if (existing.gid !== gid) throw new Error('勝敗データのギルドが一致しません。');
  }
  return key;
}
export async function writeSharedResult({ api, gid, boardKey, week, members, uid, day, slot, value }) {
  const key = await createResultBoard({ api, gid, boardKey, week, members, slot });
  await api('/api/boards/roster', options(key, 'PUT', {members}));
  const write = (bit, checked) => api('/api/boards/check', options(key, 'PUT', {uid, day, slot:bit, checked}));
  if (value === 'win') return (await write(2, true)).states;
  if (value === 'loss') {
    await write(1, true);
    return (await write(2, false)).states;
  }
  return (await write(1, false)).states;
}
export async function copySharedResults({ api, gid, boardKey, week, members, dates, states, results }) {
  for (const slot of [1, 2]) {
    const entries = resultEntries(states, results, members, dates, slot);
    if (entries.length) await createResultBoard({ api, gid, boardKey, week, members, slot, entries });
  }
}
