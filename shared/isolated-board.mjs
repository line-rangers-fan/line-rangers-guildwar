import { validId, weekDates } from './domain.mjs';
import { validateShare } from './boards.mjs';
import { normalizeMembers } from './sources.mjs';

export function validBoardKey(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value); }
export async function boardKeyHash(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return 'board-' + Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
function roster(input) {
  const data = normalizeMembers({members:input});
  if (data.length > 50 || data.some(m => !m.userName.trim() || m.userName.length > 100 || !Number.isInteger(m.level) || m.level < 1 || m.level > 10000 || m.pvpLeaguePhase.length > 40)) throw new Error('名簿の形式が正しくありません');
  return data.map(m => ({...m, userName:m.userName.trim()}));
}
export async function boardAction(store, key, method, action, input = {}) {
  if (!validBoardKey(key)) return {status:404, body:{error:'共有リンクが正しくありません'}};
  const id = await boardKeyHash(key);
  if (action === 'create' && method === 'POST') {
    if (!validId(input.gid)) return {status:400, body:{error:'ギルドIDが正しくありません'}};
    const members = roster(input.members);
    const checked = validateShare(input, members);
    const created = await store.createIsolatedBoard(id, input.gid, members, checked.entries);
    if (!created) return {status:409, body:{error:'共有リンクを作成できませんでした。再試行してください'}};
    return {status:201, body:{gid:input.gid, members, states:await store.getChecks(id, 'ally', checked.dates[0], checked.dates[2])}};
  }
  const board = await store.getIsolatedBoard(id);
  if (!board) return {status:404, body:{error:'共有リンクが見つかりません'}};
  if (action === 'board' && method === 'GET') {
    const dates = weekDates(input.week);
    return {status:200, body:{gid:board.gid, members:board.members, states:await store.getChecks(id, 'ally', dates[0], dates[2])}};
  }
  if (action === 'roster' && method === 'PUT') {
    const members = roster(input.members);
    await store.putIsolatedRoster(id, members);
    return {status:200, body:{members, mode:'manual', source:'shared:board', stale:false}};
  }
  if (action === 'check' && method === 'PUT') {
    const {uid,day,slot,checked}=input;
    const dates=weekDates(day);
    if (!board.members.some(m=>m.uid===uid) || !dates.includes(day) || ![1,2].includes(slot) || typeof checked!=='boolean') throw new Error('チェック内容が正しくありません');
    await store.saveCheck({gid:id,team:'ally',uid,day,slot,checked});
    return {status:200,body:{states:await store.getChecks(id,'ally',dates[0],dates[2])}};
  }
  return {status:404,body:{error:'操作が見つかりません'}};
}
